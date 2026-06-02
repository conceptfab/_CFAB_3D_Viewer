// lib/studio/sourceArtifact.test.ts
import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import type { VirtualFs, VirtualFile } from '@/lib/gltf/types';
import { buildSourceArtifact, rebuildVfsFromSource } from './sourceArtifact';

function vf(path: string, bytes: Uint8Array): VirtualFile {
  return { path, blob: new Blob([bytes as BlobPart]), size: bytes.length };
}
function fsOf(entries: Record<string, Uint8Array>): VirtualFs {
  const m: VirtualFs = new Map();
  for (const [p, b] of Object.entries(entries)) m.set(p.toLowerCase(), vf(p, b));
  return m;
}

describe('buildSourceArtifact', () => {
  it('single .glb → kind glb, blob = oryginalny plik', async () => {
    const fs = fsOf({ 'model.glb': new Uint8Array([1, 2, 3]) });
    const art = await buildSourceArtifact(fs, 'model.glb');
    expect(art.kind).toBe('glb');
    expect(art.fileName).toBe('model.glb');
    expect(art.blob.size).toBe(3);
  });

  it('multi-file → kind gltf-zip, blob = zip wszystkich plików', async () => {
    const fs = fsOf({
      'scene.gltf': strToU8('{"asset":{"version":"2.0"}}'),
      'scene.bin': new Uint8Array([9, 9]),
      'textures/t.png': new Uint8Array([7]),
    });
    const art = await buildSourceArtifact(fs, 'scene.gltf');
    expect(art.kind).toBe('gltf-zip');
    expect(art.fileName.endsWith('.zip')).toBe(true);
    const rebuilt = await rebuildVfsFromSource(art.blob, 'gltf-zip');
    expect(rebuilt.has('scene.gltf')).toBe(true);
    expect(rebuilt.has('scene.bin')).toBe(true);
    expect(rebuilt.has('textures/t.png')).toBe(true);
  });
});

describe('rebuildVfsFromSource', () => {
  it('glb → VFS jednoplikowy', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4]) as BlobPart]);
    const fs = await rebuildVfsFromSource(blob, 'glb', 'model.glb');
    expect(fs.size).toBe(1);
    expect(fs.has('model.glb')).toBe(true);
    expect(fs.get('model.glb')!.size).toBe(4);
  });
  it('zip → VFS wieloplikowy (pomija śmieci)', async () => {
    const zipped = zipSync({ 'a.gltf': strToU8('{}'), 'b.bin': new Uint8Array([1]), '.DS_Store': new Uint8Array([0]) });
    const fs = await rebuildVfsFromSource(new Blob([zipped as BlobPart]), 'gltf-zip');
    expect(fs.has('a.gltf')).toBe(true);
    expect(fs.has('b.bin')).toBe(true);
    expect(fs.has('.ds_store')).toBe(false);
  });
});
