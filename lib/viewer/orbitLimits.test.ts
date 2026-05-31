import { describe, it, expect } from 'vitest';
import { cameraSpherical, fitOrbitLimits, type OrbitBase } from './orbitLimits';
import type { Vec3 } from '@/components/store';

// Matches DEFAULT_CONFIG.camera.orbit.
const BASE: OrbitBase = {
  minDist: 1.2,
  maxDist: 8,
  minPolar: 0.15, // ~8.6°
  maxPolar: Math.PI / 2 - 0.05, // ~87.1°
};

describe('cameraSpherical', () => {
  it('a level camera (same Y as target) has polar ≈ 90°', () => {
    const { polar } = cameraSpherical([3, 1, 0], [0, 1, 0]);
    expect(polar).toBeCloseTo(Math.PI / 2, 5);
  });

  it('a top-down camera has a small polar angle', () => {
    // DEFAULT "top" camera.
    const { dist, polar } = cameraSpherical([0.1, 3.6, 0.1], [0, 0, 0]);
    expect(dist).toBeCloseTo(3.6028, 3);
    expect(polar).toBeLessThan(BASE.minPolar); // ~2.3° < 8.6° → would be clamped
  });

  it('a looking-up camera (below target) has polar > 90°', () => {
    const { polar } = cameraSpherical([3, 0.5, 0], [0, 1.5, 0]);
    expect(polar).toBeGreaterThan(Math.PI / 2);
  });

  it('clamps degenerate position==target without NaN', () => {
    const { dist, polar } = cameraSpherical([0, 1, 0], [0, 1, 0]);
    expect(Number.isFinite(dist)).toBe(true);
    expect(Number.isFinite(polar)).toBe(true);
  });
});

describe('fitOrbitLimits', () => {
  it('returns base limits (within epsilon) when no cameras given', () => {
    const out = fitOrbitLimits(BASE, []);
    expect(out.minDistance).toBeLessThanOrEqual(BASE.minDist);
    expect(out.maxDistance).toBeGreaterThanOrEqual(BASE.maxDist);
    expect(out.minPolarAngle).toBeLessThanOrEqual(BASE.minPolar);
    expect(out.maxPolarAngle).toBeGreaterThanOrEqual(BASE.maxPolar);
  });

  it('lowers minPolarAngle to admit a top-down camera', () => {
    const top: { position: Vec3; target: Vec3 } = {
      position: [0.1, 3.6, 0.1],
      target: [0, 0, 0],
    };
    const { polar } = cameraSpherical(top.position, top.target);
    const out = fitOrbitLimits(BASE, [top]);
    expect(out.minPolarAngle).toBeLessThanOrEqual(polar);
  });

  it('raises maxPolarAngle to admit a looking-up camera', () => {
    const up: { position: Vec3; target: Vec3 } = {
      position: [3, 0.5, 0],
      target: [0, 1.5, 0],
    };
    const { polar } = cameraSpherical(up.position, up.target);
    expect(polar).toBeGreaterThan(BASE.maxPolar); // outside base → must expand
    const out = fitOrbitLimits(BASE, [up]);
    expect(out.maxPolarAngle).toBeGreaterThanOrEqual(polar);
  });

  it('widens distance range to admit a far camera', () => {
    const far: { position: Vec3; target: Vec3 } = {
      position: [0, 5, 20],
      target: [0, 0, 0],
    };
    const { dist } = cameraSpherical(far.position, far.target);
    expect(dist).toBeGreaterThan(BASE.maxDist);
    const out = fitOrbitLimits(BASE, [far]);
    expect(out.maxDistance).toBeGreaterThanOrEqual(dist);
  });

  it('every authored camera fits inside the returned limits (no clamping)', () => {
    const cams: { position: Vec3; target: Vec3 }[] = [
      { position: [2.4, 1.4, 3.0], target: [0, 0.6, 0] }, // hero
      { position: [0.1, 3.6, 0.1], target: [0, 0, 0] }, // top (low polar)
      { position: [3, 0.4, 0], target: [0, 1.6, 0] }, // dramatic look-up (high polar)
      { position: [0, 6, 22], target: [0, 0, 0] }, // far
    ];
    const out = fitOrbitLimits(BASE, cams);
    for (const c of cams) {
      const { dist, polar } = cameraSpherical(c.position, c.target);
      expect(dist).toBeGreaterThanOrEqual(out.minDistance);
      expect(dist).toBeLessThanOrEqual(out.maxDistance);
      expect(polar).toBeGreaterThanOrEqual(out.minPolarAngle);
      expect(polar).toBeLessThanOrEqual(out.maxPolarAngle);
    }
  });

  it('keeps polar limits inside the valid [0, π] OrbitControls range', () => {
    const straightUp: { position: Vec3; target: Vec3 } = {
      position: [0, -5, 0],
      target: [0, 0, 0],
    }; // polar = π
    const straightDown: { position: Vec3; target: Vec3 } = {
      position: [0, 5, 0],
      target: [0, 0, 0],
    }; // polar = 0
    const out = fitOrbitLimits(BASE, [straightUp, straightDown]);
    expect(out.minPolarAngle).toBeGreaterThanOrEqual(0);
    expect(out.maxPolarAngle).toBeLessThanOrEqual(Math.PI);
  });
});
