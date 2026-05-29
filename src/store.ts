import { create } from 'zustand';
import type { MaterialId } from './viewer/materials/library';

export type CameraPreset = 'hero' | 'front' | 'side' | 'top' | 'detail';

export interface ModelDef {
  id: string;
  name: string;
  url: string;
  // If true, override every mesh's material with the selected MaterialId.
  // For real PBR assets, set false so embedded textures stay.
  overrideMaterial: boolean;
  targetHeight: number;
}

export const MODELS: ModelDef[] = [
  {
    id: 'camera',
    name: 'AntiqueCamera (PBR demo)',
    url: '/models/AntiqueCamera.glb',
    overrideMaterial: false,
    targetHeight: 1.4,
  },
  {
    id: 'toad',
    name: 'JadeToad (material playground)',
    url: '/models/JadeToad.gltf',
    overrideMaterial: true,
    targetHeight: 1.2,
  },
];

interface State {
  modelId: string;
  material: MaterialId;
  camera: CameraPreset;
  // World-space size [x, y, z] of the currently displayed (auto-fitted) model.
  // Drives all object-dependent studio params (shadow size, frustum, ...) so
  // the scene stays universal as objects are swapped dynamically.
  modelSize: [number, number, number];
  setModel: (id: string) => void;
  setMaterial: (id: MaterialId) => void;
  setCamera: (preset: CameraPreset) => void;
  setModelSize: (size: [number, number, number]) => void;
}

export const useStore = create<State>((set) => ({
  modelId: 'camera',
  material: 'jade',
  camera: 'hero',
  modelSize: [1, 1.4, 1],
  setModel: (modelId) => set({ modelId }),
  setMaterial: (material) => set({ material }),
  setCamera: (camera) => set({ camera }),
  setModelSize: (modelSize) => set({ modelSize }),
}));
