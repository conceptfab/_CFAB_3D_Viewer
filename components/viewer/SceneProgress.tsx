'use client';
import { useProgress } from '@react-three/drei';

/**
 * Determinate scene-loading bar for the public share/embed pages. Reads drei's
 * global `useProgress` (fed by THREE.DefaultLoadingManager, which GLTFLoader and
 * RGBELoader report through). Rendered in the DOM, outside the Canvas. Hidden
 * when nothing is loading.
 */
export function SceneProgress() {
  const { active, progress } = useProgress();
  if (!active) return null;
  const pct = Math.round(progress);
  return (
    <div
      className="scene-progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="scene-progress__track">
        <div className="scene-progress__bar" style={{ width: `${progress}%` }} />
      </div>
      <span className="scene-progress__label">Ładowanie sceny… {pct}%</span>
    </div>
  );
}
