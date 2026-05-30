import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useStore, type Vec3 } from '../store';

/**
 * Interaktywne uchwyty w widoku:
 *  - LightGizmo: złota kulka w pozycji key-lighta; przeciągnij = przesuń światło.
 *  - CameraTargetGizmo: niebieska kulka w punkcie, na który patrzy kamera (orbit
 *    target); przeciągnij = zmień kadr; zapis do aktywnego presetu kamery.
 * TransformControls drei sam wyłącza OrbitControls (makeDefault) na czas przeciągania.
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

function CameraTargetGizmo() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const active = useStore((s) => s.config.camera.active);
  const capturePreset = useStore((s) => s.capturePreset);
  const [handle, setHandle] = useState<THREE.Mesh | null>(null);
  const dragging = useRef(false);

  // Sync orbit-target → uchwyt (poza przeciąganiem).
  useEffect(() => {
    if (!handle || !controls) return;
    let raf = 0;
    const tick = () => {
      if (!dragging.current) handle.position.copy(controls.target);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [handle, controls]);

  return (
    <>
      <mesh ref={setHandle}>
        <sphereGeometry args={[0.07, 20, 20]} />
        <meshBasicMaterial color="#3a8ee0" toneMapped={false} />
      </mesh>
      {handle && (
        <TransformControls
          object={handle}
          mode="translate"
          size={0.7}
          onMouseDown={() => (dragging.current = true)}
          onMouseUp={() => {
            dragging.current = false;
            if (controls) {
              capturePreset(active, {
                position: camera.position.toArray() as Vec3,
                target: handle.position.toArray() as Vec3,
              });
            }
          }}
          onObjectChange={() => {
            if (controls) {
              controls.target.copy(handle.position);
              controls.update();
            }
          }}
        />
      )}
    </>
  );
}

export function Gizmos() {
  const showLight = useStore((s) => s.showLightGizmo);
  const showCamera = useStore((s) => s.showCameraGizmo);
  return (
    <>
      {showLight && <LightGizmo />}
      {showCamera && <CameraTargetGizmo />}
    </>
  );
}
