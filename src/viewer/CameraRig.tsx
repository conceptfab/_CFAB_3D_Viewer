import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useStore, type CameraPreset } from '../store';

interface PresetView {
  position: [number, number, number];
  target: [number, number, number];
}

const PRESETS: Record<CameraPreset, PresetView> = {
  hero:   { position: [2.4, 1.4, 3.0], target: [0, 0.6, 0] },
  front:  { position: [0,   0.9, 3.2], target: [0, 0.6, 0] },
  side:   { position: [3.2, 0.9, 0.2], target: [0, 0.6, 0] },
  top:    { position: [0.1, 3.6, 0.1], target: [0, 0.0, 0] },
  detail: { position: [1.3, 0.7, 1.3], target: [0, 0.6, 0] },
};

const TWEEN_MS = 700;

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const preset = useStore((s) => s.camera);

  const tween = useRef<{
    start: number;
    fromPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toPos: THREE.Vector3;
    toTarget: THREE.Vector3;
  } | null>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    const target = PRESETS[preset];
    tween.current = {
      start: performance.now(),
      fromPos: camera.position.clone(),
      fromTarget: controlsRef.current.target.clone(),
      toPos: new THREE.Vector3(...target.position),
      toTarget: new THREE.Vector3(...target.target),
    };
  }, [preset, camera]);

  useFrame(() => {
    if (!tween.current || !controlsRef.current) return;
    const t = Math.min(1, (performance.now() - tween.current.start) / TWEEN_MS);
    const eased = easeInOutCubic(t);
    camera.position.lerpVectors(tween.current.fromPos, tween.current.toPos, eased);
    controlsRef.current.target.lerpVectors(
      tween.current.fromTarget,
      tween.current.toTarget,
      eased
    );
    controlsRef.current.update();
    if (t >= 1) tween.current = null;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={1.2}
      maxDistance={8}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.05}
      makeDefault
    />
  );
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
