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

// ── Etap D ──────────────────────────────────────────────────────────────────

export type ShareMode = 'view' | 'embed';

export interface ScenePermission {
  id: string;
  sceneId: string;
  userId: string;
  canEdit: boolean;
  createdAt: Date;
}

export interface ShareLink {
  id: string;
  sceneId: string;
  token: string;
  mode: ShareMode;
  createdAt: Date;
  revokedAt: Date | null;
}

// PermissionWithUser używany w API GET /permissions
export interface PermissionWithUser {
  id: string;
  sceneId: string;
  userId: string;
  email: string;
  canEdit: boolean;
  createdAt: Date;
}
