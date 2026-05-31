import { describe, it, expect } from 'vitest';
import { smaaPresetFor } from './antialiasing';

describe('smaaPresetFor', () => {
  it('maps SMAA levels to postprocessing preset indices (LOW=0..ULTRA=3)', () => {
    expect(smaaPresetFor('SMAA_LOW')).toBe(0);
    expect(smaaPresetFor('SMAA_MEDIUM')).toBe(1);
    expect(smaaPresetFor('SMAA_HIGH')).toBe(2);
    expect(smaaPresetFor('SMAA_ULTRA')).toBe(3);
  });

  it('returns null for non-SMAA modes', () => {
    expect(smaaPresetFor('OFF')).toBeNull();
    expect(smaaPresetFor('FXAA')).toBeNull();
  });
});
