import type { Vec3 } from '@/components/store';

/**
 * Why this exists
 * ----------------
 * The final view (CameraRig) drives the active scene camera through drei
 * `OrbitControls`. OrbitControls re-clamps the camera to its distance / polar
 * limits on EVERY `update()`. So an authored camera whose pose lies outside
 * those limits (e.g. a low "looking-up" shot with polar angle > maxPolarAngle,
 * or one farther than maxDistance) is silently pulled to the nearest allowed
 * pose — producing a DIFFERENT framing than the editor's camera view, which
 * uses unconstrained OrbitControls.
 *
 * The editor is where cameras are authored (free, unclamped). The final view
 * must reproduce them faithfully. So we widen the final view's limits to always
 * include every authored camera: manual orbit is still bounded, but no preset
 * is ever clamped, and the two viewports match.
 */

export interface OrbitBase {
  minDist: number;
  maxDist: number;
  minPolar: number;
  maxPolar: number;
}

export interface OrbitLimits {
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
}

const MIN_DIST = 1e-4;
// Small slack so floating-point error never re-clamps a preset that sits exactly
// on a boundary (OrbitControls clamps inclusively, but acos/hypot round-off can
// push a value a hair past the edge).
const EPS_ANGLE = 1e-3; // rad (~0.057°)
const EPS_DIST = 1e-3; // 0.1%

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Distance from target and polar angle (from +Y, matching three's Spherical /
 * OrbitControls.getPolarAngle) for a camera at `position` aimed at `target`.
 */
export function cameraSpherical(
  position: Vec3,
  target: Vec3,
): { dist: number; polar: number } {
  const dx = position[0] - target[0];
  const dy = position[1] - target[1];
  const dz = position[2] - target[2];
  const dist = Math.max(Math.hypot(dx, dy, dz), MIN_DIST);
  const polar = Math.acos(clamp(dy / dist, -1, 1));
  return { dist, polar };
}

/**
 * Expand `base` orbit limits so every camera pose fits inside them (plus a tiny
 * epsilon). Returns drei-OrbitControls-shaped props. If `cams` is empty, returns
 * the base limits unchanged.
 */
export function fitOrbitLimits(
  base: OrbitBase,
  cams: ReadonlyArray<{ position: Vec3; target: Vec3 }>,
): OrbitLimits {
  let minDistance = base.minDist;
  let maxDistance = base.maxDist;
  let minPolarAngle = base.minPolar;
  let maxPolarAngle = base.maxPolar;

  for (const c of cams) {
    const { dist, polar } = cameraSpherical(c.position, c.target);
    if (dist < minDistance) minDistance = dist;
    if (dist > maxDistance) maxDistance = dist;
    if (polar < minPolarAngle) minPolarAngle = polar;
    if (polar > maxPolarAngle) maxPolarAngle = polar;
  }

  return {
    minDistance: Math.max(0, minDistance * (1 - EPS_DIST)),
    maxDistance: maxDistance * (1 + EPS_DIST),
    minPolarAngle: clamp(minPolarAngle - EPS_ANGLE, 0, Math.PI),
    maxPolarAngle: clamp(maxPolarAngle + EPS_ANGLE, 0, Math.PI),
  };
}
