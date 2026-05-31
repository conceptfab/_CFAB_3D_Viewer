import type { AntialiasingMode } from '@/components/store';

/**
 * SMAA quality preset index for an antialiasing mode, or null for OFF/FXAA.
 * Values match postprocessing's `SMAAPreset` enum: LOW=0, MEDIUM=1, HIGH=2,
 * ULTRA=3. Returned as a plain number so this module (and its test) need not
 * import the heavy `postprocessing` package; `<SMAA preset={n} />` accepts the
 * numeric enum value directly.
 */
export function smaaPresetFor(mode: AntialiasingMode): number | null {
  switch (mode) {
    case 'SMAA_LOW':
      return 0;
    case 'SMAA_MEDIUM':
      return 1;
    case 'SMAA_HIGH':
      return 2;
    case 'SMAA_ULTRA':
      return 3;
    default:
      return null;
  }
}
