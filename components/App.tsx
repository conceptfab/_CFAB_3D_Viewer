'use client';
import { useState } from 'react';
import { Viewer } from './viewer/Viewer';
import { EditorView } from './viewer/EditorView';
import { ModelDropzone } from './viewer/ModelDropzone';
import { CameraButtons } from './ui/CameraButtons';
import { ViewButtons } from './ui/ViewButtons';
import { Outliner } from './ui/Outliner';
import { Inspector } from './ui/Inspector';
import { Branding } from './ui/Branding';
import { SaveSceneDialog } from './scenes/SaveSceneDialog';

export default function App({ isAdmin = false }: { isAdmin?: boolean }) {
  const [saveMode, setSaveMode] = useState<'scene' | 'preset' | null>(null);

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
          <a
            href="/"
            title="Wyjdź do moich scen / panelu"
            style={{ fontSize: 12, fontWeight: 700, color: '#2a8a66', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            ← Sceny
          </a>
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
    </div>
  );
}
