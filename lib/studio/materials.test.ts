// lib/studio/materials.test.ts
import { describe, it, expect } from 'vitest';
import {
  applyOverride, snapshotMaterial, restoreMaterial, collectMaterials, buildMaterialInfos,
  type MaterialOverride,
} from './materials';

function stdMat(over: Partial<Record<string, unknown>> = {}) {
  return {
    name: 'Mat',
    color: { _hex: 'ffffff', set(v: string) { this._hex = v.replace('#', ''); }, getHexString() { return this._hex; } },
    metalness: 0.0,
    roughness: 1.0,
    emissive: { _hex: '000000', set(v: string) { this._hex = v.replace('#', ''); }, getHexString() { return this._hex; } },
    emissiveIntensity: 1.0,
    opacity: 1.0,
    transparent: false,
    needsUpdate: false,
    ...over,
  } as Record<string, any>;
}

describe('applyOverride', () => {
  it('ustawia obecne pola i needsUpdate', () => {
    const m = stdMat();
    applyOverride(m, { color: '#ff0000', metalness: 0.8, roughness: 0.2, transparent: true, opacity: 0.5 });
    expect(m.color.getHexString()).toBe('ff0000');
    expect(m.metalness).toBe(0.8);
    expect(m.roughness).toBe(0.2);
    expect(m.transparent).toBe(true);
    expect(m.opacity).toBe(0.5);
    expect(m.needsUpdate).toBe(true);
  });
  it('undefined override → no-op (needsUpdate niezmienione)', () => {
    const m = stdMat();
    applyOverride(m, undefined);
    expect(m.needsUpdate).toBe(false);
  });
  it('pomija clearcoat gdy materiał go nie ma', () => {
    const m = stdMat();
    applyOverride(m, { clearcoat: 0.7 });
    expect('clearcoat' in m).toBe(false);
  });
  it('normalScale tylko gdy jest normalMap', () => {
    const withMap = stdMat({ normalMap: {}, normalScale: { x: 1, y: 1, set(this: { x: number; y: number }, x: number, y: number) { this.x = x; this.y = y; } } });
    applyOverride(withMap, { normalScale: 0.5 });
    expect(withMap.normalScale.x).toBe(0.5);
    const noMap = stdMat({ normalScale: { x: 1, y: 1, set(this: { x: number }, x: number) { this.x = x; } } });
    applyOverride(noMap, { normalScale: 0.5 });
    expect(noMap.normalScale.x).toBe(1);
  });
});

describe('snapshotMaterial + restoreMaterial', () => {
  it('round-trip przywraca oryginał', () => {
    const m = stdMat({ metalness: 0.3, roughness: 0.6 });
    const snap = snapshotMaterial(m);
    applyOverride(m, { metalness: 1.0, roughness: 0.0, color: '#00ff00' });
    restoreMaterial(m, snap);
    expect(m.metalness).toBe(0.3);
    expect(m.roughness).toBe(0.6);
    expect(m.color.getHexString()).toBe('ffffff');
  });
  it('restore+apply jest idempotentne', () => {
    const m = stdMat({ metalness: 0.3 });
    const snap = snapshotMaterial(m);
    const ov: MaterialOverride = { metalness: 0.9 };
    restoreMaterial(m, snap); applyOverride(m, ov);
    const first = m.metalness;
    restoreMaterial(m, snap); applyOverride(m, ov);
    expect(m.metalness).toBe(first);
  });
});

describe('collectMaterials + buildMaterialInfos', () => {
  function groupOf(meshes: any[]) {
    return { traverse: (cb: (o: unknown) => void) => meshes.forEach(cb) };
  }
  it('zbiera unikalne materiały w kolejności, dedup współdzielonych', () => {
    const shared = stdMat({ name: 'Shared' });
    const a = stdMat({ name: 'A' });
    const meshes = [
      { isMesh: true, material: a },
      { isMesh: true, material: shared },
      { isMesh: true, material: shared },
      { isMesh: false, material: stdMat() },
    ];
    const mats = collectMaterials(groupOf(meshes));
    expect(mats).toHaveLength(2);
    expect(mats[0]).toBe(a);
    expect(mats[1]).toBe(shared);
  });
  it('obsługuje multi-material (tablica) jako osobne wpisy', () => {
    const m0 = stdMat({ name: 'M0' }); const m1 = stdMat({ name: 'M1' });
    const mats = collectMaterials({ traverse: (cb) => cb({ isMesh: true, material: [m0, m1] }) });
    expect(mats).toEqual([m0, m1]);
  });
  it('buildMaterialInfos: klucz=indeks, nazwa, flagi, baza', () => {
    const m = stdMat({ name: 'Stal', normalMap: {}, normalScale: { x: 1, y: 1 } });
    const infos = buildMaterialInfos([m]);
    expect(infos[0].key).toBe('0');
    expect(infos[0].name).toBe('Stal');
    expect(infos[0].hasNormalMap).toBe(true);
    expect(infos[0].hasClearcoat).toBe(false);
    expect(infos[0].base.metalness).toBe(0);
  });
  it('buildMaterialInfos: domyślna nazwa gdy brak', () => {
    const m = stdMat({ name: '' });
    expect(buildMaterialInfos([m])[0].name).toBe('Materiał 1');
  });
});
