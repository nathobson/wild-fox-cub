import { useSite } from '../store/SiteStore';
import type { Device, EditorMode } from '../types';
import { IconCheckSeal, IconDesktop, IconExternal, IconPhone, IconSpinner, IconTablet } from './icons';
import { Segmented } from './ui/controls';

interface ToolbarProps {
  title: string;
  showEditorControls: boolean;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  device: Device;
  onDeviceChange: (device: Device) => void;
  publishing: boolean;
  onPublish: () => void;
}

const SAVE_LABELS = {
  saved: 'Saved',
  saving: 'Saving…',
  error: 'Not saved — will retry',
  conflict: 'Out of date — reload',
} as const;

export function Toolbar({
  title,
  showEditorControls,
  mode,
  onModeChange,
  device,
  onDeviceChange,
  publishing,
  onPublish,
}: ToolbarProps) {
  const { saveState, hasChanges, publishedAt, activePage } = useSite();

  return (
    <header className="toolbar">
      <div className="window-title">{title}</div>
      <div className="toolbar-right">
        {showEditorControls && (
          <>
            <div className={`save-indicator ${saveState}`} title={SAVE_LABELS[saveState]}>
              {saveState === 'saving' ? <IconSpinner size={13} /> : <IconCheckSeal size={13} />}
              <span>{SAVE_LABELS[saveState]}</span>
            </div>
            <Segmented
              ariaLabel="Editor mode"
              value={mode}
              onChange={onModeChange}
              options={[
                { value: 'edit' as const, label: 'Edit' },
                { value: 'preview' as const, label: 'Preview' },
              ]}
            />
            <Segmented
              ariaLabel="Device"
              value={device}
              onChange={onDeviceChange}
              options={[
                { value: 'desktop' as const, label: <IconDesktop size={14} />, title: 'Desktop' },
                { value: 'tablet' as const, label: <IconTablet size={14} />, title: 'Tablet' },
                { value: 'mobile' as const, label: <IconPhone size={14} />, title: 'Mobile' },
              ]}
            />
          </>
        )}
        {publishedAt && (
          <a
            className="view-site-btn"
            href={showEditorControls ? activePage.slug : '/'}
            target="_blank"
            rel="noreferrer"
            title="Open the live site"
          >
            <IconExternal size={13} />
            <span>View site</span>
          </a>
        )}
        <button
          className="publish-btn"
          onClick={onPublish}
          disabled={publishing || !hasChanges || saveState === 'conflict'}
          title={hasChanges ? 'Make your changes live' : 'Everything is live'}
        >
          {publishing ? 'Publishing…' : hasChanges ? 'Publish' : 'Published'}
        </button>
      </div>
    </header>
  );
}
