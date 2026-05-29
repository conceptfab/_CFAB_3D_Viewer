import { useMemo } from 'react';
import * as THREE from 'three';
import { Environment, SoftShadows, ContactShadows } from '@react-three/drei';
import { useStore } from '../store';

/**
 * Studio backdrop matched to the reference benchmark:
 *  - Radial-gradient background (bright centre → darker edges) drawn as a
 *    full-screen scene.background texture → smooth vignette, NO horizon line,
 *    NO floor mesh.
 *  - 4k HDRI for soft ambient fill + crisp env reflections on chrome/metal.
 *  - ONE gentle key directional light (upper-front-left) for form + self-shadow.
 *    Kept low so the #ccc control probe stays grey (not blown to white).
 *  - Soft DIRECTIONAL ground shadow: the key light casts onto a transparent
 *    ShadowMaterial catcher (invisible except where the shadow falls, so no
 *    floor quad). PCSS (drei SoftShadows) gives a realistic contact-hardening
 *    penumbra — sharper at contact, softer with distance — and, unlike VSM, has
 *    NO light-bleeding streaks on thin/overlapping geometry (e.g. tripod legs).
 */

/** Radial vignette gradient — bright centre, gently darker toward the edges. */
function makeStudioBackground(size = 1024): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  // Centre sits slightly above the middle, like the benchmark.
  const cx = size * 0.5;
  const cy = size * 0.44;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.74);
  g.addColorStop(0.0, '#eeeef1');
  g.addColorStop(0.5, '#dcdce0');
  g.addColorStop(0.85, '#c6c7cd');
  g.addColorStop(1.0, '#b4b5bc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Studio() {
  const background = useMemo(() => makeStudioBackground(), []);

  // Everything object-dependent is derived from the current model's world size,
  // so the studio works for any dynamically swapped object.
  const [sx, sy, sz] = useStore((s) => s.modelSize);
  const sphereR = 0.5 * Math.hypot(sx, sy, sz); // bounding-sphere radius
  const footprint = Math.max(sx, sz); // widest ground dimension
  // Frustum must cover the object AND the shadow it projects onto the ground
  // (the key light is angled, so the shadow extends ~one object height away).
  const frustum = Math.max(sphereR * 1.6 + sy, 2.5);
  // Tight contact-AO footprint at the base (grounding, on the floor plane only).
  const aoScale = Math.max(footprint * 1.5, 1.8);
  const aoFar = Math.max(sy * 0.5, 0.4);

  return (
    <>
      {/* PCSS soft shadows for every shadow-casting light. Tighter blur (size)
          + more samples + a 4K map below keep the penumbra clean on thin
          geometry (tripod legs) instead of breaking into light streaks. */}
      <SoftShadows size={14} samples={24} focus={0.9} />

      <primitive attach="background" object={background} />

      <Environment
        files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/studio_small_03_4k.hdr"
        environmentIntensity={0.45}
        background={false}
        resolution={2048}
      />

      {/* Single gentle key light — soft form + product self-shadow. Intensity is
          deliberately low so the IBL stays dominant and the #ccc probe stays
          grey instead of clipping to white. */}
      <directionalLight
        position={[-2.5, 4, 3]}
        intensity={0.55}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.00012}
        shadow-normalBias={0.012}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-frustum, frustum, frustum, -frustum, 0.1, frustum * 6 + 10]}
        />
      </directionalLight>

      {/* Transparent ground catcher — shows only the soft directional shadow,
          no visible plane (ShadowMaterial is transparent elsewhere). */}
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial transparent opacity={0.3} color="#000000" />
      </mesh>

      {/* Ground contact-AO (floor-plane, NOT screen-space → no haloing around
          thin legs). smooth=false avoids ghost trails while orbiting. */}
      <ContactShadows
        position={[0, 0.0015, 0]}
        scale={aoScale}
        blur={2}
        far={aoFar}
        opacity={0.3}
        resolution={1024}
        color="#1a1a20"
        frames={1}
        smooth={false}
      />
    </>
  );
}
