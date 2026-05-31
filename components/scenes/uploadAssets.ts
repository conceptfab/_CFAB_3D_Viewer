'use client';
// components/scenes/uploadAssets.ts

import { upload } from '@vercel/blob/client';

export interface UploadedAssets {
  modelBlobUrl: string;
  thumbBlobUrl: string;
}

/**
 * Uploaduje miniaturę (PNG) ZAWSZE, a model (.glb) tylko gdy mamy świeży plik z dysku.
 * Gdy scena została otwarta z galerii (brak pliku, jest istniejący URL modelu w Blob),
 * model NIE jest wgrywany ponownie — reużywamy istniejący URL.
 *
 * @param modelFile - świeży plik .glb (LoadedModel.file) lub null (scena otwarta z galerii)
 * @param thumbBlob - miniatura PNG (captureThumbnail)
 * @param existingModelUrl - istniejący URL modelu w Blob (wymagany gdy modelFile == null)
 */
export async function uploadAssets(
  modelFile: File | null,
  thumbBlob: Blob,
  existingModelUrl?: string | null
): Promise<UploadedAssets> {
  const thumbUuid = crypto.randomUUID();
  const thumbPromise = upload(`thumbnails/${thumbUuid}.png`, thumbBlob, {
    access: 'public',
    handleUploadUrl: '/api/blob/upload',
  });

  if (modelFile) {
    const modelUuid = crypto.randomUUID();
    const [modelResult, thumbResult] = await Promise.all([
      upload(`models/${modelUuid}.glb`, modelFile, {
        access: 'public',
        handleUploadUrl: '/api/blob/upload',
      }),
      thumbPromise,
    ]);
    return { modelBlobUrl: modelResult.url, thumbBlobUrl: thumbResult.url };
  }

  if (!existingModelUrl) {
    throw new Error('Brak modelu do zapisania.');
  }
  const thumbResult = await thumbPromise;
  return { modelBlobUrl: existingModelUrl, thumbBlobUrl: thumbResult.url };
}
