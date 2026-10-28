import type { MiddlewareHandler } from 'hono';
import { blockDefinitions } from '../src/lib/registry';
import { SITE_SCRIPT } from '../src/site';

/** True in `vite dev`, where the editor page carries Vite's inline scripts. */
declare const __DEV__: boolean;

/*
 * Security headers for everything the Worker serves. Static files served before
 * the Worker (site.css, /assets/*, icons) get theirs from public/_headers.
 */

const csp = (directives: Record<string, string>) =>
  Object.entries(directives)
    .map(([name, value]) => `${name} ${value}`)
    .join('; ');

const sha256 = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
};

// Published pages only run the site's own inline scripts, allowed by hash. The
// value is a plain string, so it's safe to keep between requests.
let pageCsp: string | undefined;

async function publishedPageCsp() {
  const scripts = [SITE_SCRIPT, ...blockDefinitions.map((d) => d.script)].filter(Boolean) as string[];
  const hashes = await Promise.all(scripts.map(sha256));
  return csp({
    'default-src': "'self'",
    'script-src': ["'self'", ...hashes].join(' '),
    // Inline style attributes (image focus, the page transition) are used.
    'style-src': "'self' 'unsafe-inline'",
    'img-src': "'self' data: https:",
    'font-src': "'self' data:",
    'connect-src': "'self'",
    'form-action': "'self'",
    'frame-ancestors': "'self'",
    'base-uri': "'self'",
    'object-src': "'none'",
  });
}

// /foxcub itself is a static file: public/_headers carries the same policy for it.
const EDITOR_CSP = csp({
  'default-src': "'self'",
  // No inline scripts: even if hostile HTML got into the content, the editor
  // won't run its event handlers or javascript: links.
  'script-src': "'self'",
  'style-src': "'self' 'unsafe-inline'",
  'img-src': "'self' data: blob: https:",
  'font-src': "'self' data:",
  'connect-src': "'self'",
  'form-action': "'self'",
  'frame-ancestors': "'none'",
  'base-uri': "'self'",
  'object-src': "'none'",
});

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  const url = new URL(c.req.url);
  const path = url.pathname;
  const isEditor = path === '/foxcub' || path.startsWith('/foxcub/');
  const isApi = path.startsWith('/api/');

  // Some responses (e.g. from the assets binding) have read-only headers.
  c.res = new Response(c.res.body, c.res);
  const h = c.res.headers;
  h.set('x-content-type-options', 'nosniff');
  h.set('referrer-policy', 'strict-origin-when-cross-origin');
  h.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (url.protocol === 'https:') h.set('strict-transport-security', 'max-age=31536000');

  if (isEditor || isApi) {
    // Keep the editor and API out of search results (robots.txt only stops crawling).
    h.set('x-robots-tag', 'noindex, nofollow');
    h.set('x-frame-options', 'DENY');
  } else {
    h.set('x-frame-options', 'SAMEORIGIN');
  }

  const isHtml = h.get('content-type')?.startsWith('text/html');
  if (isEditor && isHtml && !__DEV__) h.set('content-security-policy', EDITOR_CSP);
  if (!isEditor && !isApi && isHtml) h.set('content-security-policy', (pageCsp ??= await publishedPageCsp()));
};
