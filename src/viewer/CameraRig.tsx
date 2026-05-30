import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useStore } from '../store';

const TWEEN_MS = 700;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const active = useStore((s) => s.config.camera.active);
  const cameras = useStore((s) => s.config.camera.cameras);
  const near = useStore((s) => s.config.camera.near);
  const far = useStore((s) => s.config.camera.far);
  const orbit = useStore((s) => s.config.camera.orbit);
  const registerCameraApi = useStore((s) => s.registerCameraApi);

  // Imperatywny dostęp do aktualnego widoku (z fov) — dla "zapisz widok".
  useEffect(() => {
    registerCameraApi({
      getView: () => ({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: controlsRef.current
          ? [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z]
          : [0, 0, 0],
        fov: camera.fov,
      }),
    });
    return () => registerCameraApi(null);
  }, [camera, registerCameraApi]);

  // Live fov (z aktywnej kamery) / near / far.
  const activeFov = cameras.find((c) => c.id === active)?.fov ?? 28;
  useEffect(() => {
    camera.fov = activeFov;
    camera.near = near;
    camera.far = far;
    camera.updateProjectionMatrix();
  }, [camera, activeFov, near, far]);

  const tween = useRef<{
    start: number;
    fromPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toPos: THREE.Vector3;
    toTarget: THREE.Vector3;
  } | null>(null);

  // Tween przy zmianie aktywnej kamery (presety czytamy świeżo, by zapis/gizmo nie tweenował).
  useEffect(() => {
    if (!controlsRef.current) return;
    const view = useStore.getState().config.camera.cameras.find((c) => c.id === active);
    if (!view) return;
    tween.current = {
      start: performance.now(),
      fromPos: camera.position.clone(),
      fromTarget: controlsRef.current.target.clone(),
      toPos: new THREE.Vector3(...view.position),
      toTarget: new THREE.Vector3(...view.target),
    };
  }, [active, camera]);

  useFrame(() => {
    if (!tween.current || !controlsRef.current) return;
    const t = Math.min(1, (performance.now() - tween.current.start) / TWEEN_MS);
    const eased = easeInOutCubic(t);
    camera.position.lerpVectors(tween.current.fromPos, tween.current.toPos, eased);
    controlsRef.current.target.lerpVectors(tween.current.fromTarget, tween.current.toTarget, eased);
    controlsRef.current.update();
    if (t >= 1) tween.current = null;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={orbit.damping}
      minDistance={orbit.minDist}
      maxDistance={orbit.maxDist}
      minPolarAngle={orbit.minPolar}
      maxPolarAngle={orbit.maxPolar}
      makeDefault
    />
  );
}
