// components/studio/StudioViewport.tsx
'use client';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, GizmoHelper, GizmoViewcube } from '@react-three/drei';
import * as THREE from 'three';
import { Studio } from '../viewer/Studio';
import { Postprocess } from '../viewer/Postprocess';
import { CameraRig } from '../viewer/CameraRig';
import { StudioActor } from './StudioActor';
import { useStore, DEFAULT_CONFIG } from '../store';
import type { StudioMode } from './ViewToggle';

function EditLights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#3a3d46', 0.6]} />
      <directionalLight position={[-2.5, 4, 3]} intensity={0.7} />
    </>
  );
}

export function StudioViewport({ mode }: { mode: StudioMode }) {
  const scene = useStore((s) => s.studioScene);
  const [sx, sy, sz] = useStore((s) => s.modelSize);
  const R = Math.max(sx, sy, sz, 1) * 2.4;
  const midY = sy * 0.5;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cam = DEFAULT_CONFIG.camera;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: mode === 'edit',
        alpha: false,
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
        preserveDrawingBuffer: true, // captureThumbnail
      }}
      camera={{ fov: 40, near: 0.05, far: 500, position: [R * 0.85, midY + R * 0.6, R * 0.85] }}
      onCreated={({ gl }) => { gl.setClearColor(mode === 'edit' ? 0x202227 : 0xdcdde0, 1); useStore.getState().setGlRef(gl); }}
    >
      {mode === 'render' && (
        <Suspense fallback={null}>
          <Studio />
        </Suspense>
      )}
      {mode === 'edit' && (
        <>
          <color attach="background" args={['#202227']} />
          <EditLights />
          <gridHelper args={[20, 40, '#454853', '#2c2e35']} />
          <axesHelper args={[1.5]} />
          <GizmoHelper alignment="top-right" margin={[64, 64]}>
            <GizmoViewcube color="#3a3d46" textColor="#e8eaed" strokeColor="#1b1c20" hoverColor="#ffcc33" />
          </GizmoHelper>
        </>
      )}

      <Suspense fallback={null}>{scene && <StudioActor scene={scene} />}</Suspense>

      {mode === 'render' ? (
        <>
          <CameraRig />
          <Postprocess />
        </>
      ) : (
        <>
          <PerspectiveCamera makeDefault fov={40} near={0.05} far={500} position={[R * 0.85, midY + R * 0.6, R * 0.85]} />
          <OrbitControls makeDefault target={[0, midY, 0]} enableDamping dampingFactor={0.1} />
        </>
      )}
    </Canvas>
  );
}
