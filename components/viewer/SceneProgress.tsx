'use client';
import { useProgress } from '@react-three/drei';

/**
 * Determinate scene-loading bar for the public share/embed pages. Reads drei's
 * global `useProgress` (fed by THREE.DefaultLoadingManager, which GLTFLoader and
 * RGBELoader report through). Rendered in the DOM, outside the Canvas. Hidden
 * before loading starts and once it finishes — but stays visible across any
 * transient `active:false` gap mid-load (e.g. between the GLB and HDRI batches).
 */
export function SceneProgress() {
  const { active, progress } = useProgress();
  if (!active && (progress === 0 || progress >= 100)) return null;
  const pct = Math.round(progress);
  return (
    <div
      className="scene-progress"
      role="progressbar"
      aria-label="Ładowanie sceny"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="scene-progress__track">
        <div className="scene-progress__bar" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
      <span className="scene-progress__label">Ładowanie sceny… {pct}%</span>
    </div>
  );
}
