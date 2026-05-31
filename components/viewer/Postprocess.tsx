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

  // `key={aa}` forces a clean composer rebuild when the AA effect set changes,
  // avoiding stale-effect refs. multisampling stays 0 — MSAA on the composer
  // crashes WebGL (see commit 3771325); AA is post-process only.
  //
  // EffectComposer.children: JSX.Element | JSX.Element[] — no nulls allowed.
  // We always have at least Exposure + ToneMapping; the AA slot is appended
  // only when an AA mode is active, keeping the array non-empty.
  const effects: JSX.Element[] = [
    <Exposure key="exposure" value={exposure} />,
    <ToneMapping key="tone" mode={TONE_MODE[mode]} />,
  ];
  if (aa === 'FXAA') effects.push(<FXAA key="fxaa" />);
  else if (smaaPreset !== null) effects.push(<SMAA key="smaa" preset={smaaPreset} />);

  return (
    <EffectComposer key={aa} multisampling={0}>
      {effects}
    </EffectComposer>
  );
}
