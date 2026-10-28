import { useState, type ReactNode } from 'react';
import { useSite } from '../store/SiteStore';
import { navLinks, type NavLink, type Redirect, type SiteLink } from '../types';
import { ItemList } from './ui/ItemList';
import { MediaField } from './ui/MediaField';
import { Field, GlassInput, Segmented, Select } from './ui/controls';

type Tab = 'seo' | 'footer' | 'navigation' | 'redirects';

const TABS: { value: Tab; label: string }[] = [
  { value: 'seo', label: 'SEO' },
  { value: 'footer', label: 'Footer' },
  { value: 'navigation', label: 'Navigation' },
  { value: 'redirects', label: 'Redirects' },
];

const TAB_KEY = 'foxcub:settings-tab';

function savedTab(): Tab {
  try {
    const tab = localStorage.getItem(TAB_KEY);
    return TABS.some((t) => t.value === tab) ? (tab as Tab) : 'seo';
  } catch {
    return 'seo';
  }
}

function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <span className="auth-label">{label}</span>
      <div className="field-stack">
        {children}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

function SeoSettings() {
  const { site, renameSite, updateSettings } = useSite();
  const settings = site.settings ?? {};
  return (
    <>
      <SettingsRow label="Site name" hint="Used in page titles, link previews and search results.">
        <GlassInput value={site.name} onChange={renameSite} />
      </SettingsRow>
      <SettingsRow
        label="Page title template"
        hint="Used for pages without their own SEO title. {title} is the page title, {site} the site name."
      >
        <GlassInput
          value={settings.titleTemplate ?? ''}
          placeholder="{title} — {site}"
          onChange={(titleTemplate) => updateSettings({ titleTemplate })}
        />
      </SettingsRow>
      <SettingsRow label="Share image" hint="Shown when pages are shared on social media and in messages.">
        <MediaField
          mediaId={settings.shareImageId}
          onChange={(item) => updateSettings({ shareImageId: item.id })}
          onClear={() => updateSettings({ shareImageId: null })}
        />
      </SettingsRow>
    </>
  );
}

function FooterSettings() {
  const { site, updateSettings } = useSite();
  const settings = site.settings ?? {};
  return (
    <>
      <SettingsRow label="Footer text" hint="Leave empty for “© year site name”.">
        <GlassInput value={settings.footerText ?? ''} onChange={(footerText) => updateSettings({ footerText })} />
      </SettingsRow>
      <SettingsRow label="Links" hint="Social and other links shown in the footer.">
        <ItemList<SiteLink>
          items={settings.links ?? []}
          onChange={(links) => updateSettings({ links })}
          label={(link) => link.label || link.url || 'New link'}
          create={() => ({ id: crypto.randomUUID(), label: '', url: 'https://' })}
          addLabel="Add link"
          editor={(link, update) => (
            <>
              <Field label="Label">
                <GlassInput value={link.label} onChange={(label) => update({ label })} />
              </Field>
              <Field label="URL">
                <GlassInput value={link.url} onChange={(url) => update({ url })} />
              </Field>
            </>
          )}
        />
      </SettingsRow>
    </>
  );
}

function NavigationSettings() {
  const { site, updateSettings } = useSite();
  const links = navLinks(site);
  const pageTitle = (pageId?: string) => site.pages.find((p) => p.id === pageId)?.title;
  const pageOptions = site.pages.map((p) => ({ value: p.id, label: `${p.title} (${p.slug})` }));

  return (
    <SettingsRow label="Menu" hint="The site's header menu, in order. Pages keep their place if you change their URL.">
      <ItemList<NavLink>
        items={links}
        onChange={(navigation) => updateSettings({ navigation })}
        label={(link) =>
          link.pageId
            ? link.label || pageTitle(link.pageId) || 'Deleted page'
            : `${link.label || link.url || 'New link'} ↗`
        }
        create={() => {
          // Suggest the first page that isn't in the menu yet.
          const page = site.pages.find((p) => !links.some((l) => l.pageId === p.id));
          return page
            ? { id: crypto.randomUUID(), label: '', pageId: page.id }
            : { id: crypto.randomUUID(), label: '', url: 'https://' };
        }}
        addLabel="Add menu item"
        editor={(link, update) => (
          <>
            <Segmented
              ariaLabel="Link type"
              value={link.pageId ? 'page' : 'url'}
              onChange={(kind) =>
                update(
                  kind === 'page'
                    ? { pageId: site.pages[0].id, url: undefined }
                    : { pageId: undefined, url: link.url || 'https://' },
                )
              }
              options={[
                { value: 'page', label: 'Page' },
                { value: 'url', label: 'Other URL' },
              ]}
            />
            {link.pageId ? (
              <Field label="Page">
                <Select
                  ariaLabel="Page"
                  value={link.pageId}
                  options={pageOptions}
                  onChange={(pageId) => update({ pageId })}
                />
              </Field>
            ) : (
              <Field label="URL">
                <GlassInput value={link.url ?? ''} onChange={(url) => update({ url })} />
              </Field>
            )}
            <Field label="Label">
              <GlassInput
                value={link.label}
                placeholder={link.pageId ? pageTitle(link.pageId) : 'Link text'}
                onChange={(label) => update({ label })}
              />
            </Field>
          </>
        )}
      />
    </SettingsRow>
  );
}

function RedirectSettings() {
  const { site, updateSettings } = useSite();
  return (
    <SettingsRow label="Old URLs" hint="Permanent (301) redirects, e.g. from a previous site's pages.">
      <ItemList<Redirect>
        items={site.settings?.redirects ?? []}
        onChange={(redirects) => updateSettings({ redirects })}
        label={(r) => `${r.from || '…'} → ${r.to || '…'}`}
        create={() => ({ id: crypto.randomUUID(), from: '/', to: '/' })}
        addLabel="Add redirect"
        editor={(r, update) => (
          <>
            <Field label="From">
              <GlassInput value={r.from} placeholder="/old-page.html" onChange={(from) => update({ from })} />
            </Field>
            <Field label="To">
              <GlassInput value={r.to} placeholder="/new-page" onChange={(to) => update({ to })} />
            </Field>
          </>
        )}
      />
    </SettingsRow>
  );
}

/** Site-wide settings. Saved with the draft like everything else; live on publish. */
export function SettingsPanel() {
  const [tab, setTab] = useState<Tab>(savedTab);

  const selectTab = (next: Tab) => {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // Remembering the tab is only a convenience.
    }
  };

  return (
    <div className="panel-scroll">
      <div className="panel">
        <header className="panel-header">
          <h1 className="panel-title">Settings</h1>
        </header>

        <div className="panel-tabs" role="tablist" aria-label="Settings">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`panel-tab${tab === t.value ? ' active' : ''}`}
              onClick={() => selectTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <section className="panel-card" role="tabpanel">
          {tab === 'seo' && <SeoSettings />}
          {tab === 'footer' && <FooterSettings />}
          {tab === 'navigation' && <NavigationSettings />}
          {tab === 'redirects' && <RedirectSettings />}
        </section>
      </div>
    </div>
  );
}
