# Studio — Etap 2: edytor materiałów — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps.
> **Branch:** utwórz `feat/studio-material-editor` od `main` (Etap 1 już na main). Spec: `docs/superpowers/specs/2026-06-02-studio-etap-2-material-editor-design.md`.

**Goal:** Nie-destrukcyjna edycja właściwości PBR materiałów wczytanego modelu w `/studio`: warstwa `materialOverrides` nakładana na żywo przez `StudioActor`, edytowana w panelu „Materiały" (Outliner + leva), serializowana w configu (round-trip przez istniejący zapis/otwórz — zero zmian w DB/API).

**Architecture:** Czysty rdzeń `lib/studio/materials.ts` (typy + `applyOverride`/`snapshotMaterial`/`restoreMaterial`/`collectMaterials`/`buildMaterialInfos`, testowalny strukturalnie bez three). Store: typ `materialOverrides` + settery + runtime `studioMaterials`. `StudioActor` enumeruje unikalne materiały, snapshotuje oryginały, nakłada `restore→apply` reaktywnie. Outliner: sekcja „Materiały". Inspector: panel `MaterialControls` (leva).

**Tech Stack:** three, zustand, leva, vitest (node, mock-materiały — bez importu three w teście).

---

## Struktura plików

| Plik | Odpowiedzialność | Test |
|---|---|---|
| `lib/studio/materials.ts` | Typy (`MaterialOverride`, `MaterialSnapshot`, `MaterialInfo`) + `applyOverride` / `snapshotMaterial` / `restoreMaterial` / `collectMaterials` / `buildMaterialInfos` | ✅ node |
| `components/store.ts` (mod) | Typ `materialOverrides` → `Record<string,MaterialOverride>`; `setMaterialOverride`/`resetMaterialOverride`; runtime `studioMaterials` + setter | ✅ store.test |
| `components/studio/StudioActor.tsx` (mod) | Enumeracja + snapshot + reaktywne `restore→apply`; publikacja `studioMaterials` | ⛔ przeglądarka |
| `components/ui/Outliner.tsx` (mod) | Sekcja „Materiały" → `mat:<key>` | ⛔ przeglądarka |
| `components/ui/Inspector.tsx` (mod) | `MaterialControls` (leva) dla `mat:<key>` + reset | ⛔ przeglądarka |

---

## Task 1: `lib/studio/materials.ts` — rdzeń materiałów

**Files:** Create `lib/studio/materials.ts`; Test `lib/studio/materials.test.ts`.

- [ ] **Step 1: Write the failing test** — `lib/studio/materials.test.ts`:

```ts
// lib/studio/materials.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  applyOverride, snapshotMaterial, restoreMaterial, collectMaterials, buildMaterialInfos,
  type MaterialOverride,
} from './materials';

/** Mock materiału typu MeshStandardMaterial (strukturalnie). */
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
    const withMap = stdMat({ normalMap: {}, normalScale: { x: 1, y: 1, set(x: number, y: number) { this.x = x; this.y = y; } } });
    applyOverride(withMap, { normalScale: 0.5 });
    expect(withMap.normalScale.x).toBe(0.5);
    const noMap = stdMat({ normalScale: { x: 1, y: 1, set(x: number) { this.x = x; } } });
    applyOverride(noMap, { normalScale: 0.5 });
    expect(noMap.normalScale.x).toBe(1); // nie ruszone (brak normalMap)
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
      { isMesh: true, material: shared }, // duplikat
      { isMesh: false, material: stdMat() }, // nie-mesh pomijany
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
```

- [ ] **Step 2: Run** `npx vitest run lib/studio/materials.test.ts` → FAIL (`./materials` brak).

- [ ] **Step 3: Implementation** — `lib/studio/materials.ts`:

```ts
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
```

- [ ] **Step 4: Run** `npx vitest run lib/studio/materials.test.ts` → PASS. `npx tsc --noEmit -p tsconfig.json` → clean.

- [ ] **Step 5: Commit**
```bash
git add lib/studio/materials.ts lib/studio/materials.test.ts
git commit -m "feat(studio): material override core (apply/snapshot/restore/collect/infos)"
```

---

## Task 2: store — typ overrides + settery + studioMaterials

**Files:** Modify `components/store.ts`; Test `components/store.test.ts`.

- [ ] **Step 1: Add tests** to `components/store.test.ts` (append):

```ts
describe('material overrides (Etap 2)', () => {
  beforeEach(() => {
    useStore.setState({ config: structuredClone(DEFAULT_CONFIG), studioMaterials: [] });
  });
  it('setMaterialOverride merge’uje per klucz', () => {
    useStore.getState().setMaterialOverride('0', { metalness: 0.5 });
    useStore.getState().setMaterialOverride('0', { roughness: 0.2 });
    expect(useStore.getState().config.materialOverrides['0']).toEqual({ metalness: 0.5, roughness: 0.2 });
  });
  it('resetMaterialOverride usuwa klucz', () => {
    useStore.getState().setMaterialOverride('1', { color: '#fff' });
    useStore.getState().resetMaterialOverride('1');
    expect(useStore.getState().config.materialOverrides['1']).toBeUndefined();
  });
  it('setStudioMaterials ustawia listę', () => {
    useStore.getState().setStudioMaterials([{ key: '0', name: 'A', hasNormalMap: false, hasClearcoat: false, base: {} }]);
    expect(useStore.getState().studioMaterials).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run components/store.test.ts` → nowe FAIL.

- [ ] **Step 3: Edits to `components/store.ts`**

(a) Import (po `import type { VirtualFs } ...`):
```ts
import type { MaterialOverride, MaterialInfo } from '@/lib/studio/materials';
```
(b) `SceneConfig`: zmień typ pola `materialOverrides`:
```ts
  materialOverrides: Record<string, MaterialOverride>;
```
(c) `State` interface — dodaj przy `setStudioImport`:
```ts
  setMaterialOverride: (key: string, patch: MaterialOverride) => void;
  resetMaterialOverride: (key: string) => void;
  studioMaterials: MaterialInfo[];
  setStudioMaterials: (m: MaterialInfo[]) => void;
```
(d) create body — dodaj (przy `setStudioImport`):
```ts
  setMaterialOverride: (key, patch) =>
    set((s) => ({
      config: {
        ...s.config,
        materialOverrides: {
          ...s.config.materialOverrides,
          [key]: { ...(s.config.materialOverrides[key] ?? {}), ...patch },
        },
      },
    })),
  resetMaterialOverride: (key) =>
    set((s) => {
      const next = { ...s.config.materialOverrides };
      delete next[key];
      return { config: { ...s.config, materialOverrides: next } };
    }),
  studioMaterials: [],
  setStudioMaterials: (studioMaterials) => set({ studioMaterials }),
```

- [ ] **Step 4: Run** `npx vitest run components/store.test.ts components/normalizeConfig.test.ts` → PASS. Full `npm test` → no regressions. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**
```bash
git add components/store.ts components/store.test.ts
git commit -m "feat(studio): materialOverrides setters + studioMaterials slice"
```

---

## Task 3: `StudioActor` — enumeracja, snapshot, reaktywne nakładanie

**Files:** Modify `components/studio/StudioActor.tsx`. Weryfikacja w Task 6.

- [ ] **Step 1: Edits.** Dodaj importy:
```ts
import { collectMaterials, buildMaterialInfos, applyOverride, restoreMaterial } from '@/lib/studio/materials';
```
Dodaj selektory w komponencie (obok istniejących):
```ts
  const materialOverrides = useStore((s) => s.config.materialOverrides);
  const setStudioMaterials = useStore((s) => s.setStudioMaterials);
```
Po `const cloned = useMemo(...)` dodaj memo na materiały + bazy, i publikację listy:
```ts
  const mats = useMemo(() => collectMaterials(cloned as unknown as { traverse: (cb: (o: unknown) => void) => void }), [cloned]);
  const infos = useMemo(() => buildMaterialInfos(mats), [mats]);

  useEffect(() => {
    setStudioMaterials(infos);
    return () => setStudioMaterials([]);
  }, [infos, setStudioMaterials]);
```
Dodaj efekt nakładania (restore→apply) reagujący na override:
```ts
  useEffect(() => {
    mats.forEach((m, i) => {
      restoreMaterial(m, infos[i].base);
      applyOverride(m, materialOverrides[String(i)]);
    });
  }, [mats, infos, materialOverrides]);
```
> Uwaga: istniejący efekt `envMapIntensity` zostaje bez zmian. Kolejność: envMapIntensity i materialOverrides są niezależne (różne pola). Jeśli w przeglądarce (Task 6) zauważysz, że restore kasuje envMapIntensity — przenieś ponowne ustawienie envMapIntensity do efektu nakładania (po apply). Zgłoś jako DONE_WITH_CONCERNS jeśli korygujesz.

- [ ] **Step 2:** `npx tsc --noEmit` → clean. **Commit**
```bash
git add components/studio/StudioActor.tsx
git commit -m "feat(studio): StudioActor applies material overrides (restore->apply) + publishes material list"
```

---

## Task 4: Outliner — sekcja „Materiały"

**Files:** Modify `components/ui/Outliner.tsx`. Weryfikacja w Task 6.

- [ ] **Step 1: Edits.** Dodaj selektor materiałów:
```ts
  const studioMaterials = useStore((s) => s.studioMaterials);
```
Po sekcji „Obiekty"/aktorze (przed `rows.push({ kind: 'section', label: 'Światła' })`) dodaj sekcję materiałów warunkowo:
```ts
  if (studioMaterials.length > 0) {
    rows.push({ kind: 'section', label: 'Materiały' });
    for (const m of studioMaterials) {
      rows.push({ kind: 'item', id: `mat:${m.key}`, label: m.name, icon: '🎨', depth: 1 });
    }
  }
```
(Wiersze `mat:<key>` używają istniejącej gałęzi renderującej `kind: 'item'` — `setSelected(r.id)` zadziała bez zmian, bo to zwykły przycisk wiersza.)

- [ ] **Step 2:** `npx tsc --noEmit` → clean. **Commit**
```bash
git add components/ui/Outliner.tsx
git commit -m "feat(studio): outliner Materiały section lists model materials"
```

---

## Task 5: Inspector — `MaterialControls` (leva)

**Files:** Modify `components/ui/Inspector.tsx`. Weryfikacja w Task 6.

- [ ] **Step 1: Edits.** Dodaj komponent `MaterialControls` (wzór jak `CameraControls` — własny panel leva, remount przez `key`):

```tsx
/* --- Materiał (override per indeks) --- */
function MaterialControls({ matKey }: { matKey: string }) {
  const info = useStore.getState().studioMaterials.find((m) => m.key === matKey);
  const ov = useStore.getState().config.materialOverrides[matKey] ?? {};
  const base = info?.base ?? {};
  const set = (patch: import('../store').SceneConfig['materialOverrides'][string]) =>
    useStore.getState().setMaterialOverride(matKey, patch);

  useControls(
    `Materiał: ${info?.name ?? matKey}`,
    () => ({
      color: { value: ov.color ?? base.color ?? '#ffffff', onChange: (v: string) => set({ color: v }) },
      metalness: { value: ov.metalness ?? base.metalness ?? 0, min: 0, max: 1, step: 0.01, onChange: (v: number) => set({ metalness: v }) },
      roughness: { value: ov.roughness ?? base.roughness ?? 1, min: 0, max: 1, step: 0.01, onChange: (v: number) => set({ roughness: v }) },
      emissive: { value: ov.emissive ?? base.emissive ?? '#000000', onChange: (v: string) => set({ emissive: v }) },
      emissiveIntensity: { value: ov.emissiveIntensity ?? base.emissiveIntensity ?? 1, min: 0, max: 5, step: 0.01, onChange: (v: number) => set({ emissiveIntensity: v }) },
      opacity: { value: ov.opacity ?? base.opacity ?? 1, min: 0, max: 1, step: 0.01, onChange: (v: number) => set({ opacity: v }) },
      transparent: { value: ov.transparent ?? base.transparent ?? false, onChange: (v: boolean) => set({ transparent: v }) },
      ...(info?.hasNormalMap
        ? { normalScale: { value: ov.normalScale ?? base.normalScale ?? 1, min: 0, max: 2, step: 0.01, onChange: (v: number) => set({ normalScale: v }) } }
        : {}),
      ...(info?.hasClearcoat
        ? {
            clearcoat: { value: ov.clearcoat ?? base.clearcoat ?? 0, min: 0, max: 1, step: 0.01, onChange: (v: number) => set({ clearcoat: v }) },
            clearcoatRoughness: { value: ov.clearcoatRoughness ?? base.clearcoatRoughness ?? 0, min: 0, max: 1, step: 0.01, onChange: (v: number) => set({ clearcoatRoughness: v }) },
          }
        : {}),
      'Reset materiału': button(() => useStore.getState().resetMaterialOverride(matKey)),
    }),
    [matKey]
  );
  return null;
}
```

Dodaj do `Inspector()` obsługę zaznaczenia `mat:`:
```ts
  const matKey = selected.startsWith('mat:') ? selected.slice(4) : null;
```
Dołącz `matKey` do warunku `showScene` (żeby panel sceny się nie pokazywał):
```ts
  const showScene = !camId && !camTgtId && !isLightTgt && !matKey && !PANEL_IDS.includes(selected);
```
I wyrenderuj panel (przy innych, z `key` dla remountu):
```tsx
      {matKey && <MaterialControls key={`mat-${matKey}`} matKey={matKey} />}
```

> Uwaga: `MaterialControls` inicjalizuje kontrolki z `override ?? base` i remountuje się przy zmianie `matKey` (świeże wartości dla nowego materiału). Reset czyści override w store → `StudioActor` (Task 3) przywraca oryginał; po resecie panel pozostaje na wartościach bazowych (kolejne wejście w materiał pokaże bazę).

- [ ] **Step 2:** `npx tsc --noEmit` → clean. **Commit**
```bash
git add components/ui/Inspector.tsx
git commit -m "feat(studio): inspector MaterialControls (PBR overrides + reset)"
```

---

## Task 6: Weryfikacja w przeglądarce + pełny zestaw

- [ ] **Step 1:** `npx tsc --noEmit` clean; `npm test` → wszystkie zielone.
- [ ] **Step 2:** dev server, zaloguj się, `/studio`, wczytaj `_test/battlefield_4_-_t-90a/`:
  - Outliner pokazuje sekcję „Materiały" z listą (nazwy jak `Gadget_IronFist`).
  - Zaznacz materiał → panel leva; zmień `roughness`/`color` → zmiana na żywo w EDYCJA i RENDER.
  - „Reset materiału" → powrót do oryginału.
  - Materiał współdzielony → zmiana dotyka wszystkich meshy.
  - Zapisz → otwórz ponownie `/studio/[id]` → override'y nałożone (wymaga migracji 0003 na Neon + BLOB token).
  - Konsola: brak błędów.
- [ ] **Step 3:** Jeśli błędy — diagnozuj (kolejność efektów envMapIntensity vs override; enumeracja a `useGLTF` cache; klucze) i popraw.

---

## Self-Review

**Spec coverage:** zakres PBR (Task 1 `applyOverride` + Task 5 kontrolki) · per-materiał/dedup (Task 1 `collectMaterials`) · tożsamość=indeks (Task 1 `buildMaterialInfos`) · snapshot/restore idempotentne (Task 1) · nakładanie w `StudioActor` (Task 3) · zero zmian DB/API (brak tasków API/schema — `materialOverrides` już w configu) · UI Outliner+Inspektor (Task 4,5) · reset (Task 5) · poza zakresem: tekstury/biblioteka/KTX2 (brak tasków). ✅

**Placeholder scan:** pełny kod w Task 1–2; konkretny w 3–5; brak TBD. ✅

**Type consistency:** `MaterialOverride`/`MaterialSnapshot`/`MaterialInfo` z Task 1 używane w store (Task 2), StudioActor (Task 3), Inspector (Task 5). `studioMaterials: MaterialInfo[]` spójne. `setMaterialOverride(key, patch)`/`resetMaterialOverride(key)`/`setStudioMaterials` te same sygnatury wszędzie. Klucz = `String(index)` spójny (buildMaterialInfos, StudioActor `materialOverrides[String(i)]`, Outliner `mat:${m.key}`, Inspector `slice(4)`). ✅
