import { Leva, useControls, button } from 'leva';
import {
  useStore,
  replaceStop,
  type ToneMode,
  type GizmoMode,
} from '../store';

const TONE_OPTIONS: ToneMode[] = ['NEUTRAL', 'ACES_FILMIC', 'AGX', 'REINHARD'];
const GIZMO_MODES: GizmoMode[] = ['translate', 'rotate', 'scale'];

/* --- Scene (parametry globalne: cienie) --- */
function SceneControls() {
  const sh = useStore.getState().config.shadows;
  useControls(
    'Scene',
    () => ({
      catcherOpacity: {
        value: sh.catcherOpacity,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setShadows({ catcherOpacity: v }),
      },
      contactOpacity: {
        value: sh.contactOpacity,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setShadows({ contactOpacity: v }),
      },
      contactBlur: {
        value: sh.contactBlur,
        min: 0,
        max: 6,
        step: 0.1,
        onChange: (v: number) => useStore.getState().setShadows({ contactBlur: v }),
      },
    }),
    []
  );
  return null;
}

/* --- Render (tone mapping / ekspozycja) --- */
function RenderControls() {
  const t = useStore.getState().config.tone;
  useControls(
    'Render',
    () => ({
      tone: {
        value: t.mode,
        options: TONE_OPTIONS,
        onChange: (v: ToneMode) => useStore.getState().setTone({ mode: v }),
      },
      exposure: {
        value: t.exposure,
        min: 0.1,
        max: 3,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setTone({ exposure: v }),
      },
    }),
    []
  );
  return null;
}

/* --- Background (gradient tła) --- */
function setStop(i: number, v: string) {
  const cur = useStore.getState().config.background.stops;
  useStore.getState().setBackground({ stops: replaceStop(cur, i, v) });
}

function BackgroundControls() {
  const bg = useStore.getState().config.background;
  useControls(
    'Background',
    () => ({
      'centrum': { value: bg.stops[0], onChange: (v: string) => setStop(0, v) },
      'środek': { value: bg.stops[1], onChange: (v: string) => setStop(1, v) },
      'brzeg': { value: bg.stops[2], onChange: (v: string) => setStop(2, v) },
      'róg': { value: bg.stops[3], onChange: (v: string) => setStop(3, v) },
      centerY: {
        value: bg.centerY,
        min: 0.2,
        max: 0.8,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setBackground({ centerY: v }),
      },
    }),
    []
  );
  return null;
}

/* --- Environment (IBL / HDRI) --- */
function EnvironmentControls() {
  const cfg = useStore.getState().config;
  useControls(
    'Environment',
    () => ({
      hdri: {
        value: cfg.environment.hdriUrl,
        label: 'HDRI url',
        onChange: (v: string) => useStore.getState().setEnv({ hdriUrl: v }),
      },
      intensity: {
        value: cfg.environment.intensity,
        min: 0,
        max: 2,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setEnv({ intensity: v }),
      },
      envMapIntensity: {
        value: cfg.material.envMapIntensity,
        min: 0,
        max: 3,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setMaterial({ envMapIntensity: v }),
      },
    }),
    []
  );
  return null;
}

/* --- HERO NULL --- */
function HeroControls() {
  const h = useStore.getState().config.hero;
  useControls(
    'HERO (null)',
    () => ({
      'tryb gizmo': {
        value: useStore.getState().gizmoMode,
        options: GIZMO_MODES,
        onChange: (v: GizmoMode) => useStore.getState().setGizmoMode(v),
      },
      pozycja: {
        value: h.position,
        step: 0.05,
        onChange: (v: [number, number, number]) => useStore.getState().setHero({ position: v }),
      },
      'rotacja °': {
        value: h.rotation,
        step: 1,
        onChange: (v: [number, number, number]) => useStore.getState().setHero({ rotation: v }),
      },
      skala: {
        value: h.scale,
        step: 0.05,
        onChange: (v: [number, number, number]) => useStore.getState().setHero({ scale: v }),
      },
      'Reset transformu': button(() =>
        useStore.getState().setHero({ position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] })
      ),
    }),
    []
  );
  return null;
}

/* --- Actor (read-only) --- */
function ActorNote() {
  const name = useStore((s) => s.loadedModel?.fileName);
  return (
    <div className="inspector-note">
      Aktor: <b>{name ?? '—'}</b>
      <br />
      Transform zablokowany — edytuj <b>HERO</b>.
    </div>
  );
}

/* --- Key Light --- */
function LightControls() {
  const k = useStore.getState().config.keyLight;
  useControls(
    'Key Light',
    () => ({
      intensity: {
        value: k.intensity,
        min: 0,
        max: 3,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setKeyLight({ intensity: v }),
      },
      color: {
        value: k.color,
        onChange: (v: string) => useStore.getState().setKeyLight({ color: v }),
      },
      pozycja: {
        value: k.position,
        step: 0.1,
        onChange: (v: [number, number, number]) => useStore.getState().setKeyLight({ position: v }),
      },
      castShadow: {
        value: k.castShadow,
        onChange: (v: boolean) => useStore.getState().setKeyLight({ castShadow: v }),
      },
      shadowBias: {
        value: k.shadowBias,
        min: -0.001,
        max: 0.001,
        step: 0.00001,
        onChange: (v: number) => useStore.getState().setKeyLight({ shadowBias: v }),
      },
    }),
    []
  );
  return null;
}

/* --- Camera --- */
function CameraControls() {
  const c = useStore.getState().config.camera;
  const presetNames = Object.keys(c.presets);
  useControls(
    'Camera',
    () => ({
      preset: {
        value: c.active,
        options: presetNames,
        onChange: (v: string) => useStore.getState().setCamera({ active: v }),
      },
      fov: {
        value: c.fov,
        min: 10,
        max: 80,
        step: 1,
        onChange: (v: number) => useStore.getState().setCamera({ fov: v }),
      },
      minDist: {
        value: c.orbit.minDist,
        min: 0.2,
        max: 5,
        step: 0.1,
        onChange: (v: number) => useStore.getState().setOrbit({ minDist: v }),
      },
      maxDist: {
        value: c.orbit.maxDist,
        min: 2,
        max: 30,
        step: 0.5,
        onChange: (v: number) => useStore.getState().setOrbit({ maxDist: v }),
      },
      damping: {
        value: c.orbit.damping,
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
    []
  );
  return null;
}

/** Inspektor kontekstowy — panel adekwatny do zaznaczonego elementu outlinera. */
export function Inspector() {
  const selected = useStore((s) => s.selected);
  return (
    <div className="inspector">
      {selected === 'scene' && <SceneControls />}
      {selected === 'render' && <RenderControls />}
      {selected === 'background' && <BackgroundControls />}
      {selected === 'environment' && <EnvironmentControls />}
      {selected === 'hero' && <HeroControls />}
      {selected === 'actor' && <ActorNote />}
      {selected === 'light' && <LightControls />}
      {selected === 'camera' && <CameraControls />}
      <Leva fill flat titleBar={false} />
    </div>
  );
}
