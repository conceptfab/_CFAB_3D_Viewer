# GLTF Scene Editor — Design (v1)

**Date:** 2026-05-29
**Status:** Approved (scope-level)
**Scope:** v1 — "Studio tuner" + wczytywanie modeli gltf

## Cel

Przekształcić obecny stały konfigurator mebli w **narzędzie autorskie**: wczytujesz
własny model gltf, stroisz kamerę / światło / scenę / materiały w panelu po stronie
renderera, a stan edytora jest od początku **serializowalny** — tak, by w przyszłości
wprost stał się plikiem konfiguracyjnym do osadzenia sceny na dowolnej stronie www.

**Świadomie odłożone na później:** format outputu / mechanizm osadzania (embed) oraz
przycisk eksportu configa. v1 nie buduje eksportu — buduje edytor, którego stan jest
gotowy, by eksport dorzucić jednym przyciskiem.

## Punkt wyjścia (istniejący kod)

Stack: React 18 + `@react-three/fiber` + `drei` + `postprocessing` + `zustand`, Vite/TS.
Istnieje wysokiej jakości pipeline studyjny:

- Tło: radialny gradient (`Studio.tsx` → `makeStudioBackground`, 4 stopnie koloru).
- IBL: 4K HDRI (`studio_small_03`), niewidoczne tło, `environmentIntensity`.
- Jedno delikatne światło kierunkowe (key) + PCSS soft shadows.
- Transparentny shadow-catcher + `ContactShadows`.
- Tone mapping Khronos Neutral + SMAA (`Postprocess.tsx`).
- Auto-fit/center modelu (`Product.tsx`), presety kamer z tweenem (`CameraRig.tsx`).

## Decyzje (z brainstormingu)

1. **UI edytora:** leva (już w zależnościach).
2. **Źródło modeli:** wczytywanie własnych plików (drag&drop / file input), lokalnie
   w przeglądarce przez `URL.createObjectURL`.
3. **Głębokość v1:** strojenie istniejącego studia (slidery na to, co już jest), bez
   add/remove świateł, bez per-mesh PBR, bez transformacji obiektów.
4. **Architektura stanu:** zustand = źródło prawdy, leva tylko jako warstwa kontrolek
   (panele inicjalizowane ze store'a, `onChange` → settery store'a; komponenty 3D
   czytają ze store'a). Stan zostaje serializowalny.

## Model stanu — `SceneConfig`

Jeden serializowalny obiekt w zustand (przyszły plik configa):

```
SceneConfig {
  environment: { hdriUrl: string, intensity: number }
  background:  { stops: [string, string, string, string], centerY: number }
  keyLight:    { position: [x,y,z], intensity: number, color: string,
                 castShadow: boolean, shadowMapSize: number,
                 shadowBias: number, normalBias: number }
  shadows:     { catcherOpacity: number, contactOpacity: number, contactBlur: number }
  tone:        { mode: 'NEUTRAL'|'ACES_FILMIC'|'AGX'|'REINHARD', exposure: number }
  material:    { envMapIntensity: number }        // globalny tweak na wszystkie meshe
  camera:      { fov: number, near: number, far: number,
                 orbit: { minDist, maxDist, minPolar, maxPolar, damping },
                 active: string,
                 presets: Record<string, { position: [x,y,z], target: [x,y,z] }> }
}
```

Osobno, **nieserializowane** (stan runtime, nie część configa):
`loadedModel { objectUrl: string, fileName: string }` + publikowany `modelSize`
(world-space, z auto-fit) jak obecnie.

Wartości domyślne `SceneConfig` przepisujemy 1:1 z dzisiejszych hardcode'ów, żeby
domyślna scena wyglądała identycznie jak teraz.

## Panel edytora (leva) — 5 folderów

Layout: po prawej stronie renderera (jak obecny sidebar).

- **📦 Model** — drop-zone nałożona na canvas + przycisk „Wczytaj plik"; nazwa
  wczytanego pliku.
- **📷 Kamera** — wybór aktywnego presetu (dropdown), `fov`, limity orbity
  (`minDist/maxDist/minPolar/maxPolar/damping`); przycisk **„Zapisz z aktualnego
  widoku"** — chwyta bieżącą pozycję + target z OrbitControls do aktywnego presetu
  (wygodniej niż ręczne wpisywanie wektorów).
- **💡 Światło** — `position`, `intensity`, `color`, `castShadow` on/off, `shadowBias`.
- **🌍 Scena** — 4 kolory gradientu tła + `centerY`, HDRI `intensity`, tone mapping
  (select) + `exposure`, krycie cieni (`catcherOpacity`, `contactOpacity`, `contactBlur`).
- **🎨 Materiał** — globalne `envMapIntensity`.

## Wczytywanie modelu

- Drag&drop pliku na canvas **lub** file input → `URL.createObjectURL(file)`.
- v1 celuje w **`.glb` (single-file)**. `.gltf` z zewnętrznym `.bin`/teksturami jest
  poza zakresem v1 (wymaga `LoadingManager` z mapowaniem URLi do blobów) — do zrobienia
  później.
- Po wczytaniu: auto-fit/center jak obecnie (`Product.tsx`), publikacja `modelSize`
  napędzającego shadow frustum / contact-AO.
- Przy braku wczytanego modelu: pusta scena studyjna (lub delikatny placeholder /
  instrukcja „przeciągnij .glb tutaj").

## Zmiany w istniejącym kodzie

- `store.ts` → przebudowa: `SceneConfig` (z setterami) + `loadedModel` + `modelSize`.
  Usunięcie katalogu `MODELS`, `MaterialId`/preset materiału jako wymiaru stanu.
- `Studio.tsx` → czyta `environment`, `background`, `keyLight`, `shadows` ze store'a
  zamiast hardcode. Regeneracja `CanvasTexture` tła przy zmianie `stops/centerY`.
  Parametry `SoftShadows` (size/samples/focus) zostają stałe w v1 (zmiana wymaga
  remountu) — strojone live tylko krycia cieni.
- `Postprocess.tsx` → tone mapping `mode` + `exposure` ze store'a.
- `CameraRig.tsx` → `fov`, limity orbity, presety ze store'a; funkcja „capture
  current view" zapisująca pozycję+target do aktywnego presetu.
- `Product.tsx` → ładowanie z `loadedModel.objectUrl` zamiast `MODELS`; globalny
  `envMapIntensity` ze store'a; bez ścieżki override z biblioteki materiałów.
- `Viewer.tsx` → usunięcie sondy-walca (exposure probe).
- `ui/Configurator.tsx` → zastąpione przez `ui/EditorPanel.tsx` (leva); stara siatka
  swatchy materiałów i lista modeli znikają.
- Nowe pliki: `ui/EditorPanel.tsx`, `viewer/ModelDropzone.tsx`.
- `viewer/materials/library.ts` → **pozostaje nietknięty** (nieużywany w v1), na
  wypadek powrotu do biblioteki presetów. `CircleFloor.tsx` — bez zmian (już nieużywany).

## Walidacja (ręczna)

1. Wczytaj `.glb` drag&drop oraz przez file input — model centruje się i fituje.
2. Każdy slider/kontrolka leva aktualizuje scenę na żywo.
3. Zmiana presetu kamery tweenuje; „Zapisz z aktualnego widoku" nadpisuje preset i
   ponowne wejście w preset wraca do zapisanego ujęcia.
4. Zmiana koloru gradientu tła regeneruje tło bez artefaktów.
5. Reload strony nie wywala aplikacji (domyślny `SceneConfig` = obecny wygląd).

## Poza zakresem v1 (jawnie)

- Format outputu / embed / przycisk eksportu configa.
- Dodawanie/usuwanie/typowanie świateł.
- Per-mesh selekcja i edycja PBR.
- Transformacje obiektów (gizmo), wiele modeli, hierarchia, zarządzanie teksturami.
- `.gltf` multi-file, presety materiałów z biblioteki.
- Persystencja stanu między sesjami.
