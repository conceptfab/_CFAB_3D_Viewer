import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Studio } from './Studio';
import { Product } from './Product';
import { CameraRig } from './CameraRig';
import { Postprocess } from './Postprocess';

export function Viewer() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: false, // SMAA in postprocess chain handles AA
        alpha: false, // scene <color> drives the background
        toneMapping: THREE.NoToneMapping, // ToneMapping pass applies the curve
        toneMappingExposure: 1.0,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ fov: 28, near: 0.05, far: 80, position: [2.4, 1.2, 3.2] }}
      onCreated={({ gl }) => {
        // Belt-and-braces: keep clear color in sync with the studio grey even if
        // scene.background gets mutated by Environment lifecycle during HMR.
        gl.setClearColor(0xdcdde0, 1);
      }}
    >
      <Suspense fallback={null}>
        <Studio />
        <Product />

        {/* Exposure / material sanity-check probe.
            color = #cccccc (light grey) — if this renders pure white,
            the scene is over-exposed (lighting too hot or tone mapping clipping). */}
        <mesh position={[0.9, 0.4, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.8, 48]} />
          <meshStandardMaterial color="#cccccc" roughness={0.6} metalness={0.0} />
        </mesh>
      </Suspense>

      <CameraRig />
      <Postprocess />
    </Canvas>
  );
}
