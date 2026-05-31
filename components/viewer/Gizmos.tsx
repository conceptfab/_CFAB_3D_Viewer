'use client';
import { useEffect, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, type Vec3 } from '../store';
import { reaimAfterRotation } from '@/lib/viewer/aim';

/**
 * Key-light marker in the editing viewport. Always clickable (select), and when
 * selected it shows a gizmo whose behaviour follows `aimGizmoMode`:
 * translate = move position, rotate = re-aim target, target = move the aim point.
 */
function LightGizmo() {
  const position = useStore((s) => s.config.keyLight.position);
  const target = useStore((s) => s.config.keyLight.target);
  const selected = useStore((s) => s.selected) === 'light';
  const mode = useStore((s) => s.aimGizmoMode);
  const setSelected = useStore((s) => s.setSelected);
  const setKeyLight = useStore((s) => s.setKeyLight);
  const [handle, setHandle] = useState<THREE.Mesh | null>(null);
  const [tgt, setTgt] = useState<THREE.Mesh | null>(null);
  const dragging = useRef(false);

  // store → light marker (position + orientation toward target)
  useEffect(() => {
    if (!handle || dragging.current) return;
    handle.position.fromArray(position);
    handle.lookAt(new THREE.Vector3(target[0], target[1], target[2]));
  }, [handle, position, target]);

  // store → target handle
  useEffect(() => {
    if (!tgt || dragging.current) return;
    tgt.position.fromArray(target);
  }, [tgt, target]);

  const writeMove = () => {
    if (!handle) return;
    setKeyLight({ position: handle.position.toArray() as Vec3 });
  };

  const writeRotate = () => {
    if (!handle) return;
    const cur = useStore.getState().config.keyLight;
    const q = handle.quaternion;
    const next = reaimAfterRotation(cur.position, cur.target, [q.x, q.y, q.z, q.w]);
    setKeyLight({ target: next });
  };

  const writeTarget = () => {
    if (!tgt) return;
    setKeyLight({ target: tgt.position.toArray() as Vec3 });
  };

  return (
    <>
      <mesh
        ref={setHandle}
        position={position}
        onClick={(e) => {
          e.stopPropagation();
          setSelected('light');
        }}
      >
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshBasicMaterial color={selected ? '#ffd23a' : '#b9962f'} toneMapped={false} />
      </mesh>

      {/* Move / Rotate gizmo on the light marker */}
      {handle && selected && mode !== 'target' && (
        <TransformControls
          object={handle}
          mode={mode === 'rotate' ? 'rotate' : 'translate'}
          size={0.4}
          onMouseDown={() => (dragging.current = true)}
          onMouseUp={() => {
            dragging.current = false;
            if (mode === 'rotate') writeRotate();
            else writeMove();
          }}
          onObjectChange={mode === 'rotate' ? writeRotate : writeMove}
        />
      )}

      {/* Target handle + translate gizmo */}
      {selected && mode === 'target' && (
        <>
          <mesh ref={setTgt} position={target}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#ffd23a" toneMapped={false} />
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

export function Gizmos() {
  return <LightGizmo />;
}
