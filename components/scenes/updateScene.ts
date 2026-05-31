'use client';
// components/scenes/updateScene.ts
// In-place save for an already-saved scene: capture a fresh thumbnail, upload
// it, and PATCH the scene's config + thumb. The model is NOT touched (PATCH
// has no model field) — so "Zapisz" just overwrites the layout/config of the
// scene you're editing, with no name prompt. Creating a copy is "Zapisz jako".

import { captureThumbnail } from './captureThumbnail';
import { uploadAssets } from './uploadAssets';
import type { SceneConfig } from '@/components/store';

export async function updateSceneInPlace(
  sceneId: string,
  config: SceneConfig,
  glRef: { domElement: HTMLCanvasElement }
): Promise<void> {
  const thumbBlob = await captureThumbnail(glRef);
  if (!thumbBlob) throw new Error('Nie udało się przechwycić miniatury.');

  const { thumbBlobUrl } = await uploadAssets(null, thumbBlob, null);

  const res = await fetch(`/api/scenes/${sceneId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, thumbBlobUrl }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Błąd zapisu: ${res.status}`);
  }
}
