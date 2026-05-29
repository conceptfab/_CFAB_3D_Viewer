import { useMemo } from 'react';
import * as THREE from 'three';

function makeRadialAlpha(size = 512): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, '#ffffff');
  g.addColorStop(0.55, '#e0e0e0');
  g.addColorStop(1.0, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Props {
  radius?: number;
  color?: string;
  diskOpacity?: number;
  shadowOpacity?: number;
}

/**
 * Circular floor — two stacked CircleGeometry discs sharing the same radial
 * alpha mask:
 *
 *   1) MeshBasicMaterial + alphaMap  → visible feathered floor disc
 *   2) ShadowMaterial + alphaMap     → shadow catcher, naturally bounded
 *      by the same circular geometry & feathered identically
 *
 * Uses the directional light's castShadow in Studio. ShadowMaterial only
 * renders where shadow falls, so outside the model's silhouette → transparent.
 */
export function CircleFloor({
  radius = 2.5,
  color = '#d8d8d8',
  diskOpacity = 0.4,
  shadowOpacity = 0.55,
}: Props) {
  const alphaTex = useMemo(() => makeRadialAlpha(512), []);

  const shadowMat = useMemo(() => {
    const m = new THREE.ShadowMaterial({
      color: 0x000000,
      opacity: shadowOpacity,
      transparent: true,
    });
    m.alphaMap = alphaTex;
    return m;
  }, [alphaTex, shadowOpacity]);

  return (
    <>
      {/* Visible feathered floor */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.001} renderOrder={0}>
        <circleGeometry args={[radius, 96]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={diskOpacity}
          alphaMap={alphaTex}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Shadow catcher — same circular geometry → shadow is naturally circular */}
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={0.003}
        receiveShadow
        renderOrder={1}
      >
        <circleGeometry args={[radius, 96]} />
        <primitive object={shadowMat} attach="material" />
      </mesh>
    </>
  );
}
