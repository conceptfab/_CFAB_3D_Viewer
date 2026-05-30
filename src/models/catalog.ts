/** Wbudowane modele z public/models/ — do szybkiej podmiany w panelu HERO. */
export interface CatalogModel {
  id: string;
  label: string;
  url: string;
}

export const MODEL_CATALOG: CatalogModel[] = [
  { id: 'antique-camera', label: 'AntiqueCamera', url: '/models/AntiqueCamera.glb' },
  { id: 'jade-toad', label: 'JadeToad', url: '/models/JadeToad.gltf' },
];
