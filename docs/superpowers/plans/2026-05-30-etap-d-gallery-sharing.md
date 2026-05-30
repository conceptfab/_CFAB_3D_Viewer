# Etap D — Galeria, uprawnienia per-scena, linki tylko-podgląd, embed iframe

> **For agentic workers:** Ten dokument jest planem dla subagenta działającego w trybie `superpowers:subagent-driven-development` oraz `superpowers:executing-plans`. Każdy krok zawiera pełny kod (zero placeholderów). Wykonuj kroki w kolejności; commitujesz po każdym zielonym teście. Checkboxy `- [ ]` to Twoja lista pracy.

---

## Decyzje wcielone (do weryfikacji)

Poniższe pozycje `[REVIEW]` z kontraktu zostały wcielone w konkretne decyzje implementacyjne. Zanim zaczniesz pracę, potwierdź je z właścicielem projektu:

| # | Pozycja `[REVIEW]` | Wcielona decyzja |
|---|--------------------|-----------------|
| R1 | Token share jako bearer w URL, przechowywany wprost | `share_links.token` to `crypto.randomBytes(32)` zakodowane base64url; brak hashowania — token w URL jest jedynym sekretem; indeks `UNIQUE` w DB zapewnia unikalność. Brak rotacji tokenów. |
| R2 | Polityka framingu | `next.config.ts` ustawia globalnie `X-Frame-Options: SAMEORIGIN` i `Content-Security-Policy: frame-ancestors 'self'`. Trasa `/embed/[token]` zwraca własne nagłówki przez `middleware.ts` (matcher `/embed/:path*`), które usuwają `X-Frame-Options` i ustawiają `Content-Security-Policy: frame-ancestors *`. Konfigurowalność hosta docelowego jest poza zakresem Etapu D — na razie `*`. |
| R3 | Render tylko-podgląd | `ReadOnlyViewer` to `<Canvas>` z tymi samymi komponentami renderowymi (`Studio`, `Product`, `CameraRig`, `Postprocess`, `Branding`, `CameraButtons`) co pełny edytor, ale bez `ModelDropzone`, `EditorView`, `ViewButtons`, `Outliner`, `Inspector` i paneli leva. Config sceny wstrzykiwany przez propsy — store inicjalizowany danymi z DB, nie resetowany po montażu. |
| R4 | Dodawanie uprawnień po e-mailu | `POST /api/scenes/[id]/permissions` przyjmuje `{email, canEdit}`. Serwer robi `normalizeEmail(email)` → szuka rekordu w tabeli `users`. Jeśli user nie istnieje → 422 `"Użytkownik o tym adresie nie istnieje"`. Brak auto-zaproszenia w Etapie D. |
| R5 | `canView` z tokenem share | Sygnatura helpera to `canView(scene, user: User | null, shareToken?: string): Promise<boolean>`. Token wymagany tylko dla zasobu bez innych uprawnień — sprawdzany jako ostatni (DB-query na `share_links`). |

---

## Goal

Zaimplementować warstwę współdzielenia scen: uprawnienia per-scena (kto może oglądać / edytować), linki jednorazowe tylko-do-odczytu dostępne bez logowania, stronę embed gotową do iframe, oraz galerię zarządzaną przez zalogowanego właściciela. Zmodyfikować istniejące trasy scen z Etapu B tak, by egzekwowały uprawnienia.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Next.js App Router (server components + route handlers)     │
│                                                              │
│  /gallery         — SSR, requireUser(), lista scen z DB      │
│  /s/[token]       — SSR publiczny, auth opcjonalny           │
│  /embed/[token]   — SSR publiczny, bez chrome'u              │
│                                                              │
│  API:                                                        │
│  /api/scenes/[id]                  ← egzekwowanie canView    │
│  /api/scenes/[id]/permissions      ← owner-only CRUD        │
│  /api/scenes/[id]/share-links      ← owner-only CRUD        │
│                                                              │
│  lib/scenes/access.ts              ← canView, assertCanEdit  │
│  lib/scenes/schema.ts  (+ migracja D)  ← scene_permissions, │
│                                       share_links            │
└──────────────────────────────────────────────────────────────┘

Przepływ danych w widoku publicznym:
  URL /s/<token>
    → middleware (nagłówki framing)
    → page.tsx (SSR): znajdź aktywny share_link po tokenie
      → załaduj scenę z repo
      → zainicjuj store konfiguracją sceny
      → <ReadOnlyViewer config={scene.config} modelUrl={scene.modelBlobUrl} />
```

## Tech Stack

- Next.js 14+ App Router, TypeScript strict
- Drizzle ORM + drizzle-kit (migracje)
- Zod (walidacja tras API)
- Node.js `crypto` (tokeny share)
- React 18 + `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing`
- Three.js 0.169 (wersja z projektu)
- Zustand 5 (store tylko-do-odczytu dla widoku share)
- `@vercel/blob` (już z Etapu B)
- Tailwind CSS lub CSS Modules (spójnie z resztą projektu)
- Vitest + React Testing Library (testy jednostkowe) / Playwright (testy e2e, opcjonalnie)

---

## File Structure

Pliki tworzone lub modyfikowane w Etapie D:

```
lib/
  db/
    schema.ts                    MODYFIKACJA — dodaj tabele scene_permissions i share_links
    migrations/
      XXXX_etap_d_permissions.sql  NOWY — migracja Drizzle
  scenes/
    access.ts                    NOWY — canView(), assertCanEdit()
    access.test.ts               NOWY — testy jednostkowe helpera dostępu
    repo.ts                      MODYFIKACJA (z B) — listScenes() + listAccessible()

app/
  api/
    scenes/
      route.ts                   MODYFIKACJA (z B) — GET lista scen: moje + udostępnione mi
      [id]/
        route.ts                 MODYFIKACJA (z B) — egzekwowanie canView / assertCanEdit
        permissions/
          route.ts               NOWY — GET lista, POST dodaj usera po e-mailu
          [userId]/
            route.ts             NOWY — PATCH zmień canEdit, DELETE usuń
        share-links/
          route.ts               NOWY — GET lista, POST utwórz token
          [linkId]/
            route.ts             NOWY — DELETE revoke

  gallery/
    page.tsx                     NOWY — galeria SSR zalogowanego usera
    _components/
      SceneCard.tsx              NOWY — kafelek sceny (miniatura, tytuł, akcje)
      PermissionsPanel.tsx       NOWY — lista uprawnień + formularz dodawania
      ShareLinksPanel.tsx        NOWY — lista linków + tworzenie + revoke

  s/
    [token]/
      page.tsx                   NOWY — publiczny widok only-read SSR

  embed/
    [token]/
      page.tsx                   NOWY — minimalny widok do iframe SSR

components/
  viewer/
    ReadOnlyViewer.tsx           NOWY — Canvas z Studio/Product/CameraRig/Postprocess/Branding/CameraButtons, bez paneli edycji
    ReadOnlyViewerClient.tsx     NOWY — wrapper 'use client' dla dynamic import (ssr:false)

middleware.ts                    MODYFIKACJA — nadpisanie nagłówków framing dla /embed/*

next.config.ts                   MODYFIKACJA — globalne nagłówki X-Frame-Options + CSP
```

---

## Zadania

### Zadanie 1 — Migracja Drizzle: tabele `scene_permissions` i `share_links`

**Cel:** Dodać dwie nowe tabele zgodnie z kontraktem. Brak logiki aplikacyjnej — sam schemat.

- [ ] Otwórz `lib/scenes/schema.ts` (tam, w Etapie B, zdefiniowano tabelę `scenes`). Do istniejącego importu z `drizzle-orm/pg-core` dodaj `unique`. `users` jest już zaimportowane w tym pliku (z `@/lib/db/schema`), a `scenes` jest w tym samym module. Dopisz dwie definicje tabel po definicji `scenes`:

```ts
// lib/scenes/schema.ts  (fragment — dopisz po tabeli `scenes`)

// ── Etap D ──────────────────────────────────────────────────────────────────

export const scenePermissions = pgTable(
  'scene_permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sceneId: uuid('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    canEdit: boolean('can_edit').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('scene_permissions_scene_user_uniq').on(t.sceneId, t.userId)],
);

export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sceneId: uuid('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    mode: text('mode').notNull(), // 'view' | 'embed'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('share_links_scene_id_idx').on(t.sceneId)],
);
```

- [ ] Wygeneruj migrację SQL:

```bash
npx drizzle-kit generate --name etap_d_permissions
```

Oczekiwany output: `Generated 1 migration file` — plik w `lib/db/migrations/XXXX_etap_d_permissions.sql`.

- [ ] Sprawdź wygenerowany SQL — powinien zawierać `CREATE TABLE scene_permissions` i `CREATE TABLE share_links` z odpowiednimi constraintami.

- [ ] Zaaplikuj migrację na lokalnej bazie:

```bash
npx drizzle-kit migrate
```

Oczekiwany output: `All migrations applied successfully`.

- [ ] Commit:

```bash
git add lib/scenes/schema.ts lib/db/migrations/
git commit -m "feat(db): add scene_permissions and share_links tables (Etap D)"
```

---

### Zadanie 2 — Typy TS dla Etapu D (`lib/scenes/types.ts`)

**Cel:** Dodać typy `ScenePermission` i `ShareLink` zgodne z kontraktem, żeby kolejne kroki miały stabilne importy.

- [ ] Jeśli plik `lib/scenes/types.ts` istnieje (z Etapu B) — dopisz do niego. Jeśli nie istnieje — utwórz:

```ts
// lib/scenes/types.ts

// Typ SceneRecord pochodzi z Etapu B — NIE redefiniuj.
// Ten plik eksportuje tylko typy Etapu D.

export type ShareMode = 'view' | 'embed';

export interface ScenePermission {
  id: string;
  sceneId: string;
  userId: string;
  canEdit: boolean;
  createdAt: Date;
}

export interface ShareLink {
  id: string;
  sceneId: string;
  token: string;
  mode: ShareMode;
  createdAt: Date;
  revokedAt: Date | null;
}

// PermissionWithUser używany w API GET /permissions
export interface PermissionWithUser {
  id: string;
  sceneId: string;
  userId: string;
  email: string;
  canEdit: boolean;
  createdAt: Date;
}
```

- [ ] Commit:

```bash
git add lib/scenes/types.ts
git commit -m "feat(types): add ScenePermission, ShareLink, PermissionWithUser (Etap D)"
```

---

### Zadanie 3 — Helper dostępu `lib/scenes/access.ts` (TDD — najpierw testy)

**Cel:** Czysta logika `canView` i `assertCanEdit`. Zero I/O — testy są szybkie i niezawodne.

#### 3a — Napisz failing testy (RED)

- [ ] Utwórz `lib/scenes/access.test.ts`:

```ts
// lib/scenes/access.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SceneRecord } from '@/lib/scenes/repo';
import type { User } from '@/lib/auth/types';

// Mock DB — wstrzykiwany przez dependency injection w access.ts
import type { AccessDeps } from './access';

const mockScene = (ownerId: string): SceneRecord => ({
  id: 'scene-1',
  ownerId,
  title: 'Test',
  config: {} as any,
  modelBlobUrl: null,
  modelFileName: null,
  thumbBlobUrl: null,
  isPreset: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockUser = (id: string): User => ({
  id,
  email: `${id}@test.com`,
  role: 'user',
  status: 'allowed',
  createdAt: new Date(),
  lastLoginAt: null,
  invitedBy: null,
});

const makeDeps = (
  permExists: boolean,
  tokenActive: boolean,
): AccessDeps => ({
  findPermission: vi.fn().mockResolvedValue(permExists ? { canEdit: false } : null),
  findActiveShareLink: vi.fn().mockResolvedValue(tokenActive ? { id: 'link-1' } : null),
});

describe('canView', () => {
  it('owner może zawsze oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(false, false);
    const result = await canView(mockScene('user-a'), mockUser('user-a'), undefined, deps);
    expect(result).toBe(true);
    expect(deps.findPermission).not.toHaveBeenCalled();
  });

  it('user z uprawnieniem może oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(true, false);
    const result = await canView(mockScene('owner'), mockUser('user-b'), undefined, deps);
    expect(result).toBe(true);
    expect(deps.findPermission).toHaveBeenCalledWith('scene-1', 'user-b');
  });

  it('user bez uprawnień nie może oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(false, false);
    const result = await canView(mockScene('owner'), mockUser('user-b'), undefined, deps);
    expect(result).toBe(false);
  });

  it('null user z aktywnym tokenem może oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(false, true);
    const result = await canView(mockScene('owner'), null, 'valid-token', deps);
    expect(result).toBe(true);
    expect(deps.findActiveShareLink).toHaveBeenCalledWith('scene-1', 'valid-token');
  });

  it('null user bez tokenu nie może oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(false, false);
    const result = await canView(mockScene('owner'), null, undefined, deps);
    expect(result).toBe(false);
  });

  it('null user z nieaktywnym tokenem nie może oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(false, false); // findActiveShareLink zwraca null
    const result = await canView(mockScene('owner'), null, 'revoked-token', deps);
    expect(result).toBe(false);
  });

  it('zalogowany user z aktywnym tokenem (brak perma) może oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(false, true);
    const result = await canView(mockScene('owner'), mockUser('user-c'), 'valid-token', deps);
    expect(result).toBe(true);
  });
});

describe('assertCanEdit', () => {
  it('owner może edytować', async () => {
    const { assertCanEdit } = await import('./access');
    const deps = makeDeps(false, false);
    await expect(assertCanEdit(mockScene('user-a'), mockUser('user-a'), deps)).resolves.toBeUndefined();
  });

  it('user z can_edit=true może edytować', async () => {
    const { assertCanEdit } = await import('./access');
    const deps: AccessDeps = {
      findPermission: vi.fn().mockResolvedValue({ canEdit: true }),
      findActiveShareLink: vi.fn(),
    };
    await expect(assertCanEdit(mockScene('owner'), mockUser('editor'), deps)).resolves.toBeUndefined();
  });

  it('user z can_edit=false nie może edytować — rzuca 403', async () => {
    const { assertCanEdit } = await import('./access');
    const deps: AccessDeps = {
      findPermission: vi.fn().mockResolvedValue({ canEdit: false }),
      findActiveShareLink: vi.fn(),
    };
    await expect(assertCanEdit(mockScene('owner'), mockUser('viewer'), deps)).rejects.toThrow('403');
  });

  it('user bez uprawnień nie może edytować — rzuca 403', async () => {
    const { assertCanEdit } = await import('./access');
    const deps = makeDeps(false, false);
    await expect(assertCanEdit(mockScene('owner'), mockUser('stranger'), deps)).rejects.toThrow('403');
  });
});
```

- [ ] Uruchom testy — oczekiwany wynik: **FAIL** (plik `access.ts` nie istnieje):

```bash
npx vitest run lib/scenes/access.test.ts
```

#### 3b — Implementacja (GREEN)

- [ ] Utwórz `lib/scenes/access.ts`:

```ts
// lib/scenes/access.ts
import type { SceneRecord } from '@/lib/scenes/repo';
import type { User } from '@/lib/auth/types';

// Dependency injection — łatwe mockowanie w testach, brak twardego importu DB.
export interface AccessDeps {
  findPermission: (
    sceneId: string,
    userId: string,
  ) => Promise<{ canEdit: boolean } | null>;
  findActiveShareLink: (
    sceneId: string,
    token: string,
  ) => Promise<{ id: string } | null>;
}

/**
 * Tworzy domyślne deps podpięte pod prawdziwe DB.
 * Import DB jest lazy — nie łamie testów jednostkowych.
 */
export async function defaultDeps(): Promise<AccessDeps> {
  const { db } = await import('@/lib/db');
  const { scenePermissions, shareLinks } = await import('@/lib/db/schema');
  const { eq, and, isNull } = await import('drizzle-orm');

  return {
    findPermission: async (sceneId, userId) => {
      const rows = await db
        .select({ canEdit: scenePermissions.canEdit })
        .from(scenePermissions)
        .where(
          and(
            eq(scenePermissions.sceneId, sceneId),
            eq(scenePermissions.userId, userId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },

    findActiveShareLink: async (sceneId, token) => {
      const rows = await db
        .select({ id: shareLinks.id })
        .from(shareLinks)
        .where(
          and(
            eq(shareLinks.sceneId, sceneId),
            eq(shareLinks.token, token),
            isNull(shareLinks.revokedAt),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },
  };
}

/**
 * Zwraca true jeśli user (lub anonimowy z tokenem) ma dostęp do podglądu sceny.
 *
 * Kolejność sprawdzeń (szybkie → wolne):
 * 1. user === owner → true (bez DB)
 * 2. user istnieje → sprawdź scene_permissions
 * 3. token istnieje → sprawdź aktywny share_link
 * 4. false
 */
export async function canView(
  scene: SceneRecord,
  user: User | null,
  shareToken?: string,
  deps?: AccessDeps,
): Promise<boolean> {
  const d = deps ?? (await defaultDeps());

  // 1. Owner
  if (user && scene.ownerId === user.id) return true;

  // 2. Uprawnienie per-scena
  if (user) {
    const perm = await d.findPermission(scene.id, user.id);
    if (perm) return true;
  }

  // 3. Token share (działa dla niezalogowanych i zalogowanych bez perma)
  if (shareToken) {
    const link = await d.findActiveShareLink(scene.id, shareToken);
    if (link) return true;
  }

  return false;
}

/**
 * Rzuca błąd z kodem "403" jeśli user nie może edytować sceny.
 * Edytować może: owner lub user z can_edit=true.
 */
export async function assertCanEdit(
  scene: SceneRecord,
  user: User,
  deps?: AccessDeps,
): Promise<void> {
  const d = deps ?? (await defaultDeps());

  if (scene.ownerId === user.id) return;

  const perm = await d.findPermission(scene.id, user.id);
  if (perm?.canEdit) return;

  throw new Error('403');
}
```

- [ ] Uruchom testy — oczekiwany wynik: **PASS** (wszystkie 10 testów):

```bash
npx vitest run lib/scenes/access.test.ts
```

Oczekiwany output:
```
✓ lib/scenes/access.test.ts (10 tests)
Test Files  1 passed (1)
Tests       10 passed (10)
```

- [ ] Commit:

```bash
git add lib/scenes/access.ts lib/scenes/access.test.ts
git commit -m "feat(access): add canView/assertCanEdit helpers with DI (TDD green)"
```

---

### Zadanie 4 — Modyfikacja repo scen: lista dostępnych scen

**Cel:** Rozszerzyć `lib/scenes/repo.ts` o funkcję `listAccessible(userId)` zwracającą sceny własne + udostępnione.

- [ ] W `lib/scenes/repo.ts` (plik z Etapu B — otwórz i dopisz na końcu):

```ts
// lib/scenes/repo.ts — dopisek Etap D

import { scenePermissions } from '@/lib/scenes/schema';
import { or } from 'drizzle-orm';

/**
 * Zwraca wszystkie sceny, do których user ma dostęp:
 * własne (owner_id = userId) + udostępnione mu przez scene_permissions.
 * Sortowanie: updatedAt DESC.
 */
export async function listAccessible(userId: string): Promise<SceneRecord[]> {
  // Podzapytanie: sceneId, gdzie userId ma uprawnienie
  const permittedSceneIds = db
    .select({ sceneId: scenePermissions.sceneId })
    .from(scenePermissions)
    .where(eq(scenePermissions.userId, userId));

  const rows = await db
    .select()
    .from(scenes)
    .where(
      or(
        eq(scenes.ownerId, userId),
        inArray(scenes.id, permittedSceneIds),
      ),
    )
    .orderBy(desc(scenes.updatedAt));

  return rows.map(toRecord);
}
```

Upewnij się, że importy `inArray` i `desc` są dodane na początku pliku, jeśli już nie istnieją:
```ts
import { eq, inArray, desc, or } from 'drizzle-orm';
```

- [ ] Commit:

```bash
git add lib/scenes/repo.ts
git commit -m "feat(repo): add listAccessible() for gallery (own + shared scenes)"
```

---

### Zadanie 5 — Modyfikacja tras scen z Etapu B: egzekwowanie uprawnień

**Cel:** `GET /api/scenes/[id]` → `canView`; `PATCH` → owner || can_edit; `DELETE` → owner.

- [ ] Otwórz `app/api/scenes/[id]/route.ts`. Zmodyfikuj handlery:

```ts
// app/api/scenes/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireUser, getCurrentUser } from '@/lib/auth/session';
import { getScene, updateScene, deleteScene } from '@/lib/scenes/repo';
import { canView, assertCanEdit, defaultDeps } from '@/lib/scenes/access';
import { z } from 'zod';

// ── GET — widok sceny (właściciel | uprawnienie | aktywny token) ─────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser(request); // null jeśli niezalogowany
  const shareToken =
    request.nextUrl.searchParams.get('token') ?? undefined;

  const scene = await getScene(params.id);
  if (!scene) {
    return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  }

  const deps = await defaultDeps();
  const allowed = await canView(scene, user, shareToken, deps);
  if (!allowed) {
    return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
  }

  return NextResponse.json(scene);
}

// ── PATCH — edycja sceny (właściciel | can_edit) ────────────────────────────

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  thumbBlobUrl: z.string().url().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireUser(request); // 401 jeśli niezalogowany

  const scene = await getScene(params.id);
  if (!scene) {
    return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  }

  const deps = await defaultDeps();
  try {
    await assertCanEdit(scene, user, deps);
  } catch {
    return NextResponse.json({ error: 'Brak uprawnień do edycji' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updated = await updateScene(params.id, parsed.data);
  return NextResponse.json(updated);
}

// ── DELETE — usunięcie sceny (tylko właściciel) ──────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireUser(request);

  const scene = await getScene(params.id);
  if (!scene) {
    return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  }

  if (scene.ownerId !== user.id) {
    return NextResponse.json({ error: 'Tylko właściciel może usunąć scenę' }, { status: 403 });
  }

  await deleteScene(params.id);
  return new NextResponse(null, { status: 204 });
}
```

- [ ] Sprawdź, że `getCurrentUser` (opcjonalne — zwraca `User | null`) jest zdefiniowane w `lib/auth/session.ts`. Jeśli istnieje tylko `requireUser` (rzuca 401) — dodaj `getCurrentUser`:

```ts
// lib/auth/session.ts — dopisek (jeśli brakuje)

/**
 * Jak requireUser(), ale zwraca null zamiast rzucać 401.
 * Używane tam, gdzie dostęp jest warunkowy (share token jako alternatywa).
 */
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  try {
    return await requireUser(request);
  } catch {
    return null;
  }
}
```

- [ ] Zmodyfikuj `GET /api/scenes` (lista) tak, żeby zwracała sceny własne + udostępnione:

```ts
// app/api/scenes/route.ts — modyfikacja handlera GET

import { listAccessible } from '@/lib/scenes/repo';

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  // Etap D: zwróć moje + udostępnione mi (nie ma już ?preset filtra w galerii)
  const myScenes = await listAccessible(user.id);
  return NextResponse.json(myScenes);
}
```

- [ ] Commit:

```bash
git add app/api/scenes/ lib/auth/session.ts
git commit -m "feat(api): enforce canView/assertCanEdit on scene routes (Etap D)"
```

---

### Zadanie 6 — API uprawnień: `app/api/scenes/[id]/permissions/`

#### 6a — `route.ts` (GET lista + POST dodaj usera)

- [ ] Utwórz `app/api/scenes/[id]/permissions/route.ts`:

```ts
// app/api/scenes/[id]/permissions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { getScene } from '@/lib/scenes/repo';
import { db } from '@/lib/db';
import { scenePermissions } from '@/lib/scenes/schema';
import { users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { normalizeEmail } from '@/lib/auth/utils';
import type { PermissionWithUser } from '@/lib/scenes/types';

// ── GET — lista uprawnień do sceny (tylko właściciel) ────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const caller = await requireUser(request);

  const scene = await getScene(params.id);
  if (!scene) return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  if (scene.ownerId !== caller.id) {
    return NextResponse.json({ error: 'Tylko właściciel może zarządzać uprawnieniami' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: scenePermissions.id,
      sceneId: scenePermissions.sceneId,
      userId: scenePermissions.userId,
      email: users.email,
      canEdit: scenePermissions.canEdit,
      createdAt: scenePermissions.createdAt,
    })
    .from(scenePermissions)
    .innerJoin(users, eq(users.id, scenePermissions.userId))
    .where(eq(scenePermissions.sceneId, params.id));

  const result: PermissionWithUser[] = rows.map((r) => ({
    id: r.id,
    sceneId: r.sceneId,
    userId: r.userId,
    email: r.email,
    canEdit: r.canEdit,
    createdAt: r.createdAt,
  }));

  return NextResponse.json(result);
}

// ── POST — dodaj uprawnienie po e-mailu (tylko właściciel) ──────────────────

const PostSchema = z.object({
  email: z.string().email('Nieprawidłowy e-mail'),
  canEdit: z.boolean(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const caller = await requireUser(request);

  const scene = await getScene(params.id);
  if (!scene) return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  if (scene.ownerId !== caller.id) {
    return NextResponse.json({ error: 'Tylko właściciel może dodawać uprawnienia' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);

  // Szukaj usera po e-mailu
  const targetUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (targetUsers.length === 0) {
    return NextResponse.json(
      { error: 'Użytkownik o tym adresie nie istnieje' },
      { status: 422 },
    );
  }

  const targetUser = targetUsers[0];

  // Właściciel nie może dodać samego siebie
  if (targetUser.id === caller.id) {
    return NextResponse.json(
      { error: 'Nie możesz dodać siebie — jesteś właścicielem sceny' },
      { status: 422 },
    );
  }

  // Upsert (unique constraint na scene_id + user_id)
  const [perm] = await db
    .insert(scenePermissions)
    .values({
      sceneId: params.id,
      userId: targetUser.id,
      canEdit: parsed.data.canEdit,
    })
    .onConflictDoUpdate({
      target: [scenePermissions.sceneId, scenePermissions.userId],
      set: { canEdit: parsed.data.canEdit },
    })
    .returning();

  const result: PermissionWithUser = {
    id: perm.id,
    sceneId: perm.sceneId,
    userId: perm.userId,
    email: targetUser.email,
    canEdit: perm.canEdit,
    createdAt: perm.createdAt,
  };

  return NextResponse.json(result, { status: 201 });
}
```

#### 6b — `[userId]/route.ts` (PATCH zmień canEdit + DELETE usuń)

- [ ] Utwórz `app/api/scenes/[id]/permissions/[userId]/route.ts`:

```ts
// app/api/scenes/[id]/permissions/[userId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { getScene } from '@/lib/scenes/repo';
import { db } from '@/lib/db';
import { scenePermissions } from '@/lib/scenes/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// ── PATCH — zmień canEdit ────────────────────────────────────────────────────

const PatchSchema = z.object({
  canEdit: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } },
) {
  const caller = await requireUser(request);

  const scene = await getScene(params.id);
  if (!scene) return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  if (scene.ownerId !== caller.id) {
    return NextResponse.json({ error: 'Tylko właściciel może zmieniać uprawnienia' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updated = await db
    .update(scenePermissions)
    .set({ canEdit: parsed.data.canEdit })
    .where(
      and(
        eq(scenePermissions.sceneId, params.id),
        eq(scenePermissions.userId, params.userId),
      ),
    )
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: 'Uprawnienie nie istnieje' }, { status: 404 });
  }

  return NextResponse.json(updated[0]);
}

// ── DELETE — usuń uprawnienie ────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } },
) {
  const caller = await requireUser(request);

  const scene = await getScene(params.id);
  if (!scene) return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  if (scene.ownerId !== caller.id) {
    return NextResponse.json({ error: 'Tylko właściciel może usuwać uprawnienia' }, { status: 403 });
  }

  const deleted = await db
    .delete(scenePermissions)
    .where(
      and(
        eq(scenePermissions.sceneId, params.id),
        eq(scenePermissions.userId, params.userId),
      ),
    )
    .returning({ id: scenePermissions.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Uprawnienie nie istnieje' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
```

- [ ] Commit:

```bash
git add app/api/scenes/
git commit -m "feat(api): add permissions CRUD routes (GET/POST/PATCH/DELETE)"
```

---

### Zadanie 7 — API linków share: `app/api/scenes/[id]/share-links/`

#### 7a — `route.ts` (GET lista + POST utwórz token)

- [ ] Utwórz `app/api/scenes/[id]/share-links/route.ts`:

```ts
// app/api/scenes/[id]/share-links/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { getScene } from '@/lib/scenes/repo';
import { db } from '@/lib/db';
import { shareLinks } from '@/lib/scenes/schema';
import { eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import type { ShareLink } from '@/lib/scenes/types';

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

// ── GET — lista aktywnych linków (nie-revoked) ───────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const caller = await requireUser(request);

  const scene = await getScene(params.id);
  if (!scene) return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  if (scene.ownerId !== caller.id) {
    return NextResponse.json({ error: 'Tylko właściciel może zarządzać linkami' }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.sceneId, params.id));

  const result: ShareLink[] = rows.map((r) => ({
    id: r.id,
    sceneId: r.sceneId,
    token: r.token,
    mode: r.mode as 'view' | 'embed',
    createdAt: r.createdAt,
    revokedAt: r.revokedAt,
  }));

  return NextResponse.json(result);
}

// ── POST — utwórz nowy token ─────────────────────────────────────────────────

const PostSchema = z.object({
  mode: z.enum(['view', 'embed']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const caller = await requireUser(request);

  const scene = await getScene(params.id);
  if (!scene) return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  if (scene.ownerId !== caller.id) {
    return NextResponse.json({ error: 'Tylko właściciel może tworzyć linki' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const token = generateToken();

  const [link] = await db
    .insert(shareLinks)
    .values({
      sceneId: params.id,
      token,
      mode: parsed.data.mode,
    })
    .returning();

  const result: ShareLink = {
    id: link.id,
    sceneId: link.sceneId,
    token: link.token,
    mode: link.mode as 'view' | 'embed',
    createdAt: link.createdAt,
    revokedAt: link.revokedAt,
  };

  return NextResponse.json(result, { status: 201 });
}
```

#### 7b — `[linkId]/route.ts` (DELETE = revoke)

- [ ] Utwórz `app/api/scenes/[id]/share-links/[linkId]/route.ts`:

```ts
// app/api/scenes/[id]/share-links/[linkId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { getScene } from '@/lib/scenes/repo';
import { db } from '@/lib/db';
import { shareLinks } from '@/lib/scenes/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// ── DELETE — revoke linku (ustawia revoked_at = now()) ──────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; linkId: string } },
) {
  const caller = await requireUser(request);

  const scene = await getScene(params.id);
  if (!scene) return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  if (scene.ownerId !== caller.id) {
    return NextResponse.json({ error: 'Tylko właściciel może revokować linki' }, { status: 403 });
  }

  const revoked = await db
    .update(shareLinks)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(shareLinks.id, params.linkId),
        eq(shareLinks.sceneId, params.id),
      ),
    )
    .returning({ id: shareLinks.id });

  if (revoked.length === 0) {
    return NextResponse.json({ error: 'Link nie istnieje' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
```

- [ ] Commit:

```bash
git add app/api/scenes/
git commit -m "feat(api): add share-links CRUD routes (GET/POST/DELETE revoke)"
```

---

### Zadanie 8 — Nagłówki framingu: `next.config.ts` i `middleware.ts`

**Cel:** Globalny zakaz osadzania w iframe; wyjątek dla `/embed/[token]`.

#### 8a — Globalne nagłówki w `next.config.ts`

- [ ] W `next.config.ts` dodaj sekcję `headers`:

```ts
// next.config.ts

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ... istniejące opcje z Etapu A/B ...

  async headers() {
    return [
      {
        // Globalny zakaz framowania — wszystkie trasy
        source: '/((?!embed/).*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

Uwaga: wzorzec `/((?!embed/).*)` wyklucza trasy zaczynające się od `embed/`. Trasy embed obsłuży middleware.

#### 8b — Middleware: nadpisanie nagłówków dla `/embed/[token]`

- [ ] Otwórz `middleware.ts` (plik z Etapu A — obsługuje już sesje). Dodaj logikę framingu:

```ts
// middleware.ts — dopisek Etap D

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // ── Framing dla /embed/* ──────────────────────────────────────────────────
  // Nadpisujemy nagłówki przed dalszą obsługą: usuwamy SAMEORIGIN i zezwalamy na *.
  if (request.nextUrl.pathname.startsWith('/embed/')) {
    const response = NextResponse.next();
    // Usuń globalny zakaz (next.config nadał go przez source regex — ale
    // middleware odpowiada później i może nadpisać).
    response.headers.delete('X-Frame-Options');
    response.headers.set(
      'Content-Security-Policy',
      "frame-ancestors *",
    );
    return response;
  }

  // ── Istniejąca logika sesji z Etapu A (requireUser dla chronionych tras) ──
  // ... (nie zmieniaj tej części)
}

export const config = {
  matcher: [
    // Istniejące matchery z A + embed
    '/embed/:path*',
    // ... pozostałe matchery z Etapu A
  ],
};
```

Ważna uwaga implementacyjna: Next.js 14 `headers()` w `next.config.ts` ustawia nagłówki przed middleware. Middleware może je nadpisać. Jeśli `next.config.ts` headers() nakłada się z matcherem na `/embed/` — upewnij się, że matcher w `headers()` NIE obejmuje `/embed/`. Wzorzec `/((?!embed/).*)`  załatwia to poprawnie.

- [ ] Commit:

```bash
git add next.config.ts middleware.ts
git commit -m "feat(security): global X-Frame-Options SAMEORIGIN, embed/* allows framing"
```

---

### Zadanie 9 — Komponent `ReadOnlyViewer`

**Cel:** Canvas z pełnym rendererem sceny, bez żadnych paneli edycji. Przyjmuje `config: SceneConfig` i `modelUrl: string | null` jako propsy — nie zależy od globalnego store edytora.

#### 9a — Store tylko-do-odczytu (`lib/scenes/readOnlyStore.ts`)

Widok publiczny potrzebuje własnej instancji store (odizolowanej od store edytora), inicjalizowanej konfiguracją z DB.

- [ ] Utwórz `lib/scenes/readOnlyStore.ts`:

```ts
// lib/scenes/readOnlyStore.ts

import { create } from 'zustand';
import type { SceneConfig } from '@/src/store'; // import SceneConfig z istniejącego store
// Alternatywnie przenieś SceneConfig do lib/scenes/types.ts jeśli planujesz refaktor

interface ReadOnlyState {
  config: SceneConfig;
  modelUrl: string | null;
}

/**
 * Tworzy nową instancję store tylko-do-odczytu z daną konfiguracją.
 * Używaj przez createReadOnlyStore(config, modelUrl) — NIE przez globalny useStore.
 */
export function createReadOnlyStore(config: SceneConfig, modelUrl: string | null) {
  return create<ReadOnlyState>()(() => ({
    config,
    modelUrl,
  }));
}
```

Uwaga: `createReadOnlyStore` zwraca nowy hook zustand — każda strona `/s/` i `/embed/` tworzy własną, izolowaną instancję.

#### 9b — `ReadOnlyViewer.tsx` (komponent kliencki)

- [ ] Utwórz `components/viewer/ReadOnlyViewer.tsx`:

```tsx
// components/viewer/ReadOnlyViewer.tsx
'use client';

import { Suspense, useMemo, createContext, useContext } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneConfig } from '@/src/store';
import { createReadOnlyStore } from '@/lib/scenes/readOnlyStore';

// Importy komponentów renderowych — te same co w pełnym edytorze
// Uwaga: te komponenty używają useStore() z globalnego store edytora.
// W Etapie D ZAKŁADAMY, że przed montażem ReadOnlyViewer inicjalizujemy
// globalny store danymi z DB (patrz ReadOnlyViewerClient). Jest to kompromis
// pozwalający na reużycie komponentów bez ich modyfikacji.
// Alternatywne podejście (context injection) — opcjonalne w przyszłości.
import { Studio } from '@/src/viewer/Studio';
import { Product } from '@/src/viewer/Product';
import { CameraRig } from '@/src/viewer/CameraRig';
import { Postprocess } from '@/src/viewer/Postprocess';
import { Branding } from '@/src/ui/Branding';
import { CameraButtons } from '@/src/ui/CameraButtons';

export interface ReadOnlyViewerProps {
  config: SceneConfig;
  modelUrl: string | null;
}

/**
 * Finalny renderer sceny bez jakichkolwiek paneli edycji.
 * Używany na stronach /s/[token] i /embed/[token].
 *
 * Wstrzykuje config do globalnego store PRZED renderem Canvas.
 * Nie modyfikuje store po montażu — view-only.
 */
export function ReadOnlyViewer({ config, modelUrl }: ReadOnlyViewerProps) {
  // Inicjalizacja globalnego store konfiguracją sceny.
  // Robimy to synchronicznie przed pierwszym renderem.
  // Import useStore musi być dynamic (ssr:false) — obsługuje ReadOnlyViewerClient.
  const { useStore } = require('@/src/store');

  // Inicjalizuj store danymi z DB (jeden raz przy montażu komponentu)
  useMemo(() => {
    const store = useStore.getState();
    // Ustaw config sceny
    store.setEnv(config.environment);
    store.setBackground(config.background);
    store.setKeyLight(config.keyLight);
    store.setShadows(config.shadows);
    store.setTone(config.tone);
    store.setMaterial(config.material);
    store.setBranding(config.branding);
    store.setHero(config.hero);
    store.setCamera({ active: config.camera.active });
    // cameras i orbit — przez bezpośredni patch stanu
    // (zakładamy, że store z Etapu B ma setOrbit i że cameras są w camera object)
    useStore.setState((s: any) => ({
      config: {
        ...s.config,
        camera: {
          ...config.camera,
        },
      },
    }));
    // Model z URL (Blob) — wstaw jako loadedModel jeśli istnieje
    if (modelUrl) {
      store.setLoadedModel({ objectUrl: modelUrl, fileName: '' });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cam = config.camera;
  const initialFov = cam.cameras.find((c) => c.id === cam.active)?.fov ?? 28;

  return (
    <div className="read-only-viewer">
      <Branding />
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: false,
          alpha: false,
          toneMapping: THREE.NoToneMapping,
          toneMappingExposure: 1.0,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{
          fov: initialFov,
          near: cam.near,
          far: cam.far,
          position: [2.4, 1.2, 3.2],
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0xdcdde0, 1);
        }}
      >
        <Suspense fallback={null}>
          <Studio />
          <Product />
        </Suspense>
        <CameraRig />
        <Postprocess />
      </Canvas>
      <CameraButtons />
    </div>
  );
}
```

#### 9c — `ReadOnlyViewerClient.tsx` (wrapper z dynamic import)

Next.js server components nie mogą montować Canvas (WebGL). Potrzebny wrapper z `dynamic(..., {ssr: false})`.

- [ ] Utwórz `components/viewer/ReadOnlyViewerClient.tsx`:

```tsx
// components/viewer/ReadOnlyViewerClient.tsx
'use client';

import dynamic from 'next/dynamic';
import type { ReadOnlyViewerProps } from './ReadOnlyViewer';

const ReadOnlyViewer = dynamic(
  () => import('./ReadOnlyViewer').then((m) => ({ default: m.ReadOnlyViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="read-only-viewer-loading">
        <span>Ładowanie sceny…</span>
      </div>
    ),
  },
);

export function ReadOnlyViewerClient(props: ReadOnlyViewerProps) {
  return <ReadOnlyViewer {...props} />;
}
```

- [ ] Dodaj CSS dla nowych klas w `app/globals.css` (lub odpowiednim pliku CSS):

```css
/* Widok tylko-do-odczytu — pełny ekran bez paneli edycji */
.read-only-viewer {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #dcdde0;
}

.read-only-viewer canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.read-only-viewer-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
  background: #dcdde0;
  font-family: Inter, system-ui, sans-serif;
  color: #555;
}
```

- [ ] Commit:

```bash
git add components/viewer/ lib/scenes/readOnlyStore.ts app/globals.css
git commit -m "feat(viewer): add ReadOnlyViewer and ReadOnlyViewerClient components"
```

---

### Zadanie 10 — Strona publiczna `/s/[token]`

**Cel:** SSR — znajdź aktywny `share_links` po tokenie, wczytaj scenę, wyrenderuj `ReadOnlyViewerClient`. Token nieaktywny lub revoked → 404.

- [ ] Utwórz `app/s/[token]/page.tsx`:

```tsx
// app/s/[token]/page.tsx

import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { shareLinks } from '@/lib/scenes/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getScene } from '@/lib/scenes/repo';
import { ReadOnlyViewerClient } from '@/components/viewer/ReadOnlyViewerClient';

interface Props {
  params: { token: string };
}

export async function generateMetadata({ params }: Props) {
  const link = await findActiveLink(params.token);
  if (!link) return { title: 'Scena niedostępna' };
  const scene = await getScene(link.sceneId);
  return {
    title: scene ? `${scene.title} — CFAB 3D Viewer` : 'Scena',
  };
}

async function findActiveLink(token: string) {
  const rows = await db
    .select({ id: shareLinks.id, sceneId: shareLinks.sceneId, mode: shareLinks.mode })
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.token, token),
        isNull(shareLinks.revokedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export default async function SharePage({ params }: Props) {
  const link = await findActiveLink(params.token);
  if (!link) notFound();

  const scene = await getScene(link.sceneId);
  if (!scene) notFound();

  return (
    <main style={{ margin: 0, padding: 0 }}>
      <ReadOnlyViewerClient
        config={scene.config}
        modelUrl={scene.modelBlobUrl}
      />
    </main>
  );
}
```

- [ ] Utwórz `app/s/[token]/not-found.tsx`:

```tsx
// app/s/[token]/not-found.tsx

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#444',
      gap: '1rem',
    }}>
      <h1 style={{ fontSize: '2rem', margin: 0 }}>Link wygasł lub nie istnieje</h1>
      <p style={{ margin: 0 }}>Ten link do podglądu sceny jest nieaktywny.</p>
      <a href="/" style={{ color: '#1b1c20', textDecoration: 'underline' }}>
        Przejdź do strony głównej
      </a>
    </div>
  );
}
```

- [ ] Commit:

```bash
git add app/s/
git commit -m "feat(pages): add public share page /s/[token] with SSR"
```

---

### Zadanie 11 — Strona embed `/embed/[token]`

**Cel:** Minimalny widok do iframe — zero chrome'u (bez nagłówka strony, bez branding CFAB, bez paska nawigacji). Sam Canvas.

- [ ] Utwórz `app/embed/[token]/page.tsx`:

```tsx
// app/embed/[token]/page.tsx

import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { shareLinks } from '@/lib/scenes/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getScene } from '@/lib/scenes/repo';
import { ReadOnlyViewerClient } from '@/components/viewer/ReadOnlyViewerClient';

interface Props {
  params: { token: string };
}

async function findActiveEmbedLink(token: string) {
  const rows = await db
    .select({ id: shareLinks.id, sceneId: shareLinks.sceneId })
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.token, token),
        eq(shareLinks.mode, 'embed'),
        isNull(shareLinks.revokedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export default async function EmbedPage({ params }: Props) {
  const link = await findActiveEmbedLink(params.token);
  if (!link) notFound();

  const scene = await getScene(link.sceneId);
  if (!scene) notFound();

  return (
    // Brak jakichkolwiek nagłówków, footerów, nawigacji.
    // Tylko Canvas — gotowy do wklejenia w iframe.
    <ReadOnlyViewerClient
      config={scene.config}
      modelUrl={scene.modelBlobUrl}
    />
  );
}
```

Uwaga: strona embed używa trybu 'embed' z `share_links.mode`. Link o trybie 'view' nie działa na `/embed/` — to celowe zabezpieczenie (własny token per tryb).

- [ ] Utwórz `app/embed/[token]/layout.tsx` — layout z `<html>` bez marginesów i bez globalnego layoutu strony:

```tsx
// app/embed/[token]/layout.tsx
// Odizolowany layout dla embed — nie dziedziczy globalnego layoutu z app/layout.tsx

import type { ReactNode } from 'react';

export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; overflow: hidden; background: #dcdde0; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] Commit:

```bash
git add app/embed/
git commit -m "feat(pages): add embed page /embed/[token] for iframe (mode:embed only)"
```

---

### Zadanie 12 — Galeria `/gallery`: strona SSR

**Cel:** Strona zalogowanego usera z listą scen (moje + udostępnione), zarządzaniem uprawnieniami i linkami share.

#### 12a — Strona galerii (`app/gallery/page.tsx`)

- [ ] Utwórz `app/gallery/page.tsx`:

```tsx
// app/gallery/page.tsx

import { requireUser } from '@/lib/auth/session';
import { listAccessible } from '@/lib/scenes/repo';
import { SceneCard } from './_components/SceneCard';
import { headers } from 'next/headers';

export const metadata = {
  title: 'Galeria scen — CFAB 3D Viewer',
};

export default async function GalleryPage() {
  // requireUser przekierowuje na /login jeśli niezalogowany
  const user = await requireUser();

  const scenes = await listAccessible(user.id);

  return (
    <main className="gallery-page">
      <header className="gallery-header">
        <h1>Galeria scen</h1>
        <a href="/editor" className="btn-primary">
          + Nowa scena
        </a>
      </header>

      {scenes.length === 0 ? (
        <div className="gallery-empty">
          <p>Nie masz jeszcze żadnych scen.</p>
          <a href="/editor" className="btn-primary">
            Utwórz pierwszą scenę
          </a>
        </div>
      ) : (
        <div className="gallery-grid">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              isOwner={scene.ownerId === user.id}
            />
          ))}
        </div>
      )}
    </main>
  );
}
```

#### 12b — Komponent `SceneCard`

- [ ] Utwórz `app/gallery/_components/SceneCard.tsx`:

```tsx
// app/gallery/_components/SceneCard.tsx
'use client';

import { useState } from 'react';
import type { SceneRecord } from '@/lib/scenes/repo';
import { PermissionsPanel } from './PermissionsPanel';
import { ShareLinksPanel } from './ShareLinksPanel';

interface SceneCardProps {
  scene: SceneRecord;
  isOwner: boolean;
}

export function SceneCard({ scene, isOwner }: SceneCardProps) {
  const [showPermissions, setShowPermissions] = useState(false);
  const [showShareLinks, setShowShareLinks] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Czy na pewno chcesz usunąć scenę "${scene.title}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/scenes/${scene.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? 'Błąd usuwania sceny');
        setDeleting(false);
        return;
      }
      // Odśwież stronę po usunięciu
      window.location.reload();
    } catch {
      alert('Błąd sieciowy');
      setDeleting(false);
    }
  }

  return (
    <article className="scene-card">
      {/* Miniatura */}
      <a href={`/editor/${scene.id}`} className="scene-card__thumb-link">
        {scene.thumbBlobUrl ? (
          <img
            src={scene.thumbBlobUrl}
            alt={scene.title}
            className="scene-card__thumb"
          />
        ) : (
          <div className="scene-card__thumb-placeholder">
            <span>Brak miniatury</span>
          </div>
        )}
      </a>

      {/* Metadane */}
      <div className="scene-card__body">
        <h2 className="scene-card__title">{scene.title}</h2>
        <p className="scene-card__meta">
          Zaktualizowano: {scene.updatedAt.toLocaleDateString('pl-PL')}
          {!isOwner && <span className="scene-card__badge">Udostępniona</span>}
        </p>
      </div>

      {/* Akcje */}
      <div className="scene-card__actions">
        <a href={`/editor/${scene.id}`} className="btn-sm">
          Edytuj
        </a>

        {isOwner && (
          <>
            <button
              className="btn-sm"
              onClick={() => {
                setShowPermissions(!showPermissions);
                setShowShareLinks(false);
              }}
            >
              Dostęp
            </button>
            <button
              className="btn-sm"
              onClick={() => {
                setShowShareLinks(!showShareLinks);
                setShowPermissions(false);
              }}
            >
              Linki
            </button>
            <button
              className="btn-sm btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Usuwam…' : 'Usuń'}
            </button>
          </>
        )}
      </div>

      {/* Panele rozwijane (owner-only) */}
      {isOwner && showPermissions && (
        <PermissionsPanel sceneId={scene.id} />
      )}
      {isOwner && showShareLinks && (
        <ShareLinksPanel sceneId={scene.id} />
      )}
    </article>
  );
}
```

#### 12c — Panel uprawnień (`PermissionsPanel`)

- [ ] Utwórz `app/gallery/_components/PermissionsPanel.tsx`:

```tsx
// app/gallery/_components/PermissionsPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import type { PermissionWithUser } from '@/lib/scenes/types';

interface Props {
  sceneId: string;
}

export function PermissionsPanel({ sceneId }: Props) {
  const [permissions, setPermissions] = useState<PermissionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pobierz listę uprawnień przy montażu
  useEffect(() => {
    fetch(`/api/scenes/${sceneId}/permissions`)
      .then((r) => r.json())
      .then((data) => {
        setPermissions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sceneId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenes/${sceneId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), canEdit }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Błąd dodawania uprawnienia');
        setAdding(false);
        return;
      }
      // Zaktualizuj listę (upsert — jeśli już był, odśwież jego canEdit)
      setPermissions((prev) => {
        const existing = prev.findIndex((p) => p.userId === data.userId);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = data;
          return next;
        }
        return [...prev, data];
      });
      setEmail('');
      setCanEdit(false);
    } catch {
      setError('Błąd sieciowy');
    }
    setAdding(false);
  }

  async function handleToggleEdit(perm: PermissionWithUser) {
    const res = await fetch(
      `/api/scenes/${sceneId}/permissions/${perm.userId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canEdit: !perm.canEdit }),
      },
    );
    if (!res.ok) return;
    setPermissions((prev) =>
      prev.map((p) =>
        p.userId === perm.userId ? { ...p, canEdit: !p.canEdit } : p,
      ),
    );
  }

  async function handleRemove(perm: PermissionWithUser) {
    const res = await fetch(
      `/api/scenes/${sceneId}/permissions/${perm.userId}`,
      { method: 'DELETE' },
    );
    if (!res.ok) return;
    setPermissions((prev) => prev.filter((p) => p.userId !== perm.userId));
  }

  return (
    <section className="panel permissions-panel">
      <h3>Dostęp do sceny</h3>

      {loading ? (
        <p>Ładowanie…</p>
      ) : (
        <>
          {permissions.length === 0 ? (
            <p className="panel__empty">Brak dodatkowych użytkowników.</p>
          ) : (
            <ul className="permissions-list">
              {permissions.map((perm) => (
                <li key={perm.userId} className="permissions-list__item">
                  <span className="permissions-list__email">{perm.email}</span>
                  <span className="permissions-list__role">
                    {perm.canEdit ? 'Edycja' : 'Podgląd'}
                  </span>
                  <button
                    className="btn-xs"
                    onClick={() => handleToggleEdit(perm)}
                    title={perm.canEdit ? 'Ogranicz do podglądu' : 'Przyznaj edycję'}
                  >
                    {perm.canEdit ? '→ Podgląd' : '→ Edycja'}
                  </button>
                  <button
                    className="btn-xs btn-danger"
                    onClick={() => handleRemove(perm)}
                    title="Usuń dostęp"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAdd} className="add-permission-form">
            <input
              type="email"
              placeholder="adres@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={canEdit}
                onChange={(e) => setCanEdit(e.target.checked)}
              />
              Może edytować
            </label>
            <button type="submit" className="btn-sm btn-primary" disabled={adding}>
              {adding ? 'Dodaję…' : 'Dodaj'}
            </button>
            {error && <p className="error-msg">{error}</p>}
          </form>
        </>
      )}
    </section>
  );
}
```

#### 12d — Panel linków share (`ShareLinksPanel`)

- [ ] Utwórz `app/gallery/_components/ShareLinksPanel.tsx`:

```tsx
// app/gallery/_components/ShareLinksPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import type { ShareLink, ShareMode } from '@/lib/scenes/types';

interface Props {
  sceneId: string;
}

function buildShareUrl(token: string, mode: ShareMode): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
  return mode === 'embed'
    ? `${base}/embed/${token}`
    : `${base}/s/${token}`;
}

export function ShareLinksPanel({ sceneId }: Props) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<ShareMode>('view');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/scenes/${sceneId}/share-links`)
      .then((r) => r.json())
      .then((data) => {
        setLinks(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sceneId]);

  async function handleCreate() {
    setCreating(true);
    const res = await fetch(`/api/scenes/${sceneId}/share-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (res.ok) {
      const link: ShareLink = await res.json();
      setLinks((prev) => [link, ...prev]);
    }
    setCreating(false);
  }

  async function handleRevoke(linkId: string) {
    const res = await fetch(
      `/api/scenes/${sceneId}/share-links/${linkId}`,
      { method: 'DELETE' },
    );
    if (!res.ok) return;
    setLinks((prev) =>
      prev.map((l) =>
        l.id === linkId ? { ...l, revokedAt: new Date() } : l,
      ),
    );
  }

  function handleCopy(token: string, linkMode: ShareMode) {
    const url = buildShareUrl(token, linkMode);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const activeLinks = links.filter((l) => l.revokedAt === null);
  const revokedLinks = links.filter((l) => l.revokedAt !== null);

  return (
    <section className="panel share-links-panel">
      <h3>Linki do udostępnienia</h3>

      {loading ? (
        <p>Ładowanie…</p>
      ) : (
        <>
          {activeLinks.length === 0 ? (
            <p className="panel__empty">Brak aktywnych linków.</p>
          ) : (
            <ul className="share-links-list">
              {activeLinks.map((link) => {
                const url = buildShareUrl(link.token, link.mode);
                return (
                  <li key={link.id} className="share-links-list__item">
                    <span className="share-links-list__mode">
                      {link.mode === 'embed' ? 'Embed' : 'Podgląd'}
                    </span>
                    <code className="share-links-list__url">{url}</code>
                    <button
                      className="btn-xs"
                      onClick={() => handleCopy(link.token, link.mode)}
                    >
                      {copied === link.token ? 'Skopiowano!' : 'Kopiuj'}
                    </button>
                    <button
                      className="btn-xs btn-danger"
                      onClick={() => handleRevoke(link.id)}
                    >
                      Revoke
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {revokedLinks.length > 0 && (
            <details className="revoked-links">
              <summary>Revoked ({revokedLinks.length})</summary>
              <ul className="share-links-list share-links-list--revoked">
                {revokedLinks.map((link) => (
                  <li key={link.id} className="share-links-list__item">
                    <span className="share-links-list__mode">
                      {link.mode === 'embed' ? 'Embed' : 'Podgląd'} (revoked)
                    </span>
                    <code className="share-links-list__url share-links-list__url--revoked">
                      {buildShareUrl(link.token, link.mode)}
                    </code>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Formularz tworzenia nowego linku */}
          <div className="create-link-form">
            <label className="radio-label">
              <input
                type="radio"
                name={`mode-${sceneId}`}
                value="view"
                checked={mode === 'view'}
                onChange={() => setMode('view')}
              />
              Podgląd (/s/)
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name={`mode-${sceneId}`}
                value="embed"
                checked={mode === 'embed'}
                onChange={() => setMode('embed')}
              />
              Embed (/embed/)
            </label>
            <button
              className="btn-sm btn-primary"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? 'Tworzę…' : 'Utwórz link'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
```

#### 12e — Style galerii

- [ ] Dopisz do `app/globals.css` (lub odpowiedniego pliku CSS) style galerii:

```css
/* ── Galeria ─────────────────────────────────────────────────────────────── */

.gallery-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.gallery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.gallery-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1b1c20;
}

.gallery-empty {
  text-align: center;
  padding: 4rem 0;
  color: #666;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

/* ── SceneCard ───────────────────────────────────────────────────────────── */

.scene-card {
  border: 1px solid #e0e0e3;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.scene-card__thumb-link {
  display: block;
  aspect-ratio: 4/3;
  overflow: hidden;
  background: #dcdde0;
}

.scene-card__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.scene-card__thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 0.85rem;
}

.scene-card__body {
  padding: 0.75rem 1rem 0.25rem;
}

.scene-card__title {
  font-size: 1rem;
  font-weight: 600;
  color: #1b1c20;
  margin: 0 0 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scene-card__meta {
  font-size: 0.75rem;
  color: #888;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.scene-card__badge {
  background: #e8f0fe;
  color: #1a73e8;
  padding: 0 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.scene-card__actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid #f0f0f2;
  flex-wrap: wrap;
}

/* ── Panele (PermissionsPanel, ShareLinksPanel) ──────────────────────────── */

.panel {
  padding: 1rem;
  border-top: 1px solid #f0f0f2;
  background: #fafafa;
}

.panel h3 {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.panel__empty {
  font-size: 0.85rem;
  color: #999;
  margin: 0 0 0.75rem;
}

/* Permissions */

.permissions-list {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
}

.permissions-list__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid #f0f0f2;
  font-size: 0.85rem;
}

.permissions-list__email {
  flex: 1;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.permissions-list__role {
  color: #888;
  min-width: 54px;
}

.add-permission-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.75rem;
}

.error-msg {
  width: 100%;
  color: #c62828;
  font-size: 0.8rem;
  margin: 0;
}

/* Share links */

.share-links-list {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
}

.share-links-list__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid #f0f0f2;
  font-size: 0.8rem;
}

.share-links-list__mode {
  min-width: 54px;
  color: #555;
  font-weight: 600;
}

.share-links-list__url {
  flex: 1;
  background: #f0f0f2;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
  color: #333;
}

.share-links-list__url--revoked {
  text-decoration: line-through;
  color: #bbb;
}

.share-links-list--revoked .share-links-list__item {
  opacity: 0.6;
}

.create-link-form {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

/* ── Przyciski ───────────────────────────────────────────────────────────── */

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.25rem;
  background: #1b1c20;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}

.btn-primary:hover { background: #333; }

.btn-sm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.85rem;
  background: #f0f0f2;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 0.8rem;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.1s;
}

.btn-sm:hover { background: #e4e4e6; }

.btn-xs {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.55rem;
  background: #f0f0f2;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.72rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.1s;
}

.btn-xs:hover { background: #e4e4e6; }

.btn-danger {
  background: #fce8e8;
  color: #c62828;
  border-color: #f0c0c0;
}

.btn-danger:hover { background: #f8d0d0; }

.input {
  padding: 0.4rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-size: 0.875rem;
  color: #1b1c20;
  background: #fff;
  min-width: 200px;
}

.input:focus {
  outline: none;
  border-color: #1b1c20;
}

.checkbox-label, .radio-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.revoked-links {
  margin: 0.5rem 0;
  font-size: 0.8rem;
}

.revoked-links summary {
  cursor: pointer;
  color: #888;
  user-select: none;
}
```

- [ ] Commit:

```bash
git add app/gallery/ app/globals.css
git commit -m "feat(gallery): add gallery page with SceneCard, PermissionsPanel, ShareLinksPanel"
```

---

### Zadanie 13 — Integracja z `next.config.ts` i zmienne środowiskowe

**Cel:** Upewnić się, że wszystkie wymagane zmienne env są udokumentowane i dostępne.

- [ ] Sprawdź, czy w `.env.local` (lub Vercel env) istnieje `NEXT_PUBLIC_APP_URL`. Jeśli nie — dodaj do `.env.example` (nie do `.env.local` — secrets):

```
# .env.example — fragment Etap D
NEXT_PUBLIC_APP_URL=http://localhost:3000   # URL bazowy dla linków share (public)
```

- [ ] W `ShareLinksPanel.tsx` `buildShareUrl` używa `process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin` — fallback na origin działa lokalnie.

- [ ] Commit:

```bash
git add .env.example
git commit -m "docs(env): add NEXT_PUBLIC_APP_URL to .env.example (Etap D)"
```

---

### Zadanie 14 — Weryfikacja ręczna (smoke test)

Po implementacji wykonaj poniższą sekwencję weryfikacyjną:

- [ ] Uruchom `npx drizzle-kit migrate` na świeżej bazie — tabele `scene_permissions` i `share_links` istnieją.
- [ ] Zaloguj się jako user A, utwórz scenę S1.
- [ ] Otwórz `GET /api/scenes/S1.id` jako user B (bez uprawnień) — oczekiwany: `403`.
- [ ] Dodaj uprawnienie dla B na S1: `POST /api/scenes/S1.id/permissions` `{email: B.email, canEdit: false}` — oczekiwany: `201`.
- [ ] Zaloguj się jako B, `GET /api/scenes/S1.id` — oczekiwany: `200`.
- [ ] B robi `PATCH /api/scenes/S1.id` z `{title: "test"}` — oczekiwany: `403` (canEdit=false).
- [ ] Jako A zmień uprawnienie: `PATCH /api/scenes/S1.id/permissions/B.id` `{canEdit: true}` — oczekiwany: `200`.
- [ ] Jako B ponów `PATCH` — oczekiwany: `200`.
- [ ] Utwórz link share: `POST /api/scenes/S1.id/share-links` `{mode:"view"}` — oczekiwany: `201` z tokenem.
- [ ] Otwórz w przeglądarce `/s/<token>` (wylogowany) — oczekiwany: renderuje scenę.
- [ ] Revoke link: `DELETE /api/scenes/S1.id/share-links/<linkId>` — oczekiwany: `204`.
- [ ] Odśwież `/s/<token>` — oczekiwany: `404`.
- [ ] Utwórz link embed: `POST ...share-links` `{mode:"embed"}` — otwórz `/embed/<token>` i wklej w iframe na testowej stronie HTML — oczekiwany: renderuje bez chrome'u.
- [ ] Sprawdź nagłówek: `curl -I /embed/<token>` — oczekiwany: brak `X-Frame-Options`, `Content-Security-Policy: frame-ancestors *`.
- [ ] Sprawdź nagłówek: `curl -I /gallery` — oczekiwany: `X-Frame-Options: SAMEORIGIN`.
- [ ] Galeria `/gallery` — sceny A (własne) widoczne; zaloguj się jako B — scena S1 widoczna (udostępniona).

---

## Self-Review

### Pokrycie zakresu

| Funkcja z zakresu | Zrealizowana w | Status |
|---|---|---|
| Schemat DB `scene_permissions` i `share_links` | Zadanie 1 | ✓ |
| `canView` + `assertCanEdit` (TDD) | Zadania 3a–3b | ✓ |
| Egzekwowanie uprawnień w GET/PATCH/DELETE scen | Zadanie 5 | ✓ |
| Lista scen: moje + udostępnione | Zadania 4, 5 | ✓ |
| API uprawnień GET/POST/PATCH/DELETE | Zadania 6a–6b | ✓ |
| API linków GET/POST/DELETE revoke | Zadania 7a–7b | ✓ |
| `ReadOnlyViewer` (bez paneli edycji) | Zadanie 9 | ✓ |
| Strona `/s/[token]` (SSR, 404 dla revoked) | Zadanie 10 | ✓ |
| Strona `/embed/[token]` (tylko Canvas) | Zadanie 11 | ✓ |
| Nagłówki framingu (global SAMEORIGIN, embed `*`) | Zadanie 8 | ✓ |
| Galeria `/gallery` (SSR) | Zadanie 12a | ✓ |
| `SceneCard` (miniatura, akcje, usuwanie) | Zadanie 12b | ✓ |
| `PermissionsPanel` (lista, dodaj po email, toggle, usuń) | Zadanie 12c | ✓ |
| `ShareLinksPanel` (lista, utwórz, kopiuj URL, revoke) | Zadanie 12d | ✓ |

### Skan placeholderów

Plan nie zawiera: `// TODO`, `// FIXME`, `// similar to Task N`, `// add validation`, `// implement later`. Każdy blok kodu jest kompletny.

### Spójność typów z kontraktem

| Typ w kontrakcie | Użycie w planie |
|---|---|
| `ShareMode = 'view' \| 'embed'` | `lib/scenes/types.ts` Zadanie 2 |
| `ScenePermission` | `lib/scenes/types.ts` Zadanie 2 |
| `ShareLink` | `lib/scenes/types.ts` Zadanie 2 |
| `SceneRecord` | import z `lib/scenes/repo` (z Etapu B) |
| `canView(scene, user, shareToken?)` | `lib/scenes/access.ts` Zadanie 3 |
| `assertCanEdit(scene, user)` | `lib/scenes/access.ts` Zadanie 3 |
| trasy `/api/scenes/[id]/permissions` | Zadania 6a, 6b |
| trasy `/api/scenes/[id]/share-links` | Zadania 7a, 7b |
| strony `/gallery`, `/s/[token]`, `/embed/[token]` | Zadania 10, 11, 12 |

### Decyzje R1–R5 — potwierdzenie wcielenia

- **R1** (token bearer w URL, bez hashowania): generowanie tokenem `crypto.randomBytes(32).toString('base64url')` w Zadaniu 7a; kolumna `token TEXT NOT NULL UNIQUE` w schemacie Zadanie 1.
- **R2** (framing): `next.config.ts` (Zadanie 8a) globalny SAMEORIGIN z wykluczeniem `/embed/`; `middleware.ts` (Zadanie 8b) nadpisuje nagłówki dla `/embed/:path*`.
- **R3** (render tylko-podgląd): `ReadOnlyViewer` reużywa `Studio`, `Product`, `CameraRig`, `Postprocess`, `Branding`, `CameraButtons`; nie montuje `ModelDropzone`, `EditorView`, `ViewButtons`, `Outliner`, `Inspector`, leva.
- **R4** (dodawanie po e-mailu, brak auto-zaproszenia): Zadanie 6a — szukaj w `users` po `normalizeEmail(email)`, 422 jeśli nie znaleziono.
- **R5** (`canView` z tokenem jako trzeci argument): sygnatura `canView(scene, user: User | null, shareToken?: string, deps?)` w Zadaniu 3.

### Zależności między etapami

Ten plan zakłada Etap B ukończony w zakresie:
- `lib/scenes/repo.ts` z funkcjami `getScene`, `updateScene`, `deleteScene`, `listScenes`
- `app/api/scenes/[id]/route.ts` (trasy scen)
- `lib/auth/session.ts` z `requireUser()` i `getCurrentUser()`
- Tabela `scenes` w DB z polami per kontrakt

Jeśli Etap B nie istnieje — przed uruchomieniem Etapu D należy stworzyć powyższe pliki zgodnie z kontraktem.

### Uwagi implementacyjne dla wykonawcy

1. `ReadOnlyViewer` inicjalizuje globalny store (Zustand) konfiguracją z DB przez `useMemo`. Jest to podejście pragmatyczne (reużycie istniejących komponentów bez modyfikacji). Jeśli w przyszłości komponenty dostaną własne propsy/context zamiast `useStore` — `ReadOnlyViewer` można uprościć.
2. `normalizeEmail()` musi być spójna z implementacją z Etapu A (`lib/auth/utils.ts`). Sprawdź przed uruchomieniem Zadania 6a.
3. Tokeny `share_links` są przechowywane wprost (plaintext) w DB i w URL. To akceptowalny kompromis dla tokenów nie będących hasłami — wystarczy entropia 32 bajtów losowych.
4. Kolumna `share_links.mode` jest `TEXT NOT NULL` bez CHECK constraint w Drizzle (CHECK można dodać ręcznie w SQL migracji jeśli potrzebne). Walidacja odbywa się w Zod na poziomie API.
5. `embed` tworzy własny izolowany `<html>` przez `layout.tsx` — to Next.js 14 App Router segment layout override. Upewnij się, że `app/embed/[token]/layout.tsx` jest nested segment layoutem i nie dziedziczy `app/layout.tsx`.
