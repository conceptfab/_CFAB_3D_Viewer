'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Viewer } from './viewer/Viewer';
import { EditorView } from './viewer/EditorView';
import { ModelDropzone } from './viewer/ModelDropzone';
import { CameraButtons } from './ui/CameraButtons';
import { ViewButtons } from './ui/ViewButtons';
import { Outliner } from './ui/Outliner';
import { Inspector } from './ui/Inspector';
import { Branding } from './ui/Branding';
import { SaveSceneDialog } from './scenes/SaveSceneDialog';
import { ShareDialog } from './scenes/ShareDialog';
import { IconSave, IconSaveAs, IconPreset, IconLink } from './ui/icons';
import { useStore } from './store';
import { updateSceneInPlace } from './scenes/updateScene';

export default function App({
  isAdmin = false,
  sceneId,
  sceneTitle,
}: {
  isAdmin?: boolean;
  /** Ustawione tylko dla ZAPISANEJ sceny właściciela → „Zapisz" nadpisuje w miejscu. */
  sceneId?: string;
  /** Tytuł zapisanej sceny — do „Zapisz jako (kopia)". */
  sceneTitle?: string;
}) {
  const [saveMode, setSaveMode] = useState<'scene' | 'preset' | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Auto-ukryj potwierdzenie sukcesu; błędy zostają do następnej akcji.
  useEffect(() => {
    if (toast?.kind !== 'ok') return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // „Zapisz" dla istniejącej sceny: nadpisuje config + miniaturę (bez pytania o nazwę).
  const handleSaveInPlace = async () => {
    const { glRef, config } = useStore.getState();
    if (!sceneId) return;
    if (!glRef) {
      setToast({ kind: 'err', text: 'Renderer niedostępny — spróbuj ponownie.' });
      return;
    }
    setSaveBusy(true);
    setToast(null);
    try {
      await updateSceneInPlace(sceneId, config, glRef);
      setToast({ kind: 'ok', text: 'Zapisano zmiany.' });
    } catch (e) {
      setToast({ kind: 'err', text: e instanceof Error ? e.message : 'Błąd zapisu.' });
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="layout">
      {/* 1. Finalny render (kamera sceny) */}
      <main className="viewer">
        <Branding />
        <Viewer />
        <CameraButtons />
        <ModelDropzone />
      </main>

      {/* 2. Uproszczony viewport edycyjny (przełączane rzuty) */}
      <section className="editor-viewport">
        <ViewButtons />
        <EditorView />
      </section>

      {/* 3. Outliner + inspektor kontekstowy */}
      <aside className="editor-panel">
        <div className="editor-panel__title">
          <Link
            href="/"
            title="Wyjdź do moich scen / panelu"
            style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-2)', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            ← Sceny
          </Link>
          <span>Outliner</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => (sceneId ? handleSaveInPlace() : setSaveMode('scene'))}
              className="icon-btn"
              disabled={saveBusy}
              title={sceneId ? 'Zapisz — nadpisz tę scenę' : 'Zapisz scenę'}
              aria-label={sceneId ? 'Zapisz — nadpisz tę scenę' : 'Zapisz scenę'}
            >
              <IconSave />
            </button>
            {sceneId && (
              <button
                type="button"
                onClick={() => setSaveMode('scene')}
                className="icon-btn"
                disabled={saveBusy}
                title="Zapisz jako nową scenę (kopia)"
                aria-label="Zapisz jako nową scenę"
              >
                <IconSaveAs />
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setSaveMode('preset')}
                className="icon-btn"
                disabled={saveBusy}
                title="Zapisz jako preset"
                aria-label="Zapisz jako preset"
              >
                <IconPreset />
              </button>
            )}
            {sceneId && (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="icon-btn"
                // title = verbose tooltip; aria-label = concise accessible name
                title="Link publiczny / embed do tej sceny"
                aria-label="Link publiczny"
              >
                <IconLink />
              </button>
            )}
          </div>
        </div>
        <Outliner />
        <Inspector />
      </aside>

      {saveMode && (
        <SaveSceneDialog
          preset={saveMode === 'preset'}
          defaultTitle={saveMode === 'scene' && sceneId && sceneTitle ? `${sceneTitle} (kopia)` : ''}
          onClose={() => setSaveMode(null)}
        />
      )}

      {shareOpen && sceneId && (
        <ShareDialog sceneId={sceneId} onClose={() => setShareOpen(false)} />
      )}

      {toast && (
        <div className={`save-toast save-toast--${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
