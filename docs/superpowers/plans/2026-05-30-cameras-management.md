# Cameras Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pełne zarządzanie kamerami w outlinerze i obu paskach viewportów: dodawanie/usuwanie, zmiana nazwy, kolejność (drag w outlinerze przekłada się na kolejność w paskach), oraz checkbox „pokaż w finalnym widoku" sterujący widocznością kamery na pasku finalnego widoku.

**Architecture:** Migracja modelu z `Record<string, CameraPresetView>` na uporządkowaną tablicę `cameras: CameraDef[]` (każda kamera ma stabilne `id`, edytowalną `name`, pozycję/target/fov oraz flagę `showInFinalBar`). Outliner renderuje listę w kolejności tablicy z przyciskami ↑/↓/+/✕. Pasek finalnego widoku filtruje po `showInFinalBar`. Pasek edytora jest **dwurzędowy** (`viewport-stack`): górny rząd = rzuty ortho/persp (`setEditorView`), dolny rząd = wszystkie kamery sceny w kolejności outlinera (klik = `setCamera({active: id})` + `setEditorView('camera')`).

**Tech Stack:** React 18, @react-three/fiber 8, drei 9, leva 0.9, zustand 5, Vite/TS, vitest 2.

**Testowanie:** vitest dla czystej logiki storu (nowe operacje na kamerach). Komponenty UI/R3F weryfikujemy ręcznie w dev serverze. Każdy task: `npm test` (gdy dotyczy) + `npx tsc -b` + commit.

**Branch:** kontynuacja prac na `main` (zgodnie z dotychczasową konwencją tego repo).

---

## File Structure

- `src/store.ts` — **modify**: zmiana modelu `presets: Record` → `cameras: CameraDef[]`; nowe akcje: `addCamera`, `removeCamera`, `renameCamera`, `moveCamera`, `setCameraVisible`, `updateCamera`; refactor `capturePreset` na operację po id.
- `src/store.test.ts` — **modify**: aktualizacja istniejących testów (preset → camera) + nowe testy dla operacji listy.
- `src/viewer/CameraRig.tsx` — **modify**: lookup aktywnej kamery z tablicy (`cameras.find(c => c.id === active)`).
- `src/viewer/EditorView.tsx` — **modify**: lookup po id z tablicy.
- `src/viewer/SceneIcons.tsx` — **modify**: iteracja po tablicy zamiast `Object.keys`; podpięcie nazw.
- `src/ui/Outliner.tsx` — **modify**: render kamer z przyciskami ↑/↓/✕ na wiersz + przycisk „+ dodaj kamerę" na końcu sekcji. Etykieta = `name`.
- `src/ui/Inspector.tsx` — **modify**: `CameraControls` dostaje `name` (text), `showInFinalBar` (toggle) i przycisk „Usuń kamerę" (disabled przy 1 pozostałej).
- `src/ui/CameraButtons.tsx` — **modify**: lista kamer filtrowana po `showInFinalBar`; etykieta z `name`.
- `src/ui/ViewButtons.tsx` — **modify**: dwa wiersze w jednym kontenerze `viewport-stack`: górny rząd rzutów (`setEditorView`) i dolny rząd kamer (`setCamera({active: id})` + `setEditorView('camera')`). Podświetlenie aktywnej kamery tylko gdy `editorView === 'camera'`.
- `src/styles.css` — **modify**: style dla ↑/↓/✕ w outlinerze oraz nowy `.viewport-stack` (kontener pionowy dla 2 rzędów w pasku edytora).

---

## Task 1: Store — nowy model kamer + testy (TDD)

**Files:**
- Modify: `src/store.ts`
- Modify: `src/store.test.ts`

- [ ] **Step 1: Napisz failing testy dla nowego modelu** — zaktualizuj `src/store.test.ts`.

Zastąp całą zawartość pliku poniższym:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_CONFIG, useStore, replaceStop } from './store';

function reset() {
  useStore.setState({
    config: structuredClone(DEFAULT_CONFIG),
    loadedModel: null,
    modelSize: [1, 1.4, 1],
    cameraApi: null,
  });
}

describe('DEFAULT_CONFIG', () => {
  it('domyślny tone mapping to NEUTRAL', () => {
    expect(DEFAULT_CONFIG.tone.mode).toBe('NEUTRAL');
  });

  it('ma 5 kamer w domyślnej kolejności', () => {
    expect(DEFAULT_CONFIG.camera.cameras.map((c) => c.id)).toEqual([
      'hero',
      'front',
      'side',
      'top',
      'detail',
    ]);
  });

  it('każda kamera ma name i showInFinalBar=true', () => {
    for (const c of DEFAULT_CONFIG.camera.cameras) {
      expect(typeof c.name).toBe('string');
      expect(c.showInFinalBar).toBe(true);
    }
  });
});

describe('replaceStop', () => {
  it('podmienia jeden stop bez mutacji wejścia', () => {
    const input: [string, string, string, string] = ['a', 'b', 'c', 'd'];
    const out = replaceStop(input, 2, 'X');
    expect(out).toEqual(['a', 'b', 'X', 'd']);
    expect(input).toEqual(['a', 'b', 'c', 'd']);
    expect(out).not.toBe(input);
  });
});

describe('store setters', () => {
  beforeEach(reset);

  it('setKeyLight robi merge, nie nadpisuje całej sekcji', () => {
    useStore.getState().setKeyLight({ intensity: 1 });
    const kl = useStore.getState().config.keyLight;
    expect(kl.intensity).toBe(1);
    expect(kl.position).toEqual(DEFAULT_CONFIG.keyLight.position);
  });

  it('setOrbit zmienia tylko wskazane pole orbity', () => {
    useStore.getState().setOrbit({ minDist: 2 });
    const orbit = useStore.getState().config.camera.orbit;
    expect(orbit.minDist).toBe(2);
    expect(orbit.maxDist).toBe(DEFAULT_CONFIG.camera.orbit.maxDist);
  });

  it('setBackground podmienia stops jako nową tablicę', () => {
    const next: [string, string, string, string] = ['#000', '#111', '#222', '#333'];
    useStore.getState().setBackground({ stops: next });
    expect(useStore.getState().config.background.stops).toEqual(next);
  });
});

describe('camera operations', () => {
  beforeEach(reset);

  it('updateCamera(id, patch) aktualizuje wskazaną kamerę po id', () => {
    useStore.getState().updateCamera('hero', { position: [1, 2, 3], fov: 50 });
    const hero = useStore.getState().config.camera.cameras.find((c) => c.id === 'hero')!;
    expect(hero.position).toEqual([1, 2, 3]);
    expect(hero.fov).toBe(50);
    expect(hero.target).toEqual(DEFAULT_CONFIG.camera.cameras[0].target);
  });

  it('renameCamera zmienia name', () => {
    useStore.getState().renameCamera('hero', 'Bohater');
    const hero = useStore.getState().config.camera.cameras.find((c) => c.id === 'hero')!;
    expect(hero.name).toBe('Bohater');
  });

  it('setCameraVisible przełącza showInFinalBar', () => {
    useStore.getState().setCameraVisible('hero', false);
    const hero = useStore.getState().config.camera.cameras.find((c) => c.id === 'hero')!;
    expect(hero.showInFinalBar).toBe(false);
  });

  it('moveCamera up przesuwa kamerę o jedno miejsce w górę', () => {
    useStore.getState().moveCamera('side', 'up');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual([
      'hero',
      'side',
      'front',
      'top',
      'detail',
    ]);
  });

  it('moveCamera down przesuwa o jedno w dół', () => {
    useStore.getState().moveCamera('front', 'down');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual([
      'hero',
      'side',
      'front',
      'top',
      'detail',
    ]);
  });

  it('moveCamera na krawędzi nic nie zmienia', () => {
    useStore.getState().moveCamera('hero', 'up');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual([
      'hero',
      'front',
      'side',
      'top',
      'detail',
    ]);
    useStore.getState().moveCamera('detail', 'down');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual([
      'hero',
      'front',
      'side',
      'top',
      'detail',
    ]);
  });

  it('addCamera dodaje nową kamerę z unikalnym id i widoczną w finalnym pasku', () => {
    const before = useStore.getState().config.camera.cameras.length;
    useStore.getState().addCamera();
    const after = useStore.getState().config.camera.cameras;
    expect(after.length).toBe(before + 1);
    const last = after[after.length - 1];
    expect(last.id).toMatch(/^cam_/);
    expect(last.showInFinalBar).toBe(true);
    expect(typeof last.name).toBe('string');
  });

  it('removeCamera usuwa kamerę i nie usuwa ostatniej', () => {
    useStore.getState().removeCamera('hero');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual([
      'front',
      'side',
      'top',
      'detail',
    ]);
    // usuń aż do jednej
    useStore.getState().removeCamera('front');
    useStore.getState().removeCamera('side');
    useStore.getState().removeCamera('top');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual(['detail']);
    // ostatnia — no-op
    useStore.getState().removeCamera('detail');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual(['detail']);
  });

  it('removeCamera aktywnej przełącza active na pierwszą pozostałą', () => {
    useStore.getState().setCamera({ active: 'side' });
    useStore.getState().removeCamera('side');
    expect(useStore.getState().config.camera.active).toBe('hero');
  });

  it('capturePreset aktualizuje pozycję/target/fov kamery po id', () => {
    useStore.getState().capturePreset('hero', {
      position: [1, 2, 3],
      target: [0, 0, 0],
      fov: 35,
    });
    const hero = useStore.getState().config.camera.cameras.find((c) => c.id === 'hero')!;
    expect(hero.position).toEqual([1, 2, 3]);
    expect(hero.target).toEqual([0, 0, 0]);
    expect(hero.fov).toBe(35);
  });
});
```

- [ ] **Step 2:** `npm test` → FAIL (operacje jeszcze nie istnieją, `cameras` to nie tablica).

Run: `npm test`
Expected: FAIL — błędy typu „Object.cameras is undefined" / „addCamera is not a function".

- [ ] **Step 3: Zaktualizuj `src/store.ts`** — wprowadź nowy typ `CameraDef`, zmień `presets: Record<>` na `cameras: CameraDef[]`, dodaj operacje.

Zastąp w `src/store.ts`:

A) Dopisz typ CameraDef i podmień `CameraPresetView` (zostawiamy dla widoku „getView" — to ten sam kształt bez metadanych):

```ts
export interface CameraPresetView {
  position: Vec3;
  target: Vec3;
  fov: number;
}

export interface CameraDef {
  id: string;
  name: string;
  position: Vec3;
  target: Vec3;
  fov: number;
  showInFinalBar: boolean;
}
```

B) Zamień sekcję `camera` w `SceneConfig`:

```ts
  camera: {
    near: number;
    far: number;
    orbit: {
      minDist: number;
      maxDist: number;
      minPolar: number;
      maxPolar: number;
      damping: number;
    };
    active: string;
    cameras: CameraDef[];
  };
```

C) Zamień `DEFAULT_CONFIG.camera`:

```ts
  camera: {
    near: 0.05,
    far: 80,
    orbit: {
      minDist: 1.2,
      maxDist: 8,
      minPolar: 0.15,
      maxPolar: Math.PI / 2 - 0.05,
      damping: 0.08,
    },
    active: 'hero',
    cameras: [
      { id: 'hero', name: 'Hero', position: [2.4, 1.4, 3.0], target: [0, 0.6, 0], fov: 28, showInFinalBar: true },
      { id: 'front', name: 'Front', position: [0, 0.9, 3.2], target: [0, 0.6, 0], fov: 28, showInFinalBar: true },
      { id: 'side', name: 'Side', position: [3.2, 0.9, 0.2], target: [0, 0.6, 0], fov: 28, showInFinalBar: true },
      { id: 'top', name: 'Top', position: [0.1, 3.6, 0.1], target: [0, 0, 0], fov: 30, showInFinalBar: true },
      { id: 'detail', name: 'Detail', position: [1.3, 0.7, 1.3], target: [0, 0.6, 0], fov: 45, showInFinalBar: true },
    ],
  },
```

D) W `interface State` zamień stary podpis `capturePreset` i dorzuć nowe akcje (po `setOrbit`, przed `setLoadedModel`):

```ts
  capturePreset: (id: string, view: CameraPresetView) => void;
  updateCamera: (id: string, patch: Partial<Omit<CameraDef, 'id'>>) => void;
  renameCamera: (id: string, name: string) => void;
  setCameraVisible: (id: string, visible: boolean) => void;
  moveCamera: (id: string, dir: 'up' | 'down') => void;
  addCamera: () => void;
  removeCamera: (id: string) => void;
```

E) W ciele `useStore` zamień implementację `capturePreset` na operację po liście oraz dodaj nowe akcje:

```ts
  capturePreset: (id, view) =>
    set((s) => ({
      config: {
        ...s.config,
        camera: {
          ...s.config.camera,
          cameras: s.config.camera.cameras.map((c) =>
            c.id === id ? { ...c, position: view.position, target: view.target, fov: view.fov } : c
          ),
        },
      },
    })),

  updateCamera: (id, patch) =>
    set((s) => ({
      config: {
        ...s.config,
        camera: {
          ...s.config.camera,
          cameras: s.config.camera.cameras.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        },
      },
    })),

  renameCamera: (id, name) =>
    set((s) => ({
      config: {
        ...s.config,
        camera: {
          ...s.config.camera,
          cameras: s.config.camera.cameras.map((c) => (c.id === id ? { ...c, name } : c)),
        },
      },
    })),

  setCameraVisible: (id, visible) =>
    set((s) => ({
      config: {
        ...s.config,
        camera: {
          ...s.config.camera,
          cameras: s.config.camera.cameras.map((c) =>
            c.id === id ? { ...c, showInFinalBar: visible } : c
          ),
        },
      },
    })),

  moveCamera: (id, dir) =>
    set((s) => {
      const arr = s.config.camera.cameras;
      const idx = arr.findIndex((c) => c.id === id);
      if (idx < 0) return s;
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return s;
      const next = arr.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return {
        config: { ...s.config, camera: { ...s.config.camera, cameras: next } },
      };
    }),

  addCamera: () =>
    set((s) => {
      // unikalne id
      let n = s.config.camera.cameras.length + 1;
      const taken = new Set(s.config.camera.cameras.map((c) => c.id));
      while (taken.has(`cam_${n}`)) n++;
      const id = `cam_${n}`;
      const newCam: CameraDef = {
        id,
        name: `Kamera ${n}`,
        position: [2.4, 1.4, 3.0],
        target: [0, 0.6, 0],
        fov: 35,
        showInFinalBar: true,
      };
      return {
        config: {
          ...s.config,
          camera: { ...s.config.camera, cameras: [...s.config.camera.cameras, newCam] },
        },
      };
    }),

  removeCamera: (id) =>
    set((s) => {
      const arr = s.config.camera.cameras;
      if (arr.length <= 1) return s;
      const next = arr.filter((c) => c.id !== id);
      const active = s.config.camera.active === id ? next[0].id : s.config.camera.active;
      return {
        config: { ...s.config, camera: { ...s.config.camera, active, cameras: next } },
      };
    }),
```

- [ ] **Step 4:** `npm test` → PASS (wszystkie nowe i istniejące testy).

Run: `npm test`
Expected: PASS — 18 testów (poprzednie 7 + 11 nowych).

- [ ] **Step 5:** `npx tsc -b` — w innych plikach będą błędy typu „presets does not exist" — zostawiamy je do Task 2.

Run: `npx tsc -b`
Expected: błędy TYLKO w `CameraRig.tsx`, `EditorView.tsx`, `SceneIcons.tsx`, `ui/Outliner.tsx`, `ui/Inspector.tsx`, `ui/CameraButtons.tsx`, `ui/ViewButtons.tsx` (te naprawimy w kolejnych taskach). `store.ts` i `store.test.ts` bez błędów.

- [ ] **Step 6: Commit**

```bash
git add src/store.ts src/store.test.ts
git commit -m "refactor(store): cameras as ordered list with metadata + ops"
```

---

## Task 2: Podłącz silnik 3D pod nową listę kamer

**Files:**
- Modify: `src/viewer/CameraRig.tsx`
- Modify: `src/viewer/EditorView.tsx`
- Modify: `src/viewer/SceneIcons.tsx`

- [ ] **Step 1: Zaktualizuj `src/viewer/CameraRig.tsx`** — lookup po tablicy zamiast po Record.

Znajdź:
```tsx
  const active = useStore((s) => s.config.camera.active);
  const presets = useStore((s) => s.config.camera.presets);
```
Zastąp:
```tsx
  const active = useStore((s) => s.config.camera.active);
  const cameras = useStore((s) => s.config.camera.cameras);
```

Znajdź:
```tsx
  const activeFov = presets[active]?.fov ?? 28;
```
Zastąp:
```tsx
  const activeFov = cameras.find((c) => c.id === active)?.fov ?? 28;
```

Znajdź:
```tsx
    const view = useStore.getState().config.camera.presets[active];
    if (!view) return;
```
Zastąp:
```tsx
    const view = useStore.getState().config.camera.cameras.find((c) => c.id === active);
    if (!view) return;
```

- [ ] **Step 2: Zaktualizuj `src/viewer/EditorView.tsx`**

Znajdź:
```tsx
    const p = cam.presets[cam.active] ?? cam.presets.hero;
```
Zastąp:
```tsx
    const p =
      cam.cameras.find((c) => c.id === cam.active) ?? cam.cameras[0];
```

(Reszta pliku korzysta z `p.position`/`p.target`/`p.fov` — kompatybilna z `CameraDef`.)

- [ ] **Step 3: Zaktualizuj `src/viewer/SceneIcons.tsx`** — selektor zwracający stabilną tablicę + lookup.

Zastąp całość zawartości (kompletny plik):

```tsx
import { useEffect, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, type Vec3 } from '../store';

function CameraIcon({ id }: { id: string }) {
  const cam = useStore((s) => s.config.camera.cameras.find((c) => c.id === id));
  const active = useStore((s) => s.config.camera.active) === id;
  const selected = useStore((s) => s.selected) === `cam:${id}`;
  const setSelected = useStore((s) => s.setSelected);
  const [grp, setGrp] = useState<THREE.Group | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (!grp || dragging.current || !cam) return;
    grp.position.fromArray(cam.position);
    grp.lookAt(new THREE.Vector3(cam.target[0], cam.target[1], cam.target[2]));
  }, [grp, cam]);

  if (!cam) return null;
  const color = selected ? '#4da3ff' : active ? '#74d18b' : '#9aa0ab';

  const writeBack = () => {
    if (!grp) return;
    const cur = useStore.getState().config.camera.cameras.find((c) => c.id === id);
    if (!cur) return;
    useStore.getState().capturePreset(id, {
      position: grp.position.toArray() as Vec3,
      target: cur.target,
      fov: cur.fov,
    });
  };

  return (
    <>
      <group
        ref={setGrp}
        onClick={(e) => {
          e.stopPropagation();
          setSelected(`cam:${id}`);
        }}
      >
        <mesh>
          <boxGeometry args={[0.16, 0.12, 0.1]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.055, 0.1, 14]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>

      {grp && selected && (
        <TransformControls
          object={grp}
          mode="translate"
          size={0.35}
          onMouseDown={() => (dragging.current = true)}
          onMouseUp={() => {
            dragging.current = false;
            writeBack();
          }}
          onObjectChange={writeBack}
        />
      )}
    </>
  );
}

export function SceneIcons() {
  // Stabilna ref na tablicę — selektor nie liczy Object.keys, więc nie wytwarza
  // nowego obiektu co render (vide ticket o pętli useSyncExternalStore).
  const cameras = useStore((s) => s.config.camera.cameras);
  return (
    <>
      {cameras.map((c) => (
        <CameraIcon key={c.id} id={c.id} />
      ))}
    </>
  );
}
```

- [ ] **Step 4:** `npx tsc -b` — błędy zostają już tylko w plikach UI z Tasku 3+.

Run: `npx tsc -b`
Expected: błędy TYLKO w `ui/Outliner.tsx`, `ui/Inspector.tsx`, `ui/CameraButtons.tsx`, `ui/ViewButtons.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/viewer/CameraRig.tsx src/viewer/EditorView.tsx src/viewer/SceneIcons.tsx
git commit -m "refactor(viewer): wire 3D scene to cameras array"
```

---

## Task 3: Outliner — kolejność / dodawanie / usuwanie / strzałki

**Files:**
- Modify: `src/ui/Outliner.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Zastąp zawartość `src/ui/Outliner.tsx`**

```tsx
import { useStore } from '../store';

type Row =
  | { kind: 'section'; label: string }
  | {
      kind: 'item';
      id: string;
      label: string;
      icon: string;
      depth: number;
      hint?: string;
    }
  | {
      kind: 'camera';
      id: string;
      label: string;
      depth: number;
      hint?: string;
      canUp: boolean;
      canDown: boolean;
      canRemove: boolean;
    }
  | { kind: 'add-camera' };

export function Outliner() {
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);
  const fileName = useStore((s) => s.loadedModel?.fileName);
  const cameras = useStore((s) => s.config.camera.cameras);
  const activeCam = useStore((s) => s.config.camera.active);
  const moveCamera = useStore((s) => s.moveCamera);
  const removeCamera = useStore((s) => s.removeCamera);
  const addCamera = useStore((s) => s.addCamera);

  const rows: Row[] = [
    { kind: 'section', label: 'Świat' },
    { kind: 'item', id: 'scene', label: 'Scene', icon: '🌐', depth: 0, hint: 'global' },
    { kind: 'item', id: 'render', label: 'Render', icon: '🎞', depth: 0 },
    { kind: 'item', id: 'background', label: 'Background', icon: '🌄', depth: 0 },
    { kind: 'item', id: 'environment', label: 'Environment', icon: '🌍', depth: 0, hint: 'HDRI' },

    { kind: 'section', label: 'Obiekty' },
    { kind: 'item', id: 'hero', label: 'HERO', icon: '◇', depth: 0, hint: 'NULL' },
  ];
  if (fileName) {
    rows.push({ kind: 'item', id: 'actor', label: fileName, icon: '🔒', depth: 1, hint: 'aktor' });
  }

  rows.push({ kind: 'section', label: 'Światła' });
  rows.push({ kind: 'item', id: 'light', label: 'Key Light', icon: '💡', depth: 1 });

  rows.push({ kind: 'section', label: 'Kamery' });
  cameras.forEach((c, i) => {
    rows.push({
      kind: 'camera',
      id: c.id,
      label: c.name,
      depth: 1,
      hint: c.id === activeCam ? 'aktywna' : undefined,
      canUp: i > 0,
      canDown: i < cameras.length - 1,
      canRemove: cameras.length > 1,
    });
  });
  rows.push({ kind: 'add-camera' });

  return (
    <div className="outliner">
      {rows.map((r, i) => {
        if (r.kind === 'section') {
          return (
            <div key={`s${i}`} className="outliner__section">
              {r.label}
            </div>
          );
        }
        if (r.kind === 'add-camera') {
          return (
            <button
              key={`add${i}`}
              className="outliner__add"
              onClick={() => addCamera()}
            >
              + dodaj kamerę
            </button>
          );
        }
        if (r.kind === 'camera') {
          const isSel = selected === `cam:${r.id}`;
          return (
            <div
              key={r.id}
              className={`outliner__row outliner__row--camera ${isSel ? 'is-selected' : ''}`}
              style={{ paddingLeft: 10 + r.depth * 18 }}
            >
              <button
                className="outliner__main"
                onClick={() => setSelected(`cam:${r.id}`)}
              >
                <span className="outliner__icon">📷</span>
                <span className="outliner__label">{r.label}</span>
                {r.hint && <span className="outliner__hint">{r.hint}</span>}
              </button>
              <div className="outliner__ops">
                <button
                  className="outliner__op"
                  disabled={!r.canUp}
                  title="W górę"
                  onClick={() => moveCamera(r.id, 'up')}
                >
                  ↑
                </button>
                <button
                  className="outliner__op"
                  disabled={!r.canDown}
                  title="W dół"
                  onClick={() => moveCamera(r.id, 'down')}
                >
                  ↓
                </button>
                <button
                  className="outliner__op outliner__op--danger"
                  disabled={!r.canRemove}
                  title="Usuń"
                  onClick={() => removeCamera(r.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        }
        // r.kind === 'item'
        return (
          <button
            key={r.id}
            className={`outliner__row ${selected === r.id ? 'is-selected' : ''}`}
            style={{ paddingLeft: 10 + r.depth * 18 }}
            onClick={() => setSelected(r.id)}
          >
            <span className="outliner__icon">{r.icon}</span>
            <span className="outliner__label">{r.label}</span>
            {r.hint && <span className="outliner__hint">{r.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Dorzuć style do `src/styles.css`** — na końcu pliku dopisz:

```css
/* Outliner — operacje per-camera */
.outliner__row--camera {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 8px;
}
.outliner__main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  padding: 6px 0;
  cursor: pointer;
  text-align: left;
}
.outliner__ops {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 100ms;
}
.outliner__row--camera:hover .outliner__ops,
.outliner__row--camera.is-selected .outliner__ops { opacity: 1; }
.outliner__op {
  appearance: none;
  border: 0;
  background: transparent;
  color: #cfd2d8;
  font: inherit;
  font-size: 11px;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  cursor: pointer;
}
.outliner__op:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); }
.outliner__op:disabled { opacity: 0.25; cursor: not-allowed; }
.outliner__op--danger:hover:not(:disabled) { background: rgba(229, 76, 76, 0.25); color: #ffb3b3; }

.outliner__add {
  display: flex;
  align-items: center;
  width: calc(100% - 24px);
  margin: 4px 12px 8px;
  padding: 6px 10px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  background: transparent;
  border-radius: 6px;
  color: #cfd2d8;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.outliner__add:hover { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.35); }
```

- [ ] **Step 3:** `npx tsc -b` — `Outliner.tsx` bez błędów.

Run: `npx tsc -b`
Expected: błędy TYLKO w `ui/Inspector.tsx`, `ui/CameraButtons.tsx`, `ui/ViewButtons.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Outliner.tsx src/styles.css
git commit -m "feat(outliner): per-camera reorder/add/remove ops"
```

---

## Task 4: Inspector — nazwa kamery / pokaż na pasku / usuń

**Files:**
- Modify: `src/ui/Inspector.tsx`

- [ ] **Step 1: Zastąp całą funkcję `CameraControls` + `CameraControlsInner` + helper `patchCamera`** w `src/ui/Inspector.tsx`.

Znajdź sekcję rozpoczynającą się od:
```tsx
/* --- Pojedyncza kamera (obiekt) --- */
function patchCamera(id: string, patch: Partial<CameraPresetView>) {
```
…i kończącą się na zamykającym `}` funkcji `CameraControlsInner`. Zastąp całość:

```tsx
/* --- Pojedyncza kamera (obiekt) --- */
function CameraControls({ id }: { id: string }) {
  const c = useStore.getState().config.camera;
  const cam = c.cameras.find((x) => x.id === id);
  if (!cam) return null;
  return <CameraControlsInner id={id} active={c.active === id} cam={cam} orbit={c.orbit} />;
}

function CameraControlsInner({
  id,
  active,
  cam,
  orbit,
}: {
  id: string;
  active: boolean;
  cam: { position: Vec3; target: Vec3; fov: number; name: string; showInFinalBar: boolean };
  orbit: { minDist: number; maxDist: number; damping: number };
}) {
  const removable = useStore.getState().config.camera.cameras.length > 1;

  const [, set] = useControls(
    `Camera: ${id}`,
    () => ({
      nazwa: {
        value: cam.name,
        onChange: (v: string) => useStore.getState().renameCamera(id, v),
      },
      'pokaż w finalnym widoku': {
        value: cam.showInFinalBar,
        onChange: (v: boolean) => useStore.getState().setCameraVisible(id, v),
      },
      aktywna: {
        value: active,
        onChange: (v: boolean) => {
          if (v) useStore.getState().setCamera({ active: id });
        },
      },
      pozycja: {
        value: cam.position,
        step: 0.05,
        onChange: (v: [number, number, number]) =>
          useStore.getState().updateCamera(id, { position: v }),
      },
      target: {
        value: cam.target,
        step: 0.05,
        onChange: (v: [number, number, number]) =>
          useStore.getState().updateCamera(id, { target: v }),
      },
      fov: {
        value: cam.fov,
        min: 10,
        max: 80,
        step: 1,
        onChange: (v: number) => useStore.getState().updateCamera(id, { fov: v }),
      },
      minDist: {
        value: orbit.minDist,
        min: 0.2,
        max: 5,
        step: 0.1,
        onChange: (v: number) => useStore.getState().setOrbit({ minDist: v }),
      },
      maxDist: {
        value: orbit.maxDist,
        min: 2,
        max: 30,
        step: 0.5,
        onChange: (v: number) => useStore.getState().setOrbit({ maxDist: v }),
      },
      damping: {
        value: orbit.damping,
        min: 0,
        max: 0.3,
        step: 0.01,
        onChange: (v: number) => useStore.getState().setOrbit({ damping: v }),
      },
      'Zapisz z aktualnego widoku': button(() => {
        const view = useStore.getState().cameraApi?.getView();
        if (view) useStore.getState().capturePreset(id, view);
      }),
      'Usuń kamerę': button(
        () => useStore.getState().removeCamera(id),
        { disabled: !removable }
      ),
    }),
    []
  );

  // Store → leva (gizmo / zapis widoku / rename z outlinera).
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        const cur = s.config.camera.cameras.find((x) => x.id === id);
        const old = prev.config.camera.cameras.find((x) => x.id === id);
        if (!cur || cur === old) return;
        set({
          nazwa: cur.name,
          'pokaż w finalnym widoku': cur.showInFinalBar,
          pozycja: cur.position,
          target: cur.target,
          fov: cur.fov,
        });
      }),
    [id, set]
  );
  return null;
}
```

- [ ] **Step 2:** dodaj import `Vec3` w nagłówku pliku — znajdź:

```tsx
import {
  useStore,
  replaceStop,
  type ToneMode,
  type GizmoMode,
  type CameraPresetView,
} from '../store';
```

Zastąp:

```tsx
import {
  useStore,
  replaceStop,
  type ToneMode,
  type GizmoMode,
  type Vec3,
} from '../store';
```

(Usuwamy `CameraPresetView` z importów — już nieużywany w tym pliku; dodajemy `Vec3` dla typu propsa.)

- [ ] **Step 3:** `npx tsc -b` — Inspector bez błędów.

Run: `npx tsc -b`
Expected: błędy TYLKO w `ui/CameraButtons.tsx` i `ui/ViewButtons.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Inspector.tsx
git commit -m "feat(inspector): camera name, show-in-final-bar toggle, delete"
```

---

## Task 5: CameraButtons — filtrowanie po `showInFinalBar` + nazwy

**Files:**
- Modify: `src/ui/CameraButtons.tsx`

- [ ] **Step 1: Zastąp zawartość `src/ui/CameraButtons.tsx`**

```tsx
import { useStore } from '../store';

/**
 * Pasek presetów kamery w finalnym widoku. Lista pochodzi z `cameras`,
 * filtrowana po `showInFinalBar`. Kolejność przycisków = kolejność w outlinerze
 * (kamera na szczycie outlinera = pierwsza z lewej).
 */
export function CameraButtons() {
  const cameras = useStore((s) => s.config.camera.cameras);
  const active = useStore((s) => s.config.camera.active);
  const setCamera = useStore((s) => s.setCamera);
  const visible = cameras.filter((c) => c.showInFinalBar);
  if (visible.length === 0) return null;
  return (
    <div className="viewport-bar viewport-bar--bottom">
      {visible.map((c) => (
        <button
          key={c.id}
          className={active === c.id ? 'active' : ''}
          onClick={() => setCamera({ active: c.id })}
          title={c.id}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2:** `npx tsc -b` — błędy tylko w `ViewButtons.tsx`.

Run: `npx tsc -b`
Expected: błąd TYLKO w `ui/ViewButtons.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/ui/CameraButtons.tsx
git commit -m "feat(camera-bar): filter final-view bar by showInFinalBar"
```

---

## Task 6: ViewButtons — dwa rzędy (rzuty na górze, kamery na dole)

**Files:**
- Modify: `src/ui/ViewButtons.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Zastąp zawartość `src/ui/ViewButtons.tsx`**

```tsx
import { useStore, type EditorView } from '../store';

const PROJECTIONS: { id: EditorView; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'perspective', label: 'Persp' },
];

/**
 * Pasek dolny środkowego viewportu — DWA RZĘDY:
 *  - górny: rzuty ortho + Persp (setEditorView)
 *  - dolny: kamery sceny w kolejności outlinera; klik = ustawia kamerę
 *    aktywną i przełącza editorView='camera'.
 */
export function ViewButtons() {
  const view = useStore((s) => s.editorView);
  const setEditorView = useStore((s) => s.setEditorView);
  const cameras = useStore((s) => s.config.camera.cameras);
  const active = useStore((s) => s.config.camera.active);
  const setCamera = useStore((s) => s.setCamera);

  return (
    <div className="viewport-stack viewport-stack--bottom">
      <div className="viewport-bar">
        {PROJECTIONS.map((v) => (
          <button
            key={v.id}
            className={view === v.id ? 'active' : ''}
            onClick={() => setEditorView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="viewport-bar">
        {cameras.map((c) => {
          const isActive = view === 'camera' && active === c.id;
          return (
            <button
              key={c.id}
              className={isActive ? 'active' : ''}
              onClick={() => {
                setCamera({ active: c.id });
                setEditorView('camera');
              }}
              title={c.id}
            >
              📷 {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Dorzuć kontener `viewport-stack`** — na końcu `src/styles.css` dopisz:

```css
/* Dwurzędowy stos pasków (środkowy viewport: rzuty + kamery). */
.viewport-stack {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.viewport-stack--bottom { bottom: 12px; }
/* Wewnątrz stacka paski nie pozycjonują się same. */
.viewport-stack .viewport-bar {
  position: static;
  left: auto;
  bottom: auto;
  transform: none;
}
```

- [ ] **Step 3:** `npx tsc -b` — cały projekt bez błędów.

Run: `npx tsc -b`
Expected: brak błędów.

- [ ] **Step 4:** `npm test` — wszystkie testy zielone.

Run: `npm test`
Expected: PASS (18 testów).

- [ ] **Step 5:** `npm run build` — sanity check.

Run: `npm run build`
Expected: PASS (`tsc -b` + `vite build` bez błędów).

- [ ] **Step 6: Commit**

```bash
git add src/ui/ViewButtons.tsx src/styles.css
git commit -m "feat(view-bar): add cameras list next to projection buttons"
```

---

## Task 7: Walidacja ręczna

**Files:** brak zmian kodu (chyba że walidacja ujawni usterkę — wtedy popraw i dopisz commit).

- [ ] **Step 1: Odpal dev server**

Run: `npm run dev`
Otwórz `http://localhost:5173/`.

- [ ] **Step 2: Przejdź checklistę**

1. **Outliner — kolejność**: w sekcji „Kamery" widać 5 kamer (Hero/Front/Side/Top/Detail). Najedź na wiersz kamery — pojawiają się ↑/↓/✕. Strzałka ↑ przy pierwszej i ↓ przy ostatniej są wyszarzone. Kliknij ↓ przy „Hero" → przesuwa o jedno w dół; pasek finalnego widoku natychmiast pokazuje nową kolejność (Front, Hero, Side, Top, Detail). Dolny rząd paska edytora (kamery) też.

2. **Outliner — dodawanie**: kliknij „+ dodaj kamerę" → na końcu pojawia się nowa pozycja `Kamera 6`. Zaznacz ją → otwiera się jej inspektor.

3. **Inspector — nazwa**: w polu „nazwa" wpisz „Bliska" → zmiana widoczna w outlinerze i obu paskach na żywo.

4. **Inspector — pokaż w finalnym widoku**: odznacz „pokaż w finalnym widoku" przy „Bliska" → znika z paska finalnego widoku, ale ZOSTAJE w pasku edytora.

5. **Inspector — usuń kamerę**: kliknij „Usuń kamerę" → znika z outlinera, obu pasków oraz ikon w viewporcie edycji.

6. **Inspector — usuń ostatnią**: usuń kolejne kamery aż zostanie jedna — przycisk „Usuń kamerę" zostaje wyszarzony. ✕ w outlinerze również.

7. **Pasek edytora — dwa rzędy**: środkowy viewport ma na dole DWA wiersze przycisków — górny z rzutami (Top/Bottom/.../Persp), dolny z kamerami sceny. Kliknij w dolnym rzędzie „Front" → środkowy viewport przełącza się w widok z perspektywy kamery „Front", podświetla się ten przycisk w dolnym rzędzie i ŻADEN przycisk w górnym rzędzie nie jest podświetlony; w outlinerze „Front" oznaczona jako „aktywna".

8. **Aktywna ↔ paski**: ustaw kamerę „Hero" jako aktywną → na pasku finalnego widoku „Hero" podświetlone żółto; w pasku edytora kliknij „Persp" w górnym rzędzie → kamery w dolnym rzędzie przestają być podświetlone, mimo że jedna jest aktywna w sensie sceny (bo `editorView !== 'camera'`).

9. **Gizmo + zapis widoku**: zaznacz kamerę „Front", przesuń ją gizmem w viewporcie edycji → pola „pozycja" w inspektorze aktualizują się; finalny widok się zmienia (jeżeli Front aktywna w sensie sceny i wybrana). Naciśnij „Zapisz z aktualnego widoku" → pola pozycji/target/fov aktualizują się do bieżącego stanu kamery.

10. **Reload (F5)**: aplikacja startuje, lista kamer jak DEFAULT_CONFIG, brak błędów w konsoli.

- [ ] **Step 3: Jeśli walidacja wymusiła poprawki**

```bash
git add -A
git commit -m "fix: address manual validation findings (cameras)"
```

---

## Self-Review (autora planu)

- **Pokrycie wymagań z polecenia:**
  - „Muszą mieć opcje zmiany nazwy" → T4 (inspector pole `nazwa`).
  - „Muszą mieć opcje zmiany pozycji w outlinerze" → T1 `moveCamera`, T3 strzałki ↑/↓.
  - „Ich pozycja w outlinerze jest przenoszona na pasek z kamerami w obu oknach" → T5 (final view bar mapuje `cameras` w kolejności) + T6 (editor bar mapuje `cameras` w kolejności).
  - „Jeśli kamera jest na szczycie to jest pierwsza z lewej" → outliner renderuje `cameras` w kolejności tablicy, paski mapują tę samą tablicę bez sortowania → kolejność zachowana.
  - „W ustawieniach kamery musi być opcja pokazywanie jej w panelu z widokiem finalnym" → T4 toggle `pokaż w finalnym widoku`, T5 filtruje pasek finalny po `showInFinalBar`.
  - „Musi być opcja dodawania i odejmowania kamer" → T1 `addCamera`/`removeCamera`, T3 przycisk „+ dodaj kamerę" i ✕ w wierszu, T4 przycisk „Usuń kamerę".
- **Spójność typów:**
  - `CameraDef { id, name, position, target, fov, showInFinalBar }` zdefiniowany w T1; każdy późniejszy task odnosi się do tych samych pól (T2 — `cam.position/target/fov`, T3 — `c.name/showInFinalBar`, T4 — `cam.name/showInFinalBar/position/target/fov`, T5 — `c.name/showInFinalBar`, T6 — `c.name/id`).
  - Operacje storu wołane spójnymi nazwami w T2-T6: `capturePreset(id, view)`, `updateCamera(id, patch)`, `renameCamera(id, name)`, `setCameraVisible(id, v)`, `moveCamera(id, 'up'|'down')`, `addCamera()`, `removeCamera(id)`.
  - `CameraPresetView` (kształt `{position, target, fov}`) używany tylko w `cameraApi.getView()` i `capturePreset` — bez zmian sygnatur.
- **Ryzyka rozbrojone:**
  - Selektor `useStore((s) => s.config.camera.cameras)` zwraca stabilną ref tak długo, jak nie modyfikujemy tablicy — wszystkie settery podmieniają tablicę na nową przy zmianie (`map`/`filter`/`slice`/`...`). Stabilność OK, brak pętli `useSyncExternalStore`.
  - „Move w outlinerze przekłada się na paski" — paski iterują po tej samej tablicy, więc auto.
  - Usuwanie aktywnej kamery — przełączamy `active` na `cameras[0].id` po filtracji, zanim wyrenderuje się CameraRig (zustand robi `set` atomowo, więc na następny render już mamy spójny stan).
  - Pierwsze rzeczywiste „złe" zachowanie subscribers/leva (HERO/Light/Camera) złapane w poprzedniej iteracji — wzorzec `[, set] = useControls(...)` + `useStore.subscribe(...)` powielony spójnie w CameraControls (T4).
