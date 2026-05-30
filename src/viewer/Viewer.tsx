import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Studio } from './Studio';
import { Product } from './Product';
import { CameraRig } from './CameraRig';
import { Postprocess } from './Postprocess';
import { DEFAULT_CONFIG } from '../store';

export function Viewer() {
  const cam = DEFAULT_CONFIG.camera;
  const initialFov = cam.presets[cam.active]?.fov ?? 28;
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
      }}
      camera={{ fov: initialFov, near: cam.near, far: cam.far, position: [2.4, 1.2, 3.2] }}
      onCreated={({ gl }) => {
        gl.setClearColor(0xdcdde0, 1);
      }}
    >
      <Suspense fallback={null}>
        <Studio />
        <Product />
      </Suspense>

      <CameraRig />
      <Postprocess />
    </Canvas>
  );
}
