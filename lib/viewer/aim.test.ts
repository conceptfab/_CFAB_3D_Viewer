import { describe, it, expect } from 'vitest';
import { reaimAfterRotation } from './aim';

describe('reaimAfterRotation', () => {
  it('identity quaternion keeps a +Z target', () => {
    const t = reaimAfterRotation([0, 0, 0], [0, 0, 5], [0, 0, 0, 1]);
    expect(t[0]).toBeCloseTo(0);
    expect(t[1]).toBeCloseTo(0);
    expect(t[2]).toBeCloseTo(5);
  });

  it('90° yaw about Y moves a +Z target onto +X (distance preserved)', () => {
    const s = Math.SQRT1_2; // sin45 === cos45
    const t = reaimAfterRotation([0, 0, 0], [0, 0, 5], [0, s, 0, s]);
    expect(t[0]).toBeCloseTo(5);
    expect(t[1]).toBeCloseTo(0);
    expect(t[2]).toBeCloseTo(0);
  });

  it('zero look distance stays finite (clamped, no NaN)', () => {
    const t = reaimAfterRotation([1, 1, 1], [1, 1, 1], [0, 0, 0, 1]);
    expect(t.every(Number.isFinite)).toBe(true);
  });
});
