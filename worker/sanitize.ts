/*
 * Rich text (EditableHtml, rendered inside `.eh`) is stored as HTML. Before a page
 * is published, everything inside rich-text areas is cut down to a small allowlist:
 * formatting tags only, no attributes except safe links, and no script-capable
 * URLs. The site's own markup outside `.eh` is untouched.
 */

/** Tags removed along with everything inside them. */
const DROP = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button',
  'textarea', 'select', 'option', 'svg', 'math', 'link', 'meta', 'base', 'template', 'noscript', 'video',
  'audio', 'source', 'track', 'canvas', 'dialog',
]);

/** Formatting tags kept as they are (minus attributes). Anything else is unwrapped. */
const KEEP = new Set([
  'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'small', 'mark',
  'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'span', 'div',
]);

const LINK_ATTRIBUTES = new Set(['href', 'target', 'rel', 'title']);

/** Relative URLs, fragments, http(s), mailto and tel only. */
export function isSafeUrl(value: string) {
  // Browsers ignore control characters and whitespace inside a scheme ("java\tscript:").
  const compact = value.replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(compact)?.[1];
  return !scheme || ['http', 'https', 'mailto', 'tel'].includes(scheme);
}

/** HTMLRewriter's element (not the DOM's, which the editor's types also declare). */
type RewriterElement = Parameters<NonNullable<HTMLRewriterElementContentHandlers['element']>>[0];

class RichTextFilter implements HTMLRewriterElementContentHandlers {
  element(el: RewriterElement) {
    const tag = el.tagName.toLowerCase();
    if (DROP.has(tag)) {
      el.remove();
      return;
    }
    if (!KEEP.has(tag)) {
      el.removeAndKeepContent();
      return;
    }

    const names = [...(el.attributes as Iterable<[string, string]>)].map(([name]) => name);
    for (const name of names) {
      const keep = tag === 'a' && LINK_ATTRIBUTES.has(name.toLowerCase());
      if (!keep) el.removeAttribute(name);
    }
    if (tag === 'a') {
      const href = el.getAttribute('href');
      if (href !== null && !isSafeUrl(href)) el.removeAttribute('href');
      // Links opening a new tab can't reach back into this page.
      if (el.getAttribute('target')) el.setAttribute('rel', 'noopener noreferrer');
    }
  }
}

/** Sanitises the rich-text areas of a rendered page. */
export function sanitizeRichText(html: string): Promise<string> {
  return new HTMLRewriter().on('.eh *', new RichTextFilter()).transform(new Response(html)).text();
}
