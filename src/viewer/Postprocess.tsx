import { EffectComposer, ToneMapping, SMAA } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Minimal clean post-FX baseline:
 *  - KHRONOS_NEUTRAL tone mapping — forgiving roll-off, keeps the neutral grey
 *    sweep neutral.
 *  - SMAA for clean edges.
 *
 * N8AO + Bloom removed for now — screen-space AO haloed around the thin tripod
 * legs and Bloom amplified specular aliasing into sparkles. Re-add carefully
 * (gentler settings) once the baseline is confirmed clean.
 */
export function Postprocess() {
  return (
    <EffectComposer multisampling={4}>
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  );
}
