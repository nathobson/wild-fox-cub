/** An uploaded image and the responsive sizes generated for it. */
export interface MediaItem {
  /** Content hash of the original file. */
  id: string;
  filename: string;
  /** Default alt text, used when a block doesn't set its own. */
  alt: string;
  width: number;
  height: number;
  /** MIME type of the original. */
  format: string;
  /** Widths generated in every format (empty for GIFs, which keep only the original). */
  widths: number[];
  /** Format for browsers without AVIF/WebP: png keeps transparency, otherwise jpg. */
  fallback: 'jpg' | 'png';
  size: number;
  createdAt: string;
}

/** Generated widths, capped at the original's width. */
export const BREAKPOINTS = [480, 800, 1200, 1600, 2400];

export const VARIANT_FORMATS = ['avif', 'webp'] as const;

export const ORIGINAL_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export const variantUrl = (id: string, width: number, ext: string) => `/media/${id}/${width}.${ext}`;

export const originalUrl = (item: MediaItem) => `/media/${item.id}/original.${ORIGINAL_EXTENSIONS[item.format]}`;

/** A small preview, for thumbnails in the editor. */
export const thumbUrl = (item: MediaItem) =>
  item.widths.length ? variantUrl(item.id, item.widths[0], 'webp') : originalUrl(item);

/**
 * `sizes` values for each layout, matching public/site.css: sections have 48px side
 * padding (22px when the page is under 700px wide) around a max-width column.
 */
export function sizesFor(maxWidth: number | 'full') {
  if (maxWidth === 'full') return '100vw';
  return `(min-width: ${maxWidth + 96}px) ${maxWidth}px, (min-width: 700px) calc(100vw - 96px), calc(100vw - 44px)`;
}
