# Studio — Etap 1b: persystencja (tabela + repo + API + audyt) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **Branch:** kontynuacja na `feat/studio-gltf-core` (NIE main). Plan 2 z 3 dla Etapu 1 (po 1a). Spec: `docs/superpowers/specs/2026-06-01-studio-etap-1-import-design.md`.

**Goal:** Warstwa persystencji modułu Studio: tabela `studio_projects`, repo CRUD owner-scoped, trasy API właściciela, oraz wpięcie artefaktu źródłowego (`sources/`) w upload Blob i audyt sierot (żeby audyt nie kasował źródeł studio).

**Architecture:** Nowa, izolowana tabela `studio_projects` (nie dotyka `scenes`). Repo wzorowane na `lib/scenes/repo.ts`; trasy API na `app/api/scenes/`. Źródło modelu trzymane pod prefiksem Blob `sources/<uuid>.zip|.glb`; audyt (`blobAudit`) uczy się tego prefiksu i sumuje referencje scen + studio.

**Tech Stack:** drizzle-orm + Neon, Next.js route handlers, zod, vitest (mock `@/lib/db` + `@vercel/blob`).

---

## Struktura plików

| Plik | Odpowiedzialność | Test |
|---|---|---|
| `lib/studio/types.ts` | Typy domeny (`StudioProjectRecord`, Create/Update input, `SourceKind`) | — |
| `lib/studio/schema.ts` | Drizzle tabela `studio_projects` | — |
| `drizzle.config.ts` (mod) | Dopisanie schematu studio do generowania migracji | — |
| `lib/db/migrations/0003_*.sql` | Wygenerowana migracja (CREATE TABLE) | — |
| `lib/studio/repo.ts` | CRUD owner-scoped + `getStudioReferencedBlobUrls` | ✅ |
| `app/api/blob/upload/route.ts` (mod) | Dozwolony prefiks `sources/` (+ typy zip) | — |
| `lib/scenes/blobAudit.ts` (mod) | Rodzaj `source`; suma referencji scen + studio | ✅ |
| `app/api/studio/route.ts` | GET (lista własnych) + POST (utwórz) | ✅ |
| `app/api/studio/[id]/route.ts` | GET/PATCH/DELETE (właściciel) | ✅ |

**Uwaga o migracji:** `npx drizzle-kit generate` działa OFFLINE (nie łączy się z DB). **Zastosowanie** migracji na Neon (`npx drizzle-kit migrate`) to osobny krok deploy wymagający `DATABASE_URL` — NIE jest częścią automatycznych tasków (testy mockują DB). Flaguje go Task 2.

---

## Task 1: Typy + schemat tabeli

**Files:**
- Create: `lib/studio/types.ts`
- Create: `lib/studio/schema.ts`

- [ ] **Step 1: Utwórz `lib/studio/types.ts`**

```ts
// lib/studio/types.ts
import type { SceneConfig } from '@/components/store';

/** glb = pojedynczy plik; gltf-zip = multi-file spakowany do .zip. */
export type SourceKind = 'glb' | 'gltf-zip';

/** Rekord projektu Studio — wiersz tabeli `studio_projects`. */
export interface StudioProjectRecord {
  id: string;
  ownerId: string;
  title: string;
  sourceBlobUrl: string;
  sourceFileName: string;
  sourceKind: SourceKind;
  config: SceneConfig;
  thumbBlobUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateStudioProjectInput = {
  title: string;
  sourceBlobUrl: string;
  sourceFileName: string;
  sourceKind: SourceKind;
  config: SceneConfig;
  thumbBlobUrl: string | null;
};

export type UpdateStudioProjectInput = Partial<
  Pick<StudioProjectRecord, 'title' | 'config' | 'thumbBlobUrl' | 'sourceBlobUrl' | 'sourceFileName' | 'sourceKind'>
>;
```

- [ ] **Step 2: Utwórz `lib/studio/schema.ts`**

```ts
// lib/studio/schema.ts
import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from '@/lib/db/schema';

export const studioProjects = pgTable(
  'studio_projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    sourceBlobUrl: text('source_blob_url').notNull(),
    sourceFileName: text('source_file_name').notNull(),
    sourceKind: text('source_kind').notNull(), // 'glb' | 'gltf-zip'
    config: jsonb('config').notNull(),
    thumbBlobUrl: text('thumb_blob_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('studio_projects_owner_id_idx').on(t.ownerId)]
);
```

- [ ] **Step 3: Verify compile** — `npx tsc --noEmit -p tsconfig.json` → brak błędów w `lib/studio/*`.

- [ ] **Step 4: Commit**

```bash
git add lib/studio/types.ts lib/studio/schema.ts
git commit -m "feat(studio): add studio_projects schema and domain types"
```

---

## Task 2: Rejestracja schematu + wygenerowanie migracji

**Files:**
- Modify: `drizzle.config.ts`
- Generated: `lib/db/migrations/0003_*.sql` (+ meta)

- [ ] **Step 1: Dopisz schemat studio do `drizzle.config.ts`**

Zmień tablicę `schema` z:
```ts
  schema: ['./lib/db/schema.ts', './lib/scenes/schema.ts'],
```
na:
```ts
  schema: ['./lib/db/schema.ts', './lib/scenes/schema.ts', './lib/studio/schema.ts'],
```

- [ ] **Step 2: Wygeneruj migrację (OFFLINE — bez połączenia z DB)**

Run: `npx drizzle-kit generate`
Expected: powstaje plik `lib/db/migrations/0003_*.sql` zawierający `CREATE TABLE "studio_projects"` z kolumnami i FK `owner_id → users(id) ON DELETE cascade`, oraz aktualizacja `meta/_journal.json` (nowy wpis idx=3) i `0003_snapshot.json`.

- [ ] **Step 3: Zweryfikuj treść migracji**

Run: `grep -i "studio_projects" lib/db/migrations/0003_*.sql`
Expected: linia `CREATE TABLE ... "studio_projects"` (+ kolumny). Jeśli plik nie powstał, sprawdź czy `lib/studio/schema.ts` jest poprawnie wskazany w configu i powtórz.

- [ ] **Step 4: Commit**

```bash
git add drizzle.config.ts lib/db/migrations/
git commit -m "feat(studio): generate studio_projects migration (0003)"
```

> **NIE uruchamiaj** `drizzle-kit migrate`/`push` w tym tasku — zastosowanie na Neon to świadomy krok deploy poza tym planem. Testy repo (Task 3) mockują DB i nie wymagają zastosowanej migracji.

---

## Task 3: Repo CRUD owner-scoped + testy

**Files:**
- Create: `lib/studio/repo.ts`
- Test: `lib/studio/repo.test.ts`

- [ ] **Step 1: Write the failing test** — create `lib/studio/repo.test.ts`:

```ts
// lib/studio/repo.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StudioProjectRecord, CreateStudioProjectInput } from './types';

vi.mock('@/lib/db', () => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('@vercel/blob', () => ({ del: vi.fn() }));

import {
  createProject, getProject, listProjects, updateProject, deleteProject, getStudioReferencedBlobUrls,
} from './repo';

const OWNER = 'user-uuid-1';
const PID = 'proj-uuid-1';

const rec: StudioProjectRecord = {
  id: PID,
  ownerId: OWNER,
  title: 'Mój model',
  sourceBlobUrl: 'https://b/sources/abc.zip',
  sourceFileName: 'scene.zip',
  sourceKind: 'gltf-zip',
  config: {} as StudioProjectRecord['config'],
  thumbBlobUrl: 'https://b/thumbnails/abc.png',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

beforeEach(() => vi.clearAllMocks());

describe('createProject', () => {
  it('zwraca rekord po zapisie', async () => {
    const { db } = await import('@/lib/db');
    (db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([rec]) }),
    });
    const input: CreateStudioProjectInput = {
      title: 'Mój model',
      sourceBlobUrl: rec.sourceBlobUrl,
      sourceFileName: 'scene.zip',
      sourceKind: 'gltf-zip',
      config: {} as CreateStudioProjectInput['config'],
      thumbBlobUrl: rec.thumbBlobUrl,
    };
    const out = await createProject(OWNER, input);
    expect(out.id).toBe(PID);
    expect(out.ownerId).toBe(OWNER);
    expect(out.sourceKind).toBe('gltf-zip');
  });
});

describe('getProject', () => {
  it('zwraca rekord gdy istnieje', async () => {
    const { db } = await import('@/lib/db');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([rec]) }),
    });
    const out = await getProject(PID);
    expect(out!.id).toBe(PID);
  });
  it('zwraca null gdy nie istnieje', async () => {
    const { db } = await import('@/lib/db');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });
    expect(await getProject('nope')).toBeNull();
  });
});

describe('listProjects', () => {
  it('zwraca projekty właściciela', async () => {
    const { db } = await import('@/lib/db');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([rec]) }),
      }),
    });
    const out = await listProjects(OWNER);
    expect(out).toHaveLength(1);
    expect(out[0].ownerId).toBe(OWNER);
  });
});

describe('updateProject', () => {
  it('utrwala patch i zwraca rekord', async () => {
    const { db } = await import('@/lib/db');
    const updated = { ...rec, title: 'Nowy' };
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([updated]) }),
    });
    (db.update as any).mockReturnValue({ set: setSpy });
    const out = await updateProject(PID, { title: 'Nowy' });
    expect(setSpy.mock.calls[0][0]).toMatchObject({ title: 'Nowy' });
    expect(out!.title).toBe('Nowy');
  });
  it('zwraca null gdy rekord nie istnieje', async () => {
    const { db } = await import('@/lib/db');
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    });
    expect(await updateProject('nope', { title: 'x' })).toBeNull();
  });
});

describe('deleteProject', () => {
  it('kasuje rekord oraz źródło i miniaturę z Blob', async () => {
    const { db } = await import('@/lib/db');
    const { del } = await import('@vercel/blob');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([rec]) }),
    });
    (db.delete as any).mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    await deleteProject(PID);
    expect(del).toHaveBeenCalledWith(rec.sourceBlobUrl);
    expect(del).toHaveBeenCalledWith(rec.thumbBlobUrl);
    expect(del).toHaveBeenCalledTimes(2);
  });
  it('jest ciche gdy rekord nie istnieje', async () => {
    const { db } = await import('@/lib/db');
    const { del } = await import('@vercel/blob');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });
    await deleteProject('nope');
    expect(del).not.toHaveBeenCalled();
  });
});

describe('getStudioReferencedBlobUrls', () => {
  it('zbiera niepuste source+thumb URL-e ze wszystkich projektów (dedup, bez null)', async () => {
    const { db } = await import('@/lib/db');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockResolvedValue([
        { source: 'https://b/sources/a.zip', thumb: 'https://b/thumbnails/a.png' },
        { source: 'https://b/sources/b.glb', thumb: null },
        { source: 'https://b/sources/a.zip', thumb: 'https://b/thumbnails/a.png' }, // dup
      ]),
    });
    const set = await getStudioReferencedBlobUrls();
    expect(set.has('https://b/sources/a.zip')).toBe(true);
    expect(set.has('https://b/sources/b.glb')).toBe(true);
    expect(set.has('https://b/thumbnails/a.png')).toBe(true);
    expect(set.size).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run lib/studio/repo.test.ts` → FAIL (`Failed to resolve import "./repo"`).

- [ ] **Step 3: Write implementation** — create `lib/studio/repo.ts`:

```ts
// lib/studio/repo.ts
import { eq, desc } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { db } from '@/lib/db';
import { studioProjects } from './schema';
import type { StudioProjectRecord, CreateStudioProjectInput, UpdateStudioProjectInput, SourceKind } from './types';

export type { StudioProjectRecord, CreateStudioProjectInput, UpdateStudioProjectInput } from './types';

export async function createProject(
  ownerId: string,
  input: CreateStudioProjectInput
): Promise<StudioProjectRecord> {
  const rows = await db
    .insert(studioProjects)
    .values({
      ownerId,
      title: input.title,
      sourceBlobUrl: input.sourceBlobUrl,
      sourceFileName: input.sourceFileName,
      sourceKind: input.sourceKind,
      config: input.config as unknown as Record<string, unknown>,
      thumbBlobUrl: input.thumbBlobUrl ?? null,
    })
    .returning();
  return rowToRecord(rows[0]);
}

export async function getProject(id: string): Promise<StudioProjectRecord | null> {
  const rows = await db.select().from(studioProjects).where(eq(studioProjects.id, id));
  return rows[0] ? rowToRecord(rows[0]) : null;
}

/** Projekty właściciela, najnowsze pierwsze. */
export async function listProjects(ownerId: string): Promise<StudioProjectRecord[]> {
  const rows = await db
    .select()
    .from(studioProjects)
    .where(eq(studioProjects.ownerId, ownerId))
    .orderBy(desc(studioProjects.updatedAt));
  return rows.map(rowToRecord);
}

/** Aktualizuje projekt; ustawia updatedAt=now(). Zwraca null gdy nie istnieje. */
export async function updateProject(
  id: string,
  patch: UpdateStudioProjectInput
): Promise<StudioProjectRecord | null> {
  const rows = await db
    .update(studioProjects)
    .set({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.config !== undefined && { config: patch.config as unknown as Record<string, unknown> }),
      ...(patch.thumbBlobUrl !== undefined && { thumbBlobUrl: patch.thumbBlobUrl }),
      ...(patch.sourceBlobUrl !== undefined && { sourceBlobUrl: patch.sourceBlobUrl }),
      ...(patch.sourceFileName !== undefined && { sourceFileName: patch.sourceFileName }),
      ...(patch.sourceKind !== undefined && { sourceKind: patch.sourceKind }),
      updatedAt: new Date(),
    })
    .where(eq(studioProjects.id, id))
    .returning();
  return rows[0] ? rowToRecord(rows[0]) : null;
}

/**
 * Usuwa projekt + jego pliki Blob (źródło i miniatura są PER-PROJEKT, nie współdzielone,
 * więc kasujemy bez ref-count). Kasowanie Blob jest best-effort (błąd nie wywala DELETE).
 * Ciche gdy projekt nie istnieje.
 */
export async function deleteProject(id: string): Promise<void> {
  const project = await getProject(id);
  if (!project) return;
  await db.delete(studioProjects).where(eq(studioProjects.id, id));
  try {
    await del(project.sourceBlobUrl);
    if (project.thumbBlobUrl) await del(project.thumbBlobUrl);
  } catch (err) {
    console.warn(`[deleteProject] czyszczenie Blob nieudane dla ${id} (rekord usunięty):`, err);
  }
}

/** Wszystkie niepuste source+thumb URL-e ze WSZYSTKICH projektów (dla audytu sierot). */
export async function getStudioReferencedBlobUrls(): Promise<Set<string>> {
  const rows = await db
    .select({ source: studioProjects.sourceBlobUrl, thumb: studioProjects.thumbBlobUrl })
    .from(studioProjects);
  const urls = new Set<string>();
  for (const row of rows) {
    if (row.source) urls.add(row.source);
    if (row.thumb) urls.add(row.thumb);
  }
  return urls;
}

function rowToRecord(row: typeof studioProjects.$inferSelect): StudioProjectRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    sourceBlobUrl: row.sourceBlobUrl,
    sourceFileName: row.sourceFileName,
    sourceKind: row.sourceKind as SourceKind,
    config: row.config as StudioProjectRecord['config'],
    thumbBlobUrl: row.thumbBlobUrl ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run lib/studio/repo.test.ts` → PASS (8).

- [ ] **Step 5: Commit**

```bash
git add lib/studio/repo.ts lib/studio/repo.test.ts
git commit -m "feat(studio): owner-scoped studio_projects repo (CRUD + blob refs)"
```

---

## Task 4: Upload Blob — dozwolony prefiks `sources/`

**Files:**
- Modify: `app/api/blob/upload/route.ts`

- [ ] **Step 1: Rozszerz `onBeforeGenerateToken`**

Zmień blok walidacji ścieżki + zwracane parametry. Zamień:
```ts
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
          // Maksymalny rozmiar: 1 GB dla modeli (duże .glb), 5 MB dla miniatur.
          // Uwaga: modele >100 MB ładują się wolno w przeglądarce i mocno zużywają
          // transfer/Blob — warto je kompresować (Draco / meshopt / gltfpack).
          maximumSizeInBytes: pathname.startsWith('models/') ? MAX_MODEL_BYTES : MAX_THUMB_BYTES,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
```
na:
```ts
        // Dozwolone prefiksy: models/ (sceny .glb), thumbnails/ (miniatury),
        // sources/ (edytowalne źródła Studio: .glb lub .zip multi-file glTF).
        const allowed =
          pathname.startsWith('models/') ||
          pathname.startsWith('thumbnails/') ||
          pathname.startsWith('sources/');
        if (!allowed) {
          throw new Error(`Niedozwolona ścieżka Blob: ${pathname}`);
        }

        const isThumb = pathname.startsWith('thumbnails/');
        return {
          allowedContentTypes: [
            'model/gltf-binary',
            'application/octet-stream',
            'application/zip',
            'image/png',
          ],
          // Miniatury: 5 MB; modele i źródła Studio: do 1 GB.
          // Modele >100 MB ładują się wolno i mocno zużywają transfer/Blob —
          // warto kompresować (Draco / meshopt / gltfpack).
          maximumSizeInBytes: isThumb ? MAX_THUMB_BYTES : MAX_MODEL_BYTES,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
```

- [ ] **Step 2: Verify compile** — `npx tsc --noEmit -p tsconfig.json` → brak błędów.

- [ ] **Step 3: Commit**

```bash
git add app/api/blob/upload/route.ts
git commit -m "feat(studio): allow sources/ prefix (zip) in blob upload token route"
```

---

## Task 5: Audyt sierot świadomy `sources/` + suma referencji

**Files:**
- Modify: `lib/scenes/blobAudit.ts`
- Test: `lib/scenes/blobAudit.test.ts`

- [ ] **Step 1: Zaktualizuj test (mock studio repo + nowe przypadki)**

W `lib/scenes/blobAudit.test.ts` dodaj POD istniejącym `vi.mock('./repo', ...)`:
```ts
vi.mock('@/lib/studio/repo', () => ({
  getStudioReferencedBlobUrls: vi.fn().mockResolvedValue(new Set()),
}));
```
(Domyślny pusty Set sprawia, że istniejące testy działają bez zmian — `vi.clearAllMocks` nie usuwa implementacji z fabryki mocka.)

Dodaj te dwa testy na końcu `describe('findOrphanedBlobs', ...)` (przed jego zamknięciem `});`):
```ts
  it('blob sources/ bez referencji → sierota rodzaju "source"', async () => {
    const { list } = await import('@vercel/blob');
    const { getReferencedBlobUrls } = await import('./repo');
    const src = blob('sources/orphan.zip', 5000, hoursAgo(100));
    (getReferencedBlobUrls as any).mockResolvedValue(new Set());
    (list as any).mockResolvedValue({ blobs: [src], hasMore: false });
    const report = await findOrphanedBlobs({ now: NOW });
    expect(report.orphans).toHaveLength(1);
    expect(report.orphans[0].kind).toBe('source');
  });

  it('blob sources/ referencjonowany przez projekt Studio → NIE sierota', async () => {
    const { list } = await import('@vercel/blob');
    const { getReferencedBlobUrls } = await import('./repo');
    const { getStudioReferencedBlobUrls } = await import('@/lib/studio/repo');
    const src = blob('sources/used.zip', 5000, hoursAgo(100));
    (getReferencedBlobUrls as any).mockResolvedValue(new Set());
    (getStudioReferencedBlobUrls as any).mockResolvedValue(new Set([src.url]));
    (list as any).mockResolvedValue({ blobs: [src], hasMore: false });
    const report = await findOrphanedBlobs({ now: NOW });
    expect(report.referencedCount).toBe(1);
    expect(report.orphans).toHaveLength(0);
  });
```

- [ ] **Step 2: Run test to verify the new cases fail** — `npx vitest run lib/scenes/blobAudit.test.ts` → 2 nowe FAIL (kind 'unknown' zamiast 'source'; studio refs nieuwzględnione). Istniejące przechodzą.

- [ ] **Step 3: Zaktualizuj `lib/scenes/blobAudit.ts`**

(a) Import studio refs — pod `import { getReferencedBlobUrls } from './repo';`:
```ts
import { getStudioReferencedBlobUrls } from '@/lib/studio/repo';
```

(b) Rodzaj `source` — zamień:
```ts
export type OrphanKind = 'model' | 'thumbnail' | 'unknown';
```
na:
```ts
export type OrphanKind = 'model' | 'thumbnail' | 'source' | 'unknown';
```

(c) `kindFromPath` — zamień:
```ts
function kindFromPath(pathname: string): OrphanKind {
  if (pathname.startsWith('models/')) return 'model';
  if (pathname.startsWith('thumbnails/')) return 'thumbnail';
  return 'unknown';
}
```
na:
```ts
function kindFromPath(pathname: string): OrphanKind {
  if (pathname.startsWith('models/')) return 'model';
  if (pathname.startsWith('thumbnails/')) return 'thumbnail';
  if (pathname.startsWith('sources/')) return 'source';
  return 'unknown';
}
```

(d) Suma referencji w `findOrphanedBlobs` — zamień:
```ts
  const referenced = await getReferencedBlobUrls();
```
na:
```ts
  // Store Blob jest globalny: sieroty to pliki nie wskazane ani przez scenę,
  // ani przez projekt Studio. Sumujemy oba zbiory referencji.
  const [sceneRefs, studioRefs] = await Promise.all([
    getReferencedBlobUrls(),
    getStudioReferencedBlobUrls(),
  ]);
  const referenced = new Set<string>([...sceneRefs, ...studioRefs]);
```

(e) `byKind` w `orphanListStats` — zamień:
```ts
  const byKind: Record<OrphanKind, { count: number; bytes: number }> = {
    model: { count: 0, bytes: 0 },
    thumbnail: { count: 0, bytes: 0 },
    unknown: { count: 0, bytes: 0 },
  };
```
na:
```ts
  const byKind: Record<OrphanKind, { count: number; bytes: number }> = {
    model: { count: 0, bytes: 0 },
    thumbnail: { count: 0, bytes: 0 },
    source: { count: 0, bytes: 0 },
    unknown: { count: 0, bytes: 0 },
  };
```

- [ ] **Step 4: Run tests to verify all pass** — `npx vitest run lib/scenes/blobAudit.test.ts` → PASS (wszystkie, w tym 2 nowe).

- [ ] **Step 5: Commit**

```bash
git add lib/scenes/blobAudit.ts lib/scenes/blobAudit.test.ts
git commit -m "feat(studio): teach blob audit about sources/ prefix and studio refs"
```

---

## Task 6: Trasy API Studio (właściciel)

**Files:**
- Create: `app/api/studio/route.ts`
- Test: `app/api/studio/route.test.ts`
- Create: `app/api/studio/[id]/route.ts`
- Test: `app/api/studio/[id]/route.test.ts`

- [ ] **Step 1: Write failing tests** — create `app/api/studio/route.test.ts`:

```ts
// app/api/studio/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/session', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-test', role: 'user', email: 'a@b.com' }),
}));
vi.mock('@/lib/studio/repo', () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
}));

import { GET, POST } from '@/app/api/studio/route';
import { listProjects, createProject } from '@/lib/studio/repo';

const PROJ = {
  id: 'p1', ownerId: 'user-test', title: 'T', sourceBlobUrl: 'https://b/sources/a.zip',
  sourceFileName: 'a.zip', sourceKind: 'gltf-zip', config: {}, thumbBlobUrl: null,
  createdAt: new Date(), updatedAt: new Date(),
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/studio', () => {
  it('zwraca listę projektów właściciela', async () => {
    (listProjects as any).mockResolvedValue([PROJ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(listProjects).toHaveBeenCalledWith('user-test');
  });
});

describe('POST /api/studio', () => {
  it('tworzy projekt → 201', async () => {
    (createProject as any).mockResolvedValue(PROJ);
    const req = new NextRequest('http://localhost/api/studio', {
      method: 'POST',
      body: JSON.stringify({
        title: 'T', sourceBlobUrl: 'https://b/sources/a.zip', sourceFileName: 'a.zip',
        sourceKind: 'gltf-zip', config: {}, thumbBlobUrl: null,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe('p1');
    expect(createProject).toHaveBeenCalledWith('user-test', expect.objectContaining({ sourceKind: 'gltf-zip' }));
  });

  it('zła walidacja (brak sourceBlobUrl) → 422', async () => {
    const req = new NextRequest('http://localhost/api/studio', {
      method: 'POST',
      body: JSON.stringify({ title: 'T', config: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });
});
```

Create `app/api/studio/[id]/route.test.ts`:

```ts
// app/api/studio/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/session', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'owner-1', role: 'user', email: 'a@b.com' }),
}));
vi.mock('@/lib/studio/repo', () => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));

import { GET, PATCH, DELETE } from '@/app/api/studio/[id]/route';
import { getProject, updateProject, deleteProject } from '@/lib/studio/repo';

const ID = '11111111-1111-1111-1111-111111111111';
const OWN = { id: ID, ownerId: 'owner-1', title: 'T', sourceBlobUrl: 'u', sourceFileName: 'a.zip', sourceKind: 'gltf-zip', config: {}, thumbBlobUrl: null, createdAt: new Date(), updatedAt: new Date() };
const FOREIGN = { ...OWN, ownerId: 'someone-else' };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/studio/[id]', () => {
  it('400 dla nie-UUID', async () => {
    const res = await GET(new NextRequest('http://localhost/api/studio/bad'), ctx('bad'));
    expect(res.status).toBe(400);
  });
  it('404 gdy nie istnieje', async () => {
    (getProject as any).mockResolvedValue(null);
    const res = await GET(new NextRequest(`http://localhost/api/studio/${ID}`), ctx(ID));
    expect(res.status).toBe(404);
  });
  it('403 gdy nie właściciel', async () => {
    (getProject as any).mockResolvedValue(FOREIGN);
    const res = await GET(new NextRequest(`http://localhost/api/studio/${ID}`), ctx(ID));
    expect(res.status).toBe(403);
  });
  it('200 + rekord dla właściciela', async () => {
    (getProject as any).mockResolvedValue(OWN);
    const res = await GET(new NextRequest(`http://localhost/api/studio/${ID}`), ctx(ID));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(ID);
  });
});

describe('PATCH /api/studio/[id]', () => {
  it('403 gdy nie właściciel', async () => {
    (getProject as any).mockResolvedValue(FOREIGN);
    const req = new NextRequest(`http://localhost/api/studio/${ID}`, { method: 'PATCH', body: JSON.stringify({ title: 'X' }) });
    const res = await PATCH(req, ctx(ID));
    expect(res.status).toBe(403);
  });
  it('200 gdy właściciel aktualizuje', async () => {
    (getProject as any).mockResolvedValue(OWN);
    (updateProject as any).mockResolvedValue({ ...OWN, title: 'X' });
    const req = new NextRequest(`http://localhost/api/studio/${ID}`, { method: 'PATCH', body: JSON.stringify({ title: 'X' }) });
    const res = await PATCH(req, ctx(ID));
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe('X');
  });
});

describe('DELETE /api/studio/[id]', () => {
  it('403 gdy nie właściciel', async () => {
    (getProject as any).mockResolvedValue(FOREIGN);
    const res = await DELETE(new NextRequest(`http://localhost/api/studio/${ID}`), ctx(ID));
    expect(res.status).toBe(403);
  });
  it('204 gdy właściciel kasuje', async () => {
    (getProject as any).mockResolvedValue(OWN);
    (deleteProject as any).mockResolvedValue(undefined);
    const res = await DELETE(new NextRequest(`http://localhost/api/studio/${ID}`), ctx(ID));
    expect(res.status).toBe(204);
    expect(deleteProject).toHaveBeenCalledWith(ID);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run app/api/studio/` → FAIL (brak tras).

- [ ] **Step 3: Write `app/api/studio/route.ts`**

```ts
// app/api/studio/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { listProjects, createProject } from '@/lib/studio/repo';
import type { SceneConfig } from '@/components/store';

export async function GET(): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }
  const projects = await listProjects(user.id);
  return NextResponse.json(projects);
}

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  sourceBlobUrl: z.url(),
  sourceFileName: z.string().min(1).max(255),
  sourceKind: z.enum(['glb', 'gltf-zip']),
  config: z.record(z.string(), z.unknown()),
  thumbBlobUrl: z.url().nullable(),
});

export async function POST(request: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Błąd walidacji', details: parsed.error.flatten() }, { status: 422 });
  }

  const project = await createProject(user.id, {
    title: parsed.data.title,
    sourceBlobUrl: parsed.data.sourceBlobUrl,
    sourceFileName: parsed.data.sourceFileName,
    sourceKind: parsed.data.sourceKind,
    config: parsed.data.config as unknown as SceneConfig,
    thumbBlobUrl: parsed.data.thumbBlobUrl,
  });
  return NextResponse.json(project, { status: 201 });
}
```

- [ ] **Step 4: Write `app/api/studio/[id]/route.ts`**

```ts
// app/api/studio/[id]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { getProject, updateProject, deleteProject } from '@/lib/studio/repo';

type Ctx = { params: Promise<{ id: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authOwner(id: string) {
  if (!UUID_RE.test(id)) return { error: NextResponse.json({ error: 'Nieprawidłowy identyfikator' }, { status: 400 }) };
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 }) };
  }
  const project = await getProject(id);
  if (!project) return { error: NextResponse.json({ error: 'Nie znaleziono projektu' }, { status: 404 }) };
  if (project.ownerId !== user.id) return { error: NextResponse.json({ error: 'Brak dostępu' }, { status: 403 }) };
  return { user, project };
}

export async function GET(_req: Request, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const r = await authOwner(id);
  if ('error' in r) return r.error;
  return NextResponse.json(r.project);
}

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  thumbBlobUrl: z.url().nullable().optional(),
  sourceBlobUrl: z.url().optional(),
  sourceFileName: z.string().min(1).max(255).optional(),
  sourceKind: z.enum(['glb', 'gltf-zip']).optional(),
});

export async function PATCH(request: Request, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const r = await authOwner(id);
  if ('error' in r) return r.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Błąd walidacji', details: parsed.error.flatten() }, { status: 422 });
  }

  const updated = await updateProject(id, {
    ...(parsed.data.title !== undefined && { title: parsed.data.title }),
    ...(parsed.data.config !== undefined && { config: parsed.data.config as any }),
    ...(parsed.data.thumbBlobUrl !== undefined && { thumbBlobUrl: parsed.data.thumbBlobUrl }),
    ...(parsed.data.sourceBlobUrl !== undefined && { sourceBlobUrl: parsed.data.sourceBlobUrl }),
    ...(parsed.data.sourceFileName !== undefined && { sourceFileName: parsed.data.sourceFileName }),
    ...(parsed.data.sourceKind !== undefined && { sourceKind: parsed.data.sourceKind }),
  });
  if (!updated) return NextResponse.json({ error: 'Nie znaleziono projektu' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const r = await authOwner(id);
  if ('error' in r) return r.error;
  await deleteProject(id);
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 5: Run tests to verify pass** — `npx vitest run app/api/studio/` → PASS. Then `npx tsc --noEmit -p tsconfig.json` → clean.

- [ ] **Step 6: Commit**

```bash
git add app/api/studio/
git commit -m "feat(studio): owner-scoped studio project API routes (list/create/get/update/delete)"
```

---

## Self-Review

**Spec coverage (spec §4 persystencja + §5):**
- `studio_projects` tabela z polami spec §4 → Task 1 schema (id, owner_id, title, source_blob_url, source_file_name, source_kind, config, thumb_blob_url, created/updated). ✅
- Migracja → Task 2 (generate; zastosowanie na Neon flagowane jako krok deploy). ✅
- Repo owner-scoped CRUD → Task 3 (+ `getStudioReferencedBlobUrls`). ✅
- API właściciela → Task 6 (owner-only: 401/403/404/400/422). ✅
- Upload źródła pod `sources/` → Task 4 (token route). ✅
- Audyt świadomy `sources/` + niezostawianie źródeł studio jako sierot → Task 5 (kind 'source' + suma referencji scen+studio). ✅

**Placeholder scan:** brak TBD/TODO; pełny kod w każdym kroku; komendy z oczekiwanym wynikiem. ✅

**Type consistency:** `StudioProjectRecord`/`SourceKind`/Create/Update z Task 1 używane spójnie w repo (Task 3) i trasach (Task 6). `getStudioReferencedBlobUrls` zdefiniowane w Task 3, importowane w Task 5. `sourceKind` enum `'glb'|'gltf-zip'` spójny w schema/zod/typy. ✅

**Granice (poza 1b → 1c):** klient-side `upload()` źródła do `sources/`, `captureThumbnail` przy zapisie, UI zapisu/otwierania, dual-view. Zastosowanie migracji na Neon = krok deploy (poza planem).
