import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, type SiteState } from '../lib/api';
import { cloneBlock, createBlock } from '../lib/registry';
import { NEW_PAGE_BLOCK } from '../site';
import { navLinks, type Block, type BlockPatch, type NavLink, type Page, type Site, type SiteSettings } from '../types';

/** 'conflict' means someone else saved first — the editor must reload. */
export type SaveState = 'saved' | 'saving' | 'error' | 'conflict';

export type PageMeta = Pick<Page, 'title' | 'slug' | 'icon' | 'seo'>;

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

type Action =
  | { kind: 'insertBlock'; pageId: string; block: Block; index: number }
  | { kind: 'updateBlock'; pageId: string; blockId: string; patch: object }
  | { kind: 'removeBlock'; pageId: string; blockId: string }
  | { kind: 'moveBlock'; pageId: string; blockId: string; toIndex: number }
  | { kind: 'renameSite'; name: string }
  | { kind: 'updateSettings'; patch: Partial<SiteSettings> }
  | { kind: 'addPage'; page: Page }
  | { kind: 'updatePage'; pageId: string; meta: Partial<PageMeta> }
  | { kind: 'removePage'; pageId: string }
  | { kind: 'setPageInNav'; pageId: string; inNav: boolean }
  | { kind: 'replaceSite'; site: Site };

function mapPage(site: Site, pageId: string, fn: (page: Page) => Page): Site {
  return { ...site, pages: site.pages.map((p) => (p.id === pageId ? fn(p) : p)) };
}

const withNavigation = (site: Site, navigation: NavLink[]): Site => ({
  ...site,
  settings: { ...site.settings, navigation },
});

function reducer(site: Site, action: Action): Site {
  switch (action.kind) {
    case 'insertBlock':
      return mapPage(site, action.pageId, (page) => {
        const blocks = [...page.blocks];
        const index = Math.max(0, Math.min(action.index, blocks.length));
        blocks.splice(index, 0, action.block);
        return { ...page, blocks };
      });

    case 'updateBlock':
      return mapPage(site, action.pageId, (page) => ({
        ...page,
        blocks: page.blocks.map((b) =>
          b.id === action.blockId ? ({ ...b, ...action.patch } as Block) : b,
        ),
      }));

    case 'removeBlock':
      return mapPage(site, action.pageId, (page) => ({
        ...page,
        blocks: page.blocks.filter((b) => b.id !== action.blockId),
      }));

    case 'moveBlock':
      return mapPage(site, action.pageId, (page) => {
        const from = page.blocks.findIndex((b) => b.id === action.blockId);
        if (from === -1) return page;
        const blocks = [...page.blocks];
        const [moved] = blocks.splice(from, 1);
        // toIndex is a "gap" index into the original array
        const target = from < action.toIndex ? action.toIndex - 1 : action.toIndex;
        const clamped = Math.max(0, Math.min(target, blocks.length));
        blocks.splice(clamped, 0, moved);
        return { ...page, blocks };
      });

    case 'renameSite':
      return { ...site, name: action.name };

    case 'updateSettings':
      return { ...site, settings: { ...site.settings, ...action.patch } };

    case 'addPage':
      return { ...site, pages: [...site.pages, action.page] };

    case 'updatePage':
      return mapPage(site, action.pageId, (page) => ({ ...page, ...action.meta }));

    case 'removePage':
      if (site.pages.length < 2) return site;
      return withNavigation(
        { ...site, pages: site.pages.filter((p) => p.id !== action.pageId) },
        navLinks(site).filter((l) => l.pageId !== action.pageId),
      );

    case 'setPageInNav': {
      const links = navLinks(site);
      const listed = links.some((l) => l.pageId === action.pageId);
      if (listed === action.inNav) return site;
      return withNavigation(
        site,
        action.inNav
          ? [...links, { id: crypto.randomUUID(), label: '', pageId: action.pageId }]
          : links.filter((l) => l.pageId !== action.pageId),
      );
    }

    case 'replaceSite':
      return action.site;
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `/${slug}`;
}

const RESERVED_SLUG = /^\/(admin|api|assets)(\/|$)/;

/** Returns a problem with `slug` for page `pageId`, or null if it is usable. */
export function slugProblem(site: Site, slug: string, pageId?: string): string | null {
  if (!/^\/[a-z0-9\-/]*$/.test(slug)) return 'Use lowercase letters, numbers and dashes, starting with /.';
  if (RESERVED_SLUG.test(slug)) return 'That URL is reserved for the CMS.';
  if (site.pages.some((p) => p.slug === slug && p.id !== pageId)) return 'Another page already uses that URL.';
  return null;
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

interface SiteStoreValue {
  site: Site;
  activePage: Page;
  saveState: SaveState;
  /** True when the draft differs from what is live. */
  hasChanges: boolean;
  publishedAt: string | null;
  setActivePage: (pageId: string) => void;
  /** Creates a block of `type`, inserts it at `index`, returns its id. */
  addBlock: (pageId: string, type: string, index: number) => string;
  updateBlock: (pageId: string, blockId: string, patch: BlockPatch) => void;
  removeBlock: (pageId: string, blockId: string) => void;
  /** Deep-clones the block with fresh ids, inserts after the original, returns the new id. */
  duplicateBlock: (pageId: string, blockId: string) => string | null;
  /** Moves block to gap index `toIndex` (0 = top, blocks.length = bottom). */
  moveBlock: (pageId: string, blockId: string, toIndex: number) => void;
  renameSite: (name: string) => void;
  updateSettings: (patch: Partial<SiteSettings>) => void;
  /** Adds an empty page and returns its id. */
  addPage: (meta: PageMeta) => string;
  updatePage: (pageId: string, meta: Partial<PageMeta>) => void;
  removePage: (pageId: string) => void;
  /** Add the page to the end of the navigation, or take it out. */
  setPageInNav: (pageId: string, inNav: boolean) => void;
  /** Waits for any pending autosave to reach the server. */
  flush: () => Promise<void>;
  publish: () => Promise<void>;
  /** Replaces the draft with the live site. */
  discardChanges: () => Promise<void>;
}

const SiteContext = createContext<SiteStoreValue | null>(null);

const AUTOSAVE_DELAY = 600;

export function SiteProvider({ initial, children }: { initial: SiteState; children: ReactNode }) {
  const [site, dispatch] = useReducer(reducer, initial.site);
  const [activePageId, setActivePageId] = useState(initial.site.pages[0]?.id ?? '');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [hasChanges, setHasChanges] = useState(initial.hasChanges);
  const [publishedAt, setPublishedAt] = useState(initial.publishedAt);

  // Autosave bookkeeping. Saves run one at a time so each builds on the last revision.
  const siteRef = useRef(site);
  siteRef.current = site;
  const savedSite = useRef(site);
  const revision = useRef(initial.revision);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const conflicted = useRef(false);

  const save = useCallback(() => {
    queue.current = queue.current.then(async () => {
      const snapshot = siteRef.current;
      if (snapshot === savedSite.current || conflicted.current) return;
      try {
        const res = await api<{ revision: number; hasChanges: boolean }>('/site', {
          method: 'PUT',
          body: { site: snapshot, revision: revision.current },
        });
        revision.current = res.revision;
        savedSite.current = snapshot;
        setHasChanges(res.hasChanges);
        setSaveState(siteRef.current === snapshot ? 'saved' : 'saving');
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          conflicted.current = true;
          setSaveState('conflict');
        } else {
          setSaveState('error');
        }
        throw err;
      }
    });
    const result = queue.current;
    // Keep the queue alive after a failure; callers still see the rejection.
    queue.current = result.catch(() => {});
    return result;
  }, []);

  useEffect(() => {
    if (site === savedSite.current) return;
    setSaveState(conflicted.current ? 'conflict' : 'saving');
    const timer = window.setTimeout(() => void save().catch(() => {}), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [site, save]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (siteRef.current !== savedSite.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const applyServerState = useCallback((state: SiteState) => {
    savedSite.current = state.site;
    revision.current = state.revision;
    dispatch({ kind: 'replaceSite', site: state.site });
    setHasChanges(state.hasChanges);
    setPublishedAt(state.publishedAt);
    setSaveState('saved');
  }, []);

  const flush = useCallback(() => save(), [save]);

  const publish = useCallback(async () => {
    await save();
    applyServerState(await api<SiteState>('/publish', { method: 'POST' }));
  }, [save, applyServerState]);

  const discardChanges = useCallback(async () => {
    await save().catch(() => {});
    applyServerState(await api<SiteState>('/discard', { method: 'POST' }));
  }, [save, applyServerState]);

  const setActivePage = useCallback((pageId: string) => setActivePageId(pageId), []);

  const addBlock = useCallback((pageId: string, type: string, index: number) => {
    const block = createBlock(type);
    dispatch({ kind: 'insertBlock', pageId, block, index });
    return block.id;
  }, []);

  const updateBlock = useCallback((pageId: string, blockId: string, patch: BlockPatch) => {
    dispatch({ kind: 'updateBlock', pageId, blockId, patch });
  }, []);

  const removeBlock = useCallback((pageId: string, blockId: string) => {
    dispatch({ kind: 'removeBlock', pageId, blockId });
  }, []);

  const moveBlock = useCallback((pageId: string, blockId: string, toIndex: number) => {
    dispatch({ kind: 'moveBlock', pageId, blockId, toIndex });
  }, []);

  const renameSite = useCallback((name: string) => dispatch({ kind: 'renameSite', name }), []);

  const updateSettings = useCallback(
    (patch: Partial<SiteSettings>) => dispatch({ kind: 'updateSettings', patch }),
    [],
  );

  const addPage = useCallback((meta: PageMeta) => {
    const first = createBlock(NEW_PAGE_BLOCK) as Block & { heading?: unknown };
    // Start the page with its title as the first block's heading, when it has one.
    if (typeof first.heading === 'string') first.heading = meta.title;
    const page: Page = { id: crypto.randomUUID(), ...meta, blocks: [first] };
    dispatch({ kind: 'addPage', page });
    setActivePageId(page.id);
    return page.id;
  }, []);

  const updatePage = useCallback((pageId: string, meta: Partial<PageMeta>) => {
    dispatch({ kind: 'updatePage', pageId, meta });
  }, []);

  const removePage = useCallback((pageId: string) => dispatch({ kind: 'removePage', pageId }), []);
  const setPageInNav = useCallback(
    (pageId: string, inNav: boolean) => dispatch({ kind: 'setPageInNav', pageId, inNav }),
    [],
  );

  const duplicateBlock = useCallback(
    (pageId: string, blockId: string) => {
      const page = site.pages.find((p) => p.id === pageId);
      const block = page?.blocks.find((b) => b.id === blockId);
      if (!page || !block) return null;
      const copy = cloneBlock(block);
      const index = page.blocks.findIndex((b) => b.id === blockId) + 1;
      dispatch({ kind: 'insertBlock', pageId, block: copy, index });
      return copy.id;
    },
    [site],
  );

  const value = useMemo<SiteStoreValue>(() => {
    const activePage = site.pages.find((p) => p.id === activePageId) ?? site.pages[0];
    return {
      site,
      activePage,
      saveState,
      hasChanges,
      publishedAt,
      setActivePage,
      addBlock,
      updateBlock,
      removeBlock,
      duplicateBlock,
      moveBlock,
      renameSite,
      updateSettings,
      addPage,
      updatePage,
      removePage,
      setPageInNav,
      flush,
      publish,
      discardChanges,
    };
  }, [
    site,
    activePageId,
    saveState,
    hasChanges,
    publishedAt,
    setActivePage,
    addBlock,
    updateBlock,
    removeBlock,
    duplicateBlock,
    moveBlock,
    renameSite,
    updateSettings,
    addPage,
    updatePage,
    removePage,
    setPageInNav,
    flush,
    publish,
    discardChanges,
  ]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteStoreValue {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used inside <SiteProvider>');
  return ctx;
}
