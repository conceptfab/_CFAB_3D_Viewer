'use client';
import { useMemo } from 'react';
import { EffectComposer, ToneMapping, SMAA } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useStore, type ToneMode } from '../store';
import { ExposureEffect } from '../scene/exposureEffect';

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

  return (
    // multisampling=0: MSAA na composerze z efektami powoduje błąd WebGL
    // „glBlitFramebuffer: depth/stencil attachments cannot be the same image"
    // (spam setek błędów → WebGL: too many errors → Context Lost). Antyaliasing
    // zapewnia SMAA poniżej, więc MSAA jest tu zbędne i szkodliwe.
    <EffectComposer multisampling={0}>
      <Exposure value={exposure} />
      <ToneMapping mode={TONE_MODE[mode]} />
      <SMAA />
    </EffectComposer>
  );
}
