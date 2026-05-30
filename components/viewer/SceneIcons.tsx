'use client';
import { useEffect, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, type Vec3 } from '../store';

function CameraIcon({ id }: { id: string }) {
  const cam = useStore((s) => s.config.camera.cameras.find((c) => c.id === id));
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
    const cur = useStore.getState().config.camera.cameras.find((c) => c.id === id);
    if (!cur) return;
    useStore.getState().capturePreset(id, {
      position: grp.position.toArray() as Vec3,
      target: cur.target,
      fov: cur.fov,
    });
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
          size={0.35}
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

export function SceneIcons() {
  // Stabilna ref na tablicę — selektor nie liczy Object.keys, więc nie wytwarza
  // nowego obiektu co render (vide ticket o pętli useSyncExternalStore).
  const cameras = useStore((s) => s.config.camera.cameras);
  return (
    <>
      {cameras.map((c) => (
        <CameraIcon key={c.id} id={c.id} />
      ))}
    </>
  );
}
