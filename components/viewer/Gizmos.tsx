'use client';
import { useEffect, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, type Vec3 } from '../store';

/**
 * Marker key-lighta w viewporcie edycyjnym. Zawsze widoczny (klik = zaznacz),
 * a gdy światło jest zaznaczone — dochodzi gizmo translacji. Sync store→uchwyt
 * pomijany w trakcie przeciągania.
 */
function LightGizmo() {
  const position = useStore((s) => s.config.keyLight.position);
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);
  const setKeyLight = useStore((s) => s.setKeyLight);
  const [handle, setHandle] = useState<THREE.Mesh | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (handle && !dragging.current) handle.position.fromArray(position);
  }, [handle, position]);

  const active = selected === 'light';

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
        <meshBasicMaterial color={active ? '#ffd23a' : '#b9962f'} toneMapped={false} />
      </mesh>
      {handle && active && (
        <TransformControls
          object={handle}
          mode="translate"
          size={0.4}
          onMouseDown={() => (dragging.current = true)}
          onMouseUp={() => (dragging.current = false)}
          onObjectChange={() => setKeyLight({ position: handle.position.toArray() as Vec3 })}
        />
      )}
    </>
  );
}

export function Gizmos() {
  return <LightGizmo />;
}
