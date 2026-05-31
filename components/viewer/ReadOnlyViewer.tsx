'use client';

// components/viewer/ReadOnlyViewer.tsx
// Final 3D scene renderer for public share/embed pages.
// Has ZERO editing affordances: no leva panel, no Outliner, no Inspector,
// no ModelDropzone, no save button, no gizmos/TransformControls.
// Camera switching (view-only) via CameraButtons is the only interaction.

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/components/store';
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
  // Initialise the global store synchronously before the first render.
  // useMemo with an empty dep-array fires exactly once per mount.
  useMemo(() => {
    const store = useStore.getState();

    // Push the full scene config into the store.
    store.setEnv(config.environment);
    store.setBackground(config.background);
    store.setKeyLight(config.keyLight);
    store.setShadows(config.shadows);
    store.setTone(config.tone);
    store.setMaterial(config.material);
    store.setBranding(config.branding);
    store.setHero(config.hero);

    // Patch camera (including orbit settings + cameras array) in one setState
    // so CameraRig reads the correct preset list immediately.
    useStore.setState((s) => ({
      config: {
        ...s.config,
        camera: { ...config.camera },
      },
    }));

    // Load the model from its Blob URL (no File object — view-only).
    if (modelUrl) {
      store.setLoadedModel({ objectUrl: modelUrl, fileName: '', file: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cam = config.camera;
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
