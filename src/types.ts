import type { BlockBase } from './lib/blocks';
import type { Block as SiteBlock } from './site';

/** Any block on the site, plus the settings every block can have. */
export type Block = SiteBlock & Pick<BlockBase, 'lazyLoad'>;

export type BlockType = Block['type'];

/** A partial update for any block (fields not in the block are ignored by its views). */
export type BlockPatch = Partial<Block>;

export type PageIcon = 'home' | 'doc' | 'mail';

export interface PageSeo {
  /** The full <title>. Empty uses the site's title template. */
  title?: string;
  /** Meta description for search results and link previews. */
  description?: string;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  icon: PageIcon;
  /** Legacy: whether the page was listed in the navigation, before Settings → Navigation. */
  showInNav?: boolean;
  seo?: PageSeo;
  blocks: Block[];
}

export interface SiteLink {
  id: string;
  label: string;
  url: string;
}

/** A navigation entry: a page on this site, or any other URL. */
export interface NavLink {
  id: string;
  /** Text shown in the menu. Empty uses the page title. */
  label: string;
  /** Links to this page (follows it if its URL changes). */
  pageId?: string;
  /** Used when there's no pageId, e.g. https://example.com or /files/cv.pdf */
  url?: string;
}

export interface Redirect {
  id: string;
  /** Old path, e.g. /about-us.html */
  from: string;
  /** Where it now lives, e.g. /about (or a full URL). */
  to: string;
}

export interface SiteSettings {
  /** How page titles are built when a page has no SEO title, e.g. "{title} | {site}". */
  titleTemplate?: string;
  /** Default image for link previews (social cards). */
  shareImageId?: string | null;
  /** The header menu, in order. Unset on older sites: see navLinks(). */
  navigation?: NavLink[];
  /** Footer line; empty uses "© {year} {site name}". */
  footerText?: string;
  /** Footer / social links. */
  links?: SiteLink[];
  /** Permanent (301) redirects from old URLs. */
  redirects?: Redirect[];
}

export interface Site {
  name: string;
  pages: Page[];
  settings?: SiteSettings;
}

/** A navigation entry, resolved for rendering. */
export interface NavItem {
  id: string;
  title: string;
  href: string;
  /** Set when the entry links to a page on this site. */
  pageId?: string;
}

/** What the site layer's header and footer receive. */
export interface ChromeProps {
  site: Site;
  /** The header menu, in order. */
  nav: NavItem[];
  /** The current page, or null on the "not found" page. */
  page: Page | null;
  /** Present only in the editor canvas. */
  editor?: {
    editable: boolean;
    onRename: (name: string) => void;
    /** Switch the editor to another page (used instead of following links). */
    onNavigate: (pageId: string) => void;
  };
}

/** The navigation as configured; sites from before it was configurable list every page not hidden. */
export const navLinks = (site: Site): NavLink[] =>
  site.settings?.navigation ??
  site.pages.filter((p) => p.showInNav !== false).map((p) => ({ id: p.id, label: '', pageId: p.id }));

export const navItems = (site: Site): NavItem[] =>
  navLinks(site).flatMap((link): NavItem[] => {
    if (link.pageId) {
      // Links to deleted pages drop out.
      const page = site.pages.find((p) => p.id === link.pageId);
      return page ? [{ id: link.id, title: link.label.trim() || page.title, href: page.slug, pageId: page.id }] : [];
    }
    return link.url ? [{ id: link.id, title: link.label.trim() || link.url, href: link.url }] : [];
  });

export type EditorMode = 'edit' | 'preview';

export type Device = 'desktop' | 'tablet' | 'mobile';
