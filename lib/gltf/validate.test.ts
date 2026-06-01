// lib/gltf/validate.test.ts
import { describe, it, expect } from 'vitest';
import type { VirtualFs, VirtualFile } from './types';
import { validateGltf } from './validate';
import { toKey } from './paths';

type Entry = { text?: string; bytes?: Uint8Array; size?: number };

function fsOf(entries: Record<string, Entry>): VirtualFs {
  const m: VirtualFs = new Map();
  for (const [path, e] of Object.entries(entries)) {
    const blob = e.bytes ? new Blob([e.bytes]) : new Blob([e.text ?? '']);
    const size = e.size ?? blob.size;
    const vf: VirtualFile = { path, blob, size };
    m.set(toKey(path), vf);
  }
  return m;
}

const gltf = (obj: object) => JSON.stringify(obj);

/** Buduje minimalny binarny GLB z podanym JSON-em (chunk JSON, bez BIN). */
function makeGlb(json: object): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (jsonBytes.length % 4)) % 4;
  const chunk = new Uint8Array(jsonBytes.length + pad).fill(0x20);
  chunk.set(jsonBytes, 0);
  const total = 12 + 8 + chunk.length;
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, chunk.length, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  new Uint8Array(buf, 20).set(chunk);
  return new Uint8Array(buf);
}

describe('validateGltf — .gltf multi-file', () => {
  it('OK gdy bufor i tekstura obecne; plik nieużywany → info', async () => {
    const fs = fsOf({
      'scene.gltf': { text: gltf({ asset: { version: '2.0' }, buffers: [{ uri: 'scene.bin' }], images: [{ uri: 'textures/t.png' }] }) },
      'scene.bin': { size: 100 },
      'textures/t.png': { size: 50 },
      'license.txt': { size: 10 },
      '.DS_Store': { size: 5 },
    });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('gltf');
    expect(r.resolved).toContain('scene.bin');
    expect(r.resolved).toContain('textures/t.png');
    expect(r.missing).toHaveLength(0);
    expect(r.unused).toEqual(['license.txt']); // .DS_Store pominięty (junk)
    expect(r.issues.some((i) => i.code === 'UNUSED_FILE' && i.path === 'license.txt')).toBe(true);
  });

  it('brak tekstury → warning, ale ok=true', async () => {
    const fs = fsOf({
      'scene.gltf': { text: gltf({ asset: { version: '2.0' }, buffers: [{ uri: 'scene.bin' }], images: [{ uri: 'textures/t.png' }] }) },
      'scene.bin': { size: 100 },
    });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.ok).toBe(true);
    expect(r.missing).toContain('textures/t.png');
    expect(r.issues.some((i) => i.level === 'warning' && i.code === 'MISSING_TEXTURE')).toBe(true);
  });

  it('brak bufora .bin → fatal, ok=false', async () => {
    const fs = fsOf({
      'scene.gltf': { text: gltf({ asset: { version: '2.0' }, buffers: [{ uri: 'scene.bin' }] }) },
    });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.level === 'fatal' && i.code === 'MISSING_BUFFER')).toBe(true);
  });

  it('zła wersja → fatal', async () => {
    const fs = fsOf({ 'scene.gltf': { text: gltf({ asset: { version: '1.0' } }) } });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'BAD_VERSION')).toBe(true);
  });

  it('niewspierane wymagane rozszerzenie (KTX2/Basis) → fatal', async () => {
    const fs = fsOf({
      'scene.gltf': { text: gltf({ asset: { version: '2.0' }, extensionsRequired: ['KHR_texture_basisu'] }) },
    });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'UNSUPPORTED_EXTENSION')).toBe(true);
  });

  it('Draco/meshopt jako wymagane → dozwolone (brak fatala z tego tytułu)', async () => {
    const fs = fsOf({
      'scene.gltf': { text: gltf({ asset: { version: '2.0' }, extensionsRequired: ['KHR_draco_mesh_compression'] }) },
    });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.issues.some((i) => i.code === 'UNSUPPORTED_EXTENSION')).toBe(false);
  });

  it('uszkodzony JSON → fatal PARSE_ERROR', async () => {
    const fs = fsOf({ 'scene.gltf': { text: 'to-nie-json' } });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.ok).toBe(false);
    expect(r.issues[0].code).toBe('PARSE_ERROR');
  });

  it('osadzony data: URI nie jest traktowany jako brakujący', async () => {
    const fs = fsOf({
      'm.gltf': { text: gltf({ asset: { version: '2.0' }, buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }] }) },
    });
    const r = await validateGltf(fs, 'm.gltf');
    expect(r.missing).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it('przekroczenie limitu rozmiaru → fatal TOO_LARGE', async () => {
    const fs = fsOf({
      'scene.gltf': { text: gltf({ asset: { version: '2.0' }, buffers: [{ uri: 'scene.bin' }] }), size: 10 },
      'scene.bin': { size: 1000 },
    });
    const r = await validateGltf(fs, 'scene.gltf', { maxBytes: 500 });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'TOO_LARGE')).toBe(true);
  });
});

describe('validateGltf — odporność na zniekształcone pola', () => {
  it('buffers/images o złym typie (np. liczba/null) nie rzucają, dają czysty raport', async () => {
    const fs = fsOf({
      'm.gltf': { text: gltf({ asset: { version: '2.0' }, buffers: 42, images: null }) },
    });
    const r = await validateGltf(fs, 'm.gltf');
    expect(r.ok).toBe(true);
    expect(r.missing).toHaveLength(0);
  });

  it('extensionsRequired jako string nie generuje fałszywego UNSUPPORTED_EXTENSION', async () => {
    const fs = fsOf({
      'm.gltf': { text: gltf({ asset: { version: '2.0' }, extensionsRequired: 'KHR_draco_mesh_compression' }) },
    });
    const r = await validateGltf(fs, 'm.gltf');
    expect(r.issues.some((i) => i.code === 'UNSUPPORTED_EXTENSION')).toBe(false);
  });
});

describe('validateGltf — .glb single-file', () => {
  it('OK dla poprawnego GLB; luźna tekstura obok → info UNUSED_FILE', async () => {
    const fs = fsOf({
      'source/model.glb': { bytes: makeGlb({ asset: { version: '2.0' } }) },
      'textures/x.png': { size: 50 },
    });
    const r = await validateGltf(fs, 'source/model.glb');
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('glb');
    expect(r.unused).toContain('textures/x.png');
  });

  it('zły nagłówek GLB → fatal PARSE_ERROR', async () => {
    const fs = fsOf({ 'bad.glb': { bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) } });
    const r = await validateGltf(fs, 'bad.glb');
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'PARSE_ERROR')).toBe(true);
  });

  it('GLB z zewnętrzną teksturą (images[].uri) rozwiązuje ją względem katalogu roota', async () => {
    const fs = fsOf({
      'source/model.glb': { bytes: makeGlb({ asset: { version: '2.0' }, images: [{ uri: '../textures/x.png' }] }) },
      'textures/x.png': { size: 50 },
    });
    const r = await validateGltf(fs, 'source/model.glb');
    expect(r.ok).toBe(true);
    expect(r.resolved).toContain('textures/x.png');
  });

  it('GLB z chunkLen wykraczającym poza plik → fatal PARSE_ERROR (nie RangeError)', async () => {
    const buf = new ArrayBuffer(20);
    const dv = new DataView(buf);
    dv.setUint32(0, 0x46546c67, true); // 'glTF'
    dv.setUint32(4, 2, true);
    dv.setUint32(8, 20, true);
    dv.setUint32(12, 9999, true); // chunkLen >> rozmiar pliku
    dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
    const fs = fsOf({ 'bad.glb': { bytes: new Uint8Array(buf) } });
    const r = await validateGltf(fs, 'bad.glb');
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'PARSE_ERROR')).toBe(true);
  });
});

describe('validateGltf — root nieobecny', () => {
  it('zwraca fatal ROOT_NOT_FOUND', async () => {
    const r = await validateGltf(new Map(), 'brak.gltf');
    expect(r.ok).toBe(false);
    expect(r.issues[0].code).toBe('ROOT_NOT_FOUND');
  });
});
