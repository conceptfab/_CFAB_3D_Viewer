# Editor Improvements — Rotation, Camera/Light Targets, Antialiasing, Header Icons, Loading Progress

**Date:** 2026-05-31
**Status:** Approved (design)

## Goal

Five independent-but-related improvements to the CFAB 3D Viewer editor and its
public (share/embed) renderer:

1. **Rotate gizmo** for cameras & lights in the editing viewport — rotating an
   object re-aims its look target (keeps the look-at model).
2. **Target editing** for cameras & lights — a new `target` gizmo mode plus
   numeric X/Y/Z inputs. Lights gain a real, editable target (today the key
   light always aims at the world origin).
3. **Antialiasing option** — a per-scene control: `Off / FXAA / SMAA (Low,
   Medium, High, Ultra)`, applied to the final/shared render.
4. **Header declutter** — the cramped `.editor-panel__title` action buttons
   (`Zapisz scenę` / `Jako preset` / `Link publiczny`) become compact inline-SVG
   icon buttons with tooltips.
5. **Scene-loading progress bar** — a determinate 0–100% bar on the external-link
   pages (`/s/[token]`, `/embed/[token]`) while the `.glb` (up to 1 GB) and HDRI
   download, replacing the blank `<Suspense fallback={null}>`.

## Background (current state)

- **State** lives in a Zustand store (`components/store.ts`) holding a single
  serializable `SceneConfig` plus editor-only UI state. `DEFAULT_CONFIG` is the
  source of truth for shape + defaults.
- **HERO null** (the model container, `components/viewer/Product.tsx`) already
  supports translate/rotate/scale via a global `gizmoMode` and numeric inputs.
  Rotation already works there — no change needed.
- **Cameras** (`CameraDef`) have `position`, `target`, `fov`. The camera icon
  (`components/viewer/SceneIcons.tsx`) orients via `lookAt(target)` and has a
  **translate-only** `TransformControls`. `target` is already numerically
  editable in the Inspector but has no viewport gizmo.
- **Key light** (`SceneConfig.keyLight`) has only `position` — **no target**.
  The `directionalLight` (`components/viewer/Studio.tsx`) therefore aims at the
  default target `[0,0,0]`. Its gizmo (`components/viewer/Gizmos.tsx`) is
  translate-only.
- **Antialiasing**: the final viewer (`components/viewer/Viewer.tsx`) and the
  read-only viewer (`components/viewer/ReadOnlyViewer.tsx`) render through
  `components/viewer/Postprocess.tsx`, which hardcodes `<SMAA />` (preset
  defaults to `SMAAPreset.MEDIUM`) with `multisampling={0}`. MSAA on the
  EffectComposer was deliberately removed (commit `3771325`) because it crashed
  WebGL (`glBlitFramebuffer: depth/stencil attachments cannot be the same
  image`). **MSAA stays off.** There is no UI control for AA today.
- **Config persistence**: scenes store `config` as opaque `jsonb`
  (`app/api/scenes/route.ts` validates it as `z.record(z.string(),
  z.unknown())`). So **new config fields need no API/schema change.**
- **Config load (editor)**: `components/scenes/ExistingSceneEditor.tsx` does
  `rawSet({ config: scene.config })` — a **full replace** with no merge against
  `DEFAULT_CONFIG`. Any field added after a scene was saved is therefore missing
  at load → latent runtime breakage. This must be fixed.
- **Config load (read-only)**: `ReadOnlyViewer.tsx` pushes config via per-section
  setters (`setEnv`, `setKeyLight`, …) which spread over defaults (mostly safe),
  but `camera` is full-replaced and there is no antialiasing application.
- **External-link loading**: `/s/[token]` and `/embed/[token]` mount
  `ReadOnlyViewerClient` (dynamic, `ssr:false`) whose `loading` fallback shows
  "Ładowanie sceny…" only until the JS chunk mounts. Once mounted, the Canvas
  shows but the model still downloads behind `<Suspense fallback={null}>` →
  blank scene. No `useProgress`/`Loader` is used anywhere.
- **Dependencies**: `@react-three/postprocessing@3.0.4` exports both `SMAA` and
  `FXAA` components (props pass through to the underlying effect, so
  `preset={SMAAPreset.X}` works). `postprocessing@6.39.1` exports
  `SMAAPreset = { LOW:0, MEDIUM:1, HIGH:2, ULTRA:3 }`. No icon library is
  installed and there is no existing inline-SVG usage → header icons will be
  hand-written inline SVG (no new dependency).

## Architecture

### Config additions (serialized in `SceneConfig`)

```ts
export type AntialiasingMode =
  | 'OFF' | 'FXAA'
  | 'SMAA_LOW' | 'SMAA_MEDIUM' | 'SMAA_HIGH' | 'SMAA_ULTRA';

// keyLight gains:
keyLight: { /* …existing… */ target: Vec3 };   // default [0, 0, 0]

// top-level:
antialiasing: AntialiasingMode;                  // default 'SMAA_MEDIUM'
```

- `keyLight.target` default `[0,0,0]` reproduces today's origin-aim exactly, so
  existing scenes look unchanged.
- `antialiasing` default `'SMAA_MEDIUM'` matches the current hardcoded `<SMAA/>`
  (whose default preset is `MEDIUM`), so existing scenes look unchanged.
- **Cameras** need no new field — they already carry `target`; rotation
  recomputes it.

### Editor-only store state (NOT serialized)

```ts
aimGizmoMode: 'translate' | 'rotate' | 'target';   // default 'translate'
setAimGizmoMode: (m) => void;
setAntialiasing: (mode: AntialiasingMode) => void;
```

- `aimGizmoMode` is separate from HERO's `gizmoMode` (which stays
  translate/rotate/scale). It is shared by camera + light panels because only one
  object is ever selected at a time. The mode persists across selection so a user
  who picks "rotate" keeps rotating as they click between cameras/lights — this
  is intentional and matches HERO's behavior.

### Backward-compat normalizer

```ts
export function normalizeConfig(raw: unknown): SceneConfig
```

A pure deep-merge of `raw` over `DEFAULT_CONFIG`:
- Scalars/arrays from `raw` win when present; missing keys fall back to default.
- Nested objects (`environment`, `keyLight`, `camera`, `camera.orbit`, `hero`,
  `branding`, `shadows`, `tone`, `material`, `background`) merge per-key.
- `camera.cameras` (array of `CameraDef`): each element merges over a `CameraDef`
  default so a camera saved without a future field still works; `target`/`fov`/
  `position` already exist in all saved scenes.
- The new `keyLight.target` and top-level `antialiasing` get their defaults when
  absent.

Wired into:
- `ExistingSceneEditor.tsx`: `rawSet({ config: normalizeConfig(scene.config) })`.
- `ReadOnlyViewer.tsx`: normalize once, then push (including
  `setAntialiasing(cfg.antialiasing)` and `setKeyLight(cfg.keyLight)` carrying
  the target).

### Pure aim math — `lib/viewer/aim.ts` (new)

```ts
// New target after rotating an object that previously looked from
// `position` toward `target`. Preserves look distance; clamps a minimum
// distance so position==target never yields NaN.
export function reaimAfterRotation(
  position: Vec3, target: Vec3, quaternion: [number, number, number, number]
): Vec3;

// AA mode -> postprocessing preset (pure, for Postprocess + tests).
export function smaaPresetFor(mode: AntialiasingMode): SMAAPreset | null;
```

`reaimAfterRotation`: distance `d = max(|target - position|, EPS)`; forward unit
vector = the object's local look axis (`-Z` for `lookAt`-oriented objects)
rotated by `quaternion`; new target = `position + forward * d`.

## Feature details

### Feature 1 + 2 — rotate & target gizmos (cameras & lights)

**Camera icon (`SceneIcons.tsx`)** — when the camera is selected, attach
`TransformControls` whose `mode` follows `aimGizmoMode`:
- `translate`: move the camera group, keep `target` (current behavior).
- `rotate`: gizmo on the camera group; `onObjectChange` → `reaimAfterRotation`
  from the group quaternion → write new `target` (position unchanged).
- `target`: render a small draggable handle (sphere) at `cam.target`; attach a
  translate `TransformControls` to it; `onObjectChange` → write `target`; the
  camera body re-aims via the existing `lookAt` effect.

During drag, suppress the store→handle sync (existing `dragging` ref pattern).

**Light gizmo (`Gizmos.tsx`)** — identical three modes for the key light, which
now has `keyLight.target`. The same handle/sphere approach for `target` mode.

**Light aiming (`Studio.tsx` + `EditorView.tsx`)** — give the `directionalLight`
an explicit `target` Object3D positioned at `keyLight.target` and added to the
scene (R3F: render a `<object3D>` at `keyLight.target`, set the light's `.target`
to it via ref, or use `<primitive>`). Applies to both the final-render light
(`Studio`) and the editor-preview light (`EditorView.EditorLights`).

**Inspector (`Inspector.tsx`)**:
- Camera panel (`CameraControlsInner`): add a `tryb gizmo` select bound to
  `aimGizmoMode` (`translate`/`rotate`/`target`). Target X/Y/Z inputs already
  exist.
- Light panel (`LightControls`): add the same `tryb gizmo` select **and** new
  `target` X/Y/Z numeric inputs (wired to `setKeyLight({ target })`), plus the
  store→leva subscription so gizmo edits reflect back into the panel.

### Feature 3 — antialiasing option

- `Postprocess.tsx` reads `config.antialiasing` and renders:
  - `OFF`: no AA effect (composer keeps `Exposure` + `ToneMapping`).
  - `FXAA`: `<FXAA/>`.
  - `SMAA_*`: `<SMAA preset={smaaPresetFor(mode)} />`.
  - `multisampling={0}` stays (MSAA remains off — the documented crash).
- `Inspector.tsx` `RenderControls`: add an `antialiasing` select with the six
  options, `onChange` → `setAntialiasing`.
- `ReadOnlyViewer.tsx`: call `setAntialiasing(cfg.antialiasing)` during init so
  share/embed honors the saved setting.
- Editor middle viewport (`EditorView.tsx`) keeps its own native
  `gl={{ antialias: true }}` and is unaffected — the AA option governs the
  final/shared render ("antialiasing w scenie").

### Feature 4 — header icon buttons

- New `components/ui/icons.tsx`: three small inline-SVG components — `IconSave`,
  `IconPreset`, `IconLink` (≈16px, `currentColor`, `aria-hidden`).
- `App.tsx`: replace the three text buttons in `.editor-panel__title` with icon
  buttons. Each button keeps `title` (tooltip) **and** `aria-label` with the
  original Polish text (`Zapisz scenę`, `Zapisz jako preset`, `Link publiczny`)
  so accessible names don't regress. The `Outliner` label and `← Sceny` link stay.
- `styles.css`: a `.icon-btn` rule (square, padded, same yellow accent on hover)
  replacing the wide `.save-scene-btn` footprint in the header. `.save-scene-btn`
  remains for the dialog/other uses.

### Feature 5 — scene-loading progress bar (external link)

- New `components/viewer/SceneProgress.tsx`: a **DOM** overlay (rendered outside
  the Canvas) using drei `useProgress()`. Shows a determinate bar driven by
  `progress` (0–100) plus a percent label; hides when `active` is false / progress
  reaches 100. Determinate because Vercel Blob serves `Content-Length`, so
  `GLTFLoader`/`RGBELoader` report `loaded/total` through
  `THREE.DefaultLoadingManager` (which `useProgress` observes).
- `ReadOnlyViewer.tsx`: mount `<SceneProgress />` in the `.read-only-viewer`
  container (over the Canvas). It covers both `/s/` and `/embed/` since both use
  this component.
- `styles.css`: `.scene-progress` overlay + `.scene-progress__bar` styles.
- Scope: external link only (per decision). The editor load path is out of scope.

## Data flow & persistence

- New config fields serialize automatically (config is opaque `jsonb`); **no
  changes** to `app/api/scenes/route.ts`, `[id]/route.ts`, `repo.ts`, or the
  Drizzle schema.
- `normalizeConfig` guarantees that scenes saved before this change load with the
  new defaults in both the editor and the read-only viewer.
- Saving re-serializes the full (normalized + edited) config, so a re-saved old
  scene gains the new fields persistently.

## Testing

Unit (Vitest, alongside `components/store.test.ts` & `lib/validation.test.ts`):
- `normalizeConfig`: a legacy config object missing `keyLight.target` and
  `antialiasing` → returns a full `SceneConfig` with defaults filled; present
  fields are preserved; nested partial objects merge correctly; missing
  `camera.cameras` falls back to defaults.
- `reaimAfterRotation`: identity quaternion returns the original target
  (within distance tolerance); a 90° yaw rotates the target around the position
  as expected; `position == target` returns a finite target (clamp).
- `smaaPresetFor`: maps each `SMAA_*` to the right `SMAAPreset`; returns `null`
  for `OFF`/`FXAA`.
- Store setters: `setAimGizmoMode`, `setAntialiasing`, and
  `setKeyLight({ target })` mutate config as expected.

Manual / preview verification:
- Editor: select a camera → switch Move/Rotate/Target; confirm rotate re-aims and
  target handle moves the look point; same for the light; numeric inputs sync.
- Render panel: cycle AA Off/FXAA/SMAA levels; confirm visible change and no
  WebGL errors in the console.
- Header: icon buttons render, tooltips show, actions still open the dialogs.
- External link: open `/s/<token>` for a scene with a large model; confirm the
  progress bar advances 0→100% then disappears and the model appears.

## Edge cases & risks

- **MSAA stays off** — do not reintroduce `multisampling > 0`; AA is purely
  post-process (FXAA/SMAA) to avoid the known framebuffer crash.
- **Zero look distance** (`position == target`) — `reaimAfterRotation` clamps a
  minimum distance to avoid NaN.
- **Drag/sync races** — reuse the existing `dragging` ref guard so store→handle
  sync is skipped mid-drag for the new gizmo modes and the target handle.
- **`useProgress` aggregates** the GLB **and** HDRI loads; the bar represents
  "scene loading" overall, which is the intended UX.
- **Accessibility** — icon buttons must carry `aria-label`; the AA/gizmo selects
  are standard leva controls (already accessible).
- **AA OFF** — keep the EffectComposer mounted with Exposure + ToneMapping so
  tone mapping/exposure still apply when AA is disabled.
