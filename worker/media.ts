import {
  BREAKPOINTS,
  ORIGINAL_EXTENSIONS,
  VARIANT_FORMATS,
  type MediaItem,
} from '../src/lib/media';

/*
 * Images are processed once, at upload: Cloudflare Images generates every size in
 * AVIF, WebP and a JPEG/PNG fallback, and everything is stored in R2. Serving is a
 * plain R2 read with a year-long immutable cache (file names never change).
 */

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const QUALITY = { avif: 60, webp: 78, jpg: 82, png: 90 } as const;
const MIME = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' } as const;

type Row = Omit<MediaItem, 'widths'> & { widths: string };

const toItem = (row: Row): MediaItem => ({ ...row, widths: JSON.parse(row.widths) as number[] });

export class UploadError extends Error {}

const bytesStream = (bytes: ArrayBuffer) => new Response(bytes).body!;

async function contentId(bytes: ArrayBuffer) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest.slice(0, 10)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function listMedia(db: D1Database) {
  const { results } = await db.prepare('SELECT * FROM media ORDER BY createdAt DESC').all<Row>();
  return results.map(toItem);
}

async function getMedia(db: D1Database, id: string) {
  const row = await db.prepare('SELECT * FROM media WHERE id = ?').bind(id).first<Row>();
  return row ? toItem(row) : null;
}

export async function uploadMedia(env: Env, file: File, userId: string): Promise<MediaItem> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError('Images must be 20 MB or smaller.');
  const bytes = await file.arrayBuffer();
  const id = await contentId(bytes);

  // Same file uploaded before: reuse it.
  const existing = await getMedia(env.DB, id);
  if (existing) return existing;

  const info = await env.IMAGES.info(bytesStream(bytes)).catch(() => {
    throw new UploadError('That file is not an image Fox Cub can read.');
  });
  if (!('width' in info) || !ORIGINAL_EXTENSIONS[info.format]) {
    // SVG is refused on purpose: served from this origin it could run scripts.
    throw new UploadError('Use a JPEG, PNG, WebP, AVIF or GIF image.');
  }

  const prefix = `media/${id}`;
  await env.MEDIA.put(`${prefix}/original.${ORIGINAL_EXTENSIONS[info.format]}`, bytes, {
    httpMetadata: { contentType: info.format },
  });

  // GIFs keep only the original so animation survives.
  const isGif = info.format === 'image/gif';
  const fallback: MediaItem['fallback'] = info.format === 'image/png' ? 'png' : 'jpg';
  const max = Math.min(info.width, BREAKPOINTS[BREAKPOINTS.length - 1]);
  const widths = isGif ? [] : [...BREAKPOINTS.filter((w) => w < max), max];

  for (const width of widths) {
    await Promise.all(
      [...VARIANT_FORMATS, fallback].map(async (ext: keyof typeof MIME) => {
        const result = await env.IMAGES.input(bytesStream(bytes))
          .transform({ width })
          .output({ format: MIME[ext], quality: QUALITY[ext] });
        // R2 needs a known length, so buffer each (small) variant.
        const body = await result.response().arrayBuffer();
        await env.MEDIA.put(`${prefix}/${width}.${ext}`, body, { httpMetadata: { contentType: MIME[ext] } });
      }),
    );
  }

  const item: MediaItem = {
    id,
    filename: file.name.slice(0, 200) || 'image',
    alt: '',
    width: info.width,
    height: info.height,
    format: info.format,
    widths,
    fallback,
    size: file.size,
    createdAt: new Date().toISOString(),
  };
  await env.DB.prepare(
    `INSERT OR IGNORE INTO media (id, filename, alt, width, height, format, widths, fallback, size, createdAt, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, item.filename, '', item.width, item.height, item.format, JSON.stringify(widths), fallback, item.size, item.createdAt, userId)
    .run();
  return item;
}

export async function updateMediaAlt(db: D1Database, id: string, alt: string) {
  await db.prepare('UPDATE media SET alt = ? WHERE id = ?').bind(alt.slice(0, 500), id).run();
}

/** Deletes an image unless the draft or live site still uses it. */
export async function deleteMedia(env: Env, id: string): Promise<string | null> {
  const used = await env.DB.prepare("SELECT id FROM documents WHERE instr(data, ?) > 0 LIMIT 1")
    .bind(`"mediaId":"${id}"`)
    .first<{ id: string }>();
  if (used) {
    return used.id === 'draft'
      ? 'This image is still used on a page. Remove it from the page first.'
      : 'The live site still uses this image. Publish after removing it from pages, then delete it.';
  }
  const listed = await env.MEDIA.list({ prefix: `media/${id}/` });
  if (listed.objects.length) await env.MEDIA.delete(listed.objects.map((o) => o.key));
  await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
  return null;
}

/** Serves /media/<id>/<file> from R2. */
export async function serveMedia(env: Env, request: Request, key: string): Promise<Response> {
  const object = await env.MEDIA.get(key, { onlyIf: request.headers });
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  // onlyIf matched (If-None-Match etc.): no body to send.
  if (!('body' in object)) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
}

export { getMedia };
