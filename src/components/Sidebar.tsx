import { useSite } from '../store/SiteStore';
import type { PageIcon } from '../types';
import type { View } from '../App';
import {
  IconDoc,
  IconGear,
  IconHome,
  IconImage,
  IconInbox,
  IconMail,
  IconPlus,
  IconSignOut,
  IconSliders,
  IconUsers,
} from './icons';

const PAGE_ICONS: Record<PageIcon, typeof IconHome> = {
  home: IconHome,
  doc: IconDoc,
  mail: IconMail,
};

interface SidebarProps {
  view: View;
  onViewChange: (view: View) => void;
  userEmail: string;
  onAddPage: () => void;
  onEditPage: (pageId: string) => void;
  onDiscard: () => void;
  onSignOut: () => void;
}

export function Sidebar({ view, onViewChange, userEmail, onAddPage, onEditPage, onDiscard, onSignOut }: SidebarProps) {
  const { site, activePage, setActivePage, hasChanges, publishedAt } = useSite();

  const handleDiscard = () => {
    if (window.confirm('Discard all unpublished changes and go back to the live version of the site?')) {
      onDiscard();
    }
  };

  return (
    <nav className="sidebar">
      <div className="side-section">
        <div className="side-label side-label-row">
          <span>Pages</span>
          <button className="side-add" title="Add page" onClick={onAddPage}>
            <IconPlus size={12} />
          </button>
        </div>
        {site.pages.map((page) => {
          const Icon = PAGE_ICONS[page.icon] ?? IconDoc;
          const active = view === 'editor' && page.id === activePage.id;
          return (
            <div key={page.id} className={`page-item${active ? ' active' : ''}`}>
              <button
                className="page-main"
                onClick={() => {
                  setActivePage(page.id);
                  onViewChange('editor');
                }}
              >
                <Icon size={14} className="page-icon" />
                <span className="page-title" title={page.title}>
                  {page.title}
                </span>
              </button>
              <button className="page-settings" title="Page settings" onClick={() => onEditPage(page.id)}>
                <IconGear size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="side-section">
        <div className="side-label">Site</div>
        <button
          className={`page-item nav-item${view === 'media' ? ' active' : ''}`}
          onClick={() => onViewChange('media')}
        >
          <IconImage size={14} className="page-icon" />
          <span className="page-title">Media</span>
        </button>
        <button
          className={`page-item nav-item${view === 'settings' ? ' active' : ''}`}
          onClick={() => onViewChange('settings')}
        >
          <IconSliders size={14} className="page-icon" />
          <span className="page-title">Settings</span>
        </button>
        <button
          className={`page-item nav-item${view === 'inbox' ? ' active' : ''}`}
          onClick={() => onViewChange('inbox')}
        >
          <IconInbox size={14} className="page-icon" />
          <span className="page-title">Inbox</span>
        </button>
        <button
          className={`page-item nav-item${view === 'users' ? ' active' : ''}`}
          onClick={() => onViewChange('users')}
        >
          <IconUsers size={14} className="page-icon" />
          <span className="page-title">Users</span>
        </button>
      </div>
      <div className="side-footer">
        {hasChanges && publishedAt && (
          <button className="reset-btn" onClick={handleDiscard}>
            Discard unpublished changes
          </button>
        )}
        <div className="side-user">
          <span className="side-user-email" title={userEmail}>
            {userEmail}
          </span>
          <button className="side-signout" title="Sign out" onClick={onSignOut}>
            <IconSignOut size={14} />
          </button>
        </div>
      </div>
    </nav>
  );
}
