import { useState, type FormEvent } from 'react';
import { slugify, slugProblem, useSite } from '../store/SiteStore';
import { navLinks, type PageIcon } from '../types';
import { IconDoc, IconHome, IconMail } from './icons';
import { Segmented, Toggle } from './ui/controls';

interface PageDialogProps {
  /** Page to edit, or null to create a new one. */
  pageId: string | null;
  onClose: () => void;
}

export function PageDialog({ pageId, onClose }: PageDialogProps) {
  const { site, addPage, updatePage, removePage, setPageInNav } = useSite();
  const page = pageId ? site.pages.find((p) => p.id === pageId) : undefined;
  const isHome = page?.slug === '/';

  const [title, setTitle] = useState(page?.title ?? '');
  const [slug, setSlug] = useState(page?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(page));
  const [icon, setIcon] = useState<PageIcon>(page?.icon ?? 'doc');
  const [showInNav, setShowInNav] = useState(page ? navLinks(site).some((l) => l.pageId === page.id) : true);
  const [seoTitle, setSeoTitle] = useState(page?.seo?.title ?? '');
  const [seoDescription, setSeoDescription] = useState(page?.seo?.description ?? '');

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const problem = !title.trim()
    ? 'Give the page a title.'
    : isHome
      ? null
      : effectiveSlug === '/' && !page
        ? 'Choose a URL for the page.'
        : slugProblem(site, effectiveSlug, pageId ?? undefined);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (problem) return;
    const meta = {
      title: title.trim(),
      slug: isHome ? '/' : effectiveSlug,
      icon,
      seo: { title: seoTitle.trim(), description: seoDescription.trim() },
    };
    const id = page ? page.id : addPage(meta);
    if (page) updatePage(page.id, meta);
    setPageInNav(id, showInNav);
    onClose();
  };

  const remove = () => {
    if (!page) return;
    if (window.confirm(`Delete “${page.title}”? It disappears from the live site when you next publish.`)) {
      removePage(page.id);
      onClose();
    }
  };

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <form
        className="picker dialog"
        role="dialog"
        aria-label={page ? 'Page settings' : 'New page'}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="picker-header">
          <h2 className="picker-title">{page ? 'Page settings' : 'New page'}</h2>
        </div>
        <label className="field">
          <span className="auth-label">Title</span>
          <input className="g-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span className="auth-label">URL</span>
          <input
            className="g-input"
            value={isHome ? '/' : effectiveSlug}
            disabled={isHome}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
        </label>
        <div className="field">
          <span className="auth-label">Icon</span>
          <Segmented
            ariaLabel="Page icon"
            value={icon}
            onChange={setIcon}
            options={[
              { value: 'home' as const, label: <IconHome size={14} />, title: 'Home' },
              { value: 'doc' as const, label: <IconDoc size={14} />, title: 'Page' },
              { value: 'mail' as const, label: <IconMail size={14} />, title: 'Contact' },
            ]}
          />
        </div>
        <div className="check-row">
          <Toggle checked={showInNav} label="Show in navigation" onChange={setShowInNav} />
          <span>Show in navigation</span>
        </div>
        <label className="field">
          <span className="auth-label">SEO title</span>
          <input
            className="g-input"
            value={seoTitle}
            placeholder="Defaults to the site's title template"
            onChange={(e) => setSeoTitle(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="auth-label">SEO description</span>
          <textarea
            className="g-input"
            rows={3}
            value={seoDescription}
            placeholder="One or two sentences for search results and link previews"
            onChange={(e) => setSeoDescription(e.target.value)}
          />
        </label>
        {problem && (title || slugTouched) && <p className="form-error">{problem}</p>}
        <div className="dialog-actions">
          {page && !isHome && site.pages.length > 1 && (
            <button type="button" className="text-btn danger" onClick={remove}>
              Delete page
            </button>
          )}
          <button type="button" className="text-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="publish-btn" disabled={Boolean(problem)}>
            {page ? 'Save' : 'Create page'}
          </button>
        </div>
      </form>
    </div>
  );
}
