import { renderToStaticMarkup } from 'react-dom/server';
import { pageScripts, PublicPage } from '../src/components/PublicPage';
import { originalUrl, type MediaItem } from '../src/lib/media';
import { SITE_HEAD, SITE_SCRIPT } from '../src/site';
import { sanitizeRichText } from './sanitize';
import type { Page, Site } from '../src/types';
import { getDocument } from './db';
import { listMedia } from './media';

/*
 * Published pages are rendered to complete HTML documents once, at publish time,
 * and stored in D1. Visitors are served that stored HTML: no React, no hydration.
 */

declare const __BUILD_ID__: string;
/** The site stylesheet's URL: versioned by content in builds (see vite.config.ts). */
declare const __SITE_CSS__: string;

/**
 * Stored pages are re-rendered once when this changes: on every deploy (so markup
 * changes apply) and every new year (so "© year" in footers stays current).
 * Computed per request: in Workers the clock is frozen at 0 during module startup.
 */
const currentBuild = () => `${__BUILD_ID__}:${new Date().getUTCFullYear()}`;
const NOT_FOUND = '*404';
const REDIRECTS = '*redirects';
const DEFAULT_TITLE_TEMPLATE = '{title} — {site}';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** JSON for a <script> tag: "<" escaped so content can't close the tag. */
const jsonForScript = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export function pageTitle(site: Site, page: Page | null) {
  if (!page) return `Page not found — ${site.name}`;
  if (page.seo?.title) return page.seo.title;
  if (page.slug === '/') return site.name;
  const template = site.settings?.titleTemplate || DEFAULT_TITLE_TEMPLATE;
  return template.replace(/\{title\}/g, page.title).replace(/\{site\}/g, site.name);
}

interface RenderContext {
  site: Site;
  media: ReadonlyMap<string, MediaItem>;
  /** Absolute origin for canonical URLs and social images, e.g. https://example.com */
  origin: string;
}

function headTags({ site, media, origin }: RenderContext, page: Page | null) {
  const title = pageTitle(site, page);
  const description = page?.seo?.description ?? '';
  const url = page ? `${origin}${page.slug === '/' ? '' : page.slug}` : '';
  const shareImage = media.get(site.settings?.shareImageId ?? '');
  const tags: string[] = [`<title>${escapeHtml(title)}</title>`];
  const meta = (attr: 'name' | 'property', key: string, content: string | number) =>
    tags.push(`<meta ${attr}="${key}" content="${escapeHtml(String(content))}" />`);

  if (description) meta('name', 'description', description);
  if (!page) return tags;

  tags.push(`<link rel="canonical" href="${escapeHtml(url)}" />`);
  meta('property', 'og:site_name', site.name);
  meta('property', 'og:type', 'website');
  meta('property', 'og:url', url);
  meta('property', 'og:title', title);
  if (description) meta('property', 'og:description', description);
  if (shareImage) {
    meta('property', 'og:image', `${origin}${originalUrl(shareImage)}`);
    meta('property', 'og:image:width', shareImage.width);
    meta('property', 'og:image:height', shareImage.height);
    if (shareImage.alt) meta('property', 'og:image:alt', shareImage.alt);
  }
  meta('name', 'twitter:card', shareImage ? 'summary_large_image' : 'summary');
  meta('name', 'twitter:title', title);
  if (description) meta('name', 'twitter:description', description);

  // Structured data: who the site belongs to, the site itself (home), and this page.
  const sameAs = (site.settings?.links ?? []).map((l) => l.url).filter((u) => /^https?:\/\//.test(u));
  const graph: object[] = [];
  if (page.slug === '/') {
    graph.push({ '@context': 'https://schema.org', '@type': 'Organization', name: site.name, url: origin, ...(sameAs.length ? { sameAs } : {}) });
    graph.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: origin });
  }
  graph.push({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    url,
    ...(description ? { description } : {}),
  });
  for (const item of graph) tags.push(`<script type="application/ld+json">${jsonForScript(item)}</script>`);
  return tags;
}

/**
 * Cross-fade between pages of the site: a cross-document view transition, so no
 * JavaScript. Browsers without support just navigate normally; skipped for
 * people who ask for reduced motion. A site can restyle it in site.css with
 * ::view-transition-old(root) / ::view-transition-new(root).
 */
const PAGE_TRANSITION = '<style>@media (prefers-reduced-motion: no-preference){@view-transition{navigation:auto}}</style>';

function renderPage(ctx: RenderContext, page: Page | null) {
  const body = renderToStaticMarkup(<PublicPage site={ctx.site} page={page} media={ctx.media} />);
  const scripts = pageScripts(page, SITE_SCRIPT);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${headTags(ctx, page).join('\n')}
${SITE_HEAD ? `${SITE_HEAD.trim()}\n` : ''}<link rel="stylesheet" href="${__SITE_CSS__}" />
${PAGE_TRANSITION}
</head>
<body>
${body}
${scripts.map((s) => `<script>${s}</script>`).join('\n')}
</body>
</html>`;
}

/** Renders every page of the published site and replaces the stored HTML. */
export async function renderSite(db: D1Database, site: Site, origin: string) {
  const now = new Date().toISOString();
  const media = new Map((await listMedia(db)).map((item) => [item.id, item]));
  const ctx: RenderContext = { site, media, origin };
  const rows = [
    ...(await Promise.all(
      site.pages.map(async (page) => ({ slug: page.slug, html: await sanitizeRichText(renderPage(ctx, page)), status: 200 })),
    )),
    { slug: NOT_FOUND, html: renderPage(ctx, null), status: 404 },
    // Redirects ride along so serving never needs the site document.
    { slug: REDIRECTS, html: JSON.stringify(site.settings?.redirects ?? []), status: 301 },
  ];
  await db.batch([
    db.prepare('DELETE FROM rendered_pages'),
    ...rows.map((row) =>
      db
        .prepare('INSERT INTO rendered_pages (slug, html, status, build, renderedAt) VALUES (?, ?, ?, ?, ?)')
        .bind(row.slug, row.html, row.status, currentBuild(), now),
    ),
  ]);
}

/** Normalises a request path to a page slug: "/About/" → "/about". */
const toSlug = (pathname: string) => {
  try {
    return decodeURIComponent(pathname).replace(/\/+$/, '').toLowerCase() || '/';
  } catch {
    return pathname;
  }
};

const COMING_SOON = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Coming soon</title>
${SITE_HEAD.trim()}
<style>body{margin:0;min-height:100vh;display:grid;place-content:center;gap:8px;text-align:center;font-family:system-ui,sans-serif;color:#333}h1{margin:0;font-weight:500}p{margin:0;color:#777}</style>
</head>
<body><h1>Coming soon</h1><p>This site has not been published yet.</p></body>
</html>`;

const html = (body: string, status: number) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

type Row = { html: string; status: number; build: string };

/** Serves a stored page; re-renders first if nothing is stored or it predates this deploy. */
export async function servePage(db: D1Database, url: URL): Promise<Response> {
  const slug = toSlug(url.pathname);
  const lookup = (key: string) =>
    db.prepare('SELECT html, status, build FROM rendered_pages WHERE slug = ?').bind(key).first<Row>();

  let row = await lookup(slug);
  const fallback = row ? null : await lookup(NOT_FOUND);
  if ((row ?? fallback)?.build !== currentBuild()) {
    const published = await getDocument(db, 'published');
    if (!published) return html(COMING_SOON, 503);
    await renderSite(db, JSON.parse(published.data) as Site, url.origin);
    row = await lookup(slug);
  }
  if (row) return html(row.html, row.status);

  // Not a page: an old URL with a redirect?
  const redirects = JSON.parse((await lookup(REDIRECTS))?.html ?? '[]') as { from: string; to: string }[];
  const match = redirects.find((r) => toSlug(r.from) === slug);
  if (match?.to) return Response.redirect(new URL(match.to, url.origin).toString(), 301);

  return html((await lookup(NOT_FOUND))?.html ?? COMING_SOON, 404);
}

/** robots.txt: everything public except the editor and API. */
export function robots(url: URL) {
  return new Response(`User-agent: *\nDisallow: /api/\n\nSitemap: ${url.origin}/sitemap.xml\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

/** sitemap.xml listing every published page. */
export async function sitemap(db: D1Database, url: URL) {
  const published = await getDocument(db, 'published');
  const site = published ? (JSON.parse(published.data) as Site) : null;
  const urls = (site?.pages ?? [])
    .map(
      (p) =>
        `  <url>\n    <loc>${escapeHtml(url.origin + (p.slug === '/' ? '' : p.slug))}</loc>\n    <lastmod>${published!.updatedAt}</lastmod>\n  </url>`,
    )
    .join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  );
}
