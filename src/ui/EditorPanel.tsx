import { useControls, folder, button } from 'leva';
import { useStore, DEFAULT_CONFIG, replaceStop, type ToneMode } from '../store';

const D = DEFAULT_CONFIG;
const TONE_OPTIONS: ToneMode[] = ['NEUTRAL', 'ACES_FILMIC', 'AGX', 'REINHARD'];
const PRESET_NAMES = Object.keys(D.camera.presets);

function setStop(i: number, v: string) {
  const cur = useStore.getState().config.background.stops;
  useStore.getState().setBackground({ stops: replaceStop(cur, i, v) });
}

export function EditorPanel() {
  useControls(() => ({
    '📦 Model': folder({
      'Wczytaj plik (.glb)': button(() => (window as any).__openModelPicker?.()),
    }),

    '📷 Kamera': folder({
      preset: {
        value: D.camera.active,
        options: PRESET_NAMES,
        onChange: (v: string) => useStore.getState().setCamera({ active: v }),
        transient: false,
      },
      fov: {
        value: D.camera.fov,
        min: 10,
        max: 80,
        step: 1,
        onChange: (v: number) => useStore.getState().setCamera({ fov: v }),
      },
      minDist: {
        value: D.camera.orbit.minDist,
        min: 0.2,
        max: 5,
        step: 0.1,
        onChange: (v: number) => useStore.getState().setOrbit({ minDist: v }),
      },
      maxDist: {
        value: D.camera.orbit.maxDist,
        min: 2,
        max: 30,
        step: 0.5,
        onChange: (v: number) => useStore.getState().setOrbit({ maxDist: v }),
      },
      damping: {
        value: D.camera.orbit.damping,
        min: 0,
        max: 0.3,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setOrbit({ damping: v }),
      },
      'Zapisz z aktualnego widoku': button(() => {
        const st = useStore.getState();
        const view = st.cameraApi?.getView();
        if (view) st.capturePreset(st.config.camera.active, view);
      }),
    }),

    '💡 Światło': folder({
      intensity: {
        value: D.keyLight.intensity,
        min: 0,
        max: 3,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setKeyLight({ intensity: v }),
      },
      color: {
        value: D.keyLight.color,
        onChange: (v: string) => useStore.getState().setKeyLight({ color: v }),
      },
      position: {
        value: D.keyLight.position,
        step: 0.1,
        onChange: (v: [number, number, number]) =>
          useStore.getState().setKeyLight({ position: v }),
      },
      castShadow: {
        value: D.keyLight.castShadow,
        onChange: (v: boolean) => useStore.getState().setKeyLight({ castShadow: v }),
      },
      shadowBias: {
        value: D.keyLight.shadowBias,
        min: -0.001,
        max: 0.001,
        step: 0.00001,
        onChange: (v: number) => useStore.getState().setKeyLight({ shadowBias: v }),
      },
    }),

    '🌍 Scena': folder({
      bg0: {
        value: D.background.stops[0],
        label: 'tło centrum',
        onChange: (v: string) => setStop(0, v),
      },
      bg1: {
        value: D.background.stops[1],
        label: 'tło środek',
        onChange: (v: string) => setStop(1, v),
      },
      bg2: {
        value: D.background.stops[2],
        label: 'tło brzeg',
        onChange: (v: string) => setStop(2, v),
      },
      bg3: {
        value: D.background.stops[3],
        label: 'tło róg',
        onChange: (v: string) => setStop(3, v),
      },
      centerY: {
        value: D.background.centerY,
        min: 0.2,
        max: 0.8,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setBackground({ centerY: v }),
      },
      hdriIntensity: {
        value: D.environment.intensity,
        min: 0,
        max: 2,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setEnv({ intensity: v }),
      },
      tone: {
        value: D.tone.mode,
        options: TONE_OPTIONS,
        onChange: (v: ToneMode) => useStore.getState().setTone({ mode: v }),
      },
      exposure: {
        value: D.tone.exposure,
        min: 0.1,
        max: 3,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setTone({ exposure: v }),
      },
      catcherOpacity: {
        value: D.shadows.catcherOpacity,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setShadows({ catcherOpacity: v }),
      },
      contactOpacity: {
        value: D.shadows.contactOpacity,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setShadows({ contactOpacity: v }),
      },
      contactBlur: {
        value: D.shadows.contactBlur,
        min: 0,
        max: 6,
        step: 0.1,
        onChange: (v: number) => useStore.getState().setShadows({ contactBlur: v }),
      },
    }),

    '🎨 Materiał': folder({
      envMapIntensity: {
        value: D.material.envMapIntensity,
        min: 0,
        max: 3,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setMaterial({ envMapIntensity: v }),
      },
    }),
  }));

  // Komponent nie renderuje własnego DOM — leva sama montuje panel.
  return null;
}
