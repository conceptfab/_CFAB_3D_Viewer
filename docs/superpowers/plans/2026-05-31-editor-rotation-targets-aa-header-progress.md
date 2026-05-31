# Editor Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rotate gizmo and target editing for cameras & lights, a per-scene antialiasing option, compact icon buttons in the editor header, and a determinate scene-loading progress bar on external-link pages.

**Architecture:** A shared foundation in the Zustand store (`components/store.ts`) adds two serialized config fields (`keyLight.target`, `antialiasing`), editor-only UI state (`aimGizmoMode`), and a `normalizeConfig` deep-merge so older saved scenes gain new defaults on load. Two pure, unit-tested helpers (`lib/viewer/aim.ts`, `lib/viewer/antialiasing.ts`) hold the math/mapping. Feature wiring is in the existing viewer/inspector components. Scene `config` is persisted as opaque `jsonb`, so **no API or DB schema change is needed.**

**Tech Stack:** Next.js 15 (App Router), React 19, React Three Fiber 9 + drei 10, three 0.169, `@react-three/postprocessing` 3 (`postprocessing` 6), leva 0.10, Zustand 5, Zod 4, Vitest 2.

**Spec:** `docs/superpowers/specs/2026-05-31-editor-rotation-targets-aa-header-progress-design.md`

---

## File Structure

**New files:**
- `lib/viewer/aim.ts` — pure `reaimAfterRotation(position, target, quaternion)`.
- `lib/viewer/aim.test.ts` — unit tests for the above.
- `lib/viewer/antialiasing.ts` — pure `smaaPresetFor(mode)`.
- `lib/viewer/antialiasing.test.ts` — unit tests for the above.
- `components/normalizeConfig.test.ts` — unit tests for `normalizeConfig`.
- `components/ui/icons.tsx` — inline-SVG `IconSave` / `IconPreset` / `IconLink`.
- `components/viewer/SceneProgress.tsx` — DOM progress-bar overlay using drei `useProgress`.

**Modified files:**
- `components/store.ts` — config fields + defaults; `AntialiasingMode`/`AimGizmoMode` types; `aimGizmoMode` + setters; `normalizeConfig`/`deepMerge`.
- `components/viewer/Postprocess.tsx` — AA switch (OFF/FXAA/SMAA).
- `components/ui/Inspector.tsx` — Render AA select; camera & light gizmo-mode select; light target X/Y/Z.
- `components/viewer/SceneIcons.tsx` — camera rotate/target gizmo + target handle.
- `components/viewer/Gizmos.tsx` — light rotate/target gizmo + target handle.
- `components/viewer/Studio.tsx` — `directionalLight.target` at `keyLight.target`.
- `components/viewer/EditorView.tsx` — same target on the preview light.
- `components/viewer/ReadOnlyViewer.tsx` — `normalizeConfig` + `setAntialiasing` + mount `<SceneProgress/>`.
- `components/scenes/ExistingSceneEditor.tsx` — `normalizeConfig` on load.
- `components/App.tsx` — header text buttons → icon buttons.
- `components/styles.css` — `.icon-btn`, `.scene-progress*`.

**Task groups & order:** Foundation (1–3) → AA feature (4–9) → Gizmos feature (10–14) → Header (15–16) → Progress (17–18) → Final verification (19). Each task leaves the app building and green.

---

## Task 1: Config fields + defaults

**Files:**
- Modify: `components/store.ts`

- [ ] **Step 1: Add the `AntialiasingMode` type**

In `components/store.ts`, immediately after the `ToneMode` type (line 3), add:

```ts
export type AntialiasingMode =
  | 'OFF'
  | 'FXAA'
  | 'SMAA_LOW'
  | 'SMAA_MEDIUM'
  | 'SMAA_HIGH'
  | 'SMAA_ULTRA';
```

- [ ] **Step 2: Add `target` to the `keyLight` type**

In the `SceneConfig` interface, the `keyLight` block currently ends with `normalBias: number;`. Add a `target` field so the block reads:

```ts
  keyLight: {
    position: Vec3;
    target: Vec3;
    intensity: number;
    color: string;
    castShadow: boolean;
    shadowMapSize: number;
    shadowBias: number;
    normalBias: number;
  };
```

- [ ] **Step 3: Add `antialiasing` to `SceneConfig`**

In the `SceneConfig` interface, after the `material: { envMapIntensity: number };` line, add:

```ts
  antialiasing: AntialiasingMode;
```

- [ ] **Step 4: Add defaults in `DEFAULT_CONFIG`**

In `DEFAULT_CONFIG`, add `target: [0, 0, 0],` to the `keyLight` object (right after its `position` line):

```ts
  keyLight: {
    position: [-2.5, 4, 3],
    target: [0, 0, 0],
    intensity: 0.55,
    color: '#ffffff',
    castShadow: true,
    shadowMapSize: 4096,
    shadowBias: -0.00012,
    normalBias: 0.012,
  },
```

And add the top-level default after the `material` line:

```ts
  material: { envMapIntensity: 1.0 },
  antialiasing: 'SMAA_MEDIUM',
```

- [ ] **Step 5: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0 with no output (DEFAULT_CONFIG is the only `SceneConfig` literal; all other code reads the config).

- [ ] **Step 6: Commit**

```bash
git add components/store.ts
git commit -m "feat(store): add keyLight.target and antialiasing config fields"
```

---

## Task 2: Editor state — `aimGizmoMode`, `setAimGizmoMode`, `setAntialiasing`

**Files:**
- Modify: `components/store.ts`
- Test: `components/store.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `components/store.test.ts` (inside the file, after the existing `describe('store setters', …)` block — reuse the existing `reset`/`beforeEach`). Add a new block:

```ts
describe('new editor state + setters', () => {
  beforeEach(reset);

  it('aimGizmoMode domyślnie translate', () => {
    expect(useStore.getState().aimGizmoMode).toBe('translate');
  });

  it('setAimGizmoMode ustawia tryb', () => {
    useStore.getState().setAimGizmoMode('rotate');
    expect(useStore.getState().aimGizmoMode).toBe('rotate');
  });

  it('setAntialiasing ustawia config.antialiasing', () => {
    useStore.getState().setAntialiasing('FXAA');
    expect(useStore.getState().config.antialiasing).toBe('FXAA');
  });

  it('setKeyLight({target}) robi merge zachowując position', () => {
    useStore.getState().setKeyLight({ target: [1, 2, 3] });
    const kl = useStore.getState().config.keyLight;
    expect(kl.target).toEqual([1, 2, 3]);
    expect(kl.position).toEqual(DEFAULT_CONFIG.keyLight.position);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/store.test.ts`
Expected: FAIL — `aimGizmoMode` / `setAimGizmoMode` / `setAntialiasing` are not defined on the store.

- [ ] **Step 3: Add the `AimGizmoMode` type**

In `components/store.ts`, after the existing `GizmoMode` type, add:

```ts
/** Tryb gizmo dla kamer i świateł (aim = celowanie przez target). */
export type AimGizmoMode = 'translate' | 'rotate' | 'target';
```

- [ ] **Step 4: Declare state + setters on the `State` interface**

In the `State` interface, after the existing `gizmoMode` / `setGizmoMode` lines, add:

```ts
  aimGizmoMode: AimGizmoMode;
  setAimGizmoMode: (m: AimGizmoMode) => void;
```

And next to the other config setters (e.g. after `setMaterial`), add:

```ts
  setAntialiasing: (mode: AntialiasingMode) => void;
```

- [ ] **Step 5: Implement in the store body**

In `create<State>((set) => ({ … }))`, after the `gizmoMode: 'translate', setGizmoMode: …` lines, add:

```ts
  aimGizmoMode: 'translate',
  setAimGizmoMode: (aimGizmoMode) => set({ aimGizmoMode }),
```

And alongside the other config setters (after `setMaterial`), add:

```ts
  setAntialiasing: (mode) =>
    set((s) => ({ config: { ...s.config, antialiasing: mode } })),
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run components/store.test.ts`
Expected: PASS (all blocks, including the new one).

- [ ] **Step 7: Commit**

```bash
git add components/store.ts components/store.test.ts
git commit -m "feat(store): aimGizmoMode + setAntialiasing setters"
```

---

## Task 3: `normalizeConfig` deep-merge (backward compat)

**Files:**
- Modify: `components/store.ts`
- Test: `components/normalizeConfig.test.ts`

- [ ] **Step 1: Write the failing test**

Create `components/normalizeConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, normalizeConfig } from './store';

describe('normalizeConfig', () => {
  it('fills keyLight.target and antialiasing when missing (legacy scene)', () => {
    const legacy = structuredClone(DEFAULT_CONFIG) as Record<string, unknown>;
    // simulate a scene saved before the new fields existed
    delete (legacy.keyLight as Record<string, unknown>).target;
    delete legacy.antialiasing;

    const out = normalizeConfig(legacy);
    expect(out.keyLight.target).toEqual([0, 0, 0]);
    expect(out.antialiasing).toBe('SMAA_MEDIUM');
  });

  it('preserves present values and merges nested objects per-key', () => {
    const raw = {
      keyLight: { position: [9, 9, 9], intensity: 2 }, // partial keyLight
      antialiasing: 'OFF',
    };
    const out = normalizeConfig(raw);
    expect(out.keyLight.position).toEqual([9, 9, 9]);
    expect(out.keyLight.intensity).toBe(2);
    expect(out.keyLight.color).toBe(DEFAULT_CONFIG.keyLight.color); // default kept
    expect(out.keyLight.target).toEqual([0, 0, 0]); // default kept
    expect(out.antialiasing).toBe('OFF');
  });

  it('takes arrays wholesale (cameras / Vec3) without element merge', () => {
    const raw = {
      camera: { active: 'front', cameras: [
        { id: 'only', name: 'Only', position: [1, 1, 1], target: [0, 0, 0], fov: 30, showInFinalBar: true },
      ] },
    };
    const out = normalizeConfig(raw);
    expect(out.camera.cameras).toHaveLength(1);
    expect(out.camera.cameras[0].id).toBe('only');
    expect(out.camera.active).toBe('front');
    expect(out.camera.near).toBe(DEFAULT_CONFIG.camera.near); // default kept
  });

  it('returns a full valid config from an empty object', () => {
    const out = normalizeConfig({});
    expect(out).toEqual(DEFAULT_CONFIG);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/normalizeConfig.test.ts`
Expected: FAIL — `normalizeConfig` is not exported from `./store`.

- [ ] **Step 3: Implement `deepMerge` + `normalizeConfig`**

In `components/store.ts`, after the `replaceStop` function, add:

```ts
type Json = Record<string, unknown>;
const isPlainObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep-merge `override` onto `base`. Arrays and primitives in `override`
 *  replace `base` wholesale (no element merge); nested plain objects merge
 *  per-key. Missing keys fall back to `base`. */
function deepMerge<T>(base: T, override: unknown): T {
  if (override === undefined || override === null) return structuredClone(base);
  if (!isPlainObject(base) || !isPlainObject(override)) {
    // primitive or array → take override (cloned so callers can't mutate base)
    return structuredClone(override) as T;
  }
  const out: Json = structuredClone(base) as Json;
  for (const key of Object.keys(override)) {
    out[key] = deepMerge((base as Json)[key], (override as Json)[key]);
  }
  return out as T;
}

/** Merge a loaded (possibly legacy / partial) config over DEFAULT_CONFIG so
 *  every field — including newly added ones — has a valid value. */
export function normalizeConfig(raw: unknown): SceneConfig {
  return deepMerge(DEFAULT_CONFIG, raw);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/normalizeConfig.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/store.ts components/normalizeConfig.test.ts
git commit -m "feat(store): normalizeConfig deep-merge for backward-compatible scene load"
```

---

## Task 4: Pure aim math — `reaimAfterRotation`

**Files:**
- Create: `lib/viewer/aim.ts`
- Test: `lib/viewer/aim.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/viewer/aim.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { reaimAfterRotation } from './aim';

describe('reaimAfterRotation', () => {
  it('identity quaternion keeps a +Z target', () => {
    const t = reaimAfterRotation([0, 0, 0], [0, 0, 5], [0, 0, 0, 1]);
    expect(t[0]).toBeCloseTo(0);
    expect(t[1]).toBeCloseTo(0);
    expect(t[2]).toBeCloseTo(5);
  });

  it('90° yaw about Y moves a +Z target onto +X (distance preserved)', () => {
    const s = Math.SQRT1_2; // sin45 === cos45
    const t = reaimAfterRotation([0, 0, 0], [0, 0, 5], [0, s, 0, s]);
    expect(t[0]).toBeCloseTo(5);
    expect(t[1]).toBeCloseTo(0);
    expect(t[2]).toBeCloseTo(0);
  });

  it('zero look distance stays finite (clamped, no NaN)', () => {
    const t = reaimAfterRotation([1, 1, 1], [1, 1, 1], [0, 0, 0, 1]);
    expect(t.every(Number.isFinite)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/viewer/aim.test.ts`
Expected: FAIL — cannot find module `./aim`.

- [ ] **Step 3: Implement `lib/viewer/aim.ts`**

```ts
import type { Vec3 } from '@/components/store';

const MIN_DIST = 1e-4;

/**
 * New look target after an object has been rotated by `quaternion`.
 *
 * The object is assumed to be oriented so its local +Z axis points toward the
 * target — this is how three.js `Object3D.lookAt` orients a *non-camera* object
 * (the camera icon group and the light handle are both non-cameras). The look
 * distance is preserved; a minimum distance is clamped so position == target
 * never yields NaN.
 *
 * @param quaternion the object's world quaternion as [x, y, z, w].
 */
export function reaimAfterRotation(
  position: Vec3,
  target: Vec3,
  quaternion: [number, number, number, number]
): Vec3 {
  const dx = target[0] - position[0];
  const dy = target[1] - position[1];
  const dz = target[2] - position[2];
  const dist = Math.max(Math.hypot(dx, dy, dz), MIN_DIST);

  const [x, y, z, w] = quaternion;
  // Image of local +Z (0,0,1) under the quaternion = 3rd column of the rotation matrix.
  const fx = 2 * (x * z + w * y);
  const fy = 2 * (y * z - w * x);
  const fz = 1 - 2 * (x * x + y * y);

  return [position[0] + fx * dist, position[1] + fy * dist, position[2] + fz * dist];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/viewer/aim.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/viewer/aim.ts lib/viewer/aim.test.ts
git commit -m "feat(viewer): reaimAfterRotation pure helper for rotate-gizmo re-aiming"
```

---

## Task 5: Pure AA mapping — `smaaPresetFor`

**Files:**
- Create: `lib/viewer/antialiasing.ts`
- Test: `lib/viewer/antialiasing.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/viewer/antialiasing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { smaaPresetFor } from './antialiasing';

describe('smaaPresetFor', () => {
  it('maps SMAA levels to postprocessing preset indices (LOW=0..ULTRA=3)', () => {
    expect(smaaPresetFor('SMAA_LOW')).toBe(0);
    expect(smaaPresetFor('SMAA_MEDIUM')).toBe(1);
    expect(smaaPresetFor('SMAA_HIGH')).toBe(2);
    expect(smaaPresetFor('SMAA_ULTRA')).toBe(3);
  });

  it('returns null for non-SMAA modes', () => {
    expect(smaaPresetFor('OFF')).toBeNull();
    expect(smaaPresetFor('FXAA')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/viewer/antialiasing.test.ts`
Expected: FAIL — cannot find module `./antialiasing`.

- [ ] **Step 3: Implement `lib/viewer/antialiasing.ts`**

```ts
import type { AntialiasingMode } from '@/components/store';

/**
 * SMAA quality preset index for an antialiasing mode, or null for OFF/FXAA.
 * Values match postprocessing's `SMAAPreset` enum: LOW=0, MEDIUM=1, HIGH=2,
 * ULTRA=3. Returned as a plain number so this module (and its test) need not
 * import the heavy `postprocessing` package; `<SMAA preset={n} />` accepts the
 * numeric enum value directly.
 */
export function smaaPresetFor(mode: AntialiasingMode): number | null {
  switch (mode) {
    case 'SMAA_LOW':
      return 0;
    case 'SMAA_MEDIUM':
      return 1;
    case 'SMAA_HIGH':
      return 2;
    case 'SMAA_ULTRA':
      return 3;
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/viewer/antialiasing.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/viewer/antialiasing.ts lib/viewer/antialiasing.test.ts
git commit -m "feat(viewer): smaaPresetFor AA mode -> preset mapping"
```

---

## Task 6: Antialiasing switch in `Postprocess`

**Files:**
- Modify: `components/viewer/Postprocess.tsx`

- [ ] **Step 1: Replace the component body**

Replace the entire contents of `components/viewer/Postprocess.tsx` with:

```tsx
'use client';
import { useMemo } from 'react';
import { EffectComposer, ToneMapping, SMAA, FXAA } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useStore, type ToneMode } from '../store';
import { ExposureEffect } from '../scene/exposureEffect';
import { smaaPresetFor } from '@/lib/viewer/antialiasing';

const TONE_MODE: Record<ToneMode, ToneMappingMode> = {
  NEUTRAL: ToneMappingMode.NEUTRAL,
  ACES_FILMIC: ToneMappingMode.ACES_FILMIC,
  AGX: ToneMappingMode.AGX,
  REINHARD: ToneMappingMode.REINHARD,
};

function Exposure({ value }: { value: number }) {
  const effect = useMemo(() => new ExposureEffect(value), []);
  effect.exposure = value;
  return <primitive object={effect} dispose={null} />;
}

export function Postprocess() {
  const mode = useStore((s) => s.config.tone.mode);
  const exposure = useStore((s) => s.config.tone.exposure);
  const aa = useStore((s) => s.config.antialiasing);
  const smaa = smaaPresetFor(aa);

  // `key={aa}` forces a clean composer rebuild when the AA effect set changes,
  // avoiding stale-effect refs. multisampling stays 0 — MSAA on the composer
  // crashes WebGL (see commit 3771325); AA is post-process only.
  return (
    <EffectComposer key={aa} multisampling={0}>
      <Exposure value={exposure} />
      <ToneMapping mode={TONE_MODE[mode]} />
      {aa === 'FXAA' ? <FXAA /> : null}
      {smaa !== null ? <SMAA preset={smaa} /> : null}
    </EffectComposer>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/viewer/Postprocess.tsx
git commit -m "feat(viewer): switch antialiasing OFF/FXAA/SMAA from config"
```

---

## Task 7: AA select in the Render inspector panel

**Files:**
- Modify: `components/ui/Inspector.tsx`

- [ ] **Step 1: Import the type and add an options constant**

In `components/ui/Inspector.tsx`, extend the store import (top of file) to include `AntialiasingMode`:

```ts
import {
  useStore,
  replaceStop,
  type ToneMode,
  type GizmoMode,
  type Vec3,
  type BrandingMode,
  type AntialiasingMode,
  type AimGizmoMode,
} from '../store';
```

(`AimGizmoMode` is used in Tasks 11 & 14 — import it now to avoid a second edit.)

After the `GIZMO_MODES` constant, add:

```ts
const AIM_MODES: AimGizmoMode[] = ['translate', 'rotate', 'target'];
const AA_OPTIONS: Record<string, AntialiasingMode> = {
  'Wyłącz': 'OFF',
  FXAA: 'FXAA',
  'SMAA Low': 'SMAA_LOW',
  'SMAA Medium': 'SMAA_MEDIUM',
  'SMAA High': 'SMAA_HIGH',
  'SMAA Ultra': 'SMAA_ULTRA',
};
```

- [ ] **Step 2: Add the AA control to `RenderControls`**

Replace the `RenderControls` function with:

```tsx
function RenderControls() {
  const t = useStore.getState().config.tone;
  useControls('Render', () => ({
    tone: { value: t.mode, options: TONE_OPTIONS, onChange: (v: ToneMode) => useStore.getState().setTone({ mode: v }) },
    exposure: { value: t.exposure, min: 0.1, max: 3, step: 0.01, onChange: (v: number) => useStore.getState().setTone({ exposure: v }) },
    antialiasing: {
      value: useStore.getState().config.antialiasing,
      options: AA_OPTIONS,
      onChange: (v: AntialiasingMode) => useStore.getState().setAntialiasing(v),
    },
  }), []);
  return null;
}
```

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add components/ui/Inspector.tsx
git commit -m "feat(inspector): antialiasing select in Render panel"
```

---

## Task 8: Apply normalize + AA in the read-only viewer

**Files:**
- Modify: `components/viewer/ReadOnlyViewer.tsx`

- [ ] **Step 1: Import `normalizeConfig`**

In `components/viewer/ReadOnlyViewer.tsx`, add to the store import line:

```ts
import { useStore, normalizeConfig } from '@/components/store';
```

(Replace the existing `import { useStore } from '@/components/store';`. Keep the separate `import type { SceneConfig } …` line.)

- [ ] **Step 2: Normalize once, use the normalized config everywhere**

Replace the body of the component from the `useMemo(() => { … }, [])` block through `const initialFov = …` with:

```tsx
  // Normalize so scenes saved before newer fields existed get valid defaults.
  const cfg = useMemo(() => normalizeConfig(config), [config]);

  // Initialise the global store synchronously before the first render.
  useMemo(() => {
    const store = useStore.getState();
    store.setEnv(cfg.environment);
    store.setBackground(cfg.background);
    store.setKeyLight(cfg.keyLight);
    store.setShadows(cfg.shadows);
    store.setTone(cfg.tone);
    store.setMaterial(cfg.material);
    store.setBranding(cfg.branding);
    store.setHero(cfg.hero);
    store.setAntialiasing(cfg.antialiasing);

    useStore.setState((s) => ({
      config: { ...s.config, camera: { ...cfg.camera } },
    }));

    if (modelUrl) {
      store.setLoadedModel({ objectUrl: modelUrl, fileName: '', file: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cam = cfg.camera;
  const initialFov = cam.cameras.find((c) => c.id === cam.active)?.fov ?? 28;
```

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add components/viewer/ReadOnlyViewer.tsx
git commit -m "fix(viewer): normalize config + apply antialiasing in read-only viewer"
```

---

## Task 9: Normalize config on editor load

**Files:**
- Modify: `components/scenes/ExistingSceneEditor.tsx`

- [ ] **Step 1: Import and apply `normalizeConfig`**

In `components/scenes/ExistingSceneEditor.tsx`, change the store import to:

```ts
import { useStore, normalizeConfig } from '@/components/store';
```

Then change the load line inside the `useEffect`:

```ts
    rawSet({ config: normalizeConfig(scene.config) });
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/scenes/ExistingSceneEditor.tsx
git commit -m "fix(editor): normalize scene config on load (fills new defaults)"
```

> **Checkpoint — AA feature complete.** In the editor, the Render panel now has an antialiasing select that changes the final-render AA; saved scenes load with defaults filled. Verify live in Task 19.

---

## Task 10: Camera rotate + target gizmo

**Files:**
- Modify: `components/viewer/SceneIcons.tsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `components/viewer/SceneIcons.tsx` with:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, type Vec3 } from '../store';
import { reaimAfterRotation } from '@/lib/viewer/aim';

function CameraIcon({ id }: { id: string }) {
  const cam = useStore((s) => s.config.camera.cameras.find((c) => c.id === id));
  const active = useStore((s) => s.config.camera.active) === id;
  const selected = useStore((s) => s.selected) === `cam:${id}`;
  const mode = useStore((s) => s.aimGizmoMode);
  const setSelected = useStore((s) => s.setSelected);
  const [grp, setGrp] = useState<THREE.Group | null>(null);
  const [tgt, setTgt] = useState<THREE.Mesh | null>(null);
  const dragging = useRef(false);

  // store → camera body (skip during drag)
  useEffect(() => {
    if (!grp || dragging.current || !cam) return;
    grp.position.fromArray(cam.position);
    grp.lookAt(new THREE.Vector3(cam.target[0], cam.target[1], cam.target[2]));
  }, [grp, cam]);

  // store → target handle (skip during drag)
  useEffect(() => {
    if (!tgt || dragging.current || !cam) return;
    tgt.position.fromArray(cam.target);
  }, [tgt, cam]);

  if (!cam) return null;
  const color = selected ? '#4da3ff' : active ? '#74d18b' : '#9aa0ab';

  const writePos = () => {
    if (!grp) return;
    const cur = useStore.getState().config.camera.cameras.find((c) => c.id === id);
    if (!cur) return;
    useStore.getState().capturePreset(id, {
      position: grp.position.toArray() as Vec3,
      target: cur.target,
      fov: cur.fov,
    });
  };

  const writeRotate = () => {
    if (!grp) return;
    const cur = useStore.getState().config.camera.cameras.find((c) => c.id === id);
    if (!cur) return;
    const q = grp.quaternion;
    const target = reaimAfterRotation(cur.position, cur.target, [q.x, q.y, q.z, q.w]);
    useStore.getState().updateCamera(id, { target });
  };

  const writeTarget = () => {
    if (!tgt) return;
    useStore.getState().updateCamera(id, { target: tgt.position.toArray() as Vec3 });
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

      {/* Move / Rotate gizmo on the camera body */}
      {grp && selected && mode !== 'target' && (
        <TransformControls
          object={grp}
          mode={mode === 'rotate' ? 'rotate' : 'translate'}
          size={0.35}
          onMouseDown={() => (dragging.current = true)}
          onMouseUp={() => {
            dragging.current = false;
            if (mode === 'rotate') writeRotate();
            else writePos();
          }}
          onObjectChange={mode === 'rotate' ? writeRotate : writePos}
        />
      )}

      {/* Target handle + translate gizmo */}
      {selected && mode === 'target' && (
        <>
          <mesh ref={setTgt} position={cam.target}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#4da3ff" toneMapped={false} />
          </mesh>
          {tgt && (
            <TransformControls
              object={tgt}
              mode="translate"
              size={0.3}
              onMouseDown={() => (dragging.current = true)}
              onMouseUp={() => {
                dragging.current = false;
                writeTarget();
              }}
              onObjectChange={writeTarget}
            />
          )}
        </>
      )}
    </>
  );
}

export function SceneIcons() {
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

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/viewer/SceneIcons.tsx
git commit -m "feat(editor): camera rotate + target gizmo modes"
```

---

## Task 11: Camera gizmo-mode select in the inspector

**Files:**
- Modify: `components/ui/Inspector.tsx`

- [ ] **Step 1: Add the gizmo-mode control to `CameraControlsInner`**

In `components/ui/Inspector.tsx`, inside `CameraControlsInner`'s `useControls(`Camera: ${id}`, () => ({ … }))`, add a `tryb gizmo` entry as the **first** control (before `nazwa`):

```ts
      'tryb gizmo': {
        value: useStore.getState().aimGizmoMode,
        options: AIM_MODES,
        onChange: (v: AimGizmoMode) => useStore.getState().setAimGizmoMode(v),
      },
      nazwa: {
        value: cam.name,
        onChange: (v: string) => useStore.getState().renameCamera(id, v),
      },
```

(`AIM_MODES` and the `AimGizmoMode` type were added in Task 7.)

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Inspector.tsx
git commit -m "feat(inspector): camera gizmo-mode select (move/rotate/target)"
```

---

## Task 12: Light rotate + target gizmo

**Files:**
- Modify: `components/viewer/Gizmos.tsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `components/viewer/Gizmos.tsx` with:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, type Vec3 } from '../store';
import { reaimAfterRotation } from '@/lib/viewer/aim';

/**
 * Key-light marker in the editing viewport. Always clickable (select), and when
 * selected it shows a gizmo whose behaviour follows `aimGizmoMode`:
 * translate = move position, rotate = re-aim target, target = move the aim point.
 */
function LightGizmo() {
  const position = useStore((s) => s.config.keyLight.position);
  const target = useStore((s) => s.config.keyLight.target);
  const selected = useStore((s) => s.selected) === 'light';
  const mode = useStore((s) => s.aimGizmoMode);
  const setSelected = useStore((s) => s.setSelected);
  const setKeyLight = useStore((s) => s.setKeyLight);
  const [handle, setHandle] = useState<THREE.Mesh | null>(null);
  const [tgt, setTgt] = useState<THREE.Mesh | null>(null);
  const dragging = useRef(false);

  // store → light marker (position + orientation toward target)
  useEffect(() => {
    if (!handle || dragging.current) return;
    handle.position.fromArray(position);
    handle.lookAt(new THREE.Vector3(target[0], target[1], target[2]));
  }, [handle, position, target]);

  // store → target handle
  useEffect(() => {
    if (!tgt || dragging.current) return;
    tgt.position.fromArray(target);
  }, [tgt, target]);

  const writeMove = () => {
    if (!handle) return;
    setKeyLight({ position: handle.position.toArray() as Vec3 });
  };

  const writeRotate = () => {
    if (!handle) return;
    const cur = useStore.getState().config.keyLight;
    const q = handle.quaternion;
    const next = reaimAfterRotation(cur.position, cur.target, [q.x, q.y, q.z, q.w]);
    setKeyLight({ target: next });
  };

  const writeTarget = () => {
    if (!tgt) return;
    setKeyLight({ target: tgt.position.toArray() as Vec3 });
  };

  return (
    <>
      <mesh
        ref={setHandle}
        position={position}
        onClick={(e) => {
          e.stopPropagation();
          setSelected('light');
        }}
      >
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshBasicMaterial color={selected ? '#ffd23a' : '#b9962f'} toneMapped={false} />
      </mesh>

      {/* Move / Rotate gizmo on the light marker */}
      {handle && selected && mode !== 'target' && (
        <TransformControls
          object={handle}
          mode={mode === 'rotate' ? 'rotate' : 'translate'}
          size={0.4}
          onMouseDown={() => (dragging.current = true)}
          onMouseUp={() => {
            dragging.current = false;
            if (mode === 'rotate') writeRotate();
            else writeMove();
          }}
          onObjectChange={mode === 'rotate' ? writeRotate : writeMove}
        />
      )}

      {/* Target handle + translate gizmo */}
      {selected && mode === 'target' && (
        <>
          <mesh ref={setTgt} position={target}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#ffd23a" toneMapped={false} />
          </mesh>
          {tgt && (
            <TransformControls
              object={tgt}
              mode="translate"
              size={0.3}
              onMouseDown={() => (dragging.current = true)}
              onMouseUp={() => {
                dragging.current = false;
                writeTarget();
              }}
              onObjectChange={writeTarget}
            />
          )}
        </>
      )}
    </>
  );
}

export function Gizmos() {
  return <LightGizmo />;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/viewer/Gizmos.tsx
git commit -m "feat(editor): key-light rotate + target gizmo modes"
```

---

## Task 13: Aim the directional light at `keyLight.target`

**Files:**
- Modify: `components/viewer/Studio.tsx`
- Modify: `components/viewer/EditorView.tsx`

- [ ] **Step 1: Studio — give the directional light an explicit target**

In `components/viewer/Studio.tsx`, add `useEffect`, `useRef` to the React import:

```ts
import { useEffect, useMemo, useRef } from 'react';
```

Inside `Studio`, after the existing `const [sx, sy, sz] = useStore((s) => s.modelSize);` line, add:

```ts
  const keyTarget = useStore((s) => s.config.keyLight.target);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
    }
  }, []);
```

Then change the `<directionalLight …>` opening tag to add the ref:

```tsx
      <directionalLight
        ref={lightRef}
        position={key.position}
        intensity={key.intensity}
        color={key.color}
        castShadow={key.castShadow}
        shadow-mapSize={[key.shadowMapSize, key.shadowMapSize]}
        shadow-bias={key.shadowBias}
        shadow-normalBias={key.normalBias}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-frustum, frustum, frustum, -frustum, 0.1, frustum * 6 + 10]}
        />
      </directionalLight>

      {/* Aim point for the directional light (position → target). */}
      <object3D ref={targetRef} position={keyTarget} />
```

- [ ] **Step 2: EditorView — same target on the preview light**

In `components/viewer/EditorView.tsx`, add the needed imports. Change the React import to include hooks and add a THREE import below it:

```ts
import { Suspense, useEffect, useRef } from 'react';
```

Add near the other top imports (after the drei import):

```ts
import * as THREE from 'three';
```

Replace the `EditorLights` function with:

```tsx
function EditorLights() {
  const key = useStore((s) => s.config.keyLight);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
    }
  }, []);

  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#3a3d46', 0.6]} />
      <directionalLight
        ref={lightRef}
        position={key.position}
        intensity={Math.max(key.intensity, 0.6)}
        color={key.color}
      />
      <object3D ref={targetRef} position={key.target} />
    </>
  );
}
```

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add components/viewer/Studio.tsx components/viewer/EditorView.tsx
git commit -m "feat(viewer): aim directional light at keyLight.target"
```

---

## Task 14: Light gizmo-mode select + target X/Y/Z in the inspector

**Files:**
- Modify: `components/ui/Inspector.tsx`

- [ ] **Step 1: Replace the `LightControls` function**

In `components/ui/Inspector.tsx`, replace `LightControls` with:

```tsx
function LightControls() {
  const k = useStore.getState().config.keyLight;
  const [, set] = useControls('Key Light', () => ({
    'tryb gizmo': {
      value: useStore.getState().aimGizmoMode,
      options: AIM_MODES,
      onChange: (v: AimGizmoMode) => useStore.getState().setAimGizmoMode(v),
    },
    intensity: { value: k.intensity, min: 0, max: 3, step: 0.01, onChange: (v: number) => useStore.getState().setKeyLight({ intensity: v }) },
    color: { value: k.color, onChange: (v: string) => useStore.getState().setKeyLight({ color: v }) },
    pozycja: { value: k.position, step: 0.1, onChange: (v: [number, number, number]) => useStore.getState().setKeyLight({ position: v }) },
    target: { value: k.target, step: 0.1, onChange: (v: [number, number, number]) => useStore.getState().setKeyLight({ target: v }) },
    castShadow: { value: k.castShadow, onChange: (v: boolean) => useStore.getState().setKeyLight({ castShadow: v }) },
    shadowBias: { value: k.shadowBias, min: -0.001, max: 0.001, step: 0.00001, onChange: (v: number) => useStore.getState().setKeyLight({ shadowBias: v }) },
  }), []);

  // Store → leva (gizmo updates position/target).
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.config.keyLight === prev.config.keyLight) return;
        set({ pozycja: s.config.keyLight.position, target: s.config.keyLight.target });
      }),
    [set]
  );
  return null;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Inspector.tsx
git commit -m "feat(inspector): light gizmo-mode select + target X/Y/Z"
```

> **Checkpoint — rotate/target feature complete.** Verify gizmos live in Task 19.

---

## Task 15: Inline-SVG icon components

**Files:**
- Create: `components/ui/icons.tsx`

- [ ] **Step 1: Create the icons**

Create `components/ui/icons.tsx`:

```tsx
import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

/** Floppy disk — "Zapisz scenę". */
export function IconSave(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

/** Star — "Jako preset". */
export function IconPreset(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/** Chain link — "Link publiczny". */
export function IconLink(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/ui/icons.tsx
git commit -m "feat(ui): inline-SVG icons (save/preset/link)"
```

---

## Task 16: Header icon buttons

**Files:**
- Modify: `components/App.tsx`
- Modify: `components/styles.css`

- [ ] **Step 1: Add the `.icon-btn` style**

In `components/styles.css`, after the `.save-scene-btn:hover { … }` rule (around line 439), add:

```css
/* --- Icon buttons in editor-panel header --- */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: #1c1917;
  background: #ffcc33;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.icon-btn:hover { background: #f5c200; }
.icon-btn svg { width: 16px; height: 16px; }
```

- [ ] **Step 2: Import the icons in `App.tsx`**

In `components/App.tsx`, add after the `ShareDialog` import:

```ts
import { IconSave, IconPreset, IconLink } from './ui/icons';
```

- [ ] **Step 3: Replace the three header buttons with icon buttons**

In `components/App.tsx`, replace the `<div style={{ display: 'flex', gap: 6 }}>…</div>` block (the button group, currently lines ~53–82) with:

```tsx
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setSaveMode('scene')}
              className="icon-btn"
              title="Zapisz scenę"
              aria-label="Zapisz scenę"
            >
              <IconSave />
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setSaveMode('preset')}
                className="icon-btn"
                title="Zapisz jako preset"
                aria-label="Zapisz jako preset"
              >
                <IconPreset />
              </button>
            )}
            {sceneId && (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="icon-btn"
                title="Link publiczny / embed do tej sceny"
                aria-label="Link publiczny"
              >
                <IconLink />
              </button>
            )}
          </div>
```

- [ ] **Step 4: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add components/App.tsx components/styles.css
git commit -m "feat(editor): header action buttons -> compact icon buttons"
```

---

## Task 17: Scene-loading progress bar component

**Files:**
- Create: `components/viewer/SceneProgress.tsx`
- Modify: `components/styles.css`

- [ ] **Step 1: Create `SceneProgress.tsx`**

```tsx
'use client';
import { useProgress } from '@react-three/drei';

/**
 * Determinate scene-loading bar for the public share/embed pages. Reads drei's
 * global `useProgress` (fed by THREE.DefaultLoadingManager, which GLTFLoader and
 * RGBELoader report through). Rendered in the DOM, outside the Canvas. Hidden
 * when nothing is loading.
 */
export function SceneProgress() {
  const { active, progress } = useProgress();
  if (!active) return null;
  const pct = Math.round(progress);
  return (
    <div
      className="scene-progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="scene-progress__track">
        <div className="scene-progress__bar" style={{ width: `${progress}%` }} />
      </div>
      <span className="scene-progress__label">Ładowanie sceny… {pct}%</span>
    </div>
  );
}
```

- [ ] **Step 2: Add styles**

In `components/styles.css`, after the `.read-only-viewer-loading { … }` rule (around line 925), add:

```css
/* --- Scene loading progress bar (public share/embed) --- */
.scene-progress {
  position: absolute;
  left: 50%;
  bottom: 40px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: min(360px, 70vw);
  z-index: 10;
  font-family: Inter, system-ui, sans-serif;
  pointer-events: none;
}
.scene-progress__track {
  width: 100%;
  height: 4px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
  overflow: hidden;
}
.scene-progress__bar {
  height: 100%;
  background: var(--accent, #ffcc33);
  transition: width 0.15s linear;
}
.scene-progress__label {
  font-size: 12px;
  color: var(--muted, #6f747e);
}
```

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add components/viewer/SceneProgress.tsx components/styles.css
git commit -m "feat(viewer): determinate scene-loading progress bar component"
```

---

## Task 18: Mount the progress bar in the read-only viewer

**Files:**
- Modify: `components/viewer/ReadOnlyViewer.tsx`

- [ ] **Step 1: Import and mount `SceneProgress`**

In `components/viewer/ReadOnlyViewer.tsx`, add to the imports (next to the other viewer imports):

```ts
import { SceneProgress } from '@/components/viewer/SceneProgress';
```

Inside the returned `<div className="read-only-viewer">`, add `<SceneProgress />` right after `<Branding />`:

```tsx
    <div className="read-only-viewer">
      <Branding />
      <SceneProgress />

      <Canvas
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/viewer/ReadOnlyViewer.tsx
git commit -m "feat(viewer): show loading progress bar on share/embed pages"
```

---

## Task 19: Full verification (tests, build, live preview)

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit-test suite**

Run: `npm test`
Expected: all suites PASS (existing + `aim`, `antialiasing`, `normalizeConfig`, store).

- [ ] **Step 2: Typecheck + production build**

Run: `npx tsc --noEmit && npm run build`
Expected: typecheck clean; Next build completes with no errors.

- [ ] **Step 3: Live preview — editor gizmos**

Start the dev server (`preview_start`, or `npm run dev`). In the editor:
- Select a camera in the Outliner → in its inspector switch **tryb gizmo** between `translate` / `rotate` / `target`.
  - `rotate`: dragging the rotate gizmo re-aims the camera; the final view (active camera) follows live.
  - `target`: a blue handle appears at the look point; dragging it moves the target along X/Y/Z; numeric `target` inputs update.
- Select the **light** → repeat the three modes; confirm the directional light's lighting/shadows re-aim as the target moves, and `target` X/Y/Z inputs sync.
- Confirm HERO still has its own translate/rotate/scale gizmo (unchanged).

Verify the browser console shows no errors (`preview_console_logs`).

- [ ] **Step 4: Live preview — antialiasing**

In the Render panel, cycle **antialiasing**: `Wyłącz` → `FXAA` → `SMAA Low` → `SMAA Ultra`. Confirm edge quality changes in the final render and the console shows **no** WebGL framebuffer errors. Screenshot OFF vs SMAA Ultra (`preview_screenshot`).

- [ ] **Step 5: Live preview — header icons**

Confirm the header shows three yellow icon buttons (save / star / link), tooltips appear on hover, and clicking each still opens its dialog. `preview_screenshot` the header.

- [ ] **Step 6: Live preview — progress bar (external link)**

Open a saved scene's public link (`/s/<token>`) for a scene with a sizeable model. Confirm the bar advances 0→100% then disappears and the model renders. (If testing locally without a token, temporarily render `ReadOnlyViewer` against a known scene, or throttle the network in DevTools to observe the bar.)

- [ ] **Step 7: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "test: verify editor improvements (gizmos, AA, header, progress)"
```

---

## Done criteria

- All unit tests green; `tsc --noEmit` clean; `npm run build` succeeds.
- Cameras & lights have working move/rotate/target gizmo modes; rotating re-aims the target; the light visibly re-aims.
- Antialiasing select (Off/FXAA/SMAA Low–Ultra) changes the final render with no WebGL errors; saved per scene; old scenes load with `SMAA_MEDIUM` default and look unchanged.
- Header shows compact icon buttons with accessible names + tooltips.
- The external-link pages show a determinate loading bar while the model downloads.
