import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MediaLibrary } from '../components/MediaLibrary';
import { MediaContext, MediaPickerContext } from '../components/media/context';
import { api } from '../lib/api';
import type { MediaItem } from '../lib/media';

interface MediaStoreValue {
  items: MediaItem[];
  /** Number of uploads in progress. */
  uploading: number;
  /** Uploads files one by one; returns the ones that succeeded. Errors go to onError. */
  upload: (files: File[]) => Promise<MediaItem[]>;
  setAlt: (id: string, alt: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Opens the picker; resolves with the chosen image, or null if cancelled. */
  pick: () => Promise<MediaItem | null>;
}

const MediaStoreContext = createContext<MediaStoreValue | null>(null);

export function MediaProvider({ children, onError }: { children: ReactNode; onError: (message: string) => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(0);
  const [picking, setPicking] = useState(false);
  const resolvePick = useRef<((item: MediaItem | null) => void) | null>(null);

  useEffect(() => {
    api<{ media: MediaItem[] }>('/media').then(
      (res) => setItems(res.media),
      (err: Error) => onError(err.message),
    );
  }, [onError]);

  const upload = useCallback(
    async (files: File[]) => {
      const added: MediaItem[] = [];
      for (const file of files) {
        setUploading((n) => n + 1);
        try {
          const body = new FormData();
          body.append('file', file);
          const res = await fetch('/api/media', { method: 'POST', body, credentials: 'same-origin' });
          const data = (await res.json()) as { item?: MediaItem; error?: string };
          if (!res.ok || !data.item) throw new Error(data.error ?? 'Upload failed.');
          const item = data.item;
          added.push(item);
          setItems((current) => [item, ...current.filter((i) => i.id !== item.id)]);
        } catch (err) {
          onError(`${file.name}: ${(err as Error).message}`);
        } finally {
          setUploading((n) => n - 1);
        }
      }
      return added;
    },
    [onError],
  );

  const setAlt = useCallback(async (id: string, alt: string) => {
    setItems((current) => current.map((i) => (i.id === id ? { ...i, alt } : i)));
    await api(`/media/${id}`, { method: 'PATCH', body: { alt } });
  }, []);

  const remove = useCallback(async (id: string) => {
    await api(`/media/${id}`, { method: 'DELETE' });
    setItems((current) => current.filter((i) => i.id !== id));
  }, []);

  const pick = useCallback(() => {
    resolvePick.current?.(null);
    setPicking(true);
    return new Promise<MediaItem | null>((resolve) => {
      resolvePick.current = resolve;
    });
  }, []);

  const finishPick = useCallback((item: MediaItem | null) => {
    resolvePick.current?.(item);
    resolvePick.current = null;
    setPicking(false);
  }, []);

  // Esc closes the picker. Capture phase + stop, so the editor's own Esc handling
  // (deselecting the block behind the picker) doesn't also run.
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      finishPick(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [picking, finishPick]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const value = useMemo(
    () => ({ items, uploading, upload, setAlt, remove, pick }),
    [items, uploading, upload, setAlt, remove, pick],
  );

  return (
    <MediaStoreContext.Provider value={value}>
      <MediaContext.Provider value={byId}>
        <MediaPickerContext.Provider value={pick}>
          {children}
          {picking && (
            <div className="picker-backdrop" onClick={() => finishPick(null)}>
              <div
                className="picker media-picker"
                role="dialog"
                aria-label="Choose an image"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="picker-header">
                  <h2 className="picker-title">Choose an image</h2>
                  <p className="picker-sub">Pick from the library or upload a new one. Press Esc to cancel.</p>
                </div>
                <MediaLibrary mode="pick" onSelect={finishPick} />
              </div>
            </div>
          )}
        </MediaPickerContext.Provider>
      </MediaContext.Provider>
    </MediaStoreContext.Provider>
  );
}

export function useMedia(): MediaStoreValue {
  const ctx = useContext(MediaStoreContext);
  if (!ctx) throw new Error('useMedia must be used inside <MediaProvider>');
  return ctx;
}
