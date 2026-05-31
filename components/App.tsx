'use client';
import { useState } from 'react';
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

export default function App({
  isAdmin = false,
  sceneId,
}: {
  isAdmin?: boolean;
  /** Ustawione tylko dla ZAPISANEJ sceny właściciela → pokazuje „Link publiczny". */
  sceneId?: string;
}) {
  const [saveMode, setSaveMode] = useState<'scene' | 'preset' | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

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
              onClick={() => setSaveMode('scene')}
              className="save-scene-btn"
              title="Zapisz scenę"
            >
              Zapisz scenę
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setSaveMode('preset')}
                className="save-scene-btn"
                title="Zapisz jako preset"
              >
                Jako preset
              </button>
            )}
            {sceneId && (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="save-scene-btn"
                title="Link publiczny / embed do tej sceny"
              >
                Link publiczny
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
          onClose={() => setSaveMode(null)}
        />
      )}

      {shareOpen && sceneId && (
        <ShareDialog sceneId={sceneId} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
