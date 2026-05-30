import { useEffect, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, type Vec3 } from '../store';

/** Ikona 3D pojedynczej kamery: korpus + obiektyw skierowany na target. */
function CameraIcon({ id }: { id: string }) {
  const cam = useStore((s) => s.config.camera.presets[id]);
  const active = useStore((s) => s.config.camera.active) === id;
  const selected = useStore((s) => s.selected) === `cam:${id}`;
  const setSelected = useStore((s) => s.setSelected);
  const [grp, setGrp] = useState<THREE.Group | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (!grp || dragging.current || !cam) return;
    grp.position.fromArray(cam.position);
    grp.lookAt(new THREE.Vector3(cam.target[0], cam.target[1], cam.target[2]));
  }, [grp, cam]);

  if (!cam) return null;
  const color = selected ? '#4da3ff' : active ? '#74d18b' : '#9aa0ab';

  const writeBack = () => {
    if (!grp) return;
    const cur = useStore.getState().config.camera.presets[id];
    if (!cur) return;
    useStore.getState().capturePreset(id, { ...cur, position: grp.position.toArray() as Vec3 });
  };

  return (
    <>
      <group
        ref={setGrp}
        onClick={(e) => {
          e.stopPropagation();
          setSelected(`cam:${id}`);
        }}
      >
        <mesh>
          <boxGeometry args={[0.16, 0.12, 0.1]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.055, 0.1, 14]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>

      {grp && selected && (
        <TransformControls
          object={grp}
          mode="translate"
          size={0.6}
          onMouseDown={() => (dragging.current = true)}
          onMouseUp={() => {
            dragging.current = false;
            writeBack();
          }}
          onObjectChange={writeBack}
        />
      )}
    </>
  );
}

/** Ikony 3D wszystkich kamer sceny (jeden obiekt na kamerę). */
export function SceneIcons() {
  // Wybieramy stabilną referencję presetów; Object.keys liczymy poza selektorem,
  // inaczej selektor zwracałby nową tablicę co render → pętla useSyncExternalStore.
  const presets = useStore((s) => s.config.camera.presets);
  const ids = Object.keys(presets);
  return (
    <>
      {ids.map((id) => (
        <CameraIcon key={id} id={id} />
      ))}
    </>
  );
}
