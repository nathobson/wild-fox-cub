import { useCallback, useEffect, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { BlockPicker } from './components/BlockPicker';
import { Canvas } from './components/Canvas';
import { InboxPanel } from './components/InboxPanel';
import { MediaPanel } from './components/MediaLibrary';
import { Inspector } from './components/Inspector';
import { PageDialog } from './components/PageDialog';
import { SettingsPanel } from './components/SettingsPanel';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { Toasts, type ToastData } from './components/Toasts';
import { UsersPanel } from './components/UsersPanel';
import { api, authClient, type SiteState } from './lib/api';
import { MediaProvider } from './store/MediaStore';
import { SiteProvider, useSite } from './store/SiteStore';
import type { Device, EditorMode } from './types';

export type View = 'editor' | 'media' | 'settings' | 'users' | 'inbox';

interface ShellProps {
  userEmail: string;
  onSignOut: () => void;
}

function AppShell({ userEmail, onSignOut }: ShellProps) {
  const { site, activePage, updateBlock, removeBlock, duplicateBlock, flush, publish, discardChanges } =
    useSite();
  const [view, setView] = useState<View>('editor');
  const [pageDialog, setPageDialog] = useState<{ pageId: string | null } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [mode, setMode] = useState<EditorMode>('edit');
  const [device, setDevice] = useState<Device>('desktop');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const pushToast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // Deselect when switching pages, modes or views.
  useEffect(() => {
    setSelectedBlockId(null);
  }, [activePage.id, mode, view]);

  // Keyboard: Esc closes picker / deselects; Cmd/Ctrl+S saves.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pickerIndex !== null) {
          setPickerIndex(null);
        } else if (selectedBlockId !== null) {
          setSelectedBlockId(null);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        flush().then(
          () => pushToast('All changes saved'),
          () => pushToast('Could not save — check your connection'),
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pickerIndex, selectedBlockId, pushToast, flush]);

  const selectedBlock = activePage.blocks.find((b) => b.id === selectedBlockId) ?? null;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publish();
      pushToast('Published — your changes are live');
    } catch (err) {
      pushToast(`Publish failed: ${(err as Error).message}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscard = async () => {
    try {
      await discardChanges();
      setSelectedBlockId(null);
      pushToast('Unpublished changes discarded');
    } catch (err) {
      pushToast((err as Error).message);
    }
  };

  return (
    <MediaProvider onError={pushToast}>
      <div className="wallpaper" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="window">
        <Sidebar
          view={view}
          onViewChange={setView}
          userEmail={userEmail}
          onAddPage={() => setPageDialog({ pageId: null })}
          onEditPage={(pageId) => setPageDialog({ pageId })}
          onDiscard={handleDiscard}
          onSignOut={onSignOut}
        />
        <div className="main-col">
          <Toolbar
            title={`Fox Cub CMS — ${site.name || 'Untitled site'}`}
            showEditorControls={view === 'editor'}
            mode={mode}
            onModeChange={setMode}
            device={device}
            onDeviceChange={setDevice}
            publishing={publishing}
            onPublish={handlePublish}
          />
          {view === 'media' && <MediaPanel />}
          {view === 'settings' && <SettingsPanel />}
          {view === 'users' && <UsersPanel onToast={pushToast} />}
          {view === 'inbox' && <InboxPanel />}
          <div className="workspace" hidden={view !== 'editor'}>
            <Canvas
              mode={mode}
              device={device}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
              onOpenPicker={setPickerIndex}
            />
            <Inspector
              open={mode === 'edit' && selectedBlock !== null}
              block={selectedBlock}
              onClose={() => setSelectedBlockId(null)}
              onUpdate={(patch) => {
                if (selectedBlock) updateBlock(activePage.id, selectedBlock.id, patch);
              }}
              onDuplicate={() => {
                if (!selectedBlock) return;
                const id = duplicateBlock(activePage.id, selectedBlock.id);
                if (id) setSelectedBlockId(id);
              }}
              onRemove={() => {
                if (selectedBlock) removeBlock(activePage.id, selectedBlock.id);
              }}
            />
          </div>
        </div>
      </div>
      {pickerIndex !== null && (
        <BlockPicker
          index={pickerIndex}
          onClose={() => setPickerIndex(null)}
          onInserted={(id) => setSelectedBlockId(id)}
        />
      )}
      {pageDialog && <PageDialog pageId={pageDialog.pageId} onClose={() => setPageDialog(null)} />}
      <Toasts toasts={toasts} />
    </MediaProvider>
  );
}

/** Loads the draft site once signed in. */
function Editor(props: ShellProps) {
  const [state, setState] = useState<SiteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SiteState>('/site').then(setState, (err: Error) => setError(err.message));
  }, []);

  if (error) return <Splash message={`Could not load the site: ${error}`} />;
  if (!state) return <Splash message="Loading…" />;
  return (
    <SiteProvider initial={state}>
      <AppShell {...props} />
    </SiteProvider>
  );
}

function Splash({ message }: { message: string }) {
  return (
    <>
      <div className="wallpaper" aria-hidden="true" />
      <main className="auth-screen">
        <p className="splash">{message}</p>
      </main>
    </>
  );
}

export default function App() {
  const session = authClient.useSession();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const signedIn = Boolean(session.data);

  useEffect(() => {
    if (session.isPending || signedIn) return;
    api<{ needsSetup: boolean }>('/setup').then(
      (res) => setNeedsSetup(res.needsSetup),
      () => setNeedsSetup(false),
    );
  }, [session.isPending, signedIn]);

  if (session.isPending) return <Splash message="Loading…" />;

  if (!session.data) {
    if (needsSetup === null) return <Splash message="Loading…" />;
    return (
      <AuthScreen
        setup={needsSetup}
        onDone={() => {
          setNeedsSetup(false);
          void session.refetch();
        }}
      />
    );
  }

  return (
    <Editor
      key={session.data.user.id}
      userEmail={session.data.user.email}
      onSignOut={async () => {
        await authClient.signOut();
        void session.refetch();
      }}
    />
  );
}
