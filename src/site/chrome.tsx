import { EditableText } from '../components/editing/EditableText';
import type { ChromeProps } from '../types';

declare const __SITE_JS__: string;

/**
 * Extra <head> markup for published pages: icon, theme colour, the fonts the first
 * screen needs, Lenis (smooth scrolling, self-hosted in public/vendor) and the
 * scroll engine (public/site.js, versioned by content like site.css).
 */
export const SITE_HEAD: string = `
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="theme-color" content="#09090a" />
<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href="/fonts/instrument-serif-latin-400-normal.woff2" />
<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href="/fonts/geist-latin-wght-normal.woff2" />
<script src="/vendor/lenis.min.js" defer></script>
<script src="${__SITE_JS__}" defer></script>`;

/** The scroll engine lives in public/site.js, so the composer's preview can run it too. */
export const SITE_SCRIPT = '';

/** The Fox Cub fox: the Wild Fox Digital mark. */
export function FoxMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="25 -9.5 129 129" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M 152 58 L 149 55 L 149 54 L 121 26 L 120 26 L 117 23 L 113 23 L 111 26 L 111 36 L 109 38 L 104 33 L 103 33 L 102 31 L 101 31 L 93 23 L 89 23 L 87 25 L 87 38 L 86 39 L 86 41 L 85 43 L 79 49 L 77 50 L 75 50 L 74 51 L 44 51 L 42 49 L 42 48 L 45 44 L 70 44 L 71 43 L 74 43 L 76 41 L 77 41 L 80 36 L 80 25 L 42 25 L 34 29 L 31 32 L 31 33 L 28 37 L 28 40 L 27 41 L 27 82 L 28 84 L 32 87 L 35 87 L 37 86 L 39 83 L 39 71 L 44 66 L 48 66 L 53 71 L 53 83 L 55 86 L 60 87 L 62 86 L 65 82 L 65 71 L 66 69 L 70 66 L 74 66 L 78 70 L 79 72 L 79 83 L 81 86 L 86 87 L 88 86 L 91 82 L 91 71 L 92 69 L 96 66 L 100 66 L 104 70 L 104 72 L 105 73 L 105 84 L 107 86 L 112 87 L 116 84 L 116 73 L 117 71 L 121 67 L 147 67 L 148 66 L 150 66 L 152 64 Z M 123 45 L 127 45 L 130 48 L 130 52 L 127 55 L 123 55 L 120 52 L 120 48 Z M 101 45 L 105 45 L 108 48 L 109 50 L 108 52 L 105 55 L 101 55 L 98 51 L 98 49 Z"
      />
    </svg>
  );
}

export function SiteHeader({ site, nav, page, editor }: ChromeProps) {
  const home = site.pages.find((p) => p.slug === '/');
  const brand = (
    <>
      <FoxMark className="wf-mark" />
      {editor ? (
        <EditableText className="wf-brand-name" value={site.name} editable={editor.editable} placeholder="Site name" onChange={editor.onRename} />
      ) : (
        <span className="wf-brand-name">{site.name}</span>
      )}
    </>
  );
  return (
    <header className="wf-header" data-header data-tone="dark">
      {editor ? (
        <span className="wf-brand" onClick={() => home && !editor.editable && editor.onNavigate(home.id)}>
          {brand}
        </span>
      ) : (
        <a className="wf-brand" href="/" aria-label={`${site.name}, home`}>
          {brand}
        </a>
      )}
      <nav className="wf-nav">
        {nav.map((item) => {
          const className = `wf-nav-link${item.pageId && item.pageId === page?.id ? ' active' : ''}`;
          return editor && item.pageId ? (
            <button key={item.id} type="button" className={className} onClick={() => editor.onNavigate(item.pageId!)}>
              {item.title}
            </button>
          ) : (
            <a key={item.id} className={className} href={item.href} {...(editor ? { target: '_blank', rel: 'noreferrer' } : {})}>
              {item.title}
            </a>
          );
        })}
      </nav>
      <span className="wf-progress" aria-hidden="true" />
    </header>
  );
}

export function SiteFooter({ site }: ChromeProps) {
  const links = (site.settings?.links ?? []).filter((l) => l.url);
  return (
    <footer className="wf-footer">
      <span className="wf-footer-brand">
        <FoxMark className="wf-mark" />
        {site.settings?.footerText || `© ${new Date().getFullYear()} ${site.name}`}
      </span>
      {links.length > 0 && (
        <span className="wf-footer-links">
          {links.map((link) => (
            <a key={link.id} href={link.url} {...(/^https?:/.test(link.url) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              {link.label}
            </a>
          ))}
        </span>
      )}
    </footer>
  );
}

export function NotFound() {
  return (
    <section className="wf-notfound tone-dark" data-tone="dark">
      <FoxMark className="wf-mark big" />
      <h1 className="wf-display">Off the path.</h1>
      <p className="wf-small">
        This page wandered off. <a href="/">Head back home</a>.
      </p>
    </section>
  );
}
