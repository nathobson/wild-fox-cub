import { blockDefinition } from '../lib/registry';
import type { MediaItem } from '../lib/media';
import { NotFound, SiteFooter, SiteHeader } from '../site';
import { navItems, type Page, type Site } from '../types';
import { ImageLoadingContext, MediaContext } from './media/context';

interface PublicPageProps {
  site: Site;
  /** null renders the "page not found" page. */
  page: Page | null;
  media: ReadonlyMap<string, MediaItem>;
}

const noop = () => {};

/** One published page, rendered to static HTML at publish time. */
export function PublicPage({ site, page, media }: PublicPageProps) {
  const chrome = { site, nav: navItems(site), page };
  // The first block whose images load straight away gets high fetch priority.
  const firstEager = page?.blocks.findIndex((b) => blockDefinition(b.type)?.images && b.lazyLoad === false) ?? -1;
  return (
    <MediaContext.Provider value={media}>
      <div className="site-root">
        <SiteHeader {...chrome} />
        <main>
          {page ? (
            page.blocks.map((block, index) => {
              const def = blockDefinition(block.type);
              if (!def) return null;
              const loading = { eager: block.lazyLoad === false, highPriority: index === firstEager };
              return (
                <ImageLoadingContext.Provider key={block.id} value={loading}>
                  {def.Static ? (
                    <def.Static block={block} page={page} index={index} />
                  ) : (
                    <def.View block={block} editable={false} onUpdate={noop} />
                  )}
                </ImageLoadingContext.Provider>
              );
            })
          ) : (
            <NotFound />
          )}
        </main>
        <SiteFooter {...chrome} />
      </div>
    </MediaContext.Provider>
  );
}

/** Scripts for a page: the site's own, plus one per block type used on it. */
export function pageScripts(page: Page | null, siteScript: string): string[] {
  const scripts = siteScript ? [siteScript] : [];
  const seen = new Set<string>();
  for (const block of page?.blocks ?? []) {
    const script = blockDefinition(block.type)?.script;
    if (script && !seen.has(block.type)) {
      seen.add(block.type);
      scripts.push(script);
    }
  }
  return scripts;
}
