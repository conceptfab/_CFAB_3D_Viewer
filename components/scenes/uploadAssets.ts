'use client';
// components/scenes/uploadAssets.ts

import { upload } from '@vercel/blob/client';

export interface UploadedAssets {
  modelBlobUrl: string;
  thumbBlobUrl: string;
}

/**
 * Uploaduje model (.glb) i miniaturę (PNG) bezpośrednio do Vercel Blob.
 * Token pobierany z /api/blob/upload (handleUpload).
 *
 * Oba uploady wykonywane równolegle (Promise.all).
 * @param modelFile - oryginalny plik .glb (z LoadedModel.file)
 * @param thumbBlob - miniatura PNG (z captureThumbnail)
 * @returns URL-e obu zasobów
 */
export async function uploadAssets(
  modelFile: File,
  thumbBlob: Blob
): Promise<UploadedAssets> {
  // crypto.randomUUID() dostępne w nowoczesnych przeglądarkach (bez pakietu uuid).
  const modelUuid = crypto.randomUUID();
  const thumbUuid = crypto.randomUUID();

  const [modelResult, thumbResult] = await Promise.all([
    upload(`models/${modelUuid}.glb`, modelFile, {
      access: 'public',
      handleUploadUrl: '/api/blob/upload',
    }),
    upload(`thumbnails/${thumbUuid}.png`, thumbBlob, {
      access: 'public',
      handleUploadUrl: '/api/blob/upload',
    }),
  ]);

  return {
    modelBlobUrl: modelResult.url,
    thumbBlobUrl: thumbResult.url,
  };
}
