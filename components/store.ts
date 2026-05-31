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
  | 'branding'
  | 'hero'
  | 'actor'
  | 'light'
  | 'camera';

export type BrandingMode = 'text' | 'image';

/** Tryb gizmo dla HERO NULL. */
export type GizmoMode = 'translate' | 'rotate' | 'scale';

export type Vec3 = [number, number, number];

export interface CameraPresetView {
  position: Vec3;
  target: Vec3;
  fov: number;
}

export interface CameraDef {
  id: string;
  name: string;
  position: Vec3;
  target: Vec3;
  fov: number;
  showInFinalBar: boolean;
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
  // Plakietka brandingowa w lewym górnym rogu finalnego widoku.
  branding: {
    mode: BrandingMode;
    text: string;
    fontFamily: string;
    color: string;
    fontSize: number;
    fontWeight: number;
    letterSpacing: number;
    bgEnabled: boolean;
    bgColor: string;
    imageUrl: string;
    imageName: string;
  };
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
    cameras: CameraDef[];
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
  branding: {
    mode: 'text',
    text: 'CONCEPTFAB',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: '#1b1c20',
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1.5,
    bgEnabled: true,
    bgColor: '#ffffff',
    imageUrl: '',
    imageName: '',
  },
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
    cameras: [
      { id: 'hero', name: 'Hero', position: [2.4, 1.4, 3.0], target: [0, 0.6, 0], fov: 28, showInFinalBar: true },
      { id: 'front', name: 'Front', position: [0, 0.9, 3.2], target: [0, 0.6, 0], fov: 28, showInFinalBar: true },
      { id: 'side', name: 'Side', position: [3.2, 0.9, 0.2], target: [0, 0.6, 0], fov: 28, showInFinalBar: true },
      { id: 'top', name: 'Top', position: [0.1, 3.6, 0.1], target: [0, 0, 0], fov: 30, showInFinalBar: true },
      { id: 'detail', name: 'Detail', position: [1.3, 0.7, 1.3], target: [0, 0.6, 0], fov: 45, showInFinalBar: true },
    ],
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
  /** Oryginalny obiekt File — potrzebny do uploadu przy zapisie sceny.
   *  null gdy model załadowany z Blob URL (otwieranie istniejącej sceny). */
  file: File | null;
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
  setBranding: (patch: Partial<SceneConfig['branding']>) => void;
  setHero: (patch: Partial<SceneConfig['hero']>) => void;
  setCamera: (
    patch: Partial<Pick<SceneConfig['camera'], 'near' | 'far' | 'active'>>
  ) => void;
  setOrbit: (patch: Partial<SceneConfig['camera']['orbit']>) => void;
  capturePreset: (id: string, view: CameraPresetView) => void;
  updateCamera: (id: string, patch: Partial<Omit<CameraDef, 'id'>>) => void;
  renameCamera: (id: string, name: string) => void;
  setCameraVisible: (id: string, visible: boolean) => void;
  moveCamera: (id: string, dir: 'up' | 'down') => void;
  addCamera: () => void;
  removeCamera: (id: string) => void;

  setLoadedModel: (model: LoadedModel | null) => void;
  /** Usuwa model ze sceny (zwalnia blob: objectUrl jeśli był z dysku). */
  removeModel: () => void;
  setModelSize: (size: Vec3) => void;
  registerCameraApi: (api: CameraApi | null) => void;

  /** Referencja do WebGLRenderer dla captureThumbnail (poza drzewem Canvas). */
  glRef: { domElement: HTMLCanvasElement } | null;
  setGlRef: (gl: { domElement: HTMLCanvasElement } | null) => void;
}

export const useStore = create<State>((set) => ({
  config: DEFAULT_CONFIG,
  loadedModel: null,
  modelSize: [1, 1.4, 1],
  cameraApi: null,
  glRef: null,

  editorView: 'perspective',
  setEditorView: (editorView) => set({ editorView }),
  // Pusty string = nic nie zaznaczone → inspektor pokazuje parametry sceny.
  selected: '',
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
  setBranding: (patch) =>
    set((s) => ({ config: { ...s.config, branding: { ...s.config.branding, ...patch } } })),
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
  capturePreset: (id, view) =>
    set((s) => ({
      config: {
        ...s.config,
        camera: {
          ...s.config.camera,
          cameras: s.config.camera.cameras.map((c) =>
            c.id === id ? { ...c, position: view.position, target: view.target, fov: view.fov } : c
          ),
        },
      },
    })),

  updateCamera: (id, patch) =>
    set((s) => ({
      config: {
        ...s.config,
        camera: {
          ...s.config.camera,
          cameras: s.config.camera.cameras.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        },
      },
    })),

  renameCamera: (id, name) =>
    set((s) => ({
      config: {
        ...s.config,
        camera: {
          ...s.config.camera,
          cameras: s.config.camera.cameras.map((c) => (c.id === id ? { ...c, name } : c)),
        },
      },
    })),

  setCameraVisible: (id, visible) =>
    set((s) => ({
      config: {
        ...s.config,
        camera: {
          ...s.config.camera,
          cameras: s.config.camera.cameras.map((c) =>
            c.id === id ? { ...c, showInFinalBar: visible } : c
          ),
        },
      },
    })),

  moveCamera: (id, dir) =>
    set((s) => {
      const arr = s.config.camera.cameras;
      const idx = arr.findIndex((c) => c.id === id);
      if (idx < 0) return s;
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return s;
      const next = arr.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return {
        config: { ...s.config, camera: { ...s.config.camera, cameras: next } },
      };
    }),

  addCamera: () =>
    set((s) => {
      // unikalne id
      let n = s.config.camera.cameras.length + 1;
      const taken = new Set(s.config.camera.cameras.map((c) => c.id));
      while (taken.has(`cam_${n}`)) n++;
      const id = `cam_${n}`;
      const newCam: CameraDef = {
        id,
        name: `Kamera ${n}`,
        position: [2.4, 1.4, 3.0],
        target: [0, 0.6, 0],
        fov: 35,
        showInFinalBar: true,
      };
      return {
        config: {
          ...s.config,
          camera: { ...s.config.camera, cameras: [...s.config.camera.cameras, newCam] },
        },
      };
    }),

  removeCamera: (id) =>
    set((s) => {
      const arr = s.config.camera.cameras;
      if (arr.length <= 1) return s;
      const next = arr.filter((c) => c.id !== id);
      const active = s.config.camera.active === id ? next[0].id : s.config.camera.active;
      return {
        config: { ...s.config, camera: { ...s.config.camera, active, cameras: next } },
      };
    }),

  setLoadedModel: (loadedModel) => set({ loadedModel }),
  removeModel: () =>
    set((s) => {
      const url = s.loadedModel?.objectUrl;
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
      return { loadedModel: null };
    }),
  setModelSize: (modelSize) => set({ modelSize }),
  registerCameraApi: (cameraApi) => set({ cameraApi }),

  setGlRef: (glRef) => set({ glRef }),
}));

// Dev-only: ekspozycja store w konsoli przeglądarki (debug kamer/sceny).
// Wyłączone w buildzie produkcyjnym.
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { __store?: typeof useStore }).__store = useStore;
}
