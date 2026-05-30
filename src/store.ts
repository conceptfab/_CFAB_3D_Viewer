import { create } from 'zustand';

export type ToneMode = 'NEUTRAL' | 'ACES_FILMIC' | 'AGX' | 'REINHARD';

/** Rzuty uproszczonego viewportu edycyjnego (środkowy panel). */
export type EditorView =
  | 'top'
  | 'bottom'
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'perspective'
  | 'camera';

/** Element sceny zaznaczalny w outlinerze. */
export type SceneElementId =
  | 'scene'
  | 'render'
  | 'background'
  | 'environment'
  | 'hero'
  | 'actor'
  | 'light'
  | 'camera';

/** Tryb gizmo dla HERO NULL. */
export type GizmoMode = 'translate' | 'rotate' | 'scale';

export type Vec3 = [number, number, number];

export interface CameraPresetView {
  position: Vec3;
  target: Vec3;
  fov: number;
}

export interface SceneConfig {
  environment: { hdriUrl: string; intensity: number };
  background: { stops: [string, string, string, string]; centerY: number };
  keyLight: {
    position: Vec3;
    intensity: number;
    color: string;
    castShadow: boolean;
    shadowMapSize: number;
    shadowBias: number;
    normalBias: number;
  };
  shadows: { catcherOpacity: number; contactOpacity: number; contactBlur: number };
  tone: { mode: ToneMode; exposure: number };
  material: { envMapIntensity: number };
  // HERO NULL — transform "aktora" (rotacja w stopniach). Aktora nie edytujemy
  // bezpośrednio; przesuwamy/rotujemy/skalujemy ten null.
  hero: { position: Vec3; rotation: Vec3; scale: Vec3 };
  camera: {
    near: number;
    far: number;
    orbit: {
      minDist: number;
      maxDist: number;
      minPolar: number;
      maxPolar: number;
      damping: number;
    };
    active: string;
    // Każdy wpis to osobny OBIEKT kamery (własna pozycja/target/fov).
    presets: Record<string, CameraPresetView>;
  };
}

export const DEFAULT_CONFIG: SceneConfig = {
  environment: {
    hdriUrl:
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/studio_small_03_4k.hdr',
    intensity: 0.45,
  },
  background: {
    stops: ['#eeeef1', '#dcdce0', '#c6c7cd', '#b4b5bc'],
    centerY: 0.44,
  },
  keyLight: {
    position: [-2.5, 4, 3],
    intensity: 0.55,
    color: '#ffffff',
    castShadow: true,
    shadowMapSize: 4096,
    shadowBias: -0.00012,
    normalBias: 0.012,
  },
  shadows: { catcherOpacity: 0.3, contactOpacity: 0.3, contactBlur: 2 },
  tone: { mode: 'NEUTRAL', exposure: 1.0 },
  material: { envMapIntensity: 1.0 },
  hero: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  camera: {
    near: 0.05,
    far: 80,
    orbit: {
      minDist: 1.2,
      maxDist: 8,
      minPolar: 0.15,
      maxPolar: Math.PI / 2 - 0.05,
      damping: 0.08,
    },
    active: 'hero',
    presets: {
      hero: { position: [2.4, 1.4, 3.0], target: [0, 0.6, 0], fov: 28 },
      front: { position: [0, 0.9, 3.2], target: [0, 0.6, 0], fov: 28 },
      side: { position: [3.2, 0.9, 0.2], target: [0, 0.6, 0], fov: 28 },
      top: { position: [0.1, 3.6, 0.1], target: [0, 0, 0], fov: 30 },
      detail: { position: [1.3, 0.7, 1.3], target: [0, 0.6, 0], fov: 45 },
    },
  },
};

/** Czysta funkcja: zwraca nową krotkę stopni z podmienionym indeksem. */
export function replaceStop(
  stops: [string, string, string, string],
  index: number,
  value: string
): [string, string, string, string] {
  const next = [...stops] as [string, string, string, string];
  next[index] = value;
  return next;
}

export interface LoadedModel {
  objectUrl: string;
  fileName: string;
}

/** Imperatywny dostęp do aktualnego widoku kamery (rejestrowany przez CameraRig). */
export interface CameraApi {
  getView: () => CameraPresetView;
}

interface State {
  config: SceneConfig;
  loadedModel: LoadedModel | null;
  modelSize: Vec3;
  cameraApi: CameraApi | null;

  // Stan edytora (NIE część serializowanego configu).
  editorView: EditorView;
  setEditorView: (v: EditorView) => void;
  // 'scene' | 'render' | ... | 'hero' | 'actor' | 'light' | 'cam:<id>'
  selected: string;
  setSelected: (id: string) => void;
  gizmoMode: GizmoMode;
  setGizmoMode: (m: GizmoMode) => void;

  setEnv: (patch: Partial<SceneConfig['environment']>) => void;
  setBackground: (patch: Partial<SceneConfig['background']>) => void;
  setKeyLight: (patch: Partial<SceneConfig['keyLight']>) => void;
  setShadows: (patch: Partial<SceneConfig['shadows']>) => void;
  setTone: (patch: Partial<SceneConfig['tone']>) => void;
  setMaterial: (patch: Partial<SceneConfig['material']>) => void;
  setHero: (patch: Partial<SceneConfig['hero']>) => void;
  setCamera: (
    patch: Partial<Pick<SceneConfig['camera'], 'near' | 'far' | 'active'>>
  ) => void;
  setOrbit: (patch: Partial<SceneConfig['camera']['orbit']>) => void;
  capturePreset: (name: string, view: CameraPresetView) => void;

  setLoadedModel: (model: LoadedModel | null) => void;
  setModelSize: (size: Vec3) => void;
  registerCameraApi: (api: CameraApi | null) => void;
}

export const useStore = create<State>((set) => ({
  config: DEFAULT_CONFIG,
  loadedModel: null,
  modelSize: [1, 1.4, 1],
  cameraApi: null,

  editorView: 'perspective',
  setEditorView: (editorView) => set({ editorView }),
  selected: 'hero',
  setSelected: (selected) => set({ selected }),
  gizmoMode: 'translate',
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),

  setEnv: (patch) =>
    set((s) => ({ config: { ...s.config, environment: { ...s.config.environment, ...patch } } })),
  setBackground: (patch) =>
    set((s) => ({ config: { ...s.config, background: { ...s.config.background, ...patch } } })),
  setKeyLight: (patch) =>
    set((s) => ({ config: { ...s.config, keyLight: { ...s.config.keyLight, ...patch } } })),
  setShadows: (patch) =>
    set((s) => ({ config: { ...s.config, shadows: { ...s.config.shadows, ...patch } } })),
  setTone: (patch) =>
    set((s) => ({ config: { ...s.config, tone: { ...s.config.tone, ...patch } } })),
  setMaterial: (patch) =>
    set((s) => ({ config: { ...s.config, material: { ...s.config.material, ...patch } } })),
  setHero: (patch) =>
    set((s) => ({ config: { ...s.config, hero: { ...s.config.hero, ...patch } } })),
  setCamera: (patch) =>
    set((s) => ({ config: { ...s.config, camera: { ...s.config.camera, ...patch } } })),
  setOrbit: (patch) =>
    set((s) => ({
      config: {
        ...s.config,
        camera: { ...s.config.camera, orbit: { ...s.config.camera.orbit, ...patch } },
      },
    })),
  capturePreset: (name, view) =>
    set((s) => ({
      config: {
        ...s.config,
        camera: {
          ...s.config.camera,
          presets: { ...s.config.camera.presets, [name]: view },
        },
      },
    })),

  setLoadedModel: (loadedModel) => set({ loadedModel }),
  setModelSize: (modelSize) => set({ modelSize }),
  registerCameraApi: (cameraApi) => set({ cameraApi }),
}));
