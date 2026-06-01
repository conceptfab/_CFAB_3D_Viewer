# Moduł „Studio" — Etap 1: import multi-file glTF + workspace — Design

**Data:** 2026-06-01
**Status:** Zatwierdzony (poziom zakresu)
**Zakres:** Etap 1 z 2 — workspace (dual-view) + import/walidacja multi-file glTF + ustawianie sceny + import presetów + zapis edytowalnego źródła. **Etap 2 (osobny spec): edytor materiałów.**

## Cel

Dodać do aplikacji osobny moduł autorski do pracy z modelami glTF: wczytać własny
model (również **multi-file**: `.gltf` + `.bin` + tekstury), zwalidować go, ustawić
scenę (światło/HDRI/kamera/tone — reużycie istniejącego strojenia), opcjonalnie nałożyć
istniejący preset, i **zapisać tak, by dało się go dalej edytować** (plik i — w Etapie 2
— materiały). Format roboczy jest nie-destrukcyjny; GLB to dopiero **format eksportu**
(osobny, późniejszy krok).

## Decyzje (z brainstormingu)

1. **Sekwencja:** etapami. Etap 1 = workspace + import/walidacja + scena + presety;
   Etap 2 = edytor materiałów. Edytor materiałów wymaga wczytanego modelu, więc import
   jest na ścieżce krytycznej i idzie pierwszy.
2. **Widok:** jeden viewport z **przełącznikiem trybu EDYCJA ⟷ RENDER** (nie split,
   nie 3 stałe kolumny). Panel Outliner/Inspektor zostaje z boku.
3. **Zapis nie-destrukcyjny:** trzymamy **edytowalne źródło**; edycje materiałów (Etap 2)
   to serializowalna **warstwa override** w configu; **GLB = eksport** (nie format roboczy).
4. **Persystencja Etapu 1:** tylko źródło + config; **eksport do GLB i integracja
   z galerią/embed = osobny, późniejszy krok** (nie w Etapie 1).
5. **Źródło jako jeden artefakt:** multi-file → jeden `.zip`; pojedynczy `.glb` → `.glb`.
6. **Nowa tabela `studio_projects`** (nie rozszerzanie `scenes`) — izolacja od niezmienników
   galerii/embed/permissions/audytu.
7. **Trasa robocza `/studio`**; dostęp: zalogowani (jak `/editor`).
8. **Walidacja:** baseline (własny resolver/walidator) w Etapie 1; oficjalny Khronos
   `gltf-validator` (wasm) jako **fast-follow**.
9. **Polityka walidacji:** brak tekstury → wczytaj z placeholderem + ostrzeżenie; brak
   `.bin` / nie-parsowalne / wymagane niewspierane rozszerzenie / >limit → blokada.

## Punkt wyjścia (istniejący kod, reużywany)

- **Layout `/editor`** (`components/App.tsx`, `styles.css .layout`): render (lewa) |
  viewport edycyjny (środek) | Outliner+Inspektor (prawa).
- **Render PBR:** `viewer/Viewer.tsx`, `Studio.tsx` (IBL+tło), `Postprocess.tsx`,
  `CameraRig.tsx`, `CameraButtons`, `Branding`.
- **Viewport edycyjny:** `viewer/EditorView.tsx` (rzuty orto/persp, grid, gizmo, viewcube).
- **Model:** `viewer/Product.tsx` (`Actor` — auto-fit/center, dziś `useGLTF(url)`).
- **Stan:** `components/store.ts` — `SceneConfig` + settery (źródło prawdy).
- **Presety:** tabela `scenes` `is_preset=true`; `lib/scenes/repo.ts#listPresets()`
  (globalne dla zalogowanych); `config` = `SceneConfig`.
- **Loadery:** `useGLTF` (drei) — domyślnie **Draco + meshopt** (CDN), **bez KTX2/Basis**.
- **Limity/Blob:** `lib/blob/limits.ts` (`MAX_MODEL_BYTES = 1 GB`); upload klienta
  `scenes/uploadAssets.ts` (`@vercel/blob/client`, multipart); audyt `lib/scenes/blobAudit.ts`.

## 1. Workspace / shell

- Trasy: `app/studio/page.tsx` (nowy projekt), `app/studio/[id]/page.tsx` (otwarcie istniejącego).
- Layout: `[ viewport 3D z przełącznikiem ] [ panel boczny: Outliner + Inspektor ]`.
  Pasek nad viewportem: **EDYCJA / RENDER**, „Importuj model", „Wczytaj preset", zapis.
- **Przełącznik trybu:** oba canvasy montowane raz, przełączane **widocznością**
  (bez unmount → bez ponownego ładowania modelu). EDYCJA = treść `EditorView`;
  RENDER = treść `Viewer` (+ `CameraButtons`, `Branding`).
- Model wczytany raz; oba tryby czytają ten sam obiekt 3D / `objectUrl`.

## 2. Import + walidacja (serce Etapu 1)

Maszyna stanów: **drop/wybór → wirtualny FS → wykrycie roota → walidacja → raport →
(wczytaj | blokuj)**.

### 2a. Wejście (tolerancyjne)
- Folder drag&drop (`DataTransferItem.webkitGetAsEntry`, rekurencja katalogów).
- Picker `<input type="file" multiple webkitdirectory>` (ścieżki z `webkitRelativePath`).
- `.zip` (rozpakowanie w przeglądarce, `fflate`).
- Pojedynczy `.glb` — szybka ścieżka.
- Wynik: **wirtualny FS** `Map<ścieżka_względna_znormalizowana, Blob>`. Śmieci
  (`.DS_Store`, `__MACOSX/`, dotfiles) — klasyfikowane jako ignorowane, nie kasowane.

### 2b. Wykrycie roota
- Kandydaci = wszystkie `.gltf`/`.glb`. Jeden → auto. Wiele → `RootPicker` (wybór użytkownika).
- (Przypadki `_test`: battlefield = `scene.gltf`; firefly/caravan = `.glb` w `source/`,
  luźne tekstury obok = nadmiarowe/ignorowane.)

### 2c. Walidacja — `lib/gltf/validate.ts` (funkcja czysta)

| Reguła | Wynik |
|---|---|
| JSON nie parsuje się / zły nagłówek GLB | ❌ fatal |
| `asset.version` ≠ `2.0` | ❌ fatal |
| `extensionsRequired` zawiera niewspierane (np. `KHR_texture_basisu`) | ❌ fatal |
| brak referencjonowanego **bufora** (`scene.bin`) | ❌ fatal |
| suma bajtów referencji > `MAX_MODEL_BYTES` | ❌ fatal |
| brak referencjonowanej **tekstury** | ⚠️ warning (wczytaj z placeholderem; wskaż materiał/slot) |
| pliki obecne, nieużywane (license.txt, nadmiarowe tekstury, `Generated….jpeg`) | ℹ️ info (ignorowane) |
| Draco / meshopt | ✅ wspierane |

Zbieranie referencji: `buffers[].uri` + `images[].uri` (pomijamy `data:`), normalizacja
(`decodeURIComponent`, względem katalogu roota, porównanie case-insensitive, obsługa
prefiksu `textures/`). Wynik: `ValidationReport { fatal[], warnings[], info[], resolved[],
totalBytes, root }`.

### 2d. Raport (`components/studio/ImportReport.tsx`)
Lista: rozwiązane / brakujące (czerwone) / niewspierane / zignorowane (szare).
Same warning → „Wczytaj mimo to". Fatal → blokada + wyjaśnienie (styl `model-error`).

### 2e. Wczytanie — `lib/gltf/loadFromFiles.ts`
`GLTFLoader` + `LoadingManager.setURLModifier` mapujący każdy rozwiązany URI →
`URL.createObjectURL(blob)`; dorzucamy `DRACOLoader` + `MeshoptDecoder` (replikacja
domyślnych drei, bo omijamy `useGLTF`); `loader.load(rootObjectUrl)` → `scene` →
istniejący `Product`/`Actor` (auto-fit/center). Object URL-e zwalniane po wczytaniu.

## 3. Model danych (nie-destrukcyjny)

- **Źródło:** jeden artefakt — `.zip` (multi-file) lub `.glb` (pojedynczy).
- **Config:** istniejący `SceneConfig`. Dodajemy **teraz** do `DEFAULT_CONFIG` pole
  `materialOverrides` (domyślnie `{}`), klucz = indeks materiału glTF (stabilny dla
  niezmienionego źródła). Pełny kształt `MaterialOverride` dopina **Etap 2**;
  `normalizeConfig` (deep-merge nad `DEFAULT_CONFIG`) obsłuży stare rekordy bez migracji.
- **Materiały w Etapie 1:** model zachowuje własne materiały glTF (jak dziś `Actor`);
  edycja dopiero Etap 2.

## 4. Persystencja — tabela `studio_projects`

Nowa tabela (drizzle, wzór z `lib/scenes/schema.ts`):

```
studio_projects {
  id              text PK
  owner_id        text  NOT NULL   (idx)
  title           text  NOT NULL
  source_blob_url text  NOT NULL
  source_file_name text NOT NULL
  source_kind     text  NOT NULL   ('glb' | 'gltf-zip')
  config          jsonb NOT NULL   (SceneConfig)
  thumb_blob_url  text
  created_at      timestamptz NOT NULL default now()
  updated_at      timestamptz NOT NULL default now()
}
```

- **Repo** `lib/studio/repo.ts` — CRUD **owner-scoped** (wzór i testy z `scenes/repo`).
- **API** `app/api/studio/route.ts` (list/create), `app/api/studio/[id]/route.ts`
  (get/update/delete) — autoryzacja właściciela.
- **Upload źródła:** rozszerzenie `uploadAssets` o wariant artefaktu źródłowego pod
  prefiksem `sources/<uuid>.zip|.glb` (multipart dla dużych).
- **Miniatura:** `scenes/captureThumbnail.ts` (reużycie) → `thumbnails/<uuid>.png`,
  zapisana w `studio_projects.thumb_blob_url`.
- **Audyt blobów:** `lib/scenes/blobAudit.ts` uczy się prefiksu `sources/` i uzgadnia
  go z `studio_projects.source_blob_url` (inaczej zgłosi artefakty jako osierocone).
- **Eksport (późniejszy krok, nie Etap 1):** *promote* `studio_project` → `scene`
  z wygenerowanym `.glb` (+ wypalone `materialOverrides`).

## 5. Import presetów

`listPresets()` → `components/studio/PresetPicker.tsx` (tytuł + miniatura). Wybór wywołuje
nowe `applyPreset(config)` w store: nadpisuje **tylko ustawienia sceny**
(`environment`, `background`, `keyLight`, `shadows`, `tone`, `material`, `camera`,
`branding`) — **nie rusza** wczytanego modelu ani `materialOverrides`. Model presetu ignorowany.

## 6. Plan plików

**Logika (czysta, testowalna):**
- `lib/gltf/types.ts` — `VirtualFile`, `ValidationReport`, `LoadResult`.
- `lib/gltf/virtualFs.ts` (+test) — budowa VFS z drop/picker/zip; klasyfikacja śmieci;
  normalizacja ścieżek.
- `lib/gltf/validate.ts` (+test) — `ValidationReport` (pure).
- `lib/gltf/loadFromFiles.ts` — `GLTFLoader` + URI map + Draco/meshopt.
- `lib/studio/schema.ts` (+ migracja drizzle), `lib/studio/repo.ts` (+test, owner-scoped).

**API:** `app/api/studio/route.ts`, `app/api/studio/[id]/route.ts`.

**UI/trasy:** `app/studio/page.tsx`, `app/studio/[id]/page.tsx`; `components/studio/`:
`StudioShell`, `ViewToggle`, `AssetDropzone`, `ImportReport`, `RootPicker`, `PresetPicker`,
`useImportedModel`.

**Zmiany w istniejącym:** `store.ts` (+`materialOverrides` w `DEFAULT_CONFIG`, `applyPreset`,
stan importu), `lib/scenes/blobAudit.ts` (prefiks `sources/`), `scenes/uploadAssets.ts`
(wariant źródła). Nowa zależność: `fflate`.

## 7. Testy (TDD tam, gdzie się opłaca)

- `validate.ts` — fixture'y z `_test`: battlefield (1 bin + 15 tekstur OK; extras
  license.txt/.DS_Store), brakująca tekstura (warning), brak `.bin` (fatal), wymuszone
  KTX2-required (fatal), wersja≠2.0 (fatal). **Fixtures = `scene.gltf` (253 KB) +
  manifesty nazw plików — bez binariów; `_test/` poza repo.**
- `virtualFs.ts` — filtrowanie śmieci, normalizacja (spacje `caravane real.glb`,
  `@channels=B`), `webkitRelativePath`.
- `studio/repo.ts` — CRUD owner-scoped (wzór z `scenes/repo`).
- Loader + UI — lżej (integracyjnie/ręcznie; THREE/DOM).

## 8. Walidacja ręczna (kryteria akceptacji)

1. Drag&drop folderu `battlefield_4_-_t-90a/` → raport: 1 bufor + 15 tekstur rozwiązane,
   license.txt/.DS_Store jako zignorowane → model centruje się i fituje w obu trybach.
2. Folder firefly/caravan (`.glb` w `source/` + luźne tekstury) → root = `.glb`,
   tekstury luźne jako nadmiarowe → model wczytany (spacja w nazwie nie psuje).
3. `.zip` z tymi samymi danymi → identyczny wynik jak folder.
4. Usunięcie jednej tekstury z folderu → warning (placeholder), wczytanie możliwe.
5. Usunięcie `.bin` → blokada z wyjaśnieniem.
6. Przełącznik EDYCJA/RENDER nie przeładowuje modelu; RENDER pokazuje pełne PBR/IBL.
7. „Wczytaj preset" zmienia światło/tło/kamerę/tone, nie rusza modelu.
8. Zapis → rekord `studio_projects` + artefakt `sources/<uuid>`; ponowne otwarcie
   `/studio/[id]` odtwarza scenę i model (re-edytowalne).
9. Audyt blobów nie zgłasza świeżo zapisanego artefaktu źródłowego jako osieroconego.

## 9. Poza zakresem Etapu 1 (jawnie)

Edytor materiałów (Etap 2) · eksport do GLB + integracja z galerią/embed/share
(osobny krok) · KTX2/Basis · edycja siatki/geometrii · wiele modeli w jednej scenie ·
persystencja między sesjami inna niż `studio_projects`.
