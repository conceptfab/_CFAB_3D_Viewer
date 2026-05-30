# GLTF Scene Editor (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przekształcić stały konfigurator w edytor sceny gltf: wczytywanie własnego `.glb`, strojenie kamery/światła/sceny/materiału w panelu leva, ze stanem trzymanym w jednym serializowalnym storze (przyszły plik configa).

**Architecture:** Zustand `SceneConfig` = jedyne źródło prawdy; leva to warstwa kontrolek (`onChange` → settery storu). Komponenty R3F czytają parametry ze storu. Model ładowany z `URL.createObjectURL`.

**Tech Stack:** React 18, @react-three/fiber 8, drei 9.122, @react-three/postprocessing 2.19 (+ `postprocessing`), leva 0.9.36, zustand 5, three 0.169, Vite/TS, **vitest 2** (unit testy czystej logiki storu).

**Testowanie:** vitest pokrywa CZYSTĄ logikę (DEFAULT_CONFIG, settery storu, `replaceStop`). Komponenty R3F/leva — walidacja ręczna w dev serverze (Task 10). Każdy task: `npm test` (jeśli dotyczy) + `npx tsc -b` + commit.

**Branch:** `feature/gltf-scene-editor` (in place).

**Wartości domyślne (źródło — obecne hardcode'y):** env HDRI `studio_small_03_4k.hdr`/0.45; bg stops `['#eeeef1','#dcdce0','#c6c7cd','#b4b5bc']` offsety 0/0.5/0.85/1.0, centerY 0.44; keyLight pos `[-2.5,4,3]`, int 0.55, color `#ffffff`, castShadow true, mapSize 4096, bias -0.00012, normalBias 0.012; shadows catcher 0.3/contact 0.3/blur 2; tone NEUTRAL/exposure 1.0; material envMapIntensity 1.0; camera fov 28/near 0.05/far 80; orbit min1.2/max8/minPolar0.15/maxPolar π/2-0.05/damping0.08; presety: hero `[2.4,1.4,3.0]`→`[0,0.6,0]`, front `[0,0.9,3.2]`→`[0,0.6,0]`, side `[3.2,0.9,0.2]`→`[0,0.6,0]`, top `[0.1,3.6,0.1]`→`[0,0,0]`, detail `[1.3,0.7,1.3]`→`[0,0.6,0]`.

---

## File Structure

- `src/store.ts` — **rewrite**: `SceneConfig`, `DEFAULT_CONFIG`, `replaceStop`, settery, `loadedModel`, `modelSize`, `cameraApi`.
- `src/store.test.ts` — **create**: vitest dla DEFAULT_CONFIG + settery + `replaceStop`.
- `src/scene/exposureEffect.ts` — **create**: `ExposureEffect` (mnożnik przed tone mappingiem).
- `src/viewer/Product.tsx` — **rewrite**: render wczytanego modelu, envMapIntensity ze storu.
- `src/viewer/ModelDropzone.tsx` — **create**: drag&drop (window) + ukryty input + `window.__openModelPicker`.
- `src/viewer/Studio.tsx` — **modify**: env/bg/keyLight/shadows ze storu.
- `src/viewer/Postprocess.tsx` — **modify**: tone mode + ExposureEffect.
- `src/viewer/CameraRig.tsx` — **rewrite**: fov/orbit/presety ze storu + `cameraApi`.
- `src/viewer/Viewer.tsx` — **modify**: usunięcie sondy; Canvas z DEFAULT_CONFIG.
- `src/ui/EditorPanel.tsx` — **create**: panel leva (Model/Kamera/Światło/Scena/Materiał).
- `src/ui/Configurator.tsx` — **delete**.
- `src/App.tsx` — **modify**: EditorPanel + ModelDropzone + Leva.
- `src/styles.css` — **modify**: fullscreen + drop-zone.
- Bez zmian: `src/viewer/materials/library.ts`, `src/viewer/CircleFloor.tsx`.

---

## Task 1: Store `SceneConfig` + testy (TDD)

**Files:** Rewrite `src/store.ts`; Create `src/store.test.ts`.

- [ ] **Step 1: Napisz `src/store.test.ts` (failing)** — testy importują `DEFAULT_CONFIG`, `useStore`, `replaceStop` ze `./store`:
  - `DEFAULT_CONFIG.tone.mode === 'NEUTRAL'`; `Object.keys(DEFAULT_CONFIG.camera.presets)` zawiera 5 nazw.
  - `setKeyLight({intensity:1})` zmienia `config.keyLight.intensity` na 1, nie ruszając `position`.
  - `setOrbit({minDist:2})` zmienia tylko `config.camera.orbit.minDist`.
  - `capturePreset('hero',{position:[1,2,3],target:[0,0,0]})` nadpisuje preset hero.
  - `replaceStop(['a','b','c','d'],2,'X')` → `['a','b','X','d']` (czysta funkcja, bez mutacji wejścia).
- [ ] **Step 2:** `npm test` → FAIL (brak eksportów).
- [ ] **Step 3:** Zaimplementuj `src/store.ts` (typy + DEFAULT_CONFIG + `replaceStop` + settery wg sekcji "File Structure" i wartości domyślnych). Settery: `setEnv/setBackground/setKeyLight/setShadows/setTone/setMaterial/setCamera/setOrbit/capturePreset/setLoadedModel/setModelSize/registerCameraApi`. `replaceStop(stops,i,v)` zwraca nową krotkę.
- [ ] **Step 4:** `npm test` → PASS; `npx tsc -b` → bez błędów w `store.ts` (błędy w starych plikach OK).
- [ ] **Step 5:** Commit `feat(store): serializable SceneConfig + unit tests`.

## Task 2: `ExposureEffect`

**Files:** Create `src/scene/exposureEffect.ts`. Klasa `Effect` z uniformem `exposure`, fragment mnoży `inputColor.rgb * exposure`. (Zweryfikowano: `postprocessing` ToneMappingEffect nie ma uniformu ekspozycji → własny efekt PRZED `<ToneMapping/>`.) Verify: `npx tsc -b`. Commit.

## Task 3: `Postprocess` — tone + exposure ze storu

**Files:** Modify `src/viewer/Postprocess.tsx`. Map `ToneMode`→`ToneMappingMode`; `<Exposure value={exposure}/>` (useMemo + `<primitive>`) PRZED `<ToneMapping mode/>` + `<SMAA/>`. Verify tsc. Commit.

## Task 4: `Studio` — env/bg/keyLight/shadows ze storu

**Files:** Modify `src/viewer/Studio.tsx`. `makeStudioBackground(stops,centerY)` regenerowane useMemo po wartościach stops/centerY; directionalLight i shadowMaterial/ContactShadows czytają ze storu. Verify tsc. Commit.

## Task 5: `CameraRig` — fov/orbit/presety + cameraApi

**Files:** Rewrite `src/viewer/CameraRig.tsx`. fov/near/far live (`updateProjectionMatrix`); OrbitControls limity ze storu; tween na zmianę `active`/`presets`; `registerCameraApi({getView})`. Verify tsc. Commit.

## Task 6: `Product` + `ModelDropzone` — wczytywanie `.glb`

**Files:** Rewrite `src/viewer/Product.tsx` (loader `key={objectUrl}`, auto-fit targetHeight 1.4, envMapIntensity live, anisotropy 16); Create `src/viewer/ModelDropzone.tsx` (window drag&drop, `.glb` only z alertem, revoke poprzedniego URL, `window.__openModelPicker`). Verify tsc. Commit.

## Task 7: `Viewer` cleanup

**Files:** Modify `src/viewer/Viewer.tsx`. Usuń sondę-walec; Canvas camera fov/near/far z `DEFAULT_CONFIG.camera`. Verify tsc. Commit.

## Task 8: `EditorPanel` + `App` + usuń `Configurator`

**Files:** Create `src/ui/EditorPanel.tsx` (leva foldery; `onChange`→`useStore.getState().setX`; przycisk "Wczytaj plik"→`window.__openModelPicker`; "Zapisz z aktualnego widoku"→`cameraApi.getView()`+`capturePreset`; gradient przez `replaceStop`); Delete `src/ui/Configurator.tsx`; Modify `src/App.tsx` (Viewer+ModelDropzone+EditorPanel+`<Leva/>`, HUD z nazwą pliku). Verify `npx tsc -b` PASS. Commit.

## Task 9: Style

**Files:** Modify `src/styles.css`. `#root{display:block}`; `.viewer{100vw/100vh}`; `.dropzone`(pointer-events:none, inset:0), `.dropzone--active`, `.dropzone-hint`. Verify tsc. Commit.

## Task 10: Walidacja

- [ ] `npm test` → PASS; `npm run build` → bez błędów.
- [ ] `npm run dev`: (1) start bez modelu = studio + hint + panel leva; (2) wczytaj `.glb` przyciskiem i drag&drop = fit/center, HUD pokazuje nazwę; (3) podmiana modelu zwalnia URL; (4) Scena: kolory tła/centerY live; (5) hdriIntensity/exposure/tone widocznie zmieniają obraz (exposure = dowód działania ExposureEffect); (6) Światło live; (7) krycia/blur cieni live; (8) preset tween, fov/limity orbity live; (9) "Zapisz z aktualnego widoku" zapamiętuje ujęcie; (10) reload czysty; (11) envMapIntensity live na modelu.
- [ ] Ewentualne poprawki + commit.

---

## Self-Review
- **Pokrycie spec:** store (T1) ✓ + testy ✓; .glb drag&drop+input (T6,T9) ✓; panel leva 5 folderów (T8) ✓; kamera presety/fov/orbit/zapis widoku (T5,T8) ✓; światło (T4,T8) ✓; scena tło/HDRI/tone/exposure/cienie (T3,T4,T8) ✓; materiał envMapIntensity (T6,T8) ✓; usunięcie sondy/MODELS/Configurator (T1,T7,T8) ✓; library.ts/CircleFloor nietknięte ✓.
- **Spójność typów:** settery zdefiniowane w T1, wołane tymi nazwami w T3–T8; `ToneMode` spójny; `cameraApi.getView()` (T5) ↔ użycie (T8); `replaceStop` (T1) ↔ użycie (T8).
- **Ryzyka rozbrojone:** exposure = własny `ExposureEffect` (zweryfikowany brak uniformu w postprocessing); drag&drop na `window` (nie blokuje orbity); `key={objectUrl}` = czysty remount loadera.
