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

export default function App() {
  const [saveOpen, setSaveOpen] = useState(false);

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
          Outliner
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            className="save-scene-btn"
            title="Zapisz scenę"
          >
            Zapisz scenę
          </button>
        </div>
        <Outliner />
        <Inspector />
      </aside>

      {saveOpen && <SaveSceneDialog onClose={() => setSaveOpen(false)} />}
    </div>
  );
}
