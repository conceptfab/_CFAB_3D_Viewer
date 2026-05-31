'use client';
import { useMemo, type JSX } from 'react';
import { EffectComposer, ToneMapping, SMAA, FXAA } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
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
  else if (smaaPreset !== null) effects.push(<SMAA key={`smaa-${smaaPreset}`} preset={smaaPreset} />);

  return <EffectComposer multisampling={0}>{effects}</EffectComposer>;
}
