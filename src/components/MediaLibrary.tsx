import { useEffect, useRef, useState, type DragEvent } from 'react';
import { formatDate } from '../lib/api';
import { originalUrl, thumbUrl, variantUrl, type MediaItem } from '../lib/media';
import { useMedia } from '../store/MediaStore';
import { IconTrash } from './icons';

interface MediaLibraryProps {
  /** pick: click an image to choose it. manage: edit alt text and delete. */
  mode: 'pick' | 'manage';
  onSelect?: (item: MediaItem) => void;
}

const formatSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

/** A large version for previewing: the biggest generated size up to 1600px wide. */
const previewUrl = (item: MediaItem) => {
  const width = item.widths.filter((w) => w <= 1600).at(-1);
  return width ? variantUrl(item.id, width, 'webp') : originalUrl(item);
};

function Lightbox({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  useEffect(() => {
    // Capture phase, so Escape closes this and nothing behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div
        className="picker lightbox"
        role="dialog"
        aria-label={item.filename}
        onClick={(e) => e.stopPropagation()}
      >
        <img className="lightbox-image" src={previewUrl(item)} alt={item.alt} width={item.width} height={item.height} />
        <div className="lightbox-bar">
          <span className="lightbox-name">{item.filename}</span>
          <span>
            {item.width}×{item.height} · {formatSize(item.size)}
          </span>
          <a className="text-btn" href={originalUrl(item)} target="_blank" rel="noreferrer">
            Open original
          </a>
          <button type="button" className="text-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function MediaLibrary({ mode, onSelect }: MediaLibraryProps) {
  const { items, uploading, upload, setAlt, remove } = useMedia();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<MediaItem | null>(null);

  const handleFiles = async (files: FileList | null) => {
    const images = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    const added = await upload(images);
    // Picking a single fresh upload chooses it straight away.
    if (mode === 'pick' && added.length === 1) onSelect?.(added[0]);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (item: MediaItem) => {
    if (!window.confirm(`Delete “${item.filename}” and all its sizes?`)) return;
    try {
      await remove(item.id);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  return (
    <div
      className={`media-library${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="media-toolbar">
        <button className="publish-btn" onClick={() => input.current?.click()} disabled={uploading > 0}>
          {uploading > 0 ? `Optimising ${uploading}…` : 'Upload images'}
        </button>
        <span className="muted">Or drop files here. JPEG, PNG, WebP, AVIF or GIF, up to 20 MB.</span>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {items.length === 0 ? (
        <p className="panel-empty media-empty">No images yet. Upload one to get started.</p>
      ) : (
        <div className={`media-grid${mode === 'manage' ? ' manage' : ''}`}>
          {items.map((item) =>
            mode === 'pick' ? (
              <button key={item.id} className="media-card pickable" onClick={() => onSelect?.(item)}>
                <img className="media-thumb" src={thumbUrl(item)} alt={item.alt} loading="lazy" />
                <span className="media-name">{item.filename}</span>
              </button>
            ) : (
              <div key={item.id} className="media-card">
                <button
                  type="button"
                  className="media-zoom"
                  title="View larger"
                  aria-label={`View ${item.filename} larger`}
                  onClick={() => setViewing(item)}
                >
                  <img className="media-thumb" src={thumbUrl(item)} alt={item.alt} loading="lazy" />
                </button>
                <span className="media-name" title={item.filename}>
                  {item.filename}
                </span>
                <span className="media-meta">
                  {item.width}×{item.height} · {formatSize(item.size)} · {formatDate(item.createdAt)}
                </span>
                <label className="field-stack">
                  <span>Alt text</span>
                  <textarea
                    className="g-input"
                    rows={2}
                    placeholder="Describe the image for people who can't see it"
                    defaultValue={item.alt}
                    onBlur={(e) => {
                      if (e.target.value !== item.alt) void setAlt(item.id, e.target.value);
                    }}
                  />
                </label>
                <button className="text-btn danger media-delete" onClick={() => handleDelete(item)}>
                  <IconTrash size={12} /> Delete
                </button>
              </div>
            ),
          )}
        </div>
      )}
      {viewing && <Lightbox item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

export function MediaPanel() {
  return (
    <div className="panel-scroll">
      <div className="panel wide">
        <header className="panel-header">
          <h1 className="panel-title">Media</h1>
        </header>
        <section className="panel-card">
          <MediaLibrary mode="manage" />
        </section>
      </div>
    </div>
  );
}
