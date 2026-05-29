import { Viewer } from './viewer/Viewer';
import { Configurator, CameraButtons } from './ui/Configurator';

export default function App() {
  return (
    <>
      <main className="viewer">
        <div className="hud">
          <b>Furniture Viewer</b> <span>· drag = orbit · scroll = zoom</span>
        </div>
        <Viewer />
        <CameraButtons />
      </main>
      <Configurator />
    </>
  );
}
