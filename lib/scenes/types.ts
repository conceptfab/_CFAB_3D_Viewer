// lib/scenes/types.ts
import type { SceneConfig } from '@/components/store';

/**
 * Rekord sceny — odzwierciedla wiersz tabeli `scenes`.
 * SceneConfig importowany z komponentu store (NIE redefiniować tutaj).
 * Nazwy pól: camelCase (Drizzle mapuje snake_case → camelCase).
 */
export interface SceneRecord {
  id: string;
  ownerId: string;
  title: string;
  config: SceneConfig;
  modelBlobUrl: string | null;
  modelFileName: string | null;
  thumbBlobUrl: string | null;
  isPreset: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateSceneInput = {
  title: string;
  config: SceneConfig;
  modelBlobUrl: string | null;
  modelFileName: string | null;
  thumbBlobUrl: string | null;
  isPreset?: boolean;
};

export type UpdateSceneInput = Partial<
  Pick<SceneRecord, 'title' | 'config' | 'thumbBlobUrl'>
>;
