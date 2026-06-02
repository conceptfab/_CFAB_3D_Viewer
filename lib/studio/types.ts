// lib/studio/types.ts
import type { SceneConfig } from '@/components/store';

/** glb = pojedynczy plik; gltf-zip = multi-file spakowany do .zip. */
export type SourceKind = 'glb' | 'gltf-zip';

/** Rekord projektu Studio — wiersz tabeli `studio_projects`. */
export interface StudioProjectRecord {
  id: string;
  ownerId: string;
  title: string;
  sourceBlobUrl: string;
  sourceFileName: string;
  sourceKind: SourceKind;
  config: SceneConfig;
  thumbBlobUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateStudioProjectInput = {
  title: string;
  sourceBlobUrl: string;
  sourceFileName: string;
  sourceKind: SourceKind;
  config: SceneConfig;
  thumbBlobUrl: string | null;
};

export type UpdateStudioProjectInput = Partial<
  Pick<StudioProjectRecord, 'title' | 'config' | 'thumbBlobUrl' | 'sourceBlobUrl' | 'sourceFileName' | 'sourceKind'>
>;
