'use client';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Studio } from './Studio';
import { Product } from './Product';
import { CameraRig } from './CameraRig';
import { Postprocess } from './Postprocess';
import { ModelErrorBoundary } from './ModelErrorBoundary';
import { DEFAULT_CONFIG, useStore } from '../store';
import { CamProbe } from './_CamDebug';

export function Viewer() {
  const cam = DEFAULT_CONFIG.camera;
  const initialFov = cam.cameras.find((c) => c.id === cam.active)?.fov ?? 28;
  const setGlRef = useStore((s) => s.setGlRef);
  const modelUrl = useStore((s) => s.loadedModel?.objectUrl);
  const setModelError = useStore((s) => s.setModelError);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: false,
        alpha: false,
        toneMapping: THREE.NoToneMapping,
        toneMappingExposure: 1.0,
        outputColorSpace: THREE.SRGBColorSpace,
        preserveDrawingBuffer: true,   // wymagane do captureThumbnail (toDataURL)
      }}
      camera={{ fov: initialFov, near: cam.near, far: cam.far, position: [2.4, 1.2, 3.2] }}
      onCreated={({ gl }) => {
        gl.setClearColor(0xdcdde0, 1);
        setGlRef(gl);          // rejestracja dla captureThumbnail
      }}
    >
      <Suspense fallback={null}>
        <Studio />
        <ModelErrorBoundary key={modelUrl ?? 'none'} onError={setModelError}>
          <Product />
        </ModelErrorBoundary>
      </Suspense>

      <CameraRig />
      <CamProbe label="FINAL" />
      <Postprocess />
    </Canvas>
  );
}
