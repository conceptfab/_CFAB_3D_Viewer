import { useMemo } from 'react';
import * as THREE from 'three';
import { Environment, SoftShadows, ContactShadows } from '@react-three/drei';
import { useStore } from '../store';

/** Radialny gradient tła z 4 edytowalnych stopni koloru. */
function makeStudioBackground(
  stops: [string, string, string, string],
  centerY: number,
  size = 1024
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = size * 0.5;
  const cy = size * centerY;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.74);
  g.addColorStop(0.0, stops[0]);
  g.addColorStop(0.5, stops[1]);
  g.addColorStop(0.85, stops[2]);
  g.addColorStop(1.0, stops[3]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Studio() {
  const env = useStore((s) => s.config.environment);
  const bg = useStore((s) => s.config.background);
  const key = useStore((s) => s.config.keyLight);
  const shadows = useStore((s) => s.config.shadows);
  const [sx, sy, sz] = useStore((s) => s.modelSize);

  // Regeneracja tła tylko przy zmianie stopni/centerY.
  const background = useMemo(
    () => makeStudioBackground(bg.stops, bg.centerY),
    [bg.stops[0], bg.stops[1], bg.stops[2], bg.stops[3], bg.centerY]
  );

  const sphereR = 0.5 * Math.hypot(sx, sy, sz);
  const footprint = Math.max(sx, sz);
  const frustum = Math.max(sphereR * 1.6 + sy, 2.5);
  const aoScale = Math.max(footprint * 1.5, 1.8);
  const aoFar = Math.max(sy * 0.5, 0.4);

  return (
    <>
      <SoftShadows size={14} samples={24} focus={0.9} />

      <primitive attach="background" object={background} />

      <Environment
        files={env.hdriUrl}
        environmentIntensity={env.intensity}
        background={false}
        resolution={2048}
      />

      <directionalLight
        position={key.position}
        intensity={key.intensity}
        color={key.color}
        castShadow={key.castShadow}
        shadow-mapSize={[key.shadowMapSize, key.shadowMapSize]}
        shadow-bias={key.shadowBias}
        shadow-normalBias={key.normalBias}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-frustum, frustum, frustum, -frustum, 0.1, frustum * 6 + 10]}
        />
      </directionalLight>

      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial transparent opacity={shadows.catcherOpacity} color="#000000" />
      </mesh>

      <ContactShadows
        position={[0, 0.0015, 0]}
        scale={aoScale}
        blur={shadows.contactBlur}
        far={aoFar}
        opacity={shadows.contactOpacity}
        resolution={1024}
        color="#1a1a20"
        frames={Infinity}
      />
    </>
  );
}
