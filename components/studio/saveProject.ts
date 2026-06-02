// components/studio/saveProject.ts
'use client';
import { upload } from '@vercel/blob/client';
import { captureThumbnail } from '../scenes/captureThumbnail';
import { buildSourceArtifact } from '@/lib/studio/sourceArtifact';
import { buildSavePayload } from '@/lib/studio/savePayload';
import type { VirtualFs } from '@/lib/gltf/types';
import type { SceneConfig } from '../store';

export async function saveProject(opts: {
  projectId?: string;            // PATCH gdy istnieje, POST gdy nowy
  title: string;
  vfs: VirtualFs;
  rootKey: string;
  config: SceneConfig;
  glRef: { domElement: HTMLCanvasElement };
}): Promise<{ id: string }> {
  const art = await buildSourceArtifact(opts.vfs, opts.rootKey);
  const thumb = await captureThumbnail(opts.glRef);

  const sourceUuid = crypto.randomUUID();
  const ext = art.kind === 'glb' ? 'glb' : 'zip';
  const sourceUpload = upload(`sources/${sourceUuid}.${ext}`, art.blob, { access: 'public', handleUploadUrl: '/api/blob/upload', multipart: true });
  const thumbUpload = thumb ? upload(`thumbnails/${crypto.randomUUID()}.png`, thumb, { access: 'public', handleUploadUrl: '/api/blob/upload' }) : Promise.resolve(null);
  const [src, th] = await Promise.all([sourceUpload, thumbUpload]);

  const body = buildSavePayload({
    title: opts.title,
    sourceBlobUrl: src.url,
    sourceFileName: art.fileName,
    sourceKind: art.kind,
    config: opts.config,
    thumbBlobUrl: th?.url ?? null,
  });

  const url = opts.projectId ? `/api/studio/${opts.projectId}` : '/api/studio';
  const method = opts.projectId ? 'PATCH' : 'POST';
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { error?: string }).error ?? `Błąd zapisu: ${res.status}`);
  }
  return await res.json() as { id: string };
}
