'use client';
import { useEffect, useMemo, type JSX } from 'react';
import { EffectComposer, ToneMapping, FXAA } from '@react-three/postprocessing';
import { ToneMappingMode, SMAAEffect, SMAAPreset, EffectAttribute } from 'postprocessing';
import { useStore, type ToneMode } from '../store';
import { ExposureEffect } from '../scene/exposureEffect';
import { smaaPresetFor } from '@/lib/viewer/antialiasing';

const TONE_MODE: Record<ToneMode, ToneMappingMode> = {
  NEUTRAL: ToneMappingMode.NEUTRAL,
  ACES_FILMIC: ToneMappingMode.ACES_FILMIC,
  AGX: ToneMappingMode.AGX,
  REINHARD: ToneMappingMode.REINHARD,
};

function Exposure({ value }: { value: number }) {
  const effect = useMemo(() => new ExposureEffect(value), []);
  effect.exposure = value;
  return <primitive object={effect} dispose={null} />;
}

/**
 * SMAA antialiasing as a raw postprocessing effect, with its spurious depth
 * attribute stripped.
 *
 * SMAAEffect's constructor ALWAYS advertises `CONVOLUTION | DEPTH`, but with the
 * default COLOR edge-detection mode it never samples scene depth. That stray
 * DEPTH flag makes EffectComposer (postprocessing 6.36+) allocate a stable-depth
 * target and run a per-frame depth `blitFramebuffer` whose read and write depth
 * attachments resolve to the same image → a `GL_INVALID_OPERATION:
 * glBlitFramebuffer ... cannot be the same image` flood every frame (one per
 * render, hundreds in the editor). Clearing DEPTH (keeping CONVOLUTION so SMAA
 * still gets its own pass) removes the blit with no change to the AA result.
 * We build the effect by hand because @react-three/postprocessing's <SMAA>
 * wrapper doesn't forward a ref to the effect instance.
 */
class DepthlessSMAAEffect extends SMAAEffect {
  constructor(preset: SMAAPreset) {
    super({ preset });
    // `setAttributes` is protected on Effect — reachable here in the subclass.
    this.setAttributes(this.getAttributes() & ~EffectAttribute.DEPTH);
  }
}

function Smaa({ preset }: { preset: number }) {
  const effect = useMemo(() => new DepthlessSMAAEffect(preset as SMAAPreset), [preset]);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} dispose={null} />;
}

export function Postprocess() {
  const mode = useStore((s) => s.config.tone.mode);
  const exposure = useStore((s) => s.config.tone.exposure);
  const aa = useStore((s) => s.config.antialiasing);
  const smaaPreset = smaaPresetFor(aa);

  // NO `key` on EffectComposer: remounting the whole composer on every AA change
  // reallocates render targets and recompiles ALL passes — a 200ms+ main-thread
  // block (bad INP). Instead the composer + Exposure + ToneMapping stay mounted
  // and only the AA effect is swapped. `key` on the AA effect (by mode/preset)
  // makes a change recreate just that effect so the new setting applies, while
  // a stable key on Exposure/ToneMapping keeps them (and the render targets) put.
  // multisampling stays 0 — MSAA on the composer crashes WebGL (commit 3771325).
  //
  // EffectComposer.children: JSX.Element | JSX.Element[] — no nulls allowed, so
  // the AA slot is appended only when an AA mode is active (array never empty).
  const effects: JSX.Element[] = [
    <Exposure key="exposure" value={exposure} />,
    <ToneMapping key="tone" mode={TONE_MODE[mode]} />,
  ];
  if (aa === 'FXAA') effects.push(<FXAA key="fxaa" />);
  else if (smaaPreset !== null) effects.push(<Smaa key={`smaa-${smaaPreset}`} preset={smaaPreset} />);

  return <EffectComposer multisampling={0}>{effects}</EffectComposer>;
}
