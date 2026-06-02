# Studio — Etap 1c: workspace UI (dual-view + import + zapis/otwieranie) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.
> **Branch:** kontynuacja `feat/studio-gltf-core`. Plan 3 z 3 Etapu 1 (po 1a rdzeń, 1b persystencja). Spec: `docs/superpowers/specs/2026-06-01-studio-etap-1-import-design.md`.

**Goal:** Spiąć rdzeń (1a) i persystencję (1b) w działający moduł `/studio`: import multi-file glTF (folder/zip/glb) z panelem walidacji, jeden viewport przełączany EDYCJA⟷RENDER, ustawianie sceny + import presetów, oraz zapis/otwieranie projektu (edytowalne źródło).

**Architecture (rozstrzygnięcia integracyjne):**
- **Wszystkie importy → `loadFromFiles(vfs, root)` → `THREE.Group`.** Pojedynczy `.glb` to 1-plikowy VFS. Brak `useGLTF` w Studio.
- **`StudioActor`** — wariant `Actor` przyjmujący gotowy `THREE.Group` (zamiast URL): auto-fit/center + `envMapIntensity` ze store, publikuje `modelSize`.
- **Jeden `<Canvas>` (`StudioViewport`) z przełącznikiem trybu** (nie dwa canvasy — `Object3D` ma jednego rodzica): EDIT = płaskie światło + grid + gizmo + rzuty; RENDER = `Studio` + `Postprocess` + kamera sceny. `StudioActor` obecny w obu.
- **Stan runtime w store** (nieserializowany): `studioVfs`, `studioRoot`, `studioScene` (Group), `studioReport`, `studioSourceName`. Serializowany config zyskuje `materialOverrides` (puste w 1c).
- **Źródło**: single `.glb` → artefakt `.glb`; multi-file → `.zip` (fflate) całego VFS. Upload do `sources/<uuid>`.
- **Zapis/otwieranie**: POST/PATCH `/api/studio`; otwarcie pobiera źródło → rebuild VFS → `loadFromFiles`.

**Tech Stack:** React 19 + R3F + drei + three, fflate, zustand, vitest. Reużycie: `Studio`, `Postprocess`, `CameraRig`, `Outliner`, `Inspector`, `EditorView` rigs, `captureThumbnail`, `uploadAssets` (client `upload`).

---

## Struktura plików

| Plik | Odpowiedzialność | Test |
|---|---|---|
| `components/store.ts` (mod) | `materialOverrides` w DEFAULT_CONFIG; `applyPreset`; slice runtime Studio | ✅ (store/normalizeConfig) |
| `lib/studio/sourceArtifact.ts` | VFS→artefakt (glb/zip) + rebuild VFS z pobranego źródła + detekcja kind | ✅ node (fflate) |
| `lib/studio/savePayload.ts` | Czysty builder body POST/PATCH /api/studio | ✅ node |
| `components/studio/StudioActor.tsx` | Group→scena: auto-fit/center, materiał | ⛔ przeglądarka |
| `components/studio/StudioViewport.tsx` | Jeden canvas, tryb EDIT/RENDER | ⛔ przeglądarka |
| `components/studio/ViewToggle.tsx` | Przełącznik trybu (pasek) | ⛔ przeglądarka |
| `components/studio/AssetDropzone.tsx` | Wejście folder/zip/glb → VFS→walidacja→report | ⛔ przeglądarka |
| `components/studio/ImportReport.tsx` | Panel raportu walidacji | ⛔ przeglądarka |
| `components/studio/RootPicker.tsx` | Wybór roota przy wielu kandydatach | ⛔ przeglądarka |
| `components/studio/PresetPicker.tsx` | Lista presetów → applyPreset | ⛔ przeglądarka |
| `components/studio/StudioShell.tsx` | Layout + toolbar + zapis | ⛔ przeglądarka |
| `components/studio/saveProject.ts` | Client: thumb+źródło upload + POST/PATCH | ⛔ przeglądarka (używa savePayload/sourceArtifact) |
| `components/studio/openProject.ts` | Client: fetch + download źródła + rebuild + loadFromFiles | ⛔ przeglądarka |
| `app/studio/page.tsx`, `app/studio/[id]/page.tsx` | Trasy (auth) | ⛔ przeglądarka |
| `app/dev/gltf-import/` (DELETE) | Usunięcie strony dev z 1a | — |

---

## Task 1: store — materialOverrides, applyPreset, slice Studio

**Files:** Modify `components/store.ts`; Test `components/store.test.ts` (existing — add cases).

- [ ] **Step 1: Dodaj testy** w `components/store.test.ts` (dopisz na końcu, przed ewentualnym zamknięciem pliku):

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, DEFAULT_CONFIG } from './store';

describe('materialOverrides + applyPreset (Studio)', () => {
  beforeEach(() => {
    useStore.setState({ config: structuredClone(DEFAULT_CONFIG) });
  });

  it('DEFAULT_CONFIG ma puste materialOverrides', () => {
    expect(DEFAULT_CONFIG.materialOverrides).toEqual({});
  });

  it('applyPreset nadpisuje ustawienia sceny, NIE rusza materialOverrides', () => {
    useStore.setState((s) => ({
      config: { ...s.config, materialOverrides: { '0': { color: '#fff' } } },
    }));
    const preset = structuredClone(DEFAULT_CONFIG);
    preset.tone = { mode: 'AGX', exposure: 1.7 };
    preset.environment = { hdriUrl: 'https://x/y.hdr', intensity: 0.9 };
    useStore.getState().applyPreset(preset);
    const cfg = useStore.getState().config;
    expect(cfg.tone.mode).toBe('AGX');
    expect(cfg.environment.intensity).toBe(0.9);
    // materialOverrides zachowane (nie z presetu):
    expect(cfg.materialOverrides).toEqual({ '0': { color: '#fff' } });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run components/store.test.ts` → nowe FAIL (`materialOverrides`/`applyPreset` brak).

- [ ] **Step 3: Implementacja w `components/store.ts`**

(a) W interfejsie `SceneConfig` dodaj pole (po `material`):
```ts
  /** Nie-destrukcyjne nadpisania materiałów per indeks materiału glTF.
   *  Pusty w Etapie 1; pełny kształt dopina Etap 2 (edytor materiałów). */
  materialOverrides: Record<string, unknown>;
```
(b) W `DEFAULT_CONFIG` dodaj (po `material: {...},`):
```ts
  materialOverrides: {},
```
(c) W interfejsie `State` dodaj (przy innych setterach configu):
```ts
  /** Nakłada ustawienia SCENY z presetu (bez modelu i bez materialOverrides). */
  applyPreset: (preset: SceneConfig) => void;
  // Runtime Studio (NIE serializowane):
  studioScene: import('three').Group | null;
  setStudioScene: (g: import('three').Group | null) => void;
```
(d) W `create<State>(...)` dodaj implementacje:
```ts
  applyPreset: (preset) =>
    set((s) => ({
      config: {
        ...s.config,
        environment: preset.environment,
        background: preset.background,
        keyLight: preset.keyLight,
        shadows: preset.shadows,
        tone: preset.tone,
        material: preset.material,
        antialiasing: preset.antialiasing,
        branding: preset.branding,
        camera: preset.camera,
        // hero i materialOverrides NIE z presetu (zostają bieżące).
      },
    })),
  studioScene: null,
  setStudioScene: (studioScene) => set({ studioScene }),
```

- [ ] **Step 4: Run** `npx vitest run components/store.test.ts components/normalizeConfig.test.ts` → PASS (nowe + istniejące). Then full `npm test` → no regressions. `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**
```bash
git add components/store.ts components/store.test.ts
git commit -m "feat(studio): add materialOverrides default + applyPreset + studio runtime slice"
```

---

## Task 2: `lib/studio/sourceArtifact.ts` — artefakt źródła + rebuild

**Files:** Create `lib/studio/sourceArtifact.ts`; Test `lib/studio/sourceArtifact.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
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
    // rebuild z artefaktu odtwarza VFS
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
```

- [ ] **Step 2: Run** `npx vitest run lib/studio/sourceArtifact.test.ts` → FAIL.

- [ ] **Step 3: Implementation**

```ts
// lib/studio/sourceArtifact.ts
import { zipSync, unzipSync } from 'fflate';
import type { VirtualFs, VirtualFile } from '@/lib/gltf/types';
import type { SourceKind } from './types';
import { extOf, toKey, isJunkPath } from '@/lib/gltf/paths';

export interface SourceArtifact {
  blob: Blob;
  kind: SourceKind;
  /** Nazwa pliku artefaktu (do source_file_name). */
  fileName: string;
}

/** Z VFS + roota buduje JEDEN artefakt źródła: single .glb przepuszczony,
 *  multi-file spakowany do .zip (zachowuje oryginalne ścieżki względne). */
export async function buildSourceArtifact(fs: VirtualFs, rootKey: string): Promise<SourceArtifact> {
  const root = fs.get(rootKey);
  if (!root) throw new Error(`Brak roota w VFS: ${rootKey}`);

  if (fs.size === 1 && extOf(rootKey) === '.glb') {
    return { blob: root.blob, kind: 'glb', fileName: baseName(root.path) };
  }

  // Multi-file (lub .glb z dodatkowymi plikami) → zip z ORYGINALNYCH ścieżek.
  const entries: Record<string, Uint8Array> = {};
  for (const vf of fs.values()) {
    entries[vf.path] = new Uint8Array(await vf.blob.arrayBuffer());
  }
  const zipped = zipSync(entries);
  const zipName = `${stripExt(baseName(root.path))}.zip`;
  return { blob: new Blob([zipped as BlobPart], { type: 'application/zip' }), kind: 'gltf-zip', fileName: zipName };
}

/** Odtwarza VFS z pobranego artefaktu źródła (do ponownej edycji). */
export async function rebuildVfsFromSource(
  blob: Blob,
  kind: SourceKind,
  glbFileName = 'model.glb'
): Promise<VirtualFs> {
  const fs: VirtualFs = new Map();
  if (kind === 'glb') {
    const vf: VirtualFile = { path: glbFileName, blob, size: blob.size };
    fs.set(toKey(glbFileName), vf);
    return fs;
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const unzipped = unzipSync(bytes);
  for (const [path, data] of Object.entries(unzipped)) {
    if (path.endsWith('/') || isJunkPath(path)) continue;
    const b = new Blob([data as BlobPart]);
    fs.set(toKey(path), { path, blob: b, size: b.size });
  }
  return fs;
}

function baseName(p: string): string {
  const i = p.replace(/\\/g, '/').lastIndexOf('/');
  return i === -1 ? p : p.slice(i + 1);
}
function stripExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? name : name.slice(0, i);
}
```

- [ ] **Step 4: Run** `npx vitest run lib/studio/sourceArtifact.test.ts` → PASS. `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**
```bash
git add lib/studio/sourceArtifact.ts lib/studio/sourceArtifact.test.ts
git commit -m "feat(studio): build/rebuild editable source artifact (glb passthrough, multi-file zip)"
```

---

## Task 3: `lib/studio/savePayload.ts` — builder body API

**Files:** Create `lib/studio/savePayload.ts`; Test `lib/studio/savePayload.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implementation**

```ts
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
```

- [ ] **Step 4: Run** `npx vitest run lib/studio/savePayload.test.ts` → PASS. tsc clean.

- [ ] **Step 5: Commit**
```bash
git add lib/studio/savePayload.ts lib/studio/savePayload.test.ts
git commit -m "feat(studio): pure save-payload builder for studio API"
```

---

## Task 4: `StudioActor` — wczytany Group → scena

**Files:** Create `components/studio/StudioActor.tsx`. Brak testu jednostkowego (R3F); weryfikacja w Task 9.

- [ ] **Step 1: Implementation** (wzorowane na `Actor` w `components/viewer/Product.tsx`, ale przyjmuje `THREE.Group`):

```tsx
// components/studio/StudioActor.tsx
'use client';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';

/** Wczytany model Studio (gotowy THREE.Group z loadFromFiles): klon + auto-fit/center
 *  + envMapIntensity + anizotropia + cienie. Publikuje modelSize. */
export function StudioActor({ scene }: { scene: THREE.Group }) {
  const envMapIntensity = useStore((s) => s.config.material.envMapIntensity);
  const setModelSize = useStore((s) => s.setModelSize);
  const setSelected = useStore((s) => s.setSelected);
  const ref = useRef<THREE.Group>(null);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      if (m.geometry && !m.geometry.attributes.normal) m.geometry.computeVertexNormals();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const raw of mats) {
        const mat = raw as THREE.MeshStandardMaterial;
        if (!mat) continue;
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const) {
          const tex = (mat as unknown as Record<string, THREE.Texture | undefined>)[key];
          if (tex) tex.anisotropy = 16;
        }
      }
    });
    return c;
  }, [scene]);

  useEffect(() => {
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const raw of mats) {
        const mat = raw as THREE.MeshStandardMaterial;
        if (mat && 'envMapIntensity' in mat) mat.envMapIntensity = envMapIntensity;
      }
    });
  }, [cloned, envMapIntensity]);

  useEffect(() => {
    if (!ref.current) return;
    const group = ref.current;
    group.position.set(0, 0, 0);
    group.scale.setScalar(1);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const scale = size.y > 0 ? 1.4 / size.y : 1;
    group.scale.setScalar(scale);
    group.updateWorldMatrix(true, true);
    const box2 = new THREE.Box3().setFromObject(cloned);
    const center2 = box2.getCenter(new THREE.Vector3());
    group.position.x = -center2.x;
    group.position.z = -center2.z;
    group.position.y = -box2.min.y + 0.005;
    const s = box2.getSize(new THREE.Vector3());
    setModelSize([s.x, s.y, s.z]);
  }, [cloned, setModelSize]);

  return (
    <group ref={ref} onClick={(e) => { e.stopPropagation(); setSelected('actor'); }}>
      <primitive object={cloned} />
    </group>
  );
}
```

- [ ] **Step 2: tsc** `npx tsc --noEmit` clean.
- [ ] **Step 3: Commit** `git add components/studio/StudioActor.tsx && git commit -m "feat(studio): StudioActor — mount loaded THREE.Group with auto-fit/center"`

---

## Task 5: `StudioViewport` + `ViewToggle` — jeden canvas, tryb EDIT/RENDER

**Files:** Create `components/studio/StudioViewport.tsx`, `components/studio/ViewToggle.tsx`. Weryfikacja w Task 9.

- [ ] **Step 1: `ViewToggle.tsx`** — przełącznik trybu czytany ze store (lokalny stan trybu trzymamy w StudioShell przez prop):

```tsx
// components/studio/ViewToggle.tsx
'use client';
export type StudioMode = 'edit' | 'render';
export function ViewToggle({ mode, onChange }: { mode: StudioMode; onChange: (m: StudioMode) => void }) {
  return (
    <div className="studio-toggle" role="tablist" aria-label="Tryb widoku">
      <button type="button" role="tab" aria-selected={mode === 'edit'} className={mode === 'edit' ? 'is-active' : ''} onClick={() => onChange('edit')}>Edycja</button>
      <button type="button" role="tab" aria-selected={mode === 'render'} className={mode === 'render' ? 'is-active' : ''} onClick={() => onChange('render')}>Render</button>
    </div>
  );
}
```

- [ ] **Step 2: `StudioViewport.tsx`** — jeden `<Canvas>`; treść zależna od `mode`. Reużywa `Studio`/`Postprocess`/`CameraRig` (render) oraz światło+grid+rzuty (edit). `StudioActor` zawsze obecny gdy jest `studioScene`.

```tsx
// components/studio/StudioViewport.tsx
'use client';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, GizmoHelper, GizmoViewcube } from '@react-three/drei';
import * as THREE from 'three';
import { Studio } from '../viewer/Studio';
import { Postprocess } from '../viewer/Postprocess';
import { CameraRig } from '../viewer/CameraRig';
import { StudioActor } from './StudioActor';
import { useStore, DEFAULT_CONFIG } from '../store';
import type { StudioMode } from './ViewToggle';

function EditLights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#3a3d46', 0.6]} />
      <directionalLight position={[-2.5, 4, 3]} intensity={0.7} />
    </>
  );
}

export function StudioViewport({ mode }: { mode: StudioMode }) {
  const scene = useStore((s) => s.studioScene);
  const [sx, sy, sz] = useStore((s) => s.modelSize);
  const R = Math.max(sx, sy, sz, 1) * 2.4;
  const midY = sy * 0.5;
  const cam = DEFAULT_CONFIG.camera;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: mode === 'edit',
        alpha: false,
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
        preserveDrawingBuffer: true, // captureThumbnail
      }}
      camera={{ fov: 40, near: 0.05, far: 500, position: [R * 0.85, midY + R * 0.6, R * 0.85] }}
      onCreated={({ gl }) => { gl.setClearColor(mode === 'edit' ? 0x202227 : 0xdcdde0, 1); useStore.getState().setGlRef(gl); }}
    >
      {mode === 'render' && (
        <Suspense fallback={null}>
          <Studio />
        </Suspense>
      )}
      {mode === 'edit' && (
        <>
          <color attach="background" args={['#202227']} />
          <EditLights />
          <gridHelper args={[20, 40, '#454853', '#2c2e35']} />
          <axesHelper args={[1.5]} />
          <GizmoHelper alignment="top-right" margin={[64, 64]}>
            <GizmoViewcube color="#3a3d46" textColor="#e8eaed" strokeColor="#1b1c20" hoverColor="#ffcc33" />
          </GizmoHelper>
        </>
      )}

      <Suspense fallback={null}>{scene && <StudioActor scene={scene} />}</Suspense>

      {mode === 'render' ? (
        <>
          <CameraRig />
          <Postprocess />
        </>
      ) : (
        <>
          <PerspectiveCamera makeDefault fov={40} near={0.05} far={500} position={[R * 0.85, midY + R * 0.6, R * 0.85]} />
          <OrbitControls makeDefault target={[0, midY, 0]} enableDamping dampingFactor={0.1} />
        </>
      )}
    </Canvas>
  );
}
```

> Uwaga wykonawcza: jeśli `CameraRig`/`Postprocess`/`Studio` zakładają obecność wczytanego modelu lub konkretnych pól store, w razie błędu w przeglądarce (Task 9) zawęź ich użycie lub podaj brakujący stan; loguj rozbieżności jako DONE_WITH_CONCERNS.

- [ ] **Step 3: tsc clean. Commit** `git add components/studio/StudioViewport.tsx components/studio/ViewToggle.tsx && git commit -m "feat(studio): single-canvas viewport with edit/render mode toggle"`

---

## Task 6: `AssetDropzone` + `ImportReport` + `RootPicker`

**Files:** Create the three components. Weryfikacja w Task 9.

- [ ] **Step 1: `ImportReport.tsx`** — renderuje `ValidationReport`:

```tsx
// components/studio/ImportReport.tsx
'use client';
import type { ValidationReport } from '@/lib/gltf/types';
export function ImportReport({ report }: { report: ValidationReport }) {
  const fatals = report.issues.filter((i) => i.level === 'fatal');
  const warns = report.issues.filter((i) => i.level === 'warning');
  const infos = report.issues.filter((i) => i.level === 'info');
  return (
    <div className="import-report" role="status">
      <p><strong>{report.ok ? '✅ Model gotowy do wczytania' : '❌ Nie można wczytać'}</strong> — {report.kind}, {Math.round(report.totalBytes / 1_000_000)} MB</p>
      {fatals.length > 0 && <ul className="import-report__fatal">{fatals.map((i, k) => <li key={k}>⛔ {i.message}</li>)}</ul>}
      {warns.length > 0 && <ul className="import-report__warn">{warns.map((i, k) => <li key={k}>⚠️ {i.message}</li>)}</ul>}
      {report.resolved.length > 0 && <p>Rozwiązane zależności: {report.resolved.length}</p>}
      {infos.length > 0 && <details><summary>Zignorowane pliki ({infos.length})</summary><ul>{infos.map((i, k) => <li key={k}>{i.path}</li>)}</ul></details>}
    </div>
  );
}
```

- [ ] **Step 2: `RootPicker.tsx`** — wybór roota przy wielu kandydatach:

```tsx
// components/studio/RootPicker.tsx
'use client';
export function RootPicker({ roots, onPick }: { roots: string[]; onPick: (r: string) => void }) {
  return (
    <div className="root-picker">
      <p>Wykryto kilka plików modelu — wybierz główny:</p>
      <ul>{roots.map((r) => <li key={r}><button type="button" onClick={() => onPick(r)}>{r}</button></li>)}</ul>
    </div>
  );
}
```

- [ ] **Step 3: `AssetDropzone.tsx`** — wejście → VFS → wykrycie roota → walidacja → store. Reużywa `fromFileList/fromDataTransfer/fromZip`, `findModelRoots/pickDefaultRoot`, `validateGltf`, `loadFromFiles`.

```tsx
// components/studio/AssetDropzone.tsx
'use client';
import { useRef, useState } from 'react';
import { fromDataTransfer, fromFileList, fromZip } from '@/lib/gltf/extract';
import { findModelRoots, pickDefaultRoot } from '@/lib/gltf/virtualFs';
import { validateGltf } from '@/lib/gltf/validate';
import { loadFromFiles } from '@/lib/gltf/loadFromFiles';
import type { VirtualFs, ValidationReport } from '@/lib/gltf/types';
import { useStore } from '../store';
import { ImportReport } from './ImportReport';
import { RootPicker } from './RootPicker';
import type * as THREE from 'three';

export function AssetDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [vfs, setVfs] = useState<VirtualFs | null>(null);
  const [roots, setRoots] = useState<string[]>([]);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const setStudioScene = useStore((s) => s.setStudioScene);
  const setModelError = useStore((s) => s.setModelError);
  const setSourceName = useStore.setState;

  async function ingest(fs: VirtualFs) {
    setReport(null); setVfs(fs);
    const found = findModelRoots(fs);
    setRoots(found);
    const root = pickDefaultRoot(found);
    if (!root) { setModelError('Brak pliku .gltf/.glb w wejściu.'); return; }
    await validateAndMaybeLoad(fs, root);
  }

  async function validateAndMaybeLoad(fs: VirtualFs, root: string) {
    setBusy(true);
    try {
      const rep = await validateGltf(fs, root);
      setReport(rep);
      if (rep.ok) {
        const { scene } = await loadFromFiles(fs, root);
        setStudioScene(scene as THREE.Group);
        // zapamiętaj VFS + root + nazwę źródła do zapisu (przez setState surowy)
        setSourceName({ studioVfs: fs, studioRoot: root } as never);
      }
    } catch (e) {
      setModelError(`Wczytanie nieudane: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`asset-dropzone ${dragging ? 'is-drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (e) => {
        e.preventDefault(); setDragging(false);
        try {
          const f = e.dataTransfer.files?.[0];
          if (f && f.name.toLowerCase().endsWith('.zip')) await ingest(await fromZip(f));
          else await ingest(await fromDataTransfer(e.dataTransfer.items));
        } catch (err) { setModelError(`Odczyt wejścia nieudany: ${(err as Error).message}`); }
      }}>
      <input ref={inputRef} type="file" multiple
        // @ts-expect-error webkitdirectory nie jest w typach React
        webkitdirectory=""
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files) ingest(fromFileList(e.target.files)); e.target.value = ''; }} />
      <button type="button" onClick={() => inputRef.current?.click()}>Wczytaj folder modelu</button>
      <span className="asset-dropzone__hint">albo przeciągnij folder / .zip tutaj</span>
      {busy && <span> — przetwarzanie…</span>}
      {roots.length > 1 && vfs && <RootPicker roots={roots} onPick={(r) => validateAndMaybeLoad(vfs, r)} />}
      {report && <ImportReport report={report} />}
    </div>
  );
}
```

> Uwaga: `studioVfs`/`studioRoot` to runtime-only; jeśli wolisz silne typowanie zamiast `as never`, dodaj je do interfejsu `State` w store (Task 1) — wykonawca może to zrobić i zaktualizować typy. Zapisz jako DONE_WITH_CONCERNS jeśli zmieniasz store.

- [ ] **Step 4: tsc clean. Commit** `git add components/studio/AssetDropzone.tsx components/studio/ImportReport.tsx components/studio/RootPicker.tsx && git commit -m "feat(studio): asset dropzone + validation report + root picker"`

---

## Task 7: `PresetPicker`

**Files:** Create `components/studio/PresetPicker.tsx`. Weryfikacja w Task 9.

- [ ] **Step 1: Implementation** — pobiera presety z `/api/scenes?preset=1`, nakłada `applyPreset(preset.config)`:

```tsx
// components/studio/PresetPicker.tsx
'use client';
import { useEffect, useState } from 'react';
import { useStore, normalizeConfig } from '../store';
import type { SceneRecord } from '@/lib/scenes/types';

export function PresetPicker() {
  const [presets, setPresets] = useState<SceneRecord[]>([]);
  const [open, setOpen] = useState(false);
  const applyPreset = useStore((s) => s.applyPreset);

  useEffect(() => {
    if (!open || presets.length) return;
    fetch('/api/scenes?preset=1').then((r) => r.ok ? r.json() : []).then(setPresets).catch(() => setPresets([]));
  }, [open, presets.length]);

  return (
    <div className="preset-picker">
      <button type="button" onClick={() => setOpen((o) => !o)}>Wczytaj preset sceny</button>
      {open && (
        <ul className="preset-picker__list">
          {presets.length === 0 && <li>Brak presetów</li>}
          {presets.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => { applyPreset(normalizeConfig(p.config)); setOpen(false); }}>{p.title}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: tsc clean. Commit** `git add components/studio/PresetPicker.tsx && git commit -m "feat(studio): preset picker applies scene settings (not model/materials)"`

---

## Task 8: Save/Open + `StudioShell` + trasy

**Files:** Create `components/studio/saveProject.ts`, `components/studio/openProject.ts`, `components/studio/StudioShell.tsx`, `app/studio/page.tsx`, `app/studio/[id]/page.tsx`. CSS w `components/styles.css`. Weryfikacja w Task 9.

- [ ] **Step 1: `saveProject.ts`** (client) — buduje artefakt źródła, uploaduje źródło+miniaturę, POST/PATCH:

```ts
// components/studio/saveProject.ts
'use client';
import { upload } from '@vercel/blob/client';
import { captureThumbnail } from '../scenes/captureThumbnail';
import { buildSourceArtifact } from '@/lib/studio/sourceArtifact';
import { buildSavePayload } from '@/lib/studio/savePayload';
import type { VirtualFs, ValidationReport } from '@/lib/gltf/types';
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
    throw new Error(d.error ?? `Błąd zapisu: ${res.status}`);
  }
  return await res.json();
}
```

- [ ] **Step 2: `openProject.ts`** (client) — pobiera projekt, źródło, rebuilduje VFS, ładuje:

```ts
// components/studio/openProject.ts
'use client';
import { rebuildVfsFromSource } from '@/lib/studio/sourceArtifact';
import { findModelRoots, pickDefaultRoot } from '@/lib/gltf/virtualFs';
import { loadFromFiles } from '@/lib/gltf/loadFromFiles';
import type { StudioProjectRecord } from '@/lib/studio/types';
import type { VirtualFs } from '@/lib/gltf/types';
import type * as THREE from 'three';

export async function openProjectSource(project: StudioProjectRecord): Promise<{ scene: THREE.Group; vfs: VirtualFs; root: string }> {
  const res = await fetch(project.sourceBlobUrl);
  if (!res.ok) throw new Error(`Nie udało się pobrać źródła: ${res.status}`);
  const blob = await res.blob();
  const vfs = await rebuildVfsFromSource(blob, project.sourceKind, project.sourceFileName);
  const root = pickDefaultRoot(findModelRoots(vfs));
  if (!root) throw new Error('Źródło nie zawiera pliku modelu.');
  const { scene } = await loadFromFiles(vfs, root);
  return { scene: scene as THREE.Group, vfs, root };
}
```

- [ ] **Step 3: `StudioShell.tsx`** — layout (toolbar + viewport + Outliner/Inspector), trzyma `mode`, spina zapis. (Reużywa `Outliner`, `Inspector`.) Pełny szkielet:

```tsx
// components/studio/StudioShell.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { StudioViewport } from './StudioViewport';
import { ViewToggle, type StudioMode } from './ViewToggle';
import { AssetDropzone } from './AssetDropzone';
import { PresetPicker } from './PresetPicker';
import { Outliner } from '../ui/Outliner';
import { Inspector } from '../ui/Inspector';
import { saveProject } from './saveProject';
import { useStore } from '../store';

export function StudioShell({ projectId, initialTitle }: { projectId?: string; initialTitle?: string }) {
  const [mode, setMode] = useState<StudioMode>('edit');
  const [title, setTitle] = useState(initialTitle ?? 'Nowy model');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleSave() {
    const st = useStore.getState() as unknown as { studioVfs?: import('@/lib/gltf/types').VirtualFs; studioRoot?: string; config: import('../store').SceneConfig; glRef: { domElement: HTMLCanvasElement } | null };
    if (!st.studioVfs || !st.studioRoot) { setToast('Najpierw wczytaj model.'); return; }
    if (!st.glRef) { setToast('Renderer niedostępny.'); return; }
    setBusy(true);
    try {
      const { id } = await saveProject({ projectId, title, vfs: st.studioVfs, rootKey: st.studioRoot, config: st.config, glRef: st.glRef });
      setToast('Zapisano.');
      if (!projectId) window.history.replaceState(null, '', `/studio/${id}`);
    } catch (e) { setToast(e instanceof Error ? e.message : 'Błąd zapisu.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="studio-layout">
      <header className="studio-toolbar">
        <Link href="/" className="studio-back">← Sceny</Link>
        <input className="studio-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Tytuł projektu" />
        <ViewToggle mode={mode} onChange={setMode} />
        <AssetDropzone />
        <PresetPicker />
        <button type="button" onClick={handleSave} disabled={busy}>Zapisz</button>
      </header>
      <main className="studio-viewport"><StudioViewport mode={mode} /></main>
      <aside className="studio-panel"><Outliner /><Inspector /></aside>
      {toast && <div className="save-toast" role="status">{toast}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Trasy.** `app/studio/page.tsx`:
```tsx
// app/studio/page.tsx
import { requireUser } from '@/lib/auth/session';
import { StudioShell } from '@/components/studio/StudioShell';
export default async function StudioNewPage() {
  await requireUser();
  return <StudioShell />;
}
```
`app/studio/[id]/page.tsx` (otwarcie istniejącego — hydruje config + ładuje źródło klient-side):
```tsx
// app/studio/[id]/page.tsx
import { requireUser } from '@/lib/auth/session';
import { getProject } from '@/lib/studio/repo';
import { notFound, redirect } from 'next/navigation';
import { StudioProjectLoader } from '@/components/studio/StudioProjectLoader';

export default async function StudioProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  if (project.ownerId !== user.id) redirect('/');
  return <StudioProjectLoader project={project} />;
}
```
Oraz `components/studio/StudioProjectLoader.tsx` (client: hydruje config, woła openProjectSource, ustawia scene):
```tsx
// components/studio/StudioProjectLoader.tsx
'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useStore, normalizeConfig } from '../store';
import { openProjectSource } from './openProject';
import type { StudioProjectRecord } from '@/lib/studio/types';

const Shell = dynamic(() => import('./StudioShell').then((m) => m.StudioShell), { ssr: false });

export function StudioProjectLoader({ project }: { project: StudioProjectRecord }) {
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    useStore.setState({ config: normalizeConfig(project.config) });
    openProjectSource(project)
      .then(({ scene, vfs, root }) => useStore.setState({ studioScene: scene, studioVfs: vfs, studioRoot: root } as never))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Błąd otwarcia.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);
  if (err) return <div style={{ padding: 24 }}>Nie udało się otworzyć projektu: {err}</div>;
  return <Shell projectId={project.id} initialTitle={project.title} />;
}
```

- [ ] **Step 5: CSS** — dodaj do `components/styles.css` minimalny layout (3 strefy) i style toolbara/toggle/report (siatka `studio-layout`, `studio-toolbar`, `studio-viewport`, `studio-panel`, `studio-toggle .is-active`, `import-report__fatal/warn`). Dopasuj do istniejących zmiennych (`--bg`, `--accent`).

- [ ] **Step 6: tsc clean. Commit** `git add components/studio/ app/studio/ components/styles.css && git commit -m "feat(studio): studio shell, routes, save/open project flow"`

---

## Task 9: Usunięcie strony dev + weryfikacja w przeglądarce

- [ ] **Step 1: Usuń stronę dev z 1a** `git rm -r app/dev/gltf-import && git commit -m "chore(studio): remove temporary 1a dev page (superseded by /studio)"`

- [ ] **Step 2: tsc + pełny zestaw** `npx tsc --noEmit` clean; `npm test` → wszystkie zielone.

- [ ] **Step 3: Weryfikacja w przeglądarce (preview_*):** uruchom dev, zaloguj się (lub użyj istniejącej sesji), otwórz `/studio`:
  - Wczytaj folder `_test/battlefield_4_-_t-90a/` → panel raportu: ok, 16 zależności, license.txt zignorowany; model widoczny w trybie EDIT.
  - Przełącz na RENDER → pełne PBR/IBL.
  - „Wczytaj preset" → zmienia światło/tło/tone (model bez zmian).
  - „Zapisz" → toast „Zapisano", URL zmienia się na `/studio/<id>` (wymaga zastosowanej migracji 0003 na Neon + BLOB_READ_WRITE_TOKEN).
  - Odśwież `/studio/<id>` → projekt + model wczytują się ponownie.
  - Sprawdź konsolę: brak błędów.
- [ ] **Step 4:** Jeśli błędy — diagnozuj (źródła: `StudioViewport` reużycie CameraRig/Postprocess, store runtime, CSS), popraw, powtórz.

---

## Self-Review

**Spec coverage:** workspace dual-view (Task 5) · import multi-file + raport (Task 6, rdzeń z 1a) · ustawianie sceny (reużycie Outliner/Inspector — Task 8) · import presetów (Task 7) · zapis edytowalnego źródła + otwieranie (Task 2/3/8) · `materialOverrides` zarezerwowane (Task 1) · usunięcie dev page (Task 9). ✅

**Placeholder scan:** kod kompletny dla fundamentów (Task 1–3) i konkretny dla UI (Task 4–8). Brak TBD; CSS w Task 8 opisany co do klas (wykonawca dopisuje reguły dopasowane do istniejących zmiennych). ✅

**Type consistency:** `SourceKind`, `VirtualFs`, `SceneConfig`, `StudioProjectRecord` spójne między 1a/1b/1c. Runtime store (`studioScene`/`studioVfs`/`studioRoot`) — Task 1 dodaje `studioScene`/`setStudioScene` z typami; `studioVfs`/`studioRoot` wykonawca dotypuje w `State` (oznaczone jako dozwolone uzupełnienie, by uniknąć `as never`). ⚠️→ wykonawca domyka typy w Task 1/6/8.

**Zależności środowiskowe (poza kodem):** działający zapis wymaga zastosowanej migracji `0003` na Neon i `BLOB_READ_WRITE_TOKEN`. Bez nich UI/import/preset działają, a „Zapisz" zwróci błąd API.
