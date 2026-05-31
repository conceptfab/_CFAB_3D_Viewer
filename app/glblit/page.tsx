'use client';
// TEMP DEBUG ROUTE (public) — isolates the glBlitFramebuffer depth-stencil error.
// Mounts a minimal Canvas with the SAME gl config as Viewer.tsx + the real Postprocess.
// Delete after debugging.
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Postprocess } from '@/components/viewer/Postprocess';

export default function GlBlitDebugPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#222' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: false,
          alpha: false,
          toneMapping: THREE.NoToneMapping,
          toneMappingExposure: 1.0,
          outputColorSpace: THREE.SRGBColorSpace,
          preserveDrawingBuffer: true,
        }}
        camera={{ fov: 28, near: 0.1, far: 100, position: [2.4, 1.2, 3.2] }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 2]} castShadow />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="orange" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={-0.5} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#888" />
        </mesh>
        <Postprocess />
      </Canvas>
    </div>
  );
}
