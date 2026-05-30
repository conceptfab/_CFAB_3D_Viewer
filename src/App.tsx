import { Leva } from 'leva';
import { Viewer } from './viewer/Viewer';
import { ModelDropzone } from './viewer/ModelDropzone';
import { CameraButtons } from './ui/CameraButtons';
import { EditorPanel } from './ui/EditorPanel';
import { useStore } from './store';

export default function App() {
  const fileName = useStore((s) => s.loadedModel?.fileName);
  return (
    <div className="layout">
      {/* LEWA: finalny widok renderera */}
      <main className="viewer">
        <div className="hud">
          <b>GLTF Scene Editor</b>{' '}
          <span>· {fileName ?? 'brak modelu'} · drag = orbit · scroll = zoom</span>
        </div>
        <Viewer />
        <CameraButtons />
        <ModelDropzone />
      </main>

      {/* PRAWA: okno edycji sceny */}
      <aside className="editor-panel">
        <div className="editor-panel__title">Edycja sceny</div>
        <div className="editor-panel__body">
          <EditorPanel />
          <Leva fill flat titleBar={false} />
        </div>
      </aside>
    </div>
  );
}
