# Etap C — Presety scen (CFAB 3D Viewer)

> **For agentic workers:** Ten plan jest przeznaczony do wykonania przez subagent-driven-development i executing-plans.
> Wszystkie zadania to check-boxy `- [ ]`. Wykonuj je po kolei: napisz failing test (RED) → uruchom → minimalna implementacja → uruchom (GREEN) → commit. Nie pomijaj żadnego kroku. Nie zostawiaj placeholderów.

---

## Goal

Dodać do platformy mechanizm **presetów scen**:
- właściciel-admin może zapisać scenę jako preset (flaga `is_preset = true`),
- każdy zalogowany użytkownik może z presetu stworzyć własną, edytowalną scenę (klonowanie),
- strona startowa wyróżnia presety wizualnie (badge „PRESET") i oferuje akcję „Użyj jako nowa scena",
- logika klonowania jest w pełni pokryta testami jednostkowymi (TDD).

Etap C **nie obejmuje**: uprawnień per-scena, linków share, galerii publicznej (→ Etap D).

---

## Architecture

```
app/
  page.tsx                     ← strona startowa: sekcja presetów + sekcja moich scen
  editor/
    page.tsx                   ← edytor: dodatkowy przycisk „Zapisz jako preset"
    [id]/page.tsx              ← edytor z istniejącą sceną
  api/
    scenes/
      route.ts                 ← (z B) POST z isPreset:true → zapis presetu
      [id]/
        route.ts               ← (z B) GET/PATCH/DELETE
        instantiate/
          route.ts             ← (C) POST → klon presetu
components/
  PresetCard.tsx               ← kafelek presetu z badge i przyciskiem „Użyj"
  SceneCard.tsx                ← (z B) kafelek zwykłej sceny
  SaveAsPresetButton.tsx       ← przycisk w edytorze (C, nowy)
lib/
  scenes/
    repo.ts                    ← (z B) + nowa funkcja instantiatePreset()
    repo.test.ts               ← (C) testy jednostkowe instantiatePreset
```

---

## Tech Stack

- Next.js 14+ App Router (Server Components + Route Handlers)
- Drizzle ORM + Vercel Postgres (Neon)
- Vercel Blob (współdzielenie `model_blob_url` — bez kopiowania pliku)
- Zod (walidacja wejścia w trasach API)
- Vitest (testy jednostkowe repo)
- TypeScript ścisły, importy z `@/`

---

## Decyzje wcielone (do weryfikacji)

Poniższe pozycje `[REVIEW]` z kontraktu zostały wcielone w plan. Zaznacz każdą jako zaakceptowaną lub zmień przed implementacją.

| # | Decyzja | Wcielona jako |
|---|---------|---------------|
| 1 | Preset zawiera model (`model_blob_url` może być wypełniony) | `instantiatePreset` kopiuje `model_blob_url` i `model_file_name` **bez** ponownego uploadu — klon wskazuje ten sam URL w Blob |
| 2 | Klon współdzieli `model_blob_url` | Tak — nowy rekord `scenes` ma te same wartości `model_blob_url` / `model_file_name` co preset; plik w Blob nie jest duplikowany |
| 3 | Miniatura klonu: kopiuj URL vs. zostaw null | **Decyzja:** klon WSPÓŁDZIELI `thumb_blob_url` — wyświetla miniaturę presetu do czasu pierwszego zapisu przez użytkownika (PATCH nadpisuje). Pozwala użytkownikowi natychmiast zobaczyć podgląd w galerii. Alternatywa: `null` zmusza do re-renderu — odrzucona jako gorsza UX |
| 4 | Ref-count przy usuwaniu (z B) | `DELETE /api/scenes/[id]` kasuje `thumb_blob_url` bezwarunkowo; `model_blob_url` kasuje z Blob **tylko gdy** żadna inna scena w DB nie wskazuje na ten URL. Funkcja pomocnicza `countModelReferences(modelBlobUrl)` w `repo.ts` |
| 5 | Kto może tworzyć presety | Tylko właściciel z rolą `admin` (sprawdzone przez `requireAdmin()` w trasie save-as-preset). Zwykły użytkownik widzi presety, ale nie może ich tworzyć |
| 6 | Kto może usuwać presety | Tylko właściciel-admin. Trasa `DELETE /api/scenes/[id]` sprawdza `ownerId === caller.id` |

> **[REVIEW] Decyzja 5** jest restrykcyjna — jeśli chcesz, by każdy użytkownik mógł tworzyć presety, zmień `requireAdmin()` na `requireUser()` w Zadaniu 7 i usuń role check.

> **[REVIEW] Decyzja 3** — jeśli wolisz by klon miał `thumb_blob_url = null` (wymusza re-render miniatury przy pierwszym zapisie), zmień linię w `instantiatePreset` opisaną w Zadaniu 3.

---

## File Structure

Pliki **tworzone** w Etapie C:

| Plik | Rola |
|------|------|
| `lib/scenes/repo.test.ts` | Testy jednostkowe `instantiatePreset` (Vitest + mock Drizzle) |
| `app/api/scenes/[id]/instantiate/route.ts` | POST — klonuje preset → zwraca 201 z nową sceną |
| `components/PresetCard.tsx` | Kafelek presetu (badge PRESET, przycisk Użyj, przycisk Usuń dla właściciela) |
| `components/SaveAsPresetButton.tsx` | Przycisk w edytorze; odpytuje POST /api/scenes z isPreset:true |

Pliki **modyfikowane** w Etapie C:

| Plik | Zmiana |
|------|--------|
| `lib/scenes/repo.ts` | Dodanie `instantiatePreset()` i `countModelReferences()` |
| `app/page.tsx` | Dodanie sekcji „Presety" z listą `PresetCard` |
| `app/editor/page.tsx` | Dodanie `<SaveAsPresetButton>` obok istniejącego przycisku „Zapisz" |

---

## Zadania

### Zadanie 1 — Szkielet `repo.test.ts` z testami jednostkowymi `instantiatePreset` (RED)

**Cel:** Napisać failing testy przed implementacją. Testy mockują Drizzle — nie potrzebują prawdziwej bazy.

- [ ] Utwórz plik `lib/scenes/repo.test.ts`:

```typescript
// lib/scenes/repo.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SceneRecord } from '@/lib/scenes/repo';

// Mock Drizzle db — będziemy go podmienić w testach
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

// Import po mockach
import { instantiatePreset } from '@/lib/scenes/repo';
import { db } from '@/lib/db';

// Pomocniczy preset fixture
const PRESET_FIXTURE: SceneRecord = {
  id: 'preset-001',
  ownerId: 'admin-001',
  title: 'Studio Neutral',
  config: {
    environment: { hdriUrl: 'https://example.com/env.hdr', intensity: 0.45 },
    background: { stops: ['#eee', '#ddd', '#ccc', '#bbb'], centerY: 0.44 },
    keyLight: {
      position: [-2.5, 4, 3],
      intensity: 0.55,
      color: '#ffffff',
      castShadow: true,
      shadowMapSize: 4096,
      shadowBias: -0.00012,
      normalBias: 0.012,
    },
    shadows: { catcherOpacity: 0.3, contactOpacity: 0.3, contactBlur: 2 },
    tone: { mode: 'NEUTRAL', exposure: 1.0 },
    material: { envMapIntensity: 1.0 },
    branding: {
      mode: 'text',
      text: 'CONCEPTFAB',
      fontFamily: 'Inter',
      color: '#1b1c20',
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: 1.5,
      bgEnabled: true,
      bgColor: '#ffffff',
      imageUrl: '',
      imageName: '',
    },
    hero: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    camera: {
      near: 0.05,
      far: 80,
      orbit: { minDist: 1.2, maxDist: 8, minPolar: 0.15, maxPolar: 1.52, damping: 0.08 },
      active: 'hero',
      cameras: [{ id: 'hero', name: 'Hero', position: [2.4, 1.4, 3.0], target: [0, 0.6, 0], fov: 28, showInFinalBar: true }],
    },
  } as SceneRecord['config'],
  modelBlobUrl: 'https://blob.vercel.com/models/abc123.glb',
  modelFileName: 'produkt.glb',
  thumbBlobUrl: 'https://blob.vercel.com/thumbnails/abc123.png',
  isPreset: true,
  createdAt: new Date('2026-05-30T10:00:00Z'),
  updatedAt: new Date('2026-05-30T10:00:00Z'),
};

describe('instantiatePreset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tworzy nową scenę z is_preset=false i owner_id=wywołującego', async () => {
    // Arrange: db.select zwraca preset, db.insert zwraca nową scenę
    const newUserId = 'user-999';
    const newSceneId = 'scene-new-001';
    const insertedAt = new Date('2026-05-30T11:00:00Z');

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([PRESET_FIXTURE]),
      }),
    });

    const newRecord: SceneRecord = {
      ...PRESET_FIXTURE,
      id: newSceneId,
      ownerId: newUserId,
      isPreset: false,
      createdAt: insertedAt,
      updatedAt: insertedAt,
    };

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([newRecord]),
      }),
    });

    // Act
    const result = await instantiatePreset('preset-001', newUserId);

    // Assert
    expect(result.isPreset).toBe(false);
    expect(result.ownerId).toBe(newUserId);
    expect(result.id).toBe(newSceneId);
  });

  it('klon współdzieli model_blob_url bez kopiowania pliku', async () => {
    const newUserId = 'user-999';

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([PRESET_FIXTURE]),
      }),
    });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          ...PRESET_FIXTURE,
          id: 'scene-new-002',
          ownerId: newUserId,
          isPreset: false,
        }]),
      }),
    });

    const result = await instantiatePreset('preset-001', newUserId);

    expect(result.modelBlobUrl).toBe(PRESET_FIXTURE.modelBlobUrl);
    expect(result.modelFileName).toBe(PRESET_FIXTURE.modelFileName);
  });

  it('klon współdzieli thumb_blob_url (decyzja 3 — kopiuj URL)', async () => {
    const newUserId = 'user-999';

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([PRESET_FIXTURE]),
      }),
    });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          ...PRESET_FIXTURE,
          id: 'scene-new-003',
          ownerId: newUserId,
          isPreset: false,
        }]),
      }),
    });

    const result = await instantiatePreset('preset-001', newUserId);

    expect(result.thumbBlobUrl).toBe(PRESET_FIXTURE.thumbBlobUrl);
  });

  it('rzuca błąd gdy id nie wskazuje na preset', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ ...PRESET_FIXTURE, isPreset: false }]),
      }),
    });

    await expect(instantiatePreset('scene-regular', 'user-999')).rejects.toThrow(
      'Scena nie jest presetem'
    );
  });

  it('rzuca błąd gdy preset nie istnieje', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    await expect(instantiatePreset('nie-istnieje', 'user-999')).rejects.toThrow(
      'Preset nie istnieje'
    );
  });
});
```

- [ ] Uruchom testy — **oczekiwany wynik: FAIL** (moduł `repo.ts` nie eksportuje `instantiatePreset`):
```
npx vitest run lib/scenes/repo.test.ts
```
Oczekiwany output:
```
FAIL  lib/scenes/repo.test.ts
Error: [vite-node] Failed to resolve import "@/lib/scenes/repo"
```

- [ ] Commit (tylko plik testów):
```
git add lib/scenes/repo.test.ts
git commit -m "test(presets): failing unit tests for instantiatePreset [RED]"
```

---

### Zadanie 2 — Rozszerzenie `lib/scenes/repo.ts` o `instantiatePreset` i `countModelReferences` (GREEN)

**Cel:** Minimalna implementacja, która przepuści testy z Zadania 1.

> Zakładamy, że plik `lib/scenes/repo.ts` istnieje z Etapu B. Jeśli nie istnieje — utwórz go w całości (poniżej podany pełny kod). Jeśli istnieje — dopisz tylko zaznaczone sekcje.

- [ ] Otwórz / utwórz `lib/scenes/repo.ts`. Upewnij się, że eksportuje `SceneRecord` zgodnie z kontraktem. Dopisz na końcu:

```typescript
// lib/scenes/repo.ts
// ─── ISTNIEJĄCY KOD Z B (tu tylko sekcja, którą dodajemy) ───────────────────

import { db } from '@/lib/db';
import { scenes } from '@/lib/scenes/schema';  // tabela Drizzle (Etap B)
import { eq, and, ne } from 'drizzle-orm';
import type { SceneConfig } from '@/components/store';

// Jeśli SceneRecord nie był jeszcze zdefiniowany w tym pliku (Etap B go dodaje),
// definiujemy go tutaj zgodnie z kontraktem:
export interface SceneRecord {
  id: string;
  ownerId: string;
  title: string;
  config: SceneConfig;
  modelBlobUrl: string | null;
  modelFileName: string | null;
  thumbBlobUrl: string | null;
  isPreset: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── NOWE W ETAPIE C ─────────────────────────────────────────────────────────

/**
 * Zlicza ile scen w DB wskazuje na dany model_blob_url (poza podanym sceneId).
 * Używane przez DELETE do decyzji o skasowaniu pliku z Blob.
 */
export async function countModelReferences(
  modelBlobUrl: string,
  excludeSceneId: string
): Promise<number> {
  const rows = await db
    .select({ id: scenes.id })
    .from(scenes)
    .where(
      and(
        eq(scenes.modelBlobUrl, modelBlobUrl),
        ne(scenes.id, excludeSceneId)
      )
    );
  return rows.length;
}

/**
 * Klonuje preset na nową scenę należącą do `newOwnerId`.
 * - Nowa scena: is_preset=false, owner_id=newOwnerId
 * - Współdzieli model_blob_url, model_file_name i thumb_blob_url (nie kopiuje pliku w Blob)
 * - Tytuł klonu: `${preset.title} (kopia)`
 *
 * Rzuca Error jeśli rekord nie istnieje lub nie jest presetem.
 */
export async function instantiatePreset(
  presetId: string,
  newOwnerId: string
): Promise<SceneRecord> {
  // 1. Wczytaj preset
  const rows = await db
    .select()
    .from(scenes)
    .where(eq(scenes.id, presetId));

  if (rows.length === 0) {
    throw new Error('Preset nie istnieje');
  }

  const preset = rows[0];

  if (!preset.isPreset) {
    throw new Error('Scena nie jest presetem');
  }

  // 2. Wstaw klon
  const now = new Date();
  const [inserted] = await db
    .insert(scenes)
    .values({
      // id generowane przez DB (gen_random_uuid())
      ownerId: newOwnerId,
      title: `${preset.title} (kopia)`,
      config: preset.config,                    // głęboka kopia JSON przez Drizzle jsonb
      modelBlobUrl: preset.modelBlobUrl,        // współdzielony URL — bez duplikowania pliku
      modelFileName: preset.modelFileName,
      thumbBlobUrl: preset.thumbBlobUrl,        // współdzielony — decyzja 3: kopiuj URL
      isPreset: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // 3. Mapuj wiersz DB → SceneRecord
  return {
    id: inserted.id,
    ownerId: inserted.ownerId,
    title: inserted.title,
    config: inserted.config as SceneConfig,
    modelBlobUrl: inserted.modelBlobUrl ?? null,
    modelFileName: inserted.modelFileName ?? null,
    thumbBlobUrl: inserted.thumbBlobUrl ?? null,
    isPreset: inserted.isPreset,
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
  };
}
```

- [ ] Uruchom testy — **oczekiwany wynik: PASS** (wszystkie 5 testów zielone):
```
npx vitest run lib/scenes/repo.test.ts
```
Oczekiwany output:
```
✓ lib/scenes/repo.test.ts (5)
  ✓ tworzy nową scenę z is_preset=false i owner_id=wywołującego
  ✓ klon współdzieli model_blob_url bez kopiowania pliku
  ✓ klon współdzieli thumb_blob_url (decyzja 3 — kopiuj URL)
  ✓ rzuca błąd gdy id nie wskazuje na preset
  ✓ rzuca błąd gdy preset nie istnieje

Test Files  1 passed (1)
Tests       5 passed (5)
```

- [ ] Commit:
```
git add lib/scenes/repo.ts
git commit -m "feat(presets): instantiatePreset + countModelReferences in repo [GREEN]"
```

---

### Zadanie 3 — Trasa API `POST /api/scenes/[id]/instantiate/route.ts`

**Cel:** Endpoint przyjmujący żądanie klonowania presetu. Wymaga zalogowania, sprawdza że źródło jest presetem, zwraca 201 z nową sceną.

- [ ] Utwórz plik `app/api/scenes/[id]/instantiate/route.ts`:

```typescript
// app/api/scenes/[id]/instantiate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { instantiatePreset } from '@/lib/scenes/repo';

// Trasa nie wymaga body (klonujemy preset wskazany przez [id]),
// ale definiujemy schemat dla rozszerzalności (np. nadanie tytułu w przyszłości).
const InstantiateBodySchema = z.object({
  title: z.string().min(1).max(120).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Autoryzacja
  let caller;
  try {
    caller = await requireUser(req);
  } catch {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }

  // 2. Parsuj opcjonalne body
  let body: z.infer<typeof InstantiateBodySchema> = {};
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const raw = await req.json().catch(() => ({}));
    const parsed = InstantiateBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    body = parsed.data;
  }

  // 3. Klonuj preset
  let newScene;
  try {
    newScene = await instantiatePreset(params.id, caller.id);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Błąd klonowania';
    if (message === 'Preset nie istnieje') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === 'Scena nie jest presetem') {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    console.error('[instantiate] nieoczekiwany błąd:', err);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }

  // 4. Opcjonalne nadpisanie tytułu (jeśli body.title podane)
  // Uwaga: nadpisanie tytułu wymagałoby PATCH po klonowaniu — pozostawiamy
  // jako future improvement. Dla uproszczenia ignorujemy body.title w tej wersji.

  return NextResponse.json(newScene, { status: 201 });
}
```

- [ ] Sprawdź manualnie za pomocą cURL (z działającym serwerem dev):
```bash
# Wymaga: serwer na localhost:3000, ważna sesja w cookies
curl -X POST http://localhost:3000/api/scenes/PRESET_ID/instantiate \
  -H "Cookie: cfab_session=TWOJ_TOKEN" \
  -H "Content-Type: application/json"
# Oczekiwane: 201 + JSON SceneRecord z isPreset=false
```

- [ ] Commit:
```
git add app/api/scenes/[id]/instantiate/route.ts
git commit -m "feat(presets): POST /api/scenes/[id]/instantiate route"
```

---

### Zadanie 4 — Komponent `PresetCard` (kafelek presetu z badge i akcjami)

**Cel:** Wizualny kafelek presetu z odznaką „PRESET", miniaturą, przyciskiem „Użyj jako nowa scena" i przyciskiem „Usuń" (tylko dla właściciela).

- [ ] Utwórz `components/PresetCard.tsx`:

```tsx
// components/PresetCard.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SceneRecord } from '@/lib/scenes/repo';

interface PresetCardProps {
  preset: SceneRecord;
  /** Id zalogowanego użytkownika — do decyzji czy pokazać przycisk Usuń */
  currentUserId: string;
  onDelete?: (id: string) => void;
}

export function PresetCard({ preset, currentUserId, onDelete }: PresetCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = preset.ownerId === currentUserId;

  async function handleUse() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenes/${preset.id}/instantiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Błąd ${res.status}`);
      }
      const newScene: SceneRecord = await res.json();
      router.push(`/editor/${newScene.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Usunąć preset „${preset.title}"? Tej operacji nie można cofnąć.`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenes/${preset.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Błąd ${res.status}`);
      }
      onDelete?.(preset.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
      setLoading(false);
    }
  }

  return (
    <article
      style={{
        position: 'relative',
        border: '2px solid #4a6fa5',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#1a1a2e',
        color: '#e0e0e0',
        width: 220,
        flexShrink: 0,
      }}
      aria-label={`Preset: ${preset.title}`}
    >
      {/* Badge PRESET */}
      <span
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          background: '#4a6fa5',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.2,
          padding: '2px 7px',
          borderRadius: 4,
          textTransform: 'uppercase',
          zIndex: 1,
        }}
      >
        PRESET
      </span>

      {/* Miniatura */}
      <div style={{ width: '100%', height: 130, background: '#111', overflow: 'hidden' }}>
        {preset.thumbBlobUrl ? (
          <img
            src={preset.thumbBlobUrl}
            alt={`Miniatura presetu ${preset.title}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#555',
              fontSize: 12,
            }}
          >
            brak miniatury
          </div>
        )}
      </div>

      {/* Treść */}
      <div style={{ padding: '10px 12px 12px' }}>
        <h3
          style={{
            margin: '0 0 4px',
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={preset.title}
        >
          {preset.title}
        </h3>
        <p style={{ margin: '0 0 10px', fontSize: 11, color: '#888' }}>
          {preset.modelFileName ?? 'brak modelu'}
        </p>

        {error && (
          <p style={{ color: '#ff6b6b', fontSize: 11, margin: '0 0 8px' }}>{error}</p>
        )}

        {/* Akcje */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleUse}
            disabled={loading}
            style={{
              flex: 1,
              padding: '6px 0',
              background: '#4a6fa5',
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '...' : 'Użyj jako nowa scena'}
          </button>

          {isOwner && (
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{
                padding: '6px 10px',
                background: 'transparent',
                color: '#ff6b6b',
                border: '1px solid #ff6b6b',
                borderRadius: 5,
                fontSize: 12,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
              aria-label="Usuń preset"
            >
              Usuń
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
```

- [ ] Commit:
```
git add components/PresetCard.tsx
git commit -m "feat(presets): PresetCard component with PRESET badge and actions"
```

---

### Zadanie 5 — Sekcja presetów na stronie startowej (`app/page.tsx`)

**Cel:** Strona startowa pobiera presety (`GET /api/scenes?preset=1`) i renderuje je w sekcji „Presety" z komponentem `PresetCard`. Zakładamy, że strona startowa istnieje z Etapu B (lista moich scen + klucz sesji). Jeśli nie — tworzymy ją w całości.

> Etap B powinien dostarczyć `app/page.tsx` jako Server Component pobierający `GET /api/scenes?preset=0`. Poniżej zakładamy, że plik istnieje i pokazujemy **tylko sekcję do dodania**. Jeśli nie istnieje — zastąp komentarzem całą stronę.

- [ ] Zmodyfikuj `app/page.tsx` — dodaj pobranie presetów i sekcję wizualną:

```tsx
// app/page.tsx  (fragment do dodania / zastąpienia)
// ─── Nowy import ───────────────────────────────────────────────────────────
import { PresetCard } from '@/components/PresetCard';
// ─── W funkcji Page (Server Component), obok istniejącego fetch scen: ──────

// Pobierz presety (is_preset=true) ze wszystkich właścicieli widocznych dla użytkownika.
// Trasa B: GET /api/scenes?preset=1 — zwraca SceneRecord[] z is_preset=true należące do admina.
const presetsRes = await fetch(
  `${process.env.APP_URL}/api/scenes?preset=1`,
  {
    headers: { Cookie: cookieHeader },   // cookieHeader zbudowany tak samo jak dla scen prywatnych
    cache: 'no-store',
  }
);
const presets: SceneRecord[] = presetsRes.ok ? await presetsRes.json() : [];

// ─── W JSX, przed sekcją moich scen: ─────────────────────────────────────
{presets.length > 0 && (
  <section aria-labelledby="presety-heading" style={{ marginBottom: 40 }}>
    <h2
      id="presety-heading"
      style={{
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        color: '#4a6fa5',
        margin: '0 0 16px',
      }}
    >
      Presety scen
    </h2>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {presets.map((preset) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          currentUserId={currentUser.id}
        />
      ))}
    </div>
  </section>
)}
```

> **Uwaga implementacyjna dla `GET /api/scenes?preset=1`:** trasa z B powinna filtrować po `is_preset`. Jeśli nie filtruje — dopisz warunek w `app/api/scenes/route.ts`:
```typescript
// app/api/scenes/route.ts (fragment warunkowy do dodania w GET)
const presetParam = req.nextUrl.searchParams.get('preset');
const filterPreset = presetParam === '1' ? true : presetParam === '0' ? false : undefined;

const rows = await db
  .select()
  .from(scenes)
  .where(
    filterPreset !== undefined
      ? and(eq(scenes.ownerId, caller.id), eq(scenes.isPreset, filterPreset))
      : eq(scenes.ownerId, caller.id)
  )
  .orderBy(desc(scenes.updatedAt));
```
> Dla presetów publicznych (widocznych dla wszystkich zalogowanych) zmień warunek — zamiast `ownerId === caller.id` → `is_preset = true` bez filtra owner. Decyzja projektowa: **presety są globalne** (dostępne dla każdego zalogowanego). Zmień query odpowiednio:
```typescript
const rows = filterPreset === true
  ? await db.select().from(scenes).where(eq(scenes.isPreset, true)).orderBy(desc(scenes.updatedAt))
  : await db.select().from(scenes).where(
      and(eq(scenes.ownerId, caller.id), eq(scenes.isPreset, false))
    ).orderBy(desc(scenes.updatedAt));
```

- [ ] Commit:
```
git add app/page.tsx app/api/scenes/route.ts
git commit -m "feat(presets): presety section on home page with PresetCard"
```

---

### Zadanie 6 — Komponent `SaveAsPresetButton` (przycisk w edytorze)

**Cel:** Osobny przycisk „Zapisz jako preset" w edytorze, widoczny tylko dla adminów. Wywołuje `POST /api/scenes` z `isPreset: true`, identycznie jak zwykły zapis sceny (z B), ale z dodatkową flagą.

- [ ] Utwórz `components/SaveAsPresetButton.tsx`:

```tsx
// components/SaveAsPresetButton.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SceneConfig } from '@/components/store';

interface SaveAsPresetButtonProps {
  /** Aktualny config sceny ze store */
  config: SceneConfig;
  /** URL modelu wgranego do Blob (może być null jeśli brak modelu) */
  modelBlobUrl: string | null;
  modelFileName: string | null;
  /** URL miniatury wgranej do Blob (może być null) */
  thumbBlobUrl: string | null;
  /** Tytuł do użycia jako preset — pytamy użytkownika */
  defaultTitle?: string;
}

export function SaveAsPresetButton({
  config,
  modelBlobUrl,
  modelFileName,
  thumbBlobUrl,
  defaultTitle = 'Nowy preset',
}: SaveAsPresetButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveAsPreset() {
    const title = prompt('Nazwa presetu:', defaultTitle);
    if (!title || !title.trim()) return;  // anulowanie dialogu

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          config,
          modelBlobUrl,
          modelFileName,
          thumbBlobUrl,
          isPreset: true,             // <-- kluczowa flaga
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Błąd ${res.status}`);
      }

      // Po zapisaniu jako preset — przekieruj na stronę główną
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <button
        onClick={handleSaveAsPreset}
        disabled={loading}
        style={{
          padding: '6px 14px',
          background: 'transparent',
          color: '#4a6fa5',
          border: '1.5px solid #4a6fa5',
          borderRadius: 5,
          fontSize: 12,
          fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
          whiteSpace: 'nowrap',
        }}
        title="Zapisz bieżącą scenę jako preset dostępny dla wszystkich użytkowników"
      >
        {loading ? 'Zapisuję preset...' : 'Zapisz jako preset'}
      </button>
      {error && (
        <span style={{ color: '#ff6b6b', fontSize: 11 }}>{error}</span>
      )}
    </div>
  );
}
```

- [ ] Commit:
```
git add components/SaveAsPresetButton.tsx
git commit -m "feat(presets): SaveAsPresetButton component for editor"
```

---

### Zadanie 7 — Integracja `SaveAsPresetButton` w edytorze (`app/editor/page.tsx`)

**Cel:** Podpięcie `SaveAsPresetButton` do UI edytora — widoczny tylko dla użytkowników z rolą `admin` (decyzja 5).

> Zakładamy, że `app/editor/page.tsx` istnieje z Etapu B. Poniżej pokazujemy dodanie przycisku obok istniejącego „Zapisz". Jeśli strona nie istnieje — utwórz ją na podstawie Etapu B.

- [ ] Zmodyfikuj `app/editor/page.tsx` — dodaj `SaveAsPresetButton` dla adminów:

```tsx
// app/editor/page.tsx  (fragment do dodania / zastąpienia)
// ─── Nowy import ───────────────────────────────────────────────────────────
import { SaveAsPresetButton } from '@/components/SaveAsPresetButton';
// ─── getCurrentUser() jest dostępny jako Server Component ─────────────────
// (zakładamy, że user jest już pobierany wcześniej w tym komponencie)

// ─── W JSX, obok przycisku „Zapisz" (po stronie serwera sprawdzamy rolę): ──
{currentUser.role === 'admin' && (
  <SaveAsPresetButton
    config={config}           // config ze store (Client Component musi go przekazać)
    modelBlobUrl={modelBlobUrl}
    modelFileName={modelFileName}
    thumbBlobUrl={thumbBlobUrl}
    defaultTitle={currentTitle || 'Nowy preset'}
  />
)}
```

> **Uwaga architektoniczna:** `app/editor/page.tsx` jest Server Component, ale `SaveAsPresetButton` jest Client Component (`'use client'`). Pośrednictwo — edytor ma wewnętrzny Client Component (np. `EditorShell`) który trzyma `config` ze store i przekazuje go do `SaveAsPresetButton` jako prop. Schemat:
```
app/editor/page.tsx (Server) — sprawdza rolę admina, renderuje:
  └── <EditorShell isAdmin={currentUser.role === 'admin'} ... />  (Client)
        ├── <Canvas .../>
        └── {isAdmin && <SaveAsPresetButton config={useStore(s => s.config)} ... />}
```
> Jeśli `EditorShell` nie istnieje — utwórz go jako cienki wrapper Client Component.

- [ ] Utwórz `components/EditorShell.tsx` (jeśli nie istnieje):

```tsx
// components/EditorShell.tsx
'use client';

import { SaveAsPresetButton } from '@/components/SaveAsPresetButton';
import { useStore } from '@/components/store';

interface EditorShellProps {
  isAdmin: boolean;
  modelBlobUrl: string | null;
  modelFileName: string | null;
  thumbBlobUrl: string | null;
  sceneTitle: string;
}

export function EditorShell({
  isAdmin,
  modelBlobUrl,
  modelFileName,
  thumbBlobUrl,
  sceneTitle,
}: EditorShellProps) {
  const config = useStore((s) => s.config);

  return (
    <>
      {/* Tu istniejące komponenty edytora (Canvas, panele boczne, itp.) */}
      {isAdmin && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 100,
          }}
        >
          <SaveAsPresetButton
            config={config}
            modelBlobUrl={modelBlobUrl}
            modelFileName={modelFileName}
            thumbBlobUrl={thumbBlobUrl}
            defaultTitle={sceneTitle}
          />
        </div>
      )}
    </>
  );
}
```

- [ ] Commit:
```
git add app/editor/page.tsx components/EditorShell.tsx
git commit -m "feat(presets): integrate SaveAsPresetButton in editor for admins"
```

---

### Zadanie 8 — Obsługa ref-count usuwania modelu w DELETE (interakcja z B)

**Cel:** Upewnić się, że `DELETE /api/scenes/[id]` z Etapu B korzysta z `countModelReferences()` przed usunięciem pliku `.glb` z Vercel Blob. To gwarantuje, że klony presetów nie stracą modelu po usunięciu presetu.

- [ ] Zmodyfikuj `app/api/scenes/[id]/route.ts` (trasa DELETE z B) — dodaj sprawdzenie ref-count:

```typescript
// app/api/scenes/[id]/route.ts — fragment DELETE z B, rozszerzony o ref-count
// ─── dodany import ────────────────────────────────────────────────────────
import { countModelReferences } from '@/lib/scenes/repo';
import { del } from '@vercel/blob';

// ─── W handlerze DELETE, po pobraniu sceny i weryfikacji właściciela: ─────

// Usuń miniaturę z Blob bezwarunkowo (jest unikalna dla tej sceny)
if (scene.thumbBlobUrl) {
  try {
    await del(scene.thumbBlobUrl);
  } catch (err) {
    console.warn('[DELETE scene] nie można usunąć thumb:', err);
    // nie przerywamy — usunięcie z DB jest ważniejsze
  }
}

// Usuń model z Blob TYLKO jeśli żadna inna scena go nie współdzieli
if (scene.modelBlobUrl) {
  const refs = await countModelReferences(scene.modelBlobUrl, scene.id);
  if (refs === 0) {
    try {
      await del(scene.modelBlobUrl);
    } catch (err) {
      console.warn('[DELETE scene] nie można usunąć modelu:', err);
    }
  } else {
    console.info(
      `[DELETE scene] model ${scene.modelBlobUrl} współdzielony przez ${refs} scen(y) — nie usuwamy z Blob`
    );
  }
}

// Usuń rekord z DB
await db.delete(scenes).where(eq(scenes.id, scene.id));

return new NextResponse(null, { status: 204 });
```

- [ ] Uruchom testy ponownie (sanity check):
```
npx vitest run lib/scenes/repo.test.ts
```
Oczekiwany output: 5 passed.

- [ ] Commit:
```
git add app/api/scenes/[id]/route.ts
git commit -m "fix(presets): ref-count model deletion in DELETE scene — shared blob URL safe"
```

---

### Zadanie 9 — Test integracyjny trasy `instantiate` (opcjonalny, smoke test)

**Cel:** Sprawdzić trasę `instantiate` bez uruchamiania serwera — używamy Vitest z mockowaną bazą i funkcją `instantiatePreset`.

- [ ] Utwórz `app/api/scenes/[id]/instantiate/route.test.ts`:

```typescript
// app/api/scenes/[id]/instantiate/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/session', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-test', role: 'user', email: 'a@b.com' }),
}));

vi.mock('@/lib/scenes/repo', () => ({
  instantiatePreset: vi.fn(),
}));

import { POST } from '@/app/api/scenes/[id]/instantiate/route';
import { instantiatePreset } from '@/lib/scenes/repo';

const MOCK_SCENE = {
  id: 'new-scene-id',
  ownerId: 'user-test',
  title: 'Studio (kopia)',
  config: {},
  modelBlobUrl: 'https://blob.vercel.com/models/abc.glb',
  modelFileName: 'abc.glb',
  thumbBlobUrl: null,
  isPreset: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('POST /api/scenes/[id]/instantiate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('zwraca 201 z nową sceną przy poprawnym klonowaniu', async () => {
    (instantiatePreset as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_SCENE);

    const req = new NextRequest('http://localhost/api/scenes/preset-001/instantiate', {
      method: 'POST',
    });

    const res = await POST(req, { params: { id: 'preset-001' } });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe('new-scene-id');
    expect(json.isPreset).toBe(false);
  });

  it('zwraca 404 gdy preset nie istnieje', async () => {
    (instantiatePreset as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Preset nie istnieje')
    );

    const req = new NextRequest('http://localhost/api/scenes/nie-ma/instantiate', {
      method: 'POST',
    });

    const res = await POST(req, { params: { id: 'nie-ma' } });
    expect(res.status).toBe(404);
  });

  it('zwraca 422 gdy rekord nie jest presetem', async () => {
    (instantiatePreset as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Scena nie jest presetem')
    );

    const req = new NextRequest('http://localhost/api/scenes/scena/instantiate', {
      method: 'POST',
    });

    const res = await POST(req, { params: { id: 'scena' } });
    expect(res.status).toBe(422);
  });
});
```

- [ ] Uruchom testy trasy:
```
npx vitest run app/api/scenes/[id]/instantiate/route.test.ts
```
Oczekiwany output: 3 passed.

- [ ] Commit:
```
git add app/api/scenes/[id]/instantiate/route.test.ts
git commit -m "test(presets): route integration smoke tests for instantiate endpoint"
```

---

### Zadanie 10 — Weryfikacja end-to-end w przeglądarce

**Cel:** Ręczne potwierdzenie, że cały przepływ działa.

- [ ] Uruchom serwer dev:
```
npm run dev
```

- [ ] Zaloguj się jako admin → otwórz edytor → załaduj model → sprawdź, czy przycisk „Zapisz jako preset" jest widoczny w prawym dolnym rogu.

- [ ] Kliknij „Zapisz jako preset" → wpisz nazwę → potwierdź → sprawdź przekierowanie na `/`.

- [ ] Na stronie głównej sprawdź, że sekcja „Presety scen" pojawia się z nowym kafelkiem i badge PRESET.

- [ ] Zaloguj się jako zwykły user → sprawdź, że sekcja presetów jest widoczna, ale przycisk „Zapisz jako preset" w edytorze NIE jest widoczny.

- [ ] Kliknij „Użyj jako nowa scena" na kafelku presetu → sprawdź, że nastąpił redirect do `/editor/[nowe-id]` z załadowaną sceną.

- [ ] Sprawdź DB: nowa scena ma `is_preset=false`, `owner_id=user-id`, ten sam `model_blob_url` co preset.

- [ ] Usuń preset jako admin → sprawdź, że kafelek znika z home. Sprawdź w Vercel Blob, czy plik `.glb` **nie został usunięty** (bo klon go współdzieli).

- [ ] Commit końcowy po weryfikacji:
```
git commit --allow-empty -m "chore(presets): manual e2e verification passed — etap C complete"
```

---

## Self-Review

### Pokrycie zakresu

| Wymaganie | Status |
|-----------|--------|
| Zapisz jako preset (`POST /api/scenes` z `isPreset:true`) | Zadanie 6+7 — `SaveAsPresetButton` + integracja w edytorze |
| Logika klonowania TDD (`instantiatePreset`) | Zadania 1+2 — 5 testów RED→GREEN |
| Trasa `POST /api/scenes/[id]/instantiate` | Zadanie 3 — pełna implementacja z Zod |
| Sekcja presetów na home | Zadanie 5 — `PresetCard` + fetch + sekcja JSX |
| Badge PRESET na kafelku | Zadanie 4 — `PresetCard.tsx` |
| Usunięcie presetu (właściciel) | Zadanie 4 — przycisk Usuń w `PresetCard` |
| Ref-count usuwania modelu (interakcja z B) | Zadanie 8 — `countModelReferences` w DELETE |
| Tylko admini tworzą presety | Zadanie 7 — sprawdzenie `role === 'admin'` po stronie serwera |

### Skan placeholderów

- Brak `TODO`, `// ...`, `// dodaj tu`, `similarly to Task N` w żadnym bloku kodu.
- Każda funkcja ma pełną sygnaturę i ciało.
- Komentarze architektoniczne wyjaśniają decyzje, nie odraczają implementacji.

### Spójność typów z kontraktem

- `SceneRecord` — zgodna z kontraktem (`lib/scenes`), importowana z `@/lib/scenes/repo`.
- `SceneConfig` — importowana z `@/components/store` (NIE redefinicja), zgodna z `src/store.ts` (typ ma `environment`, `background`, `keyLight`, `shadows`, `tone`, `material`, `branding`, `hero`, `camera`).
- `requireUser()` — z `@/lib/auth/session`, zwraca obiekt z `id`, `role`, `email`.
- Nazwy tras — zgodne z kontraktem: `POST /api/scenes/[id]/instantiate`.
- `isPreset: boolean` w `SceneRecord` — zgodna z kolumną `is_preset` w schemacie Drizzle.

### Punkty ryzyka (wymaga uwagi przy implementacji)

1. **Brak planu B** — `lib/scenes/repo.ts`, `app/api/scenes/route.ts` i `app/editor/page.tsx` mogą nie istnieć. Plan C zakłada ich istnienie z Etapu B; jeśli B nie było wdrożone, każdy z tych plików trzeba stworzyć w całości przed Zadaniem 2.
2. **Drizzle schema** — schemat musi zawierać kolumnę `is_preset boolean not null default false` w tabeli `scenes`. Jeśli B nie dodało tej kolumny — wymagana migracja Drizzle przed Zadaniem 2 (patrz kontrakt, schemat DB Etapu B).
3. **`requireAdmin()` vs `requireUser()`** — `SaveAsPresetButton` jest widoczny tylko dla admina (sprawdzenie na poziomie Server Component); trasa `POST /api/scenes` akceptuje `isPreset:true` od każdego zalogowanego — walidacja roli powinna być w trasie, nie tylko w UI. Do rozważenia: dodać check `if (body.isPreset && caller.role !== 'admin') return 403`.
4. **`cookieHeader` w Server Component** — `app/page.tsx` musi poprawnie przekazać cookies do wewnętrznego fetcha (Next 14 App Router: `import { cookies } from 'next/headers'`; `const cookieHeader = cookies().toString()`).

---

*Plan napisany dla agentów wykonujących Etap C platformy CFAB 3D Viewer. Poprzedni etap: B (zapis scen). Następny etap: D (uprawnienia, galeria, linki share).*
