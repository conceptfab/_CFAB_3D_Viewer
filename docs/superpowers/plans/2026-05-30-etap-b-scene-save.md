# Etap B — Zapis scen + miniatura + strona startowa

> **For agentic workers:** ten plan jest przeznaczony do realizacji za pomocą podejścia
> subagent-driven-development lub executing-plans. Każde zadanie ma checkboxy `- [ ]`,
> jest bite-sized (2–5 min) i ma pełny kod — zero placeholderów. Commit po każdym PASS.
> Wykonuj po jednym zadaniu; nie przeskakuj do kolejnego przed zielonym testem.

---

## Goal

Dać zalogowanemu użytkownikowi możliwość **zapisu kompletnej sceny 3D** (konfiguracja + plik
modelu `.glb` + auto-miniatura PNG) do Vercel Blob i Postgres, a następnie **otwarcia jej
ponownie** z poziomu **strony startowej** wyświetlającej kafelki z miniaturami. Etap B
zakłada, że Etap A jest w pełni ukończony i działający (Next.js App Router, Drizzle/Neon,
tabela `users`, `lib/auth/session.ts` z `requireUser()`/`getCurrentUser()`).

Zakres tego etapu **nie obejmuje**: presetów (kolumna `is_preset` istnieje, ale UI do
presetów jest w Etapie C), współdzielenia i uprawnień per-scena (Etap D).

---

## Decyzje wcielone z kontraktu — do weryfikacji (pozycje `[REVIEW]`)

Poniższe decyzje są przejęte 1:1 z `2026-05-30-platform-interface-contract.md`. Są wdrożone
w planie bezwarunkowo, ale **wymagają akceptacji użytkownika przed/w trakcie implementacji**.

| # | Pozycja | Wcielona decyzja |
|---|---------|-----------------|
| R1 | Schemat tabeli `scenes` | Kolumny: `id, owner_id, title, config jsonb, model_blob_url, model_file_name, thumb_blob_url, is_preset, created_at, updated_at`; indeksy na `owner_id` i `is_preset`. |
| R2 | Blob upload | Klient wysyła `.glb` i miniaturę **bezpośrednio** do Vercel Blob przez `upload()` z `@vercel/blob/client`; token pochodzi z `POST /api/blob/upload` (`handleUpload`). Serwer nie przepuszcza przez siebie danych pliku. |
| R3 | Ścieżki Blob | `models/<uuid>.glb`, `thumbnails/<uuid>.png` |
| R4 | Miniatura | Zrzut przez `gl.domElement.toDataURL('image/png')` z **`preserveDrawingBuffer: true`** na `<Canvas>` (podejście synchroniczne, zero opóźnień render-on-demand). Alternatywą byłby render-on-demand + `readback` przez `gl.readRenderTargetPixels`, ale wymaga dodatkowego przejścia renderowania — pomijamy złożoność. Przeskalowany canvas-side (`OffscreenCanvas` lub `<canvas>`) do ≤512 px dłuższego boku przed uploadem. |
| R5 | Ref-count przy usuwaniu | Usuwając scenę: `thumb_blob_url` **zawsze** kasowany z Blob; `model_blob_url` kasowany tylko gdy żadna inna scena (w tym przyszłe klony presetów z Etapu C) nie współdzieli tego URL-a. Implementacja: `SELECT COUNT(*) FROM scenes WHERE model_blob_url = $url AND id != $id`. |
| R6 | Typ `SceneRecord` | Import `SceneConfig` z `@/components/store` (nie redefiniować). Interfejs dokładnie jak w kontrakcie. |

---

## Architecture

```
Przeglądarka                 Next.js (Vercel)               Zewnętrzne
──────────────────────────   ───────────────────────────    ─────────────
Zustand store                app/api/blob/upload/           Vercel Blob
  ├─ config: SceneConfig       handleUpload (token)   ──▶  models/<uuid>.glb
  ├─ loadedModel               (autoryzacja requireUser)     thumbnails/<uuid>.png
  │   ├─ objectUrl                                           
  │   ├─ fileName          app/api/scenes/            Neon Postgres (Drizzle)
  │   └─ file: File ◀────    route.ts (GET/POST)  ──▶  tabela scenes
  │                          [id]/route.ts (GET/         
components/scenes/             PATCH/DELETE)
  uploadAssets.ts
    upload() @vercel/blob/client ──▶ Blob bezpośrednio (token z /api/blob/upload)
  captureThumbnail.ts
    gl.domElement (preserveDrawingBuffer:true) → scale → Blob PNG

app/page.tsx         ── GET /api/scenes → kafelki scen
app/editor/[id]/     ── GET /api/scenes/[id] → hydratacja store
```

Przepływ zapisu sceny:
1. Użytkownik klika „Zapisz scenę" w `SaveSceneDialog`
2. `captureThumbnail(gl)` → PNG Blob ≤512px
3. `uploadAssets(modelFile, thumbBlob)` → równoległy upload do Vercel Blob, zwraca URL-e
4. `POST /api/scenes` z `{title, config, modelBlobUrl, modelFileName, thumbBlobUrl}`
5. Redirect na `/editor/[id]` nowo utworzonej sceny

Przepływ otwierania sceny:
1. Strona startowa `GET /api/scenes` → siatka kafelków
2. Klik „Otwórz" → `/editor/[id]`
3. Server Component `app/editor/[id]/page.tsx` → `GET /api/scenes/[id]` → `SceneRecord`
4. Przekazanie `SceneRecord` do komponentu klienckiego → hydratacja store

---

## Tech Stack

- **Next.js 14+ App Router** — trasy API jako Route Handlers, Server Components dla SSR
- **Drizzle ORM + drizzle-kit** — migracja dodająca tabelę `scenes`
- **Vercel Blob** (`@vercel/blob`, `@vercel/blob/client`) — storage `.glb` i PNG
- **Zustand** (`@/components/store`) — stan edytora; rozszerzony o `file: File | null`
- **zod** — walidacja wejścia we wszystkich trasach API
- **vitest** — testy jednostkowe repozytorium i helpers (bez WebGL w unit)
- **TypeScript** ścisły, `@/` alias konfigurowany przez Next

---

## File Structure

Pliki **tworzone** w Etapie B (nowe):

```
lib/
  db/
    migrations/                       ← output drizzle-kit (auto-generowany)
  scenes/
    schema.ts                         ← definicja tabeli scenes w Drizzle
    repo.ts                           ← CRUD + ref-count delete
    repo.test.ts                      ← testy jednostkowe repozytorium
    types.ts                          ← eksport SceneRecord (re-export kontraktu)

app/
  api/
    blob/
      upload/
        route.ts                      ← handleUpload z @vercel/blob/client
    scenes/
      route.ts                        ← GET (lista) + POST (utwórz)
      [id]/
        route.ts                      ← GET / PATCH / DELETE

  editor/
    [id]/
      page.tsx                        ← otwieranie istniejącej sceny

components/
  scenes/
    uploadAssets.ts                   ← klient-side helper: upload modelu + miniatury
    captureThumbnail.ts               ← zrzut canvasu → PNG Blob ≤512px
    SaveSceneDialog.tsx               ← modal: prompt na tytuł + akcja zapisu
    SceneCard.tsx                     ← kafelek na stronie startowej
```

Pliki **modyfikowane** w Etapie B:

```
components/store.ts                   ← LoadedModel rozszerzony o `file: File | null`
components/viewer/Viewer.tsx          ← preserveDrawingBuffer: true + eksport ref gl
components/viewer/ModelDropzone.tsx   ← accept() zapisuje również File w store
app/page.tsx                          ← przebudowa na siatkę SceneCard
app/editor/page.tsx                   ← dodanie przycisku + integracja SaveSceneDialog
.env.example                          ← BLOB_READ_WRITE_TOKEN
```

---

## Zadania

### TASK-B-01 — Zainstaluj `@vercel/blob`

- [ ] Zainstaluj pakiety:
  ```bash
  npm install @vercel/blob
  ```
  Oczekiwany output: `added N packages` bez błędów.

- [ ] Dodaj do `.env.example` (plik istnieje po Etapie A):
  ```
  BLOB_READ_WRITE_TOKEN              # B — Vercel Blob
  ```

- [ ] Dodaj do `.env.local` (lokalne dev — nie commitować):
  ```
  BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...  # skopiuj z dashboardu Vercel Blob
  ```

- [ ] Commit:
  ```bash
  git add package.json package-lock.json .env.example
  git commit -m "chore(blob): add @vercel/blob dependency"
  ```

---

### TASK-B-02 — Schemat Drizzle: tabela `scenes`

Tworzymy osobny plik schematu dla scen (nie modyfikujemy `lib/db/schema.ts` admina).

- [ ] Utwórz `lib/scenes/schema.ts`:

  ```ts
  // lib/scenes/schema.ts
  import {
    pgTable,
    uuid,
    text,
    jsonb,
    boolean,
    timestamp,
    index,
  } from 'drizzle-orm/pg-core';
  import { users } from '@/lib/db/schema';

  export const scenes = pgTable(
    'scenes',
    {
      id: uuid('id').defaultRandom().primaryKey(),
      ownerId: uuid('owner_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
      title: text('title').notNull(),
      config: jsonb('config').notNull(),
      modelBlobUrl: text('model_blob_url'),
      modelFileName: text('model_file_name'),
      thumbBlobUrl: text('thumb_blob_url'),
      isPreset: boolean('is_preset').notNull().default(false),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
      index('scenes_owner_id_idx').on(t.ownerId),
      index('scenes_is_preset_idx').on(t.isPreset),
    ]
  );
  ```

  > Uwaga: `users` jest eksportowane z `lib/db/schema.ts` (Etap A) bez sufiksu `Table`.

- [ ] Dodaj `lib/scenes/schema.ts` do eksportów zbiorczego schematu Drizzle.
  W pliku konfiguracyjnym `drizzle.config.ts` (lub `drizzle.config.js`) upewnij się, że
  `schema` wskazuje na wszystkie pliki schematu (glob lub tablica):

  ```ts
  // drizzle.config.ts
  import type { Config } from 'drizzle-kit';

  export default {
    schema: ['./lib/db/schema.ts', './lib/scenes/schema.ts'],
    out: './lib/db/migrations',
    dialect: 'postgresql',
    dbCredentials: {
      url: process.env.DATABASE_URL!,
    },
  } satisfies Config;
  ```

- [ ] Wygeneruj migrację:
  ```bash
  npx drizzle-kit generate
  ```
  Oczekiwany output: plik `lib/db/migrations/XXXX_scenes.sql` z `CREATE TABLE scenes`.

- [ ] Uruchom migrację na lokalnej bazie:
  ```bash
  npx drizzle-kit migrate
  ```
  Oczekiwany output: `[✓] migrations applied`.

- [ ] Commit:
  ```bash
  git add lib/scenes/schema.ts drizzle.config.ts lib/db/migrations/
  git commit -m "feat(db): add scenes table migration"
  ```

---

### TASK-B-03 — Typ `SceneRecord` i plik `lib/scenes/types.ts`

- [ ] Utwórz `lib/scenes/types.ts`:

  ```ts
  // lib/scenes/types.ts
  import type { SceneConfig } from '@/components/store';

  /**
   * Rekord sceny — odzwierciedla wiersz tabeli `scenes`.
   * SceneConfig importowany z komponentu store (NIE redefiniować tutaj).
   * Nazwy pól: camelCase (Drizzle mapuje snake_case → camelCase).
   */
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

  export type CreateSceneInput = {
    title: string;
    config: SceneConfig;
    modelBlobUrl: string | null;
    modelFileName: string | null;
    thumbBlobUrl: string | null;
    isPreset?: boolean;
  };

  export type UpdateSceneInput = Partial<
    Pick<SceneRecord, 'title' | 'config' | 'thumbBlobUrl'>
  >;
  ```

- [ ] Nie uruchamiaj testów (plik czysty — same typy, brak logiki). Commit:
  ```bash
  git add lib/scenes/types.ts
  git commit -m "feat(scenes): add SceneRecord types"
  ```

---

### TASK-B-04 — Repozytorium scen `lib/scenes/repo.ts` (TDD)

Najpierw testy, potem implementacja.

#### TASK-B-04a — Napisz testy (RED)

- [ ] Utwórz `lib/scenes/repo.test.ts`:

  ```ts
  // lib/scenes/repo.test.ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import type { SceneRecord, CreateSceneInput } from './types';

  // Mockujemy moduł db aby testy były jednostkowe (bez realnej bazy).
  vi.mock('@/lib/db', () => ({
    db: {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }));

  // Mockujemy @vercel/blob (del) — używane w deleteScene.
  vi.mock('@vercel/blob', () => ({
    del: vi.fn(),
  }));

  import { createScene, getScene, listScenes, updateScene, deleteScene } from './repo';

  const MOCK_OWNER_ID = 'user-uuid-1';
  const MOCK_SCENE_ID = 'scene-uuid-1';

  const mockSceneRecord: SceneRecord = {
    id: MOCK_SCENE_ID,
    ownerId: MOCK_OWNER_ID,
    title: 'Moja scena',
    config: {} as any,
    modelBlobUrl: 'https://blob.vercel.com/models/abc.glb',
    modelFileName: 'model.glb',
    thumbBlobUrl: 'https://blob.vercel.com/thumbnails/abc.png',
    isPreset: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  describe('createScene', () => {
    it('zwraca SceneRecord po zapisaniu', async () => {
      const { db } = await import('@/lib/db');
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSceneRecord]),
        }),
      });

      const input: CreateSceneInput = {
        title: 'Moja scena',
        config: {} as any,
        modelBlobUrl: 'https://blob.vercel.com/models/abc.glb',
        modelFileName: 'model.glb',
        thumbBlobUrl: 'https://blob.vercel.com/thumbnails/abc.png',
      };

      const result = await createScene(MOCK_OWNER_ID, input);
      expect(result.id).toBe(MOCK_SCENE_ID);
      expect(result.title).toBe('Moja scena');
    });
  });

  describe('getScene', () => {
    it('zwraca SceneRecord gdy istnieje', async () => {
      const { db } = await import('@/lib/db');
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockSceneRecord]),
        }),
      });

      const result = await getScene(MOCK_SCENE_ID);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(MOCK_SCENE_ID);
    });

    it('zwraca null gdy nie istnieje', async () => {
      const { db } = await import('@/lib/db');
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await getScene('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listScenes', () => {
    it('zwraca tablicę SceneRecord dla ownerId', async () => {
      const { db } = await import('@/lib/db');
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockSceneRecord]),
        }),
      });

      const results = await listScenes(MOCK_OWNER_ID, { preset: false });
      expect(results).toHaveLength(1);
      expect(results[0].ownerId).toBe(MOCK_OWNER_ID);
    });
  });

  describe('updateScene', () => {
    it('zwraca zaktualizowany SceneRecord', async () => {
      const { db } = await import('@/lib/db');
      const updated = { ...mockSceneRecord, title: 'Nowa nazwa' };
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const result = await updateScene(MOCK_SCENE_ID, { title: 'Nowa nazwa' });
      expect(result!.title).toBe('Nowa nazwa');
    });
  });

  describe('deleteScene', () => {
    it('kasuje miniaturę zawsze i model gdy nie współdzielony', async () => {
      const { db } = await import('@/lib/db');
      const { del } = await import('@vercel/blob');

      // getScene returns mockSceneRecord
      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockSceneRecord]),
          }),
        })
        // countShared: 0 innych scen z tym modelem
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        });

      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await deleteScene(MOCK_SCENE_ID);

      // del wywołany dwukrotnie: thumb + model
      expect(del).toHaveBeenCalledTimes(2);
    });

    it('kasuje tylko miniaturę gdy model współdzielony', async () => {
      const { db } = await import('@/lib/db');
      const { del } = await import('@vercel/blob');
      vi.clearAllMocks();

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockSceneRecord]),
          }),
        })
        // countShared: 1 inna scena współdzieli ten model
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        });

      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await deleteScene(MOCK_SCENE_ID);

      // del wywołany tylko raz: thumb (model NIE kasowany)
      expect(del).toHaveBeenCalledTimes(1);
      expect(del).toHaveBeenCalledWith(mockSceneRecord.thumbBlobUrl);
    });
  });
  ```

- [ ] Uruchom testy (oczekiwany wynik: **RED** — `repo.ts` nie istnieje):
  ```bash
  npx vitest run lib/scenes/repo.test.ts
  ```
  Oczekiwany output: `Cannot find module './repo'` lub podobny błąd importu.

#### TASK-B-04b — Implementacja (GREEN)

- [ ] Utwórz `lib/scenes/repo.ts`:

  ```ts
  // lib/scenes/repo.ts
  import { eq, and, sql } from 'drizzle-orm';
  import { del } from '@vercel/blob';
  import { db } from '@/lib/db';
  import { scenes } from './schema';
  import type { SceneRecord, CreateSceneInput, UpdateSceneInput } from './types';

  // Re-eksport typów domeny scen — by można je importować także z `@/lib/scenes/repo`
  // (Etapy C i D korzystają z tej ścieżki).
  export type { SceneRecord, CreateSceneInput, UpdateSceneInput } from './types';

  /** Tworzy nową scenę w DB. Zwraca pełny SceneRecord. */
  export async function createScene(
    ownerId: string,
    input: CreateSceneInput
  ): Promise<SceneRecord> {
    const rows = await db
      .insert(scenes)
      .values({
        ownerId,
        title: input.title,
        config: input.config as any,
        modelBlobUrl: input.modelBlobUrl ?? null,
        modelFileName: input.modelFileName ?? null,
        thumbBlobUrl: input.thumbBlobUrl ?? null,
        isPreset: input.isPreset ?? false,
      })
      .returning();

    return rowToRecord(rows[0]);
  }

  /** Pobiera pojedynczą scenę po id. Zwraca null jeśli nie istnieje. */
  export async function getScene(id: string): Promise<SceneRecord | null> {
    const rows = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, id));

    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  /**
   * Lista scen właściciela.
   * preset=false → tylko własne (nie-presetowe); preset=true → tylko presety.
   * Domyślnie zwraca nie-presetowe (Etap C doda dedykowane trasy presetów).
   */
  export async function listScenes(
    ownerId: string,
    opts: { preset: boolean } = { preset: false }
  ): Promise<SceneRecord[]> {
    const rows = await db
      .select()
      .from(scenes)
      .where(
        and(
          eq(scenes.ownerId, ownerId),
          eq(scenes.isPreset, opts.preset)
        )
      );

    return rows.map(rowToRecord);
  }

  /**
   * Aktualizuje scenę (tytuł, config lub miniatura).
   * Automatycznie ustawia updatedAt = now().
   * Zwraca null jeśli scena nie istnieje (nie rzuca wyjątku).
   */
  export async function updateScene(
    id: string,
    patch: UpdateSceneInput
  ): Promise<SceneRecord | null> {
    const rows = await db
      .update(scenes)
      .set({
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.config !== undefined && { config: patch.config as any }),
        ...(patch.thumbBlobUrl !== undefined && { thumbBlobUrl: patch.thumbBlobUrl }),
        updatedAt: new Date(),
      })
      .where(eq(scenes.id, id))
      .returning();

    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  /**
   * Usuwa scenę z DB oraz pliki z Vercel Blob (ref-count dla modelu).
   *
   * Miniatura jest kasowana zawsze.
   * Model kasowany tylko gdy żadna inna scena nie współdzieli tego URL-a
   * (klon presetu z Etapu C będzie współdzielić URL modelu).
   *
   * Jeśli scena nie istnieje — funkcja kończy się cicho (idempotent).
   */
  export async function deleteScene(id: string): Promise<void> {
    const scene = await getScene(id);
    if (!scene) return;

    // Ref-count: ile innych scen używa tego samego model_blob_url?
    let sharedModelCount = 0;
    if (scene.modelBlobUrl) {
      const countRows = await db
        .select({ count: sql<number>`count(*)` })
        .from(scenes)
        .where(
          and(
            eq(scenes.modelBlobUrl, scene.modelBlobUrl),
            sql`${scenes.id} != ${id}`
          )
        );
      sharedModelCount = Number(countRows[0]?.count ?? 0);
    }

    // Usuń rekord z DB.
    await db.delete(scenes).where(eq(scenes.id, id));

    // Usuń miniatury z Blob (zawsze).
    if (scene.thumbBlobUrl) {
      await del(scene.thumbBlobUrl);
    }

    // Usuń model z Blob (tylko gdy nie współdzielony).
    if (scene.modelBlobUrl && sharedModelCount === 0) {
      await del(scene.modelBlobUrl);
    }
  }

  // ─── Mapper ────────────────────────────────────────────────────────────────

  function rowToRecord(row: typeof scenes.$inferSelect): SceneRecord {
    return {
      id: row.id,
      ownerId: row.ownerId,
      title: row.title,
      config: row.config as any,
      modelBlobUrl: row.modelBlobUrl ?? null,
      modelFileName: row.modelFileName ?? null,
      thumbBlobUrl: row.thumbBlobUrl ?? null,
      isPreset: row.isPreset,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
  ```

- [ ] Uruchom testy (oczekiwany wynik: **GREEN**):
  ```bash
  npx vitest run lib/scenes/repo.test.ts
  ```
  Oczekiwany output: `✓ lib/scenes/repo.test.ts (6 tests passed)`.

- [ ] Commit:
  ```bash
  git add lib/scenes/repo.ts lib/scenes/repo.test.ts lib/scenes/types.ts
  git commit -m "feat(scenes): add scene repo with ref-count delete (TDD)"
  ```

---

### TASK-B-05 — Trasa API `/api/blob/upload`

Token autoryzujący bezpośredni upload klienta do Vercel Blob.

- [ ] Utwórz `app/api/blob/upload/route.ts`:

  ```ts
  // app/api/blob/upload/route.ts
  import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
  import { NextResponse } from 'next/server';
  import { requireUser } from '@/lib/auth/session';

  /**
   * Token route dla @vercel/blob/client.
   * Klient wysyła plik bezpośrednio do Blob, tu tylko autoryzacja i wygenerowanie tokenu.
   * Ścieżki dozwolone: models/<uuid>.glb oraz thumbnails/<uuid>.png.
   */
  export async function POST(request: Request): Promise<NextResponse> {
    const user = await requireUser();
    // requireUser rzuca 401/redirect jeśli niezalogowany — obsługa jest w requireUser.

    const body = (await request.json()) as HandleUploadBody;

    try {
      const jsonResponse = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async (pathname) => {
          // Upewniamy się, że ścieżka jest dozwolona (modele i miniatury).
          const allowed =
            pathname.startsWith('models/') || pathname.startsWith('thumbnails/');
          if (!allowed) {
            throw new Error(`Niedozwolona ścieżka Blob: ${pathname}`);
          }

          return {
            allowedContentTypes: [
              'model/gltf-binary',
              'application/octet-stream',
              'image/png',
            ],
            // Maksymalny rozmiar: 100 MB dla modeli, 1 MB dla miniatur.
            maximumSizeInBytes: pathname.startsWith('models/') ? 100_000_000 : 1_000_000,
            tokenPayload: JSON.stringify({ userId: user.id }),
          };
        },
        onUploadCompleted: async ({ blob }) => {
          // Callback po zakończeniu uploadu (logowanie lub przyszłe użycie).
          console.log(`[blob] upload zakończony: ${blob.url}`);
        },
      });

      return NextResponse.json(jsonResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Błąd uploadu';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  ```

  > Uwaga: `requireUser()` musi być wyeksportowane z `lib/auth/session.ts` (Etap A).
  > Jeśli `requireUser` rzuca błąd zamiast zwracać wartość, opakuj w try-catch i zwróć 401.

- [ ] Sprawdź manualnie (dev server):
  ```bash
  curl -X POST http://localhost:3000/api/blob/upload \
    -H "Content-Type: application/json" \
    -d '{}' 
  ```
  Oczekiwany output bez sesji: `401` lub redirect do `/login`.

- [ ] Commit:
  ```bash
  git add app/api/blob/upload/route.ts
  git commit -m "feat(blob): add upload token route with requireUser"
  ```

---

### TASK-B-06 — Trasy API `/api/scenes` i `/api/scenes/[id]`

#### TASK-B-06a — `GET + POST /api/scenes`

- [ ] Utwórz `app/api/scenes/route.ts`:

  ```ts
  // app/api/scenes/route.ts
  import { NextResponse } from 'next/server';
  import { z } from 'zod';
  import { requireUser } from '@/lib/auth/session';
  import { createScene, listScenes } from '@/lib/scenes/repo';
  import type { SceneConfig } from '@/components/store';

  // ─── GET /api/scenes?preset=0|1 ─────────────────────────────────────────────

  export async function GET(request: Request): Promise<NextResponse> {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const preset = searchParams.get('preset') === '1';

    const scenes = await listScenes(user.id, { preset });
    return NextResponse.json(scenes);
  }

  // ─── POST /api/scenes ────────────────────────────────────────────────────────

  const CreateSceneSchema = z.object({
    title: z.string().min(1).max(200),
    config: z.record(z.unknown()),          // SceneConfig jako opaque object
    modelBlobUrl: z.string().url().nullable(),
    modelFileName: z.string().max(255).nullable(),
    thumbBlobUrl: z.string().url().nullable(),
    isPreset: z.boolean().optional(),
  });

  export async function POST(request: Request): Promise<NextResponse> {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
    }

    const parsed = CreateSceneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Błąd walidacji', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const scene = await createScene(user.id, {
      title: parsed.data.title,
      config: parsed.data.config as SceneConfig,
      modelBlobUrl: parsed.data.modelBlobUrl,
      modelFileName: parsed.data.modelFileName,
      thumbBlobUrl: parsed.data.thumbBlobUrl,
      isPreset: parsed.data.isPreset ?? false,
    });

    return NextResponse.json(scene, { status: 201 });
  }
  ```

#### TASK-B-06b — `GET + PATCH + DELETE /api/scenes/[id]`

- [ ] Utwórz `app/api/scenes/[id]/route.ts`:

  ```ts
  // app/api/scenes/[id]/route.ts
  import { NextResponse } from 'next/server';
  import { z } from 'zod';
  import { requireUser } from '@/lib/auth/session';
  import { getScene, updateScene, deleteScene } from '@/lib/scenes/repo';

  type Ctx = { params: Promise<{ id: string }> };

  // ─── GET /api/scenes/[id] ────────────────────────────────────────────────────

  export async function GET(_req: Request, ctx: Ctx): Promise<NextResponse> {
    const user = await requireUser();
    const { id } = await ctx.params;

    const scene = await getScene(id);
    if (!scene) {
      return NextResponse.json({ error: 'Nie znaleziono sceny' }, { status: 404 });
    }

    // Etap B: tylko właściciel. Etap D doda uprawnienia per-scena.
    if (scene.ownerId !== user.id) {
      return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
    }

    return NextResponse.json(scene);
  }

  // ─── PATCH /api/scenes/[id] ──────────────────────────────────────────────────

  const PatchSceneSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    config: z.record(z.unknown()).optional(),
    thumbBlobUrl: z.string().url().nullable().optional(),
  });

  export async function PATCH(request: Request, ctx: Ctx): Promise<NextResponse> {
    const user = await requireUser();
    const { id } = await ctx.params;

    const scene = await getScene(id);
    if (!scene) {
      return NextResponse.json({ error: 'Nie znaleziono sceny' }, { status: 404 });
    }
    if (scene.ownerId !== user.id) {
      return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
    }

    const parsed = PatchSceneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Błąd walidacji', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const updated = await updateScene(id, {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.config !== undefined && { config: parsed.data.config as any }),
      ...(parsed.data.thumbBlobUrl !== undefined && { thumbBlobUrl: parsed.data.thumbBlobUrl }),
    });

    return NextResponse.json(updated);
  }

  // ─── DELETE /api/scenes/[id] ─────────────────────────────────────────────────

  export async function DELETE(_req: Request, ctx: Ctx): Promise<NextResponse> {
    const user = await requireUser();
    const { id } = await ctx.params;

    const scene = await getScene(id);
    if (!scene) {
      return NextResponse.json({ error: 'Nie znaleziono sceny' }, { status: 404 });
    }
    if (scene.ownerId !== user.id) {
      return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
    }

    await deleteScene(id);
    return new NextResponse(null, { status: 204 });
  }
  ```

- [ ] Sprawdź TypeScript:
  ```bash
  npx tsc --noEmit
  ```
  Oczekiwany output: brak błędów.

- [ ] Commit:
  ```bash
  git add app/api/scenes/route.ts app/api/scenes/[id]/route.ts
  git commit -m "feat(api): add scenes CRUD routes (GET/POST/PATCH/DELETE)"
  ```

---

### TASK-B-07 — Rozszerzenie `LoadedModel` w store o `file: File | null`

Aby przy zapisie sceny mieć dostęp do oryginalnego obiektu `File` (potrzebnego do uploadu
do Vercel Blob), przechowujemy go obok `objectUrl`.

- [ ] Edytuj `components/store.ts` — zmień definicję `LoadedModel`:

  ```ts
  // PRZED:
  export interface LoadedModel {
    objectUrl: string;
    fileName: string;
  }

  // PO:
  export interface LoadedModel {
    objectUrl: string;
    fileName: string;
    /** Oryginalny obiekt File — potrzebny do uploadu przy zapisie sceny.
     *  null gdy model załadowany z Blob URL (otwieranie istniejącej sceny). */
    file: File | null;
  }
  ```

- [ ] Edytuj `components/viewer/ModelDropzone.tsx` — funkcja `accept` zapisuje `file`:

  ```ts
  // PRZED (wywołanie setLoadedModel):
  setLoadedModel({ objectUrl, fileName: file.name });

  // PO:
  setLoadedModel({ objectUrl, fileName: file.name, file });
  ```

- [ ] Sprawdź TypeScript (wszystkie miejsca używające `LoadedModel`):
  ```bash
  npx tsc --noEmit
  ```
  Jeśli inne miejsca w kodzie konstruują `LoadedModel` bez `file` — dodaj `file: null`
  (np. przy hipotetycznym ładowaniu z URL).

- [ ] Uruchom istniejące testy store:
  ```bash
  npx vitest run components/store.test.ts
  ```
  Oczekiwany output: wszystkie zielone (brak zmian logiki).

- [ ] Commit:
  ```bash
  git add components/store.ts components/viewer/ModelDropzone.tsx
  git commit -m "feat(store): extend LoadedModel with file for blob upload"
  ```

---

### TASK-B-08 — `preserveDrawingBuffer: true` na `<Canvas>`

Wymagane do odczytu canvasu przez `toDataURL()` przy tworzeniu miniatury.

- [ ] Edytuj `components/viewer/Viewer.tsx` — dodaj `preserveDrawingBuffer` do opcji WebGL:

  ```ts
  // PRZED:
  gl={{
    antialias: false,
    alpha: false,
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1.0,
    outputColorSpace: THREE.SRGBColorSpace,
  }}

  // PO:
  gl={{
    antialias: false,
    alpha: false,
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1.0,
    outputColorSpace: THREE.SRGBColorSpace,
    preserveDrawingBuffer: true,   // wymagane do captureThumbnail (toDataURL)
  }}
  ```

  > **Decyzja R4 — uzasadnienie:** `preserveDrawingBuffer: true` pozwala wywołać
  > `gl.domElement.toDataURL()` synchronicznie po wyrenderowaniu klatki. Alternatywne
  > podejście (render-on-demand + `gl.readRenderTargetPixels`) wymagałoby dodatkowego
  > render target i ręcznego wyzwolenia renderowania — zbędna złożoność dla Etapu B.
  > Koszt: przeglądarka nie może optymalizować swap chain (potencjalnie ~5% wolniej na
  > mobilnych GPU). Akceptowalny na aplikację desktopową.

- [ ] Sprawdź wizualnie, że edytor nadal działa (brak regresji renderowania):
  ```bash
  npm run dev
  # otwórz http://localhost:3000/editor, załaduj model .glb
  ```

- [ ] Commit:
  ```bash
  git add components/viewer/Viewer.tsx
  git commit -m "feat(viewer): enable preserveDrawingBuffer for thumbnail capture"
  ```

---

### TASK-B-09 — `captureThumbnail.ts` — zrzut canvasu do PNG Blob

- [ ] Utwórz `components/scenes/captureThumbnail.ts`:

  ```ts
  // components/scenes/captureThumbnail.ts

  /**
   * Przechwytuje aktualną klatkę renderowanego canvasu r3f i zwraca ją jako PNG Blob
   * przeskalowany do maksymalnie 512 px na dłuższym boku.
   *
   * Wymaga: preserveDrawingBuffer: true na <Canvas> (ustawione w Viewer.tsx).
   *
   * @param gl - obiekt WebGL renderer (dostępny z useThree().gl lub przekazany z onCreated)
   * @returns Blob PNG lub null jeśli canvas jest niedostępny
   */
  export async function captureThumbnail(
    gl: { domElement: HTMLCanvasElement }
  ): Promise<Blob | null> {
    const source = gl.domElement;
    if (!source || source.width === 0 || source.height === 0) return null;

    const MAX_SIZE = 512;
    const ratio = source.width / source.height;
    let w: number;
    let h: number;

    if (source.width >= source.height) {
      w = Math.min(source.width, MAX_SIZE);
      h = Math.round(w / ratio);
    } else {
      h = Math.min(source.height, MAX_SIZE);
      w = Math.round(h * ratio);
    }

    // Rysujemy na tymczasowym canvasie o docelowym rozmiarze.
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(source, 0, 0, w, h);

    return new Promise<Blob | null>((resolve) => {
      out.toBlob((blob) => resolve(blob), 'image/png');
    });
  }
  ```

- [ ] Ten plik jest czystą funkcją przeglądarki — nie ma sensu testować jej jednostkowo
  bez DOM (canvas API). Weryfikacja nastąpi integracyjnie w TASK-B-11 (zapis sceny).

- [ ] Commit:
  ```bash
  git add components/scenes/captureThumbnail.ts
  git commit -m "feat(scenes): add captureThumbnail helper (canvas → PNG blob ≤512px)"
  ```

---

### TASK-B-10 — `uploadAssets.ts` — upload modelu + miniatury do Vercel Blob

- [ ] Utwórz `components/scenes/uploadAssets.ts`:

  ```ts
  // components/scenes/uploadAssets.ts
  'use client';

  import { upload } from '@vercel/blob/client';
  import { v4 as uuidv4 } from 'uuid';

  export interface UploadedAssets {
    modelBlobUrl: string;
    thumbBlobUrl: string;
  }

  /**
   * Uploaduje model (.glb) i miniaturę (PNG) bezpośrednio do Vercel Blob.
   * Token pobierany z /api/blob/upload (handleUpload).
   *
   * Oba uploady wykonywane równolegle (Promise.all).
   * @param modelFile - oryginalny plik .glb (z LoadedModel.file)
   * @param thumbBlob - miniatura PNG (z captureThumbnail)
   * @returns URL-e obu zasobów
   */
  export async function uploadAssets(
    modelFile: File,
    thumbBlob: Blob
  ): Promise<UploadedAssets> {
    const modelUuid = uuidv4();
    const thumbUuid = uuidv4();

    const [modelResult, thumbResult] = await Promise.all([
      upload(`models/${modelUuid}.glb`, modelFile, {
        access: 'public',
        handleUploadUrl: '/api/blob/upload',
      }),
      upload(`thumbnails/${thumbUuid}.png`, thumbBlob, {
        access: 'public',
        handleUploadUrl: '/api/blob/upload',
      }),
    ]);

    return {
      modelBlobUrl: modelResult.url,
      thumbBlobUrl: thumbResult.url,
    };
  }
  ```

  > Uwaga: jeśli projekt nie ma jeszcze `uuid` jako zależności, zainstaluj:
  > ```bash
  > npm install uuid && npm install -D @types/uuid
  > ```
  > Alternatywnie użyj `crypto.randomUUID()` (dostępne w nowoczesnych przeglądarkach):
  > ```ts
  > const modelUuid = crypto.randomUUID();
  > ```

- [ ] Sprawdź TypeScript:
  ```bash
  npx tsc --noEmit
  ```

- [ ] Commit:
  ```bash
  git add components/scenes/uploadAssets.ts
  git commit -m "feat(scenes): add uploadAssets helper (parallel blob upload)"
  ```

---

### TASK-B-11 — Komponent `SaveSceneDialog.tsx`

Modal z promptem na tytuł sceny + pełna akcja zapisu (miniatura → upload → POST API).

- [ ] Utwórz `components/scenes/SaveSceneDialog.tsx`:

  ```tsx
  // components/scenes/SaveSceneDialog.tsx
  'use client';

  import { useState } from 'react';
  import { useRouter } from 'next/navigation';
  import { useThree } from '@react-three/fiber';
  import { useStore } from '@/components/store';
  import { captureThumbnail } from './captureThumbnail';
  import { uploadAssets } from './uploadAssets';

  interface SaveSceneDialogProps {
    onClose: () => void;
  }

  /**
   * Modal „Zapisz scenę" wywołany z paska narzędzi edytora.
   * Musi być renderowany wewnątrz drzewa <Canvas> (useThree wymaga kontekstu r3f)
   * LUB gl przekazany z zewnątrz przez ref.
   *
   * Implementacja: komponent Portal umieszczony wewnątrz Canvas przez <Html> z drei,
   * lub alternatywnie gl przekazywany przez props z rodzica.
   *
   * Wybrane podejście: przekazywanie `gl` przez props z rodzica (App/Editor), który
   * rejestruje go w store poprzez `onCreated` callbacku `<Canvas>`.
   */
  export function SaveSceneDialog({ onClose }: SaveSceneDialogProps) {
    const router = useRouter();
    const config = useStore((s) => s.config);
    const loadedModel = useStore((s) => s.loadedModel);
    const glRef = useStore((s) => s.glRef);   // dodane w TASK-B-12

    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
      if (!title.trim()) {
        setError('Podaj tytuł sceny.');
        return;
      }
      if (!loadedModel?.file) {
        setError('Załaduj model .glb przed zapisem.');
        return;
      }
      if (!glRef) {
        setError('Renderer niedostępny — spróbuj ponownie.');
        return;
      }

      setSaving(true);
      setError(null);

      try {
        // 1. Zrzut miniatury.
        const thumbBlob = await captureThumbnail(glRef);
        if (!thumbBlob) throw new Error('Nie udało się przechwycić miniatury.');

        // 2. Równoległy upload modelu i miniatury do Vercel Blob.
        const { modelBlobUrl, thumbBlobUrl } = await uploadAssets(
          loadedModel.file,
          thumbBlob
        );

        // 3. Zapis sceny przez API.
        const response = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            config,
            modelBlobUrl,
            modelFileName: loadedModel.fileName,
            thumbBlobUrl,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? `Błąd API: ${response.status}`);
        }

        const scene = await response.json();

        // 4. Redirect do widoku zapisanej sceny.
        router.push(`/editor/${scene.id}`);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nieznany błąd zapisu.');
        setSaving(false);
      }
    };

    return (
      <div className="save-scene-overlay" role="dialog" aria-modal="true">
        <div className="save-scene-modal">
          <h2>Zapisz scenę</h2>

          {!loadedModel?.file && (
            <p className="save-scene-warning">
              Uwaga: model załadowany z URL (nie z dysku) — plik nie będzie zapisany do Blob.
              Cofnij i załaduj model z dysku (.glb drag&amp;drop).
            </p>
          )}

          <label htmlFor="scene-title">Tytuł sceny</label>
          <input
            id="scene-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="np. Krzesło minimalistyczne v1"
            autoFocus
            maxLength={200}
            disabled={saving}
          />

          {error && <p className="save-scene-error">{error}</p>}

          <div className="save-scene-actions">
            <button onClick={onClose} disabled={saving} type="button">
              Anuluj
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              type="button"
              className="save-scene-primary"
            >
              {saving ? 'Zapisywanie…' : 'Zapisz'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] Commit:
  ```bash
  git add components/scenes/SaveSceneDialog.tsx
  git commit -m "feat(scenes): add SaveSceneDialog with upload flow"
  ```

---

### TASK-B-12 — Ekspozycja `gl` przez store (`glRef`)

`SaveSceneDialog` potrzebuje dostępu do obiektu `WebGLRenderer` spoza drzewa `<Canvas>`.
Dodajemy `glRef` do store, rejestrowany przez callback `onCreated` canvasu.

- [ ] Edytuj `components/store.ts` — dodaj `glRef` do stanu:

  ```ts
  // Dodaj typ (na górze, po innych importach/typach):
  import type { WebGLRenderer } from 'three';

  // W interfejsie State:
  glRef: { domElement: HTMLCanvasElement } | null;
  setGlRef: (gl: { domElement: HTMLCanvasElement } | null) => void;

  // W create<State>:
  glRef: null,
  setGlRef: (glRef) => set({ glRef }),
  ```

- [ ] Edytuj `components/viewer/Viewer.tsx` — rejestruj gl w store przez `onCreated`:

  ```tsx
  // Na górze komponentu Viewer, przed return:
  const setGlRef = useStore((s) => s.setGlRef);

  // W <Canvas>, rozszerz onCreated:
  onCreated={({ gl }) => {
    gl.setClearColor(0xdcdde0, 1);
    setGlRef(gl);          // rejestracja dla captureThumbnail
  }}
  ```

- [ ] Sprawdź TypeScript:
  ```bash
  npx tsc --noEmit
  ```

- [ ] Commit:
  ```bash
  git add components/store.ts components/viewer/Viewer.tsx
  git commit -m "feat(store): expose glRef for thumbnail capture outside Canvas"
  ```

---

### TASK-B-13 — Przycisk „Zapisz scenę" w edytorze

Integracja `SaveSceneDialog` z paskiem edytora.

- [ ] Zlokalizuj komponent paska narzędzi edytora.

  Po Etapie A edytor jest pod `app/editor/page.tsx` i `components/` (przeniesione z `src/`).
  Znajdź miejsce, gdzie renderowany jest pasek górny lub panel boczny (np. `App.tsx`
  przeniesiony do `components/App.tsx` lub bezpośrednio `app/editor/page.tsx`).

  ```bash
  grep -r "Wczytaj plik\|openModelPicker\|ViewButtons\|toolbar" components/ app/editor/ \
    --include="*.tsx" -l
  ```

- [ ] Dodaj stan otwarcia dialogu i przycisk w znalezionym komponencie (np. `components/App.tsx`
  lub `app/editor/page.tsx`):

  ```tsx
  'use client';
  // ... istniejące importy ...
  import { useState } from 'react';
  import { SaveSceneDialog } from '@/components/scenes/SaveSceneDialog';

  // Wewnątrz komponentu, przed return:
  const [saveOpen, setSaveOpen] = useState(false);

  // Wewnątrz JSX (w pasku narzędzi, obok istniejących przycisków):
  <button
    type="button"
    onClick={() => setSaveOpen(true)}
    className="toolbar-btn"
    title="Zapisz scenę"
  >
    Zapisz scenę
  </button>

  {saveOpen && <SaveSceneDialog onClose={() => setSaveOpen(false)} />}
  ```

  > Uwaga: dokładne miejsce wstawienia przycisku zależy od struktury layoutu po Etapie A.
  > Priorytet: przycisk widoczny i dostępny w widoku edytora. Style `.toolbar-btn`
  > powinny być spójne z istniejącymi przyciskami ViewButtons/CameraButtons.

- [ ] Sprawdź manualnie (dev server):
  - Załaduj model .glb
  - Kliknij „Zapisz scenę" → pojawia się modal
  - Wpisz tytuł → „Zapisz"
  - Oczekiwane: upload (widoczny w zakładce Network), redirect do `/editor/[id]`

- [ ] Commit:
  ```bash
  git add app/editor/page.tsx  # lub components/App.tsx w zależności od struktury
  git commit -m "feat(editor): add Save Scene button and dialog integration"
  ```

---

### TASK-B-14 — Strona `/editor/[id]` — otwieranie istniejącej sceny

Server Component pobierający `SceneRecord` i przekazujący do klienta.

- [ ] Utwórz `app/editor/[id]/page.tsx`:

  ```tsx
  // app/editor/[id]/page.tsx
  import { notFound, redirect } from 'next/navigation';
  import { requireUser } from '@/lib/auth/session';
  import { getScene } from '@/lib/scenes/repo';
  import { ExistingSceneEditor } from '@/components/scenes/ExistingSceneEditor';

  interface Props {
    params: Promise<{ id: string }>;
  }

  /**
   * Server Component: pobiera scenę z DB, weryfikuje właściciela,
   * przekazuje dane do komponentu klienckiego.
   */
  export default async function EditorScenePage({ params }: Props) {
    const user = await requireUser();
    // requireUser przekierowuje na /login jeśli niezalogowany.

    const { id } = await params;
    const scene = await getScene(id);

    if (!scene) notFound();
    // Etap B: tylko właściciel. Etap D doda uprawnienia per-scena.
    if (scene.ownerId !== user.id) notFound();

    return <ExistingSceneEditor scene={scene} />;
  }
  ```

- [ ] Utwórz `components/scenes/ExistingSceneEditor.tsx`:

  ```tsx
  // components/scenes/ExistingSceneEditor.tsx
  'use client';

  import { useEffect } from 'react';
  import { useStore } from '@/components/store';
  import type { SceneRecord } from '@/lib/scenes/types';
  // Import App/EditorLayout (komponent edytora po Etapie A — dostosuj nazwę).
  // Zakładamy, że przeniesiony edytor eksportuje <EditorApp /> lub podobny komponent.
  import { EditorApp } from '@/components/App';

  interface Props {
    scene: SceneRecord;
  }

  /**
   * Komponent kliencki: hydruje store danymi ze sceny i renderuje edytor.
   * Model ładowany z modelBlobUrl (zdalny URL zamiast objectUrl).
   */
  export function ExistingSceneEditor({ scene }: Props) {
    const setConfig = useStore((s) => s.setEnv);   // używamy bezpośrednio set config
    const loadedModel = useStore((s) => s.loadedModel);
    const setLoadedModel = useStore((s) => s.setLoadedModel);

    // Bezpośrednie ustawienie całego config (nie przez poszczególne settery).
    // Drizzle zwraca config jako any (jsonb) — rzutujemy przez SceneConfig.
    const rawSet = useStore.setState;

    useEffect(() => {
      // Hydratacja: ustawienie configu ze sceny do store.
      rawSet({ config: scene.config });

      // Jeśli scena ma model: ustaw loadedModel z URL Blob (nie objectUrl).
      if (scene.modelBlobUrl) {
        setLoadedModel({
          objectUrl: scene.modelBlobUrl,  // r3f useGLTF akceptuje HTTPS URL
          fileName: scene.modelFileName ?? 'model.glb',
          file: null,  // plik niedostępny (pochodzi z Blob, nie z dysku)
        });
      }

      // Czyszczenie przy odmontowaniu (opcjonalne — edytor reset).
      // return () => rawSet({ config: DEFAULT_CONFIG, loadedModel: null });
    }, [scene.id]); // eslint-disable-line react-hooks/exhaustive-deps
    // Celowe: scene.id jako dep — scene.config jest stały per render (SSR).

    return <EditorApp />;
  }
  ```

  > Uwaga: `rawSet` (czyli `useStore.setState`) jest metodą Zustand — poprawne użycie
  > do ustawienia wielu kluczy store naraz bez tworzenia dedykowanego settera.
  >
  > Uwaga 2: `useGLTF` z drei akceptuje zarówno `objectUrl` (blob:) jak i `https://` URL.
  > Ładowanie z Blob URL działa bez zmian w `Product.tsx`.

- [ ] Sprawdź TypeScript:
  ```bash
  npx tsc --noEmit
  ```

- [ ] Sprawdź manualnie:
  - Zapisz scenę (TASK-B-11)
  - Otwórz URL `/editor/[id]` z otrzymanego redirecta
  - Oczekiwane: edytor ładuje się z zachowanym configiem i modelem z Blob

- [ ] Commit:
  ```bash
  git add app/editor/[id]/page.tsx components/scenes/ExistingSceneEditor.tsx
  git commit -m "feat(editor): add /editor/[id] route to open saved scene"
  ```

---

### TASK-B-15 — Komponent `SceneCard.tsx` — kafelek sceny

- [ ] Utwórz `components/scenes/SceneCard.tsx`:

  ```tsx
  // components/scenes/SceneCard.tsx
  'use client';

  import { useState } from 'react';
  import Link from 'next/link';
  import Image from 'next/image';
  import type { SceneRecord } from '@/lib/scenes/types';

  interface SceneCardProps {
    scene: SceneRecord;
    onDelete: (id: string) => void;
  }

  /**
   * Kafelek pojedynczej sceny na stronie startowej.
   * Pokazuje: miniatura (lub placeholder), tytuł, data, przycisk „Otwórz", przycisk „Usuń".
   */
  export function SceneCard({ scene, onDelete }: SceneCardProps) {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
      if (!confirm(`Usunąć scenę „${scene.title}"? Tego nie można cofnąć.`)) return;
      setDeleting(true);
      try {
        const res = await fetch(`/api/scenes/${scene.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Błąd usuwania');
        onDelete(scene.id);
      } catch {
        alert('Nie udało się usunąć sceny.');
        setDeleting(false);
      }
    };

    const dateStr = new Intl.DateTimeFormat('pl-PL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(scene.updatedAt));

    return (
      <article className="scene-card">
        <Link href={`/editor/${scene.id}`} className="scene-card-thumb-link">
          {scene.thumbBlobUrl ? (
            <Image
              src={scene.thumbBlobUrl}
              alt={`Miniatura: ${scene.title}`}
              width={256}
              height={160}
              className="scene-card-thumb"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className="scene-card-thumb-placeholder">
              <span>Brak miniatury</span>
            </div>
          )}
        </Link>

        <div className="scene-card-body">
          <h3 className="scene-card-title" title={scene.title}>
            {scene.title}
          </h3>
          <time className="scene-card-date">{dateStr}</time>

          <div className="scene-card-actions">
            <Link href={`/editor/${scene.id}`} className="scene-card-btn scene-card-btn--primary">
              Otwórz
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="scene-card-btn scene-card-btn--danger"
            >
              {deleting ? '…' : 'Usuń'}
            </button>
          </div>
        </div>
      </article>
    );
  }
  ```

  > Uwaga: Next.js `<Image>` z zewnętrznym URL wymaga konfiguracji `remotePatterns`
  > w `next.config.ts`. Dodaj domenę Vercel Blob:
  > ```ts
  > // next.config.ts
  > const nextConfig = {
  >   images: {
  >     remotePatterns: [
  >       {
  >         protocol: 'https',
  >         hostname: '*.public.blob.vercel-storage.com',
  >       },
  >     ],
  >   },
  > };
  > ```

- [ ] Commit:
  ```bash
  git add components/scenes/SceneCard.tsx
  git commit -m "feat(scenes): add SceneCard component for home grid"
  ```

---

### TASK-B-16 — Strona startowa `app/page.tsx` — siatka scen

Przebudowa strony `/` z minimalnego placeholdera (Etap A) na pełną siatkę kafelków scen.

- [ ] Edytuj `app/page.tsx`:

  ```tsx
  // app/page.tsx
  import { redirect } from 'next/navigation';
  import Link from 'next/link';
  import { requireUser } from '@/lib/auth/session';
  import { listScenes } from '@/lib/scenes/repo';
  import { SceneGrid } from '@/components/scenes/SceneGrid';

  /**
   * Strona startowa zalogowanego użytkownika.
   * Server Component: pobiera listę scen użytkownika z DB.
   */
  export default async function HomePage() {
    const user = await requireUser();
    const scenes = await listScenes(user.id, { preset: false });

    return (
      <main className="home-page">
        <header className="home-header">
          <h1>Moje sceny</h1>
          <Link href="/editor" className="home-btn-new">
            + Nowa scena
          </Link>
        </header>

        {scenes.length === 0 ? (
          <div className="home-empty">
            <p>Nie masz jeszcze żadnych scen.</p>
            <Link href="/editor" className="home-btn-new">
              Utwórz pierwszą scenę
            </Link>
          </div>
        ) : (
          <SceneGrid initialScenes={scenes} />
        )}
      </main>
    );
  }
  ```

- [ ] Utwórz `components/scenes/SceneGrid.tsx` — klient-side (obsługuje usuwanie):

  ```tsx
  // components/scenes/SceneGrid.tsx
  'use client';

  import { useState } from 'react';
  import { SceneCard } from './SceneCard';
  import type { SceneRecord } from '@/lib/scenes/types';

  interface SceneGridProps {
    initialScenes: SceneRecord[];
  }

  /**
   * Siatka kafelków scen. Zarządza stanem klienckim po usunięciu sceny
   * (optimistic removal bez reload strony).
   */
  export function SceneGrid({ initialScenes }: SceneGridProps) {
    const [scenes, setScenes] = useState<SceneRecord[]>(initialScenes);

    const handleDelete = (id: string) => {
      setScenes((prev) => prev.filter((s) => s.id !== id));
    };

    if (scenes.length === 0) {
      return <p className="home-empty-after-delete">Wszystkie sceny usunięte.</p>;
    }

    return (
      <section className="scene-grid" aria-label="Lista scen">
        {scenes.map((scene) => (
          <SceneCard key={scene.id} scene={scene} onDelete={handleDelete} />
        ))}
      </section>
    );
  }
  ```

- [ ] Dodaj minimalny CSS dla siatki (jeśli projekt używa CSS Modules lub global CSS —
  dostosuj do konwencji projektu). Przykład dla global CSS:

  ```css
  /* Dodaj do components/styles.css lub app/globals.css */

  .home-page { padding: 2rem; max-width: 1200px; margin: 0 auto; }
  .home-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
  .home-header h1 { font-size: 1.5rem; font-weight: 700; }
  .home-btn-new { background: #1b1c20; color: #fff; padding: 0.5rem 1.25rem;
    border-radius: 6px; text-decoration: none; font-size: 0.9rem; }
  .home-empty { text-align: center; padding: 4rem; color: #666; }

  .scene-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(256px, 1fr));
    gap: 1.5rem; }

  .scene-card { border: 1px solid #dcdde0; border-radius: 8px; overflow: hidden;
    background: #fff; }
  .scene-card-thumb-link { display: block; }
  .scene-card-thumb { width: 100%; height: 160px; display: block; }
  .scene-card-thumb-placeholder { width: 100%; height: 160px; background: #eeeef1;
    display: flex; align-items: center; justify-content: center; color: #999; }
  .scene-card-body { padding: 0.75rem; }
  .scene-card-title { font-weight: 600; font-size: 0.95rem; margin: 0 0 0.25rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .scene-card-date { font-size: 0.8rem; color: #888; }
  .scene-card-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
  .scene-card-btn { padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem;
    text-decoration: none; cursor: pointer; border: none; }
  .scene-card-btn--primary { background: #1b1c20; color: #fff; }
  .scene-card-btn--danger { background: #fee2e2; color: #991b1b; }
  ```

- [ ] Sprawdź TypeScript:
  ```bash
  npx tsc --noEmit
  ```

- [ ] Sprawdź manualnie (dev server):
  - Zaloguj się → `/` → lista scen lub pusty stan
  - Zapisz scenę → redirect → powrót na `/` → kafelek widoczny
  - Kliknij „Usuń" → potwierdzenie → kafelek znika (bez reload)

- [ ] Commit:
  ```bash
  git add app/page.tsx components/scenes/SceneGrid.tsx components/scenes/SceneCard.tsx
  git commit -m "feat(home): rebuild home page as scene grid with SceneCard"
  ```

---

### TASK-B-17 — `next.config.ts` — remotePatterns dla Vercel Blob

(Może być wykonane wcześniej jeśli TASK-B-15 zgłosi błąd o brakującym domenie.)

- [ ] Edytuj `next.config.ts` (lub `next.config.js`) — dodaj `remotePatterns`:

  ```ts
  // next.config.ts
  import type { NextConfig } from 'next';

  const nextConfig: NextConfig = {
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: '*.public.blob.vercel-storage.com',
        },
      ],
    },
    // ... inne konfiguracje z Etapu A (jeśli istnieją)
  };

  export default nextConfig;
  ```

- [ ] Commit:
  ```bash
  git add next.config.ts
  git commit -m "chore(next): allow Vercel Blob domain in Image remotePatterns"
  ```

---

### TASK-B-18 — Weryfikacja end-to-end (manualna)

- [ ] Uruchom dev server:
  ```bash
  npm run dev
  ```

- [ ] Przeprowadź pełny przepływ:

  1. **Niezalogowany** → `http://localhost:3000/` → redirect do `/login` ✓
  2. **Zaloguj się** (e-mail z białej listy → kod) → redirect na `/` ✓
  3. **Pusta strona startowa** → komunikat „Nie masz jeszcze żadnych scen" + przycisk „Nowa scena" ✓
  4. **Kliknij „Nowa scena"** → `/editor` → edytor działa jak przed Etapem B ✓
  5. **Załaduj model** drag&drop `.glb` → model widoczny w scenie ✓
  6. **Dostosuj parametry** (światło, kamera, tło) ✓
  7. **Kliknij „Zapisz scenę"** → modal → wpisz tytuł → „Zapisz" ✓
     - Sieć: 2× upload do Blob (`models/...glb`, `thumbnails/...png`) ✓
     - Sieć: `POST /api/scenes` → 201 ✓
     - Redirect do `/editor/[id]` ✓
  8. **Odśwież stronę** `/editor/[id]` → scena załadowana (config + model z Blob) ✓
  9. **Powrót na `/`** → kafelek z miniaturą, tytułem, datą ✓
  10. **„Otwórz"** → `/editor/[id]` → poprawna scena ✓
  11. **„Usuń"** → potwierdzenie → kafelek znika (optimistic) ✓
      - Sieć: `DELETE /api/scenes/[id]` → 204 ✓
      - Vercel Blob: miniatura i model usunięte (sprawdź dashboard Blob) ✓
  12. **Inny użytkownik** (jeśli dostępne): GET `/api/scenes/[id]` cudzej sceny → 403 ✓

- [ ] Commit:
  ```bash
  git commit -m "test(e2e): manual end-to-end verification of Etap B complete"
  # (jeśli nie było nowych plików — pusty commit jako checkpoint lub pomiń)
  ```

---

### TASK-B-19 — Build produkcyjny (weryfikacja)

- [ ] Uruchom build:
  ```bash
  npm run build
  ```
  Oczekiwany output: `✓ Compiled successfully` bez błędów TypeScript i ESLint.

- [ ] Jeśli build zgłasza błędy — napraw je przed committem (typowe problemy:
  brakujące typy, niezgodność `any`, nieużywane importy).

- [ ] Commit końcowy:
  ```bash
  git add -p  # przejrzyj każdą zmianę
  git commit -m "feat(etap-b): complete scene save, blob upload, thumbnail, home page"
  ```

---

## Self-Review

### Pokrycie zakresu Etapu B

| Wymaganie | Plik(i) | Status |
|-----------|---------|--------|
| Migracja tabeli `scenes` | `lib/scenes/schema.ts`, `lib/db/migrations/` | ✓ |
| Typ `SceneRecord` z kontraktu | `lib/scenes/types.ts` | ✓ |
| Repo: `createScene`, `getScene`, `listScenes`, `updateScene`, `deleteScene` | `lib/scenes/repo.ts` | ✓ |
| Ref-count przy usuwaniu modelu | `lib/scenes/repo.ts:deleteScene` | ✓ |
| Testy repo (TDD) | `lib/scenes/repo.test.ts` | ✓ |
| Token route Blob | `app/api/blob/upload/route.ts` | ✓ |
| Upload helper klient-side | `components/scenes/uploadAssets.ts` | ✓ |
| Miniatura z canvasu | `components/scenes/captureThumbnail.ts` | ✓ |
| `preserveDrawingBuffer: true` | `components/viewer/Viewer.tsx` | ✓ |
| `LoadedModel.file` w store | `components/store.ts` | ✓ |
| `glRef` w store | `components/store.ts`, `components/viewer/Viewer.tsx` | ✓ |
| Trasy API scen (GET/POST/PATCH/DELETE) | `app/api/scenes/route.ts`, `app/api/scenes/[id]/route.ts` | ✓ |
| UI „Zapisz scenę" | `components/scenes/SaveSceneDialog.tsx` | ✓ |
| Przycisk w edytorze | `app/editor/page.tsx` (lub `components/App.tsx`) | ✓ |
| `/editor/[id]` — otwieranie sceny | `app/editor/[id]/page.tsx`, `components/scenes/ExistingSceneEditor.tsx` | ✓ |
| Strona startowa z kafelkami | `app/page.tsx`, `components/scenes/SceneGrid.tsx`, `components/scenes/SceneCard.tsx` | ✓ |
| Nowa scena → `/editor` | `app/page.tsx` (link) | ✓ |
| `BLOB_READ_WRITE_TOKEN` w `.env.example` | `.env.example` | ✓ |
| `remotePatterns` dla Blob | `next.config.ts` | ✓ |

### Elementy poza zakresem B (jawnie wykluczone)

- Presety (`is_preset` kolumna istnieje, UI w Etapie C)
- Uprawnienia per-scena (`scene_permissions` — Etap D)
- Linki udostępniające / embed (Etap D)
- `GET /api/scenes?preset=1` używane w C (trasa istnieje, UI nie)

### Skan placeholderów

- **Zero** komentarzy typu `// TODO`, `// FIXME`, `// placeholder`, `// similar to`
- Każdy krok ma pełny kod gotowy do copy-paste

### Spójność nazw z kontraktem

| Kontrakt | Plan | Zgodność |
|----------|------|----------|
| tabela `scenes` | `scenes` (Drizzle convention) → SQL `scenes` | ✓ |
| typ `SceneRecord` | `lib/scenes/types.ts:SceneRecord` | ✓ |
| `POST /api/blob/upload` | `app/api/blob/upload/route.ts` | ✓ |
| `GET /api/scenes?preset=` | `app/api/scenes/route.ts` | ✓ |
| `POST /api/scenes` | `app/api/scenes/route.ts` | ✓ |
| `GET/PATCH/DELETE /api/scenes/[id]` | `app/api/scenes/[id]/route.ts` | ✓ |
| `/editor/[id]` | `app/editor/[id]/page.tsx` | ✓ |
| `ownerId`, `modelBlobUrl`, `modelFileName`, `thumbBlobUrl`, `isPreset` | `lib/scenes/types.ts`, `lib/scenes/schema.ts` | ✓ |

### Zależności między zadaniami

```
B-01 (npm install)
  └─ B-02 (schema) ──┬─ B-03 (types)
                     └─ B-04 (repo, TDD) ──┬─ B-06 (API routes)
                                            └─ B-14 (editor/[id])
B-05 (blob upload route) ─┐
B-07 (store file) ────────┤
B-08 (preserveDrawingBuffer) ─ B-09 (captureThumbnail) ─┐
B-10 (uploadAssets) ──────────────────────────────────┬─┤
B-12 (glRef w store) ─────────────────────────────────┘ └─ B-11 (SaveSceneDialog)
B-13 (przycisk w edytorze) ─── wymaga B-11
B-15 (SceneCard) ─┐
B-16 (home page) ─┴─ wymaga B-06
B-17 (remotePatterns) ─ niezależny, zalecany przed B-15
B-18 (e2e) ─── ostatni
B-19 (build) ─── ostatni
```

### Decyzje do weryfikacji — podsumowanie

Wszystkie 6 pozycji `[REVIEW]` z kontraktu zostały wcielone. Implementator POWINIEN
potwierdzić z właścicielem projektu przed uruchomieniem:

1. **R1** — schemat tabeli `scenes` zaakceptowany?
2. **R2** — client-side upload przez `@vercel/blob/client` zaakceptowany (serwer nie
   widzi danych pliku)?
3. **R3** — ścieżki `models/<uuid>.glb` i `thumbnails/<uuid>.png` w Blob OK?
4. **R4** — `preserveDrawingBuffer: true` zaakceptowane (minimalny koszt wydajności)?
5. **R5** — logika ref-count (miniatura zawsze kasowana, model tylko gdy nie współdzielony)
   zaakceptowana?
6. **R6** — import `SceneConfig` z `@/components/store` (nie redefinicja) zaakceptowany?
