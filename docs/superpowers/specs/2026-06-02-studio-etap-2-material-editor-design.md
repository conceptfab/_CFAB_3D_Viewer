# Moduł „Studio" — Etap 2: edytor materiałów — Design

**Data:** 2026-06-02
**Status:** Zatwierdzony (poziom designu)
**Zakres:** Etap 2 modułu Studio (po Etapie 1: import/walidacja + persystencja + workspace). Nie-destrukcyjna edycja właściwości PBR materiałów wczytanego modelu.
**Zależności:** Etap 1 scalony do `main` (lib/gltf/*, components/studio/*, `StudioActor`, `materialOverrides` w `SceneConfig`).

## Cel

Pozwolić użytkownikowi w `/studio` edytować materiały wczytanego modelu glTF **nie-destrukcyjnie**: zmiany to warstwa nadpisań (`materialOverrides`) nakładana na oryginalne materiały przy renderowaniu, serializowana w configu projektu. Oryginalne źródło (glb/zip) i jego materiały/tekstury pozostają nietknięte; edycje round-trip'ują przez istniejący zapis/otwórz.

## Decyzje (z brainstormingu)

1. **Zakres v1: właściwości PBR (skalary + kolory), nie-destrukcyjnie.** Bez wymiany/uploadu tekstur, bez biblioteki/presetów materiałów, bez KTX2.
2. **Granularność: per-materiał** (per unikalna instancja materiału glTF), NIE per-mesh. Meshe współdzielące materiał edytują się razem.
3. **Zero zmian w DB/API/schema** — `materialOverrides` jest już częścią `SceneConfig` (Etap 1c), więc `studio_projects.config` (jsonb) już to round-trip'uje. Etap 2 = wyłącznie warstwa edycji + nakładania + UI.
4. **Rozbudowa istniejącego wzorca** (Outliner/Inspektor/leva/StudioActor), nie nowy system.

## Architektura

Rozszerzamy cztery miejsca:
- **`components/store.ts`** — finalny typ `MaterialOverride`; `materialOverrides: Record<string, MaterialOverride>` (zamiast `Record<string, unknown>`); settery `setMaterialOverride(key, patch)` i `resetMaterialOverride(key)`; runtime `studioMaterials: { key: string; name: string }[]` + `setStudioMaterials`.
- **`lib/studio/materials.ts`** (nowy, testowalny) — `applyOverride(material, override)` (nakłada obecne pola, pomija niewspierane przez dany typ materiału) oraz pomocnicy enumeracji/kluczy.
- **`components/studio/StudioActor.tsx`** — enumeruje unikalne materiały sklonowanej sceny, publikuje `studioMaterials`, i w efekcie reaguje na `config.materialOverrides` nakładając `applyOverride` na każdy materiał po kluczu.
- **`components/ui/Outliner.tsx`** + **`components/ui/Inspector.tsx`** — sekcja „Materiały" (lista, zaznaczenie `mat:<key>`) + panel `MaterialControls` (leva) z synchronizacją store↔leva (wzorzec jak istniejące panele).

## Tożsamość materiału

Po `loadFromFiles` mamy `THREE.Group`. Enumerujemy **unikalne instancje `THREE.Material`** w **deterministycznej kolejności obchodzenia sceny** (`traverse`), pomijając duplikaty (mesh-y współdzielące materiał). Każdy dostaje:
- `key` = indeks w tej liście (string, np. `"0"`, `"1"`),
- `name` = `material.name || "Materiał ${i}"`.

Kolejność jest stabilna dla danego źródła (ten sam parse glTF → ta sama kolejność meshy/materiałów), więc klucz jednoznacznie odwzorowuje materiał między sesjami (zapis→otwórz). Tablice materiałów na meshu (multi-material) liczą się jako osobne wpisy w kolejności.

## Model danych — `MaterialOverride`

```ts
interface MaterialOverride {
  color?: string;              // hex baseColor
  metalness?: number;          // 0..1
  roughness?: number;          // 0..1
  emissive?: string;           // hex
  emissiveIntensity?: number;  // 0..~5
  opacity?: number;            // 0..1
  transparent?: boolean;
  normalScale?: number;        // skalar → normalScale.set(s, s) (gdy jest normalMap)
  clearcoat?: number;          // 0..1 — tylko gdy materiał wspiera ('clearcoat' in mat)
  clearcoatRoughness?: number; // 0..1 — j.w.
}
```
`SceneConfig.materialOverrides: Record<string /*key*/, MaterialOverride>`. Pole istnieje od Etapu 1c (domyślnie `{}`); zmieniamy tylko jego typ z `Record<string, unknown>` na `Record<string, MaterialOverride>`. `normalizeConfig` (deep-merge) nadal działa.

## Nakładanie — `applyOverride`

`lib/studio/materials.ts`:
```ts
export function applyOverride(mat: THREE.Material, ov: MaterialOverride | undefined): void
```
- Dla każdego obecnego pola override ustawia odpowiednią właściwość na materiale (np. `mat.color.set(ov.color)`, `mat.metalness = ov.metalness`, `mat.emissive.set(...)`, `mat.opacity`, `mat.transparent`, `mat.normalScale.set(s,s)` jeśli `mat.normalMap`), tylko gdy materiał ma daną właściwość (`'metalness' in mat` itd.).
- `clearcoat`/`clearcoatRoughness` tylko gdy `'clearcoat' in mat` (MeshPhysicalMaterial).
- `mat.needsUpdate = true` po zmianach.
- Brak override (undefined) → no-op (materiał zostaje oryginalny).

**Reset / przywracanie oryginału (idempotentne nakładanie).** Ponieważ `applyOverride` mutuje sklonowany materiał, każde nakładanie musi liczyć się od oryginału (inaczej zmiana/usunięcie override dryfuje). Dwa dodatkowe czyste pomocniki w `lib/studio/materials.ts`:
```ts
export function snapshotMaterial(mat: THREE.Material): MaterialSnapshot
export function restoreMaterial(mat: THREE.Material, snap: MaterialSnapshot): void
```
`MaterialSnapshot` trzyma oryginalne wartości edytowalnych pól (kolor, metalness, roughness, emissive, emissiveIntensity, opacity, transparent, normalScale, clearcoat — tylko te, które materiał ma).

`StudioActor`: po sklonowaniu sceny buduje listę unikalnych materiałów (ta sama enumeracja co dla `studioMaterials`) i robi `snapshotMaterial` każdego. W `useEffect` zależnym od `config.materialOverrides` dla każdego materiału woła kolejno `restoreMaterial(mat, snap)` → `applyOverride(mat, overrides[key])`. Dzięki temu usunięcie klucza (reset) przywraca oryginał, a zmiana zawsze liczy się od oryginału — bez dryfu.

## UI

- **Outliner:** nowa sekcja „Materiały" (po „Obiekty"/aktorze), wiersze z `studioMaterials` → `setSelected('mat:<key>')`. Widoczna tylko gdy są materiały (model wczytany).
- **Inspector:** `MaterialControls` pokazywany gdy `selected` zaczyna się od `mat:`. Kontrolki leva: kolor, metalness, roughness, emissive, emissiveIntensity, opacity, transparent, normalScale, (clearcoat/clearcoatRoughness gdy wspierane) — `onChange` → `setMaterialOverride(key, {...})`. Przycisk **„Reset materiału"** → `resetMaterialOverride(key)`. Synchronizacja store→leva przy zmianie zaznaczenia (jak inne panele).
- Inicjalizacja kontrolek wartościami: override (jeśli jest) lub oryginał materiału (ze snapshotu).

## Testy

- **`lib/studio/materials.ts`** (TDD, node z mock-materiałem `{ color: {set}, metalness, ... }`): `applyOverride` ustawia obecne pola; pomija niewspierane (`clearcoat` na materiale bez clearcoat; `normalScale` bez normalMap); `transparent` razem z `opacity`; undefined → no-op; ustawia `needsUpdate`. `snapshotMaterial`→`restoreMaterial` round-trip przywraca oryginalne wartości; `restore`+`apply` od oryginału jest idempotentne (dwukrotne nałożenie tego samego override daje ten sam stan).
- **`components/store.ts`** (rozszerzenie store.test): `setMaterialOverride` merge'uje per klucz; `resetMaterialOverride` usuwa klucz; `materialOverrides` domyślnie `{}`.
- **Enumeracja/snapshot** — pomocnik czysty na liście (mesh→materiał) testowalny; obchodzenie THREE = weryfikacja w przeglądarce.
- **UI** (Outliner sekcja, MaterialControls, reset, na żywo) — weryfikacja w przeglądarce na realnym modelu z `_test`.

## Walidacja ręczna (akceptacja)

1. Wczytaj `_test/battlefield_4_-_t-90a/` → sekcja „Materiały" listuje materiały (27 wg glTF; nazwy jak `Gadget_IronFist`).
2. Zaznacz materiał → zmień `roughness`/`color` → zmiana widoczna na żywo w EDYCJA i RENDER.
3. „Reset materiału" → powrót do oryginału z glTF.
4. Zapisz projekt → otwórz ponownie (`/studio/[id]`) → override'y zachowane i nałożone.
5. Materiał współdzielony przez wiele meshy → edycja zmienia wszystkie.

## Poza zakresem v1 (jawnie)

Wymiana/upload tekstur i map · biblioteka/presety materiałów (`materials/library.ts` zostaje nieużyty) · KTX2/Basis · edycja per-mesh · animacje materiałów · eksport do GLB (osobny, wcześniej odłożony krok).
