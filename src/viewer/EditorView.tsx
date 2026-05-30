import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
  OrthographicCamera,
  GizmoHelper,
  GizmoViewcube,
} from '@react-three/drei';
import { Product } from './Product';
import { Gizmos } from './Gizmos';
import { SceneIcons } from './SceneIcons';
import { useStore, type EditorView as EditorViewId, type Vec3 } from '../store';

/** Kierunki kamery dla rzutów ortograficznych (od strony osi w stronę środka). */
const ORTHO_DIR: Record<
  Exclude<EditorViewId, 'perspective' | 'camera'>,
  Vec3
> = {
  top: [0, 1, 0],
  bottom: [0, -1, 0],
  front: [0, 0, 1],
  back: [0, 0, -1],
  right: [1, 0, 0],
  left: [-1, 0, 0],
};

/** Światło kierunkowe odzwierciedlające key-light ze sceny (żeby edycja była widoczna). */
function EditorLights() {
  const key = useStore((s) => s.config.keyLight);
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#3a3d46', 0.6]} />
      <directionalLight
        position={key.position}
        intensity={Math.max(key.intensity, 0.6)}
        color={key.color}
      />
    </>
  );
}

function EditorRig({ view }: { view: EditorViewId }) {
  const [sx, sy, sz] = useStore((s) => s.modelSize);
  const cam = useStore((s) => s.config.camera);

  const midY = sy * 0.5;
  const target: Vec3 = [0, midY, 0];
  const R = Math.max(sx, sy, sz, 1) * 2.4;

  if (view === 'camera') {
    const p =
      cam.cameras.find((c) => c.id === cam.active) ?? cam.cameras[0];
    return (
      <>
        <PerspectiveCamera
          makeDefault
          fov={p.fov}
          near={cam.near}
          far={cam.far}
          position={p.position}
        />
        <OrbitControls makeDefault target={p.target} enableDamping dampingFactor={0.1} />
      </>
    );
  }

  if (view === 'perspective') {
    const pos: Vec3 = [R * 0.85, midY + R * 0.6, R * 0.85];
    return (
      <>
        <PerspectiveCamera makeDefault fov={40} near={0.05} far={500} position={pos} />
        <OrbitControls makeDefault target={target} enableDamping dampingFactor={0.1} />
      </>
    );
  }

  // Rzuty ortograficzne.
  const dir = ORTHO_DIR[view];
  const pos: Vec3 = [
    target[0] + dir[0] * R,
    target[1] + dir[1] * R,
    target[2] + dir[2] * R,
  ];
  const up: Vec3 = view === 'top' ? [0, 0, -1] : view === 'bottom' ? [0, 0, 1] : [0, 1, 0];
  const zoom = 320 / Math.max(sx, sy, sz, 0.6);

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={pos}
        up={up}
        zoom={zoom}
        near={0.01}
        far={R * 6}
      />
      <OrbitControls makeDefault target={target} enableRotate={false} />
    </>
  );
}

/** Środkowy, uproszczony viewport edycyjny: płaskie oświetlenie + grid + gizmo. */
export function EditorView() {
  const view = useStore((s) => s.editorView);
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true }} frameloop="always">
      <color attach="background" args={['#202227']} />

      <EditorLights />

      <Suspense fallback={null}>
        <Product interactive />
      </Suspense>

      <gridHelper args={[20, 40, '#454853', '#2c2e35']} />
      <axesHelper args={[1.5]} />

      <EditorRig key={view} view={view} />
      <Gizmos />
      <SceneIcons />

      {/* Nawigacyjna kostka widoku (jak w C4D/Blenderze) — klik na ściankę/krawędź
          obraca kamerę do danego rzutu. */}
      <GizmoHelper alignment="top-right" margin={[64, 64]}>
        <GizmoViewcube
          color="#3a3d46"
          textColor="#e8eaed"
          strokeColor="#1b1c20"
          hoverColor="#ffcc33"
        />
      </GizmoHelper>
    </Canvas>
  );
}
