'use client';
import { useEffect, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, type Vec3 } from '../store';
import { reaimAfterRotation } from '@/lib/viewer/aim';

function CameraIcon({ id }: { id: string }) {
  const cam = useStore((s) => s.config.camera.cameras.find((c) => c.id === id));
  const active = useStore((s) => s.config.camera.active) === id;
  const selected = useStore((s) => s.selected) === `cam:${id}`;
  const mode = useStore((s) => s.aimGizmoMode);
  const setSelected = useStore((s) => s.setSelected);
  const [grp, setGrp] = useState<THREE.Group | null>(null);
  const [tgt, setTgt] = useState<THREE.Mesh | null>(null);
  const dragging = useRef(false);

  // store → camera body (skip during drag)
  useEffect(() => {
    if (!grp || dragging.current || !cam) return;
    grp.position.fromArray(cam.position);
    grp.lookAt(new THREE.Vector3(cam.target[0], cam.target[1], cam.target[2]));
  }, [grp, cam]);

  // store → target handle (skip during drag)
  useEffect(() => {
    if (!tgt || dragging.current || !cam) return;
    tgt.position.fromArray(cam.target);
  }, [tgt, cam]);

  if (!cam) return null;
  const color = selected ? '#4da3ff' : active ? '#74d18b' : '#9aa0ab';

  const writePos = () => {
    if (!grp) return;
    const cur = useStore.getState().config.camera.cameras.find((c) => c.id === id);
    if (!cur) return;
    useStore.getState().capturePreset(id, {
      position: grp.position.toArray() as Vec3,
      target: cur.target,
      fov: cur.fov,
    });
  };

  const writeRotate = () => {
    if (!grp) return;
    const cur = useStore.getState().config.camera.cameras.find((c) => c.id === id);
    if (!cur) return;
    const q = grp.quaternion;
    const target = reaimAfterRotation(cur.position, cur.target, [q.x, q.y, q.z, q.w]);
    useStore.getState().updateCamera(id, { target });
  };

  const writeTarget = () => {
    if (!tgt) return;
    useStore.getState().updateCamera(id, { target: tgt.position.toArray() as Vec3 });
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

      {/* Move / Rotate gizmo on the camera body */}
      {grp && selected && mode !== 'target' && (
        <TransformControls
          object={grp}
          mode={mode === 'rotate' ? 'rotate' : 'translate'}
          size={0.35}
          onMouseDown={() => (dragging.current = true)}
          onMouseUp={() => {
            dragging.current = false;
            if (mode === 'rotate') writeRotate();
            else writePos();
          }}
          onObjectChange={mode === 'rotate' ? writeRotate : writePos}
        />
      )}

      {/* Target handle + translate gizmo */}
      {selected && mode === 'target' && (
        <>
          <mesh ref={setTgt} position={cam.target}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#4da3ff" toneMapped={false} />
          </mesh>
          {tgt && (
            <TransformControls
              object={tgt}
              mode="translate"
              size={0.3}
              onMouseDown={() => (dragging.current = true)}
              onMouseUp={() => {
                dragging.current = false;
                writeTarget();
              }}
              onObjectChange={writeTarget}
            />
          )}
        </>
      )}
    </>
  );
}

export function SceneIcons() {
  const cameras = useStore((s) => s.config.camera.cameras);
  return (
    <>
      {cameras.map((c) => (
        <CameraIcon key={c.id} id={c.id} />
      ))}
    </>
  );
}
