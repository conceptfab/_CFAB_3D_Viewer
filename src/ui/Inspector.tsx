import { useEffect } from 'react';
import { Leva, useControls, button } from 'leva';
import {
  useStore,
  replaceStop,
  type ToneMode,
  type GizmoMode,
  type Vec3,
} from '../store';
import { MODEL_CATALOG } from '../models/catalog';

const TONE_OPTIONS: ToneMode[] = ['NEUTRAL', 'ACES_FILMIC', 'AGX', 'REINHARD'];
const GIZMO_MODES: GizmoMode[] = ['translate', 'rotate', 'scale'];

// Mapa label→url dla wbudowanych modeli (select w panelu HERO).
const MODEL_OPTIONS: Record<string, string> = MODEL_CATALOG.reduce(
  (acc, m) => ({ ...acc, [m.label]: m.url }),
  {}
);

/* --- Scene (parametry globalne: cienie) --- */
function SceneControls() {
  const sh = useStore.getState().config.shadows;
  useControls('Scene', () => ({
    catcherOpacity: { value: sh.catcherOpacity, min: 0, max: 1, step: 0.01, onChange: (v: number) => useStore.getState().setShadows({ catcherOpacity: v }) },
    contactOpacity: { value: sh.contactOpacity, min: 0, max: 1, step: 0.01, onChange: (v: number) => useStore.getState().setShadows({ contactOpacity: v }) },
    contactBlur: { value: sh.contactBlur, min: 0, max: 6, step: 0.1, onChange: (v: number) => useStore.getState().setShadows({ contactBlur: v }) },
  }), []);
  return null;
}

/* --- Render (tone mapping / ekspozycja) --- */
function RenderControls() {
  const t = useStore.getState().config.tone;
  useControls('Render', () => ({
    tone: { value: t.mode, options: TONE_OPTIONS, onChange: (v: ToneMode) => useStore.getState().setTone({ mode: v }) },
    exposure: { value: t.exposure, min: 0.1, max: 3, step: 0.01, onChange: (v: number) => useStore.getState().setTone({ exposure: v }) },
  }), []);
  return null;
}

/* --- Background (gradient tła) --- */
function setStop(i: number, v: string) {
  const cur = useStore.getState().config.background.stops;
  useStore.getState().setBackground({ stops: replaceStop(cur, i, v) });
}
function BackgroundControls() {
  const bg = useStore.getState().config.background;
  useControls('Background', () => ({
    centrum: { value: bg.stops[0], onChange: (v: string) => setStop(0, v) },
    środek: { value: bg.stops[1], onChange: (v: string) => setStop(1, v) },
    brzeg: { value: bg.stops[2], onChange: (v: string) => setStop(2, v) },
    róg: { value: bg.stops[3], onChange: (v: string) => setStop(3, v) },
    centerY: { value: bg.centerY, min: 0.2, max: 0.8, step: 0.01, onChange: (v: number) => useStore.getState().setBackground({ centerY: v }) },
  }), []);
  return null;
}

/* --- Environment (IBL / HDRI) --- */
function EnvironmentControls() {
  const cfg = useStore.getState().config;
  useControls('Environment', () => ({
    hdri: { value: cfg.environment.hdriUrl, label: 'HDRI url', onChange: (v: string) => useStore.getState().setEnv({ hdriUrl: v }) },
    intensity: { value: cfg.environment.intensity, min: 0, max: 2, step: 0.01, onChange: (v: number) => useStore.getState().setEnv({ intensity: v }) },
    envMapIntensity: { value: cfg.material.envMapIntensity, min: 0, max: 3, step: 0.01, onChange: (v: number) => useStore.getState().setMaterial({ envMapIntensity: v }) },
  }), []);
  return null;
}

/* --- HERO NULL --- */
function HeroControls() {
  const h = useStore.getState().config.hero;
  const currentUrl = useStore.getState().loadedModel?.objectUrl ?? '';
  const [, set] = useControls('HERO (null)', () => ({
    model: {
      value: Object.values(MODEL_OPTIONS).includes(currentUrl)
        ? currentUrl
        : Object.values(MODEL_OPTIONS)[0],
      options: MODEL_OPTIONS,
      onChange: (url: string) => {
        if (useStore.getState().loadedModel?.objectUrl === url) return;
        const label = Object.keys(MODEL_OPTIONS).find((k) => MODEL_OPTIONS[k] === url) ?? 'model';
        useStore.getState().setLoadedModel({ objectUrl: url, fileName: label });
      },
    },
    'Wczytaj plik (.glb)': button(() => (window as any).__openModelPicker?.()),
    'tryb gizmo': { value: useStore.getState().gizmoMode, options: GIZMO_MODES, onChange: (v: GizmoMode) => useStore.getState().setGizmoMode(v) },
    pozycja: { value: h.position, step: 0.05, onChange: (v: [number, number, number]) => useStore.getState().setHero({ position: v }) },
    'rotacja °': { value: h.rotation, step: 1, onChange: (v: [number, number, number]) => useStore.getState().setHero({ rotation: v }) },
    skala: { value: h.scale, step: 0.05, onChange: (v: [number, number, number]) => useStore.getState().setHero({ scale: v }) },
    'Reset transformu': button(() => useStore.getState().setHero({ position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] })),
  }), []);

  // Store → leva (gizmo / inne źródła). set() nie wywołuje onChange, więc bez pętli.
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.config.hero === prev.config.hero) return;
        const hh = s.config.hero;
        set({ pozycja: hh.position, 'rotacja °': hh.rotation, skala: hh.scale });
      }),
    [set]
  );
  return null;
}

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
  const [, set] = useControls('Key Light', () => ({
    intensity: { value: k.intensity, min: 0, max: 3, step: 0.01, onChange: (v: number) => useStore.getState().setKeyLight({ intensity: v }) },
    color: { value: k.color, onChange: (v: string) => useStore.getState().setKeyLight({ color: v }) },
    pozycja: { value: k.position, step: 0.1, onChange: (v: [number, number, number]) => useStore.getState().setKeyLight({ position: v }) },
    castShadow: { value: k.castShadow, onChange: (v: boolean) => useStore.getState().setKeyLight({ castShadow: v }) },
    shadowBias: { value: k.shadowBias, min: -0.001, max: 0.001, step: 0.00001, onChange: (v: number) => useStore.getState().setKeyLight({ shadowBias: v }) },
  }), []);

  // Store → leva (gizmo światła aktualizuje pozycję).
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.config.keyLight === prev.config.keyLight) return;
        set({ pozycja: s.config.keyLight.position });
      }),
    [set]
  );
  return null;
}

/* --- Pojedyncza kamera (obiekt) --- */
function CameraControls({ id }: { id: string }) {
  const c = useStore.getState().config.camera;
  const cam = c.cameras.find((x) => x.id === id);
  if (!cam) return null;
  return <CameraControlsInner id={id} active={c.active === id} cam={cam} orbit={c.orbit} />;
}

function CameraControlsInner({
  id,
  active,
  cam,
  orbit,
}: {
  id: string;
  active: boolean;
  cam: { position: Vec3; target: Vec3; fov: number; name: string; showInFinalBar: boolean };
  orbit: { minDist: number; maxDist: number; damping: number };
}) {
  const removable = useStore.getState().config.camera.cameras.length > 1;

  const [, set] = useControls(
    `Camera: ${id}`,
    () => ({
      nazwa: {
        value: cam.name,
        onChange: (v: string) => useStore.getState().renameCamera(id, v),
      },
      'pokaż w finalnym widoku': {
        value: cam.showInFinalBar,
        onChange: (v: boolean) => useStore.getState().setCameraVisible(id, v),
      },
      aktywna: {
        value: active,
        onChange: (v: boolean) => {
          if (v) useStore.getState().setCamera({ active: id });
        },
      },
      pozycja: {
        value: cam.position,
        step: 0.05,
        onChange: (v: [number, number, number]) =>
          useStore.getState().updateCamera(id, { position: v }),
      },
      target: {
        value: cam.target,
        step: 0.05,
        onChange: (v: [number, number, number]) =>
          useStore.getState().updateCamera(id, { target: v }),
      },
      fov: {
        value: cam.fov,
        min: 10,
        max: 80,
        step: 1,
        onChange: (v: number) => useStore.getState().updateCamera(id, { fov: v }),
      },
      minDist: {
        value: orbit.minDist,
        min: 0.2,
        max: 5,
        step: 0.1,
        onChange: (v: number) => useStore.getState().setOrbit({ minDist: v }),
      },
      maxDist: {
        value: orbit.maxDist,
        min: 2,
        max: 30,
        step: 0.5,
        onChange: (v: number) => useStore.getState().setOrbit({ maxDist: v }),
      },
      damping: {
        value: orbit.damping,
        min: 0,
        max: 0.3,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setOrbit({ damping: v }),
      },
      'Zapisz z aktualnego widoku': button(() => {
        const view = useStore.getState().cameraApi?.getView();
        if (view) useStore.getState().capturePreset(id, view);
      }),
      'Usuń kamerę': button(
        () => useStore.getState().removeCamera(id),
        { disabled: !removable }
      ),
    }),
    []
  );

  // Store → leva (gizmo / zapis widoku / rename z outlinera).
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        const cur = s.config.camera.cameras.find((x) => x.id === id);
        const old = prev.config.camera.cameras.find((x) => x.id === id);
        if (!cur || cur === old) return;
        set({
          nazwa: cur.name,
          'pokaż w finalnym widoku': cur.showInFinalBar,
          pozycja: cur.position,
          target: cur.target,
          fov: cur.fov,
        });
      }),
    [id, set]
  );
  return null;
}

/** Inspektor kontekstowy — panel adekwatny do zaznaczonego elementu outlinera. */
export function Inspector() {
  const selected = useStore((s) => s.selected);
  const camId = selected.startsWith('cam:') ? selected.slice(4) : null;
  return (
    <div className="inspector">
      {selected === 'scene' && <SceneControls />}
      {selected === 'render' && <RenderControls />}
      {selected === 'background' && <BackgroundControls />}
      {selected === 'environment' && <EnvironmentControls />}
      {selected === 'hero' && <HeroControls />}
      {selected === 'actor' && <ActorNote />}
      {selected === 'light' && <LightControls />}
      {camId && <CameraControls key={camId} id={camId} />}
      <Leva fill flat titleBar={false} />
    </div>
  );
}
