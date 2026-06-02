// lib/studio/materials.ts
// Czysty rdzeń edycji materiałów. Typowany strukturalnie (MatLike), by testować
// bez importu three (mock-materiały). StudioActor podaje realne THREE.Material
// (przypisywalne do MatLike — wszystkie pola opcjonalne).

export interface MaterialOverride {
  color?: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  transparent?: boolean;
  normalScale?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
}

/** Oryginalne wartości edytowalnych pól (do przywracania + baza w UI). */
export type MaterialSnapshot = MaterialOverride;

export interface MaterialInfo {
  key: string;
  name: string;
  hasNormalMap: boolean;
  hasClearcoat: boolean;
  base: MaterialSnapshot;
}

interface ColorLike { set?: (v: string) => void; getHexString?: () => string }
interface Vec2Like { x?: number; set?: (x: number, y: number) => void }
interface MatLike {
  name?: string;
  color?: ColorLike;
  metalness?: number;
  roughness?: number;
  emissive?: ColorLike;
  emissiveIntensity?: number;
  opacity?: number;
  transparent?: boolean;
  normalMap?: unknown;
  normalScale?: Vec2Like;
  clearcoat?: number;
  clearcoatRoughness?: number;
  needsUpdate?: boolean;
}

/** Nakłada obecne pola override; pomija niewspierane przez materiał. */
export function applyOverride(mat: MatLike, ov?: MaterialOverride): void {
  if (!ov) return;
  let changed = false;
  if (ov.color !== undefined && mat.color?.set) { mat.color.set(ov.color); changed = true; }
  if (ov.metalness !== undefined && 'metalness' in mat) { mat.metalness = ov.metalness; changed = true; }
  if (ov.roughness !== undefined && 'roughness' in mat) { mat.roughness = ov.roughness; changed = true; }
  if (ov.emissive !== undefined && mat.emissive?.set) { mat.emissive.set(ov.emissive); changed = true; }
  if (ov.emissiveIntensity !== undefined && 'emissiveIntensity' in mat) { mat.emissiveIntensity = ov.emissiveIntensity; changed = true; }
  if (ov.opacity !== undefined && 'opacity' in mat) { mat.opacity = ov.opacity; changed = true; }
  if (ov.transparent !== undefined && 'transparent' in mat) { mat.transparent = ov.transparent; changed = true; }
  if (ov.normalScale !== undefined && mat.normalMap && mat.normalScale?.set) { mat.normalScale.set(ov.normalScale, ov.normalScale); changed = true; }
  if (ov.clearcoat !== undefined && 'clearcoat' in mat) { mat.clearcoat = ov.clearcoat; changed = true; }
  if (ov.clearcoatRoughness !== undefined && 'clearcoatRoughness' in mat) { mat.clearcoatRoughness = ov.clearcoatRoughness; changed = true; }
  if (changed) mat.needsUpdate = true;
}

/** Zapisuje oryginalne wartości edytowalnych pól materiału. */
export function snapshotMaterial(mat: MatLike): MaterialSnapshot {
  const s: MaterialSnapshot = {};
  if (mat.color?.getHexString) s.color = `#${mat.color.getHexString()}`;
  if ('metalness' in mat) s.metalness = mat.metalness;
  if ('roughness' in mat) s.roughness = mat.roughness;
  if (mat.emissive?.getHexString) s.emissive = `#${mat.emissive.getHexString()}`;
  if ('emissiveIntensity' in mat) s.emissiveIntensity = mat.emissiveIntensity;
  if ('opacity' in mat) s.opacity = mat.opacity;
  if ('transparent' in mat) s.transparent = mat.transparent;
  if (mat.normalMap && mat.normalScale && typeof mat.normalScale.x === 'number') s.normalScale = mat.normalScale.x;
  if ('clearcoat' in mat) s.clearcoat = mat.clearcoat;
  if ('clearcoatRoughness' in mat) s.clearcoatRoughness = mat.clearcoatRoughness;
  return s;
}

/** Przywraca materiał do snapshotu (= nałożenie snapshotu jako override). */
export function restoreMaterial(mat: MatLike, snap: MaterialSnapshot): void {
  applyOverride(mat, snap);
}

interface GroupLike { traverse: (cb: (o: unknown) => void) => void }

/** Unikalne instancje materiałów w kolejności obchodzenia sceny (dedup współdzielonych). */
export function collectMaterials(group: GroupLike): MatLike[] {
  const seen = new Set<unknown>();
  const out: MatLike[] = [];
  group.traverse((o) => {
    const mesh = o as { isMesh?: boolean; material?: MatLike | MatLike[] };
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m && !seen.has(m)) { seen.add(m); out.push(m); }
    }
  });
  return out;
}

/** Buduje metadane materiałów (klucz=indeks, nazwa, flagi, baza) do store/UI. */
export function buildMaterialInfos(mats: MatLike[]): MaterialInfo[] {
  return mats.map((m, i) => ({
    key: String(i),
    name: m.name || `Materiał ${i + 1}`,
    hasNormalMap: !!m.normalMap,
    hasClearcoat: 'clearcoat' in m,
    base: snapshotMaterial(m),
  }));
}
