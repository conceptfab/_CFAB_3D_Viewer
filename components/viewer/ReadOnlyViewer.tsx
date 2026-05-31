'use client';

// components/viewer/ReadOnlyViewer.tsx
// Final 3D scene renderer for public share/embed pages.
// Has ZERO editing affordances: no leva panel, no Outliner, no Inspector,
// no ModelDropzone, no save button, no gizmos/TransformControls.
// Camera switching (view-only) via CameraButtons is the only interaction.

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore, normalizeConfig } from '@/components/store';
import type { SceneConfig } from '@/components/store';

// Render-only components — same as the full editor viewer, minus anything editing.
import { Studio } from '@/components/viewer/Studio';
import { Product } from '@/components/viewer/Product';
import { CameraRig } from '@/components/viewer/CameraRig';
import { Postprocess } from '@/components/viewer/Postprocess';
import { Branding } from '@/components/ui/Branding';
import { CameraButtons } from '@/components/ui/CameraButtons';

export interface ReadOnlyViewerProps {
  config: SceneConfig;
  modelUrl: string | null;
}

/**
 * Mounts the full scene renderer without any editing UI.
 * Initialises the global store once with the DB-loaded scene config so that
 * Studio / Product / CameraRig / Postprocess / Branding / CameraButtons work
 * exactly as they do inside the editor — but the viewer never exposes any
 * setter to the user.
 *
 * This component is always loaded via ReadOnlyViewerClient (ssr:false) so it
 * only runs in the browser.
 */
export function ReadOnlyViewer({ config, modelUrl }: ReadOnlyViewerProps) {
  // Normalize so scenes saved before newer fields existed get valid defaults.
  const cfg = useMemo(() => normalizeConfig(config), [config]);

  // Initialise the global store synchronously before the first render.
  useMemo(() => {
    const store = useStore.getState();
    store.setEnv(cfg.environment);
    store.setBackground(cfg.background);
    store.setKeyLight(cfg.keyLight);
    store.setShadows(cfg.shadows);
    store.setTone(cfg.tone);
    store.setMaterial(cfg.material);
    store.setBranding(cfg.branding);
    store.setHero(cfg.hero);
    store.setAntialiasing(cfg.antialiasing);

    useStore.setState((s) => ({
      config: { ...s.config, camera: { ...cfg.camera } },
    }));

    if (modelUrl) {
      store.setLoadedModel({ objectUrl: modelUrl, fileName: '', file: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cam = cfg.camera;
  const initialFov = cam.cameras.find((c) => c.id === cam.active)?.fov ?? 28;

  return (
    <div className="read-only-viewer">
      {/* Branding badge — top-left, identical to final-view in the editor */}
      <Branding />

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
        camera={{
          fov: initialFov,
          near: cam.near,
          far: cam.far,
          position: [2.4, 1.2, 3.2],
        }}
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

      {/* Camera preset switch bar — view-only, no editing actions */}
      <CameraButtons />
    </div>
  );
}
