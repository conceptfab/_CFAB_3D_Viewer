import { useEffect, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, type Vec3 } from '../store';

/**
 * Uchwyt światła w viewporcie edycyjnym: złota kulka w pozycji key-lighta,
 * przeciągnij = przesuń światło (zapis do storu na żywo). TransformControls drei
 * sam wyłącza aktywne OrbitControls na czas przeciągania.
 */
function LightGizmo() {
  const position = useStore((s) => s.config.keyLight.position);
  const setKeyLight = useStore((s) => s.setKeyLight);
  const [handle, setHandle] = useState<THREE.Mesh | null>(null);
  const dragging = useRef(false);

  // Sync store → uchwyt, ale nie w trakcie przeciągania (uniknięcie sprzężenia).
  useEffect(() => {
    if (handle && !dragging.current) handle.position.fromArray(position);
  }, [handle, position]);

  return (
    <>
      <mesh ref={setHandle} position={position}>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshBasicMaterial color="#ffcc33" toneMapped={false} />
      </mesh>
      {handle && (
        <TransformControls
          object={handle}
          mode="translate"
          size={0.7}
          onMouseDown={() => (dragging.current = true)}
          onMouseUp={() => (dragging.current = false)}
          onObjectChange={() =>
            setKeyLight({ position: handle.position.toArray() as Vec3 })
          }
        />
      )}
    </>
  );
}

export function Gizmos() {
  const showLight = useStore((s) => s.showLightGizmo);
  return <>{showLight && <LightGizmo />}</>;
}
