'use client';
import { useEffect } from 'react';
import { Leva, useControls, button } from 'leva';
import {
  useStore,
  replaceStop,
  type ToneMode,
  type GizmoMode,
  type Vec3,
  type BrandingMode,
  type AntialiasingMode,
  type AimGizmoMode,
} from '../store';
import { MODEL_CATALOG } from '../models/catalog';

const TONE_OPTIONS: ToneMode[] = ['NEUTRAL', 'ACES_FILMIC', 'AGX', 'REINHARD'];
const GIZMO_MODES: GizmoMode[] = ['translate', 'rotate', 'scale'];
const AIM_MODES: AimGizmoMode[] = ['translate', 'rotate', 'target'];
const AA_OPTIONS: Record<string, AntialiasingMode> = {
  'Wyłącz': 'OFF',
  FXAA: 'FXAA',
  'SMAA Low': 'SMAA_LOW',
  'SMAA Medium': 'SMAA_MEDIUM',
  'SMAA High': 'SMAA_HIGH',
  'SMAA Ultra': 'SMAA_ULTRA',
};

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

/* --- Render (tone mapping / ekspozycja / antyaliasing) --- */
function RenderControls() {
  const t = useStore.getState().config.tone;
  useControls('Render', () => ({
    tone: { value: t.mode, options: TONE_OPTIONS, onChange: (v: ToneMode) => useStore.getState().setTone({ mode: v }) },
    exposure: { value: t.exposure, min: 0.1, max: 3, step: 0.01, onChange: (v: number) => useStore.getState().setTone({ exposure: v }) },
    antialiasing: {
      value: useStore.getState().config.antialiasing,
      options: AA_OPTIONS,
      onChange: (v: AntialiasingMode) => useStore.getState().setAntialiasing(v),
    },
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

/* --- Branding (plakietka w finalnym widoku) --- */
const FONT_OPTIONS: Record<string, string> = {
  'Inter / sans-serif': 'Inter, system-ui, sans-serif',
  'System UI': 'system-ui, sans-serif',
  'Georgia / serif': 'Georgia, "Times New Roman", serif',
  Monospace: 'ui-monospace, "SF Mono", Menlo, monospace',
  'Arial Black': '"Arial Black", Impact, sans-serif',
};
const BRANDING_MODES: BrandingMode[] = ['text', 'image'];
const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

function BrandingControls() {
  const b = useStore.getState().config.branding;
  const [, set] = useControls('Branding', () => ({
    tryb: {
      value: b.mode,
      options: BRANDING_MODES,
      onChange: (v: BrandingMode) => useStore.getState().setBranding({ mode: v }),
    },
    tekst: { value: b.text, onChange: (v: string) => useStore.getState().setBranding({ text: v }) },
    krój: {
      value: Object.values(FONT_OPTIONS).includes(b.fontFamily)
        ? b.fontFamily
        : Object.values(FONT_OPTIONS)[0],
      options: FONT_OPTIONS,
      onChange: (v: string) => useStore.getState().setBranding({ fontFamily: v }),
    },
    kolor: { value: b.color, onChange: (v: string) => useStore.getState().setBranding({ color: v }) },
    rozmiar: {
      value: b.fontSize,
      min: 8,
      max: 96,
      step: 1,
      onChange: (v: number) => useStore.getState().setBranding({ fontSize: v }),
    },
    grubość: {
      value: b.fontWeight,
      options: FONT_WEIGHTS,
      onChange: (v: number) => useStore.getState().setBranding({ fontWeight: v }),
    },
    'odstęp liter': {
      value: b.letterSpacing,
      min: -2,
      max: 12,
      step: 0.5,
      onChange: (v: number) => useStore.getState().setBranding({ letterSpacing: v }),
    },
    'tło plakietki': {
      value: b.bgEnabled,
      onChange: (v: boolean) => useStore.getState().setBranding({ bgEnabled: v }),
    },
    'kolor tła': {
      value: b.bgColor,
      onChange: (v: string) => useStore.getState().setBranding({ bgColor: v }),
    },
    'Wgraj logo (webp/svg/png)': button(() => (window as any).__openLogoPicker?.()),
    'Wróć do tekstu': button(() => useStore.getState().setBranding({ mode: 'text' })),
  }), []);

  // Store → leva (wgranie logo zmienia tryb na 'image' poza panelem).
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.config.branding === prev.config.branding) return;
        const bb = s.config.branding;
        set({
          tryb: bb.mode,
          tekst: bb.text,
          kolor: bb.color,
          rozmiar: bb.fontSize,
          'odstęp liter': bb.letterSpacing,
          'tło plakietki': bb.bgEnabled,
          'kolor tła': bb.bgColor,
        });
      }),
    [set]
  );
  return null;
}

/* --- HERO NULL --- */
function HeroControls() {
  const h = useStore.getState().config.hero;
  const [, set] = useControls('HERO (null)', () => ({
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
  const removeModel = useStore((s) => s.removeModel);
  const setSelected = useStore((s) => s.setSelected);
  return (
    <div className="inspector-note">
      Aktor: <b>{name ?? '—'}</b>
      <br />
      Transform zablokowany — edytuj <b>HERO</b>.
      {name && (
        <button
          type="button"
          className="save-scene-btn"
          style={{ marginTop: 10, display: 'block', width: '100%' }}
          onClick={() => {
            removeModel();
            setSelected('hero');
          }}
        >
          Usuń model ze sceny
        </button>
      )}
    </div>
  );
}

/* --- Key Light --- */
function LightControls() {
  const k = useStore.getState().config.keyLight;
  const [, set] = useControls('Key Light', () => ({
    'tryb gizmo': {
      value: useStore.getState().aimGizmoMode,
      options: AIM_MODES,
      onChange: (v: AimGizmoMode) => useStore.getState().setAimGizmoMode(v),
    },
    intensity: { value: k.intensity, min: 0, max: 3, step: 0.01, onChange: (v: number) => useStore.getState().setKeyLight({ intensity: v }) },
    color: { value: k.color, onChange: (v: string) => useStore.getState().setKeyLight({ color: v }) },
    pozycja: { value: k.position, step: 0.1, onChange: (v: [number, number, number]) => useStore.getState().setKeyLight({ position: v }) },
    target: { value: k.target, step: 0.1, onChange: (v: [number, number, number]) => useStore.getState().setKeyLight({ target: v }) },
    castShadow: { value: k.castShadow, onChange: (v: boolean) => useStore.getState().setKeyLight({ castShadow: v }) },
    shadowBias: { value: k.shadowBias, min: -0.001, max: 0.001, step: 0.00001, onChange: (v: number) => useStore.getState().setKeyLight({ shadowBias: v }) },
  }), []);

  // Store → leva. `aimGizmoMode` is shared with the camera panel, and leva
  // retains a stale per-path value across panel remounts — so sync it from the
  // store on mount AND on change. Also mirror gizmo edits to position/target.
  useEffect(() => {
    set({ 'tryb gizmo': useStore.getState().aimGizmoMode });
    return useStore.subscribe((s, prev) => {
      if (s.aimGizmoMode !== prev.aimGizmoMode) set({ 'tryb gizmo': s.aimGizmoMode });
      if (s.config.keyLight !== prev.config.keyLight) {
        set({ pozycja: s.config.keyLight.position, target: s.config.keyLight.target });
      }
    });
  }, [set]);
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
      'tryb gizmo': {
        value: useStore.getState().aimGizmoMode,
        options: AIM_MODES,
        onChange: (v: AimGizmoMode) => useStore.getState().setAimGizmoMode(v),
      },
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

  // Store → leva (gizmo / zapis widoku / rename z outlinera). `aimGizmoMode` is
  // shared with the light panel and leva keeps a stale per-path value across
  // remounts — sync it from the store on mount AND on change.
  useEffect(() => {
    set({ 'tryb gizmo': useStore.getState().aimGizmoMode });
    return useStore.subscribe((s, prev) => {
      if (s.aimGizmoMode !== prev.aimGizmoMode) set({ 'tryb gizmo': s.aimGizmoMode });
      const cur = s.config.camera.cameras.find((x) => x.id === id);
      const old = prev.config.camera.cameras.find((x) => x.id === id);
      if (cur && cur !== old) {
        set({
          nazwa: cur.name,
          'pokaż w finalnym widoku': cur.showInFinalBar,
          pozycja: cur.position,
          target: cur.target,
          fov: cur.fov,
        });
      }
    });
  },
    [id, set]
  );
  return null;
}

/** Inspektor kontekstowy — panel adekwatny do zaznaczonego elementu outlinera. */
const PANEL_IDS = ['render', 'background', 'environment', 'branding', 'hero', 'actor', 'light'];

export function Inspector() {
  const selected = useStore((s) => s.selected);
  const camId = selected.startsWith('cam:') ? selected.slice(4) : null;
  // Nic / nierozpoznane zaznaczenie → parametry sceny (jak 'scene').
  const showScene = !camId && !PANEL_IDS.includes(selected);
  return (
    <div className="inspector">
      {showScene && <SceneControls />}
      {selected === 'render' && <RenderControls />}
      {selected === 'background' && <BackgroundControls />}
      {selected === 'environment' && <EnvironmentControls />}
      {selected === 'branding' && <BrandingControls />}
      {selected === 'hero' && <HeroControls />}
      {selected === 'actor' && <ActorNote />}
      {selected === 'light' && <LightControls />}
      {camId && <CameraControls key={camId} id={camId} />}
      <div className="inspector__panel">
        <Leva fill flat titleBar={false} />
      </div>
    </div>
  );
}
