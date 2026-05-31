import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, normalizeConfig } from './store';

describe('normalizeConfig', () => {
  it('fills keyLight.target and antialiasing when missing (legacy scene)', () => {
    const legacy = structuredClone(DEFAULT_CONFIG) as Record<string, unknown>;
    delete (legacy.keyLight as Record<string, unknown>).target;
    delete legacy.antialiasing;

    const out = normalizeConfig(legacy);
    expect(out.keyLight.target).toEqual([0, 0, 0]);
    expect(out.antialiasing).toBe('SMAA_MEDIUM');
  });

  it('preserves present values and merges nested objects per-key', () => {
    const raw = {
      keyLight: { position: [9, 9, 9], intensity: 2 },
      antialiasing: 'OFF',
    };
    const out = normalizeConfig(raw);
    expect(out.keyLight.position).toEqual([9, 9, 9]);
    expect(out.keyLight.intensity).toBe(2);
    expect(out.keyLight.color).toBe(DEFAULT_CONFIG.keyLight.color);
    expect(out.keyLight.target).toEqual([0, 0, 0]);
    expect(out.antialiasing).toBe('OFF');
  });

  it('takes arrays wholesale (cameras / Vec3) without element merge', () => {
    const raw = {
      camera: { active: 'front', cameras: [
        { id: 'only', name: 'Only', position: [1, 1, 1], target: [0, 0, 0], fov: 30, showInFinalBar: true },
      ] },
    };
    const out = normalizeConfig(raw);
    expect(out.camera.cameras).toHaveLength(1);
    expect(out.camera.cameras[0].id).toBe('only');
    expect(out.camera.active).toBe('front');
    expect(out.camera.near).toBe(DEFAULT_CONFIG.camera.near);
  });

  it('returns a full valid config from an empty object', () => {
    const out = normalizeConfig({});
    expect(out).toEqual(DEFAULT_CONFIG);
  });
});
