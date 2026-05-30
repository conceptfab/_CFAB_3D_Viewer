import { Viewer } from './viewer/Viewer';
import { EditorView } from './viewer/EditorView';
import { ModelDropzone } from './viewer/ModelDropzone';
import { CameraButtons } from './ui/CameraButtons';
import { ViewButtons } from './ui/ViewButtons';
import { Outliner } from './ui/Outliner';
import { Inspector } from './ui/Inspector';
import { Branding } from './ui/Branding';

export default function App() {
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
        <div className="editor-panel__title">Outliner</div>
        <Outliner />
        <Inspector />
      </aside>
    </div>
  );
}
