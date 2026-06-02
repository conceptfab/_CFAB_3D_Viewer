// lib/studio/savePayload.test.ts
import { describe, it, expect } from 'vitest';
import { buildSavePayload } from './savePayload';
import { DEFAULT_CONFIG } from '@/components/store';

describe('buildSavePayload', () => {
  it('składa body POST z wymaganymi polami', () => {
    const body = buildSavePayload({
      title: 'Mój model',
      sourceBlobUrl: 'https://b/sources/a.zip',
      sourceFileName: 'a.zip',
      sourceKind: 'gltf-zip',
      config: DEFAULT_CONFIG,
      thumbBlobUrl: 'https://b/thumbnails/a.png',
    });
    expect(body).toMatchObject({
      title: 'Mój model',
      sourceBlobUrl: 'https://b/sources/a.zip',
      sourceFileName: 'a.zip',
      sourceKind: 'gltf-zip',
      thumbBlobUrl: 'https://b/thumbnails/a.png',
    });
    expect(body.config).toBe(DEFAULT_CONFIG);
  });

  it('thumbBlobUrl null gdy brak miniatury', () => {
    const body = buildSavePayload({
      title: 'X', sourceBlobUrl: 'https://b/sources/a.glb', sourceFileName: 'a.glb',
      sourceKind: 'glb', config: DEFAULT_CONFIG, thumbBlobUrl: null,
    });
    expect(body.thumbBlobUrl).toBeNull();
  });
});
