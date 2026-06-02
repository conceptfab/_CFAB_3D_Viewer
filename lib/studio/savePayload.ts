// lib/studio/savePayload.ts
import type { SceneConfig } from '@/components/store';
import type { SourceKind } from './types';

export interface SavePayloadInput {
  title: string;
  sourceBlobUrl: string;
  sourceFileName: string;
  sourceKind: SourceKind;
  config: SceneConfig;
  thumbBlobUrl: string | null;
}

/** Czysty builder body dla POST /api/studio (i PATCH — to samo body). */
export function buildSavePayload(input: SavePayloadInput): Record<string, unknown> {
  return {
    title: input.title,
    sourceBlobUrl: input.sourceBlobUrl,
    sourceFileName: input.sourceFileName,
    sourceKind: input.sourceKind,
    config: input.config,
    thumbBlobUrl: input.thumbBlobUrl,
  };
}
