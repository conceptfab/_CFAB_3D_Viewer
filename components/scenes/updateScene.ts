'use client';
// components/scenes/updateScene.ts
// In-place save for an already-saved scene: capture a fresh thumbnail, upload
// it (plus the model when it changed), and PATCH the scene's config + model +
// thumb. "Zapisz" overwrites the scene you're editing in place, with no name
// prompt; creating a copy is "Zapisz jako".
//
// Model handling mirrors SaveSceneDialog (the create path) so podmiana modelu
// utrwala się tak samo:
//   • brak modelu (usunięty w edytorze)  → modelBlobUrl/Name = null (wyczyść)
//   • świeży plik z dysku                 → upload nowego .glb
//   • istniejący URL z Blob (bez zmian)   → reużyj URL (bez ponownego uploadu)
//   • wczytany, ale bez pliku i bez URL   → NIE ruszaj modelu (nie kasuj go)

import { captureThumbnail } from './captureThumbnail';
import { uploadAssets } from './uploadAssets';
import type { SceneConfig, LoadedModel } from '@/components/store';

export async function updateSceneInPlace(
  sceneId: string,
  config: SceneConfig,
  glRef: { domElement: HTMLCanvasElement },
  loadedModel: LoadedModel | null
): Promise<void> {
  const thumbBlob = await captureThumbnail(glRef);
  if (!thumbBlob) throw new Error('Nie udało się przechwycić miniatury.');

  // Z czego wysłać model: świeży plik z dysku vs. istniejący URL z Blob.
  const modelFile = loadedModel?.file ?? null;
  const remoteModelUrl =
    loadedModel && !loadedModel.file && /^https?:\/\//.test(loadedModel.objectUrl)
      ? loadedModel.objectUrl
      : null;
  // Czy potrafimy jednoznacznie określić stan modelu? Gdy model jest wczytany,
  // ale nie mamy ani pliku, ani URL-a (np. osierocony blob:), pomijamy pola
  // modelu, by przypadkiem NIE skasować poprawnego modelu z bazy.
  const canSerializeModel = !loadedModel || modelFile !== null || remoteModelUrl !== null;

  const { modelBlobUrl, thumbBlobUrl } = await uploadAssets(modelFile, thumbBlob, remoteModelUrl);

  const body: Record<string, unknown> = { config, thumbBlobUrl };
  if (canSerializeModel) {
    body.modelBlobUrl = modelBlobUrl; // null gdy model usunięty → czyści model w DB
    body.modelFileName = loadedModel?.fileName ?? null;
  }

  const res = await fetch(`/api/scenes/${sceneId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Błąd zapisu: ${res.status}`);
  }
}
