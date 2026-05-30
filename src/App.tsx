import { Leva } from 'leva';
import { Viewer } from './viewer/Viewer';
import { ModelDropzone } from './viewer/ModelDropzone';
import { EditorPanel } from './ui/EditorPanel';
import { useStore } from './store';

export default function App() {
  const fileName = useStore((s) => s.loadedModel?.fileName);
  return (
    <>
      <main className="viewer">
        <div className="hud">
          <b>GLTF Scene Editor</b>{' '}
          <span>· {fileName ?? 'brak modelu'} · drag = orbit · scroll = zoom</span>
        </div>
        <Viewer />
        <ModelDropzone />
      </main>
      <EditorPanel />
      <Leva collapsed={false} />
    </>
  );
}
