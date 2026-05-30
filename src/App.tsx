import { Viewer } from './viewer/Viewer';
import { EditorView } from './viewer/EditorView';
import { ModelDropzone } from './viewer/ModelDropzone';
import { CameraButtons } from './ui/CameraButtons';
import { ViewButtons } from './ui/ViewButtons';
import { Outliner } from './ui/Outliner';
import { Inspector } from './ui/Inspector';
import { useStore } from './store';

export default function App() {
  const fileName = useStore((s) => s.loadedModel?.fileName);
  return (
    <div className="layout">
      {/* 1. Finalny render (kamera sceny) */}
      <main className="viewer">
        <div className="hud">
          <b>Finalny widok</b> <span>· {fileName ?? 'brak modelu'}</span>
        </div>
        <Viewer />
        <CameraButtons />
        <ModelDropzone />
      </main>

      {/* 2. Uproszczony viewport edycyjny (przełączane rzuty) */}
      <section className="editor-viewport">
        <div className="hud hud--editor">
          <b>Edycja</b> <span>· drag = orbit · scroll = zoom</span>
        </div>
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
