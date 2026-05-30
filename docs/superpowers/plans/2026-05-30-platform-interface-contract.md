# Platforma CFAB — kontrakt interfejsów (Etapy A–D)

> **Cel tego dokumentu:** jedno źródło prawdy dla rzeczy, które MUSZĄ być spójne między 4 planami (A, B, C, D): tabele DB, typy TS, mapa tras API, konwencje. Każdy plan implementacyjny odwołuje się do tych nazw 1:1. Jeśli plan potrzebuje czegoś, czego tu nie ma — dodaje to lokalnie, ale nie zmienia nazw zdefiniowanych tutaj.

> **⚠️ DECYZJE DO WERYFIKACJI:** Etap A wynika z zatwierdzonej specyfikacji. Etapy B/C/D **nie były brainstormowane** — modele danych i przepływy poniżej to propozycje autora planu. Wszystkie pozycje oznaczone `[REVIEW]` wymagają akceptacji użytkownika.

## Zablokowane decyzje (całość)

- Next.js (App Router) na Vercel. Edytor 3D = komponent kliencki (`<Canvas>` dynamiczny `ssr:false`).
- Vercel Postgres (Neon) + **Drizzle ORM** (`drizzle-kit` migracje).
- Vercel Blob na pliki (`.glb` + miniatury) — od Etapu B.
- Własny SMTP przez `nodemailer`.
- Biała lista = pojedyncze maile; jedna tabela `users` (`status allowed|blocked`, czarna nadpisuje białą); role `admin|user`.
- Logowanie kodem: 6 cyfr, 15 min, jednorazowy; sesja w DB, cookie `cfab_session` 7 dni (sztywne).
- Język UI i komentarzy: polski. Conventional commits. TDD + drobne commity.

## Schemat DB (Postgres / Drizzle) — wszystkie etapy

```
-- ETAP A
users
  id            uuid pk default gen_random_uuid()
  email         text unique not null         -- normalizeEmail()
  role          text not null default 'user'     -- 'admin' | 'user'
  status        text not null default 'allowed'  -- 'allowed' | 'blocked'
  created_at    timestamptz not null default now()
  last_login_at timestamptz
  invited_by    uuid references users(id)

login_codes
  id uuid pk; email text not null; code_hash text not null
  expires_at timestamptz not null; consumed_at timestamptz
  attempts int not null default 0; created_at timestamptz not null default now()
  index(email, created_at)

sessions
  id uuid pk; user_id uuid not null references users(id) on delete cascade
  token_hash text not null unique; expires_at timestamptz not null
  created_at timestamptz not null default now(); index(user_id)

-- ETAP B  [REVIEW]
scenes
  id              uuid pk default gen_random_uuid()
  owner_id        uuid not null references users(id) on delete cascade
  title           text not null
  config          jsonb not null            -- SceneConfig (components/store.ts)
  model_blob_url  text                      -- Vercel Blob URL .glb (null = scena bez modelu)
  model_file_name text
  thumb_blob_url  text                      -- Vercel Blob URL miniatury PNG
  is_preset       boolean not null default false   -- ETAP C używa tej flagi
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()
  index(owner_id), index(is_preset)

-- ETAP D  [REVIEW]
scene_permissions
  id uuid pk; scene_id uuid not null references scenes(id) on delete cascade
  user_id uuid not null references users(id) on delete cascade
  can_edit boolean not null default false   -- false = tylko podgląd
  created_at timestamptz not null default now()
  unique(scene_id, user_id)

share_links
  id uuid pk; scene_id uuid not null references scenes(id) on delete cascade
  token text not null unique                -- losowy 32B base64url (bearer w URL)
  mode text not null                        -- 'view' | 'embed'
  created_at timestamptz not null default now()
  revoked_at timestamptz                    -- null = aktywny
  index(scene_id)
```

## Typy TS współdzielone

```ts
// lib/auth (A)
export type Role = 'admin' | 'user';
export type UserStatus = 'allowed' | 'blocked';
export interface User { id: string; email: string; role: Role; status: UserStatus;
  createdAt: Date; lastLoginAt: Date | null; invitedBy: string | null; }

// lib/scenes (B)  — SceneConfig importowany z components/store.ts (NIE redefiniować)
import type { SceneConfig } from '@/components/store';
export interface SceneRecord {
  id: string; ownerId: string; title: string; config: SceneConfig;
  modelBlobUrl: string | null; modelFileName: string | null;
  thumbBlobUrl: string | null; isPreset: boolean;
  createdAt: Date; updatedAt: Date;
}

// lib/scenes (D)
export type ShareMode = 'view' | 'embed';
export interface ScenePermission { id: string; sceneId: string; userId: string; canEdit: boolean; createdAt: Date; }
export interface ShareLink { id: string; sceneId: string; token: string; mode: ShareMode; createdAt: Date; revokedAt: Date | null; }
```

## Mapa tras API (wszystkie etapy)

```
# A
POST   /api/auth/request-code      {email}                  -> 200 generyczny
POST   /api/auth/verify-code       {email, code}            -> 200 + Set-Cookie cfab_session
POST   /api/auth/logout                                     -> 204, czyści cookie
GET    /api/auth/me                                         -> {user} | 401
GET    /api/admin/users                                     -> [User]            (requireAdmin)
POST   /api/admin/users            {email}                  -> 201 User          (requireAdmin)
PATCH  /api/admin/users/[id]       {role?|status?}          -> 200 User          (requireAdmin, anty-lockout)
DELETE /api/admin/users/[id]                                -> 204               (requireAdmin, anty-lockout)

# B
POST   /api/blob/upload            (handleUpload @vercel/blob/client token route)
GET    /api/scenes                 ?preset=0|1              -> [SceneRecord]     (moje)
POST   /api/scenes                 {title,config,modelBlobUrl,modelFileName,thumbBlobUrl,isPreset?} -> 201
GET    /api/scenes/[id]                                     -> SceneRecord       (właściciel | [D] uprawnienie)
PATCH  /api/scenes/[id]            {title?|config?|thumbBlobUrl?} -> 200          (właściciel | [D] can_edit)
DELETE /api/scenes/[id]                                     -> 204               (właściciel; ref-count Blob)

# C
POST   /api/scenes/[id]/instantiate                         -> 201 SceneRecord   (klon presetu na nową scenę; owner=caller)
# (zapis jako preset = POST /api/scenes z isPreset:true)

# D
GET    /api/scenes/[id]/permissions                         -> [{user,canEdit}]  (właściciel)
POST   /api/scenes/[id]/permissions       {email, canEdit}  -> 201               (właściciel)
PATCH  /api/scenes/[id]/permissions/[userId] {canEdit}      -> 200               (właściciel)
DELETE /api/scenes/[id]/permissions/[userId]                -> 204               (właściciel)
GET    /api/scenes/[id]/share-links                         -> [ShareLink]       (właściciel)
POST   /api/scenes/[id]/share-links       {mode}            -> 201 ShareLink     (właściciel)
DELETE /api/scenes/[id]/share-links/[linkId]                -> 204 (revoke)      (właściciel)
```

## Mapa stron (App Router)

```
/login              (A) publiczne — e-mail → kod
/                   (A) home zalogowanego → (B) strona startowa: kafelki scen + sekcja presetów
/editor             (A) port edytora; (B) + UI „Zapisz" / „Zapisz jako preset"
/editor/[id]        (B) otwarcie istniejącej sceny do edycji
/admin              (A) panel admina (requireAdmin)
/gallery            (D) galeria scen z dostępem (moje + udostępnione), usuwanie, uprawnienia, linki
/s/[token]          (D) publiczny podgląd tylko-do-odczytu (SSR po tokenie)
/embed/[token]      (D) minimalny widok do iframe (frameable)
```

## Konwencje techniczne

- **Auth helpers** (`lib/auth/session.ts`): `getCurrentUser()`, `requireUser()`, `requireAdmin()`. Status `allowed` sprawdzany przy każdym żądaniu.
- **Permission helpers** [REVIEW] (`lib/scenes/access.ts`, Etap D): `canView(scene, user)` (owner || perm || istnieje aktywny share token), `assertCanEdit(scene, user)` (owner || perm.can_edit).
- **Blob upload** [REVIEW]: klient wysyła `.glb` i miniaturę bezpośrednio do Vercel Blob przez `upload()` z `@vercel/blob/client`, token z `POST /api/blob/upload` (`handleUpload`). Ścieżki: `models/<uuid>.glb`, `thumbnails/<uuid>.png`. Funkcja serverless nie przepuszcza dużych plików.
- **Miniatura** [REVIEW]: zrzut finalnego canvasu (`gl.domElement.toDataURL('image/png')` z `preserveDrawingBuffer:true` lub render-on-demand), przeskalowany do ≤512 px dłuższego boku → upload do Blob przy zapisie.
- **Ref-count przy usuwaniu** [REVIEW]: usuwając scenę kasujemy jej `thumb`; `model_blob_url` kasujemy z Blob tylko jeśli żadna inna scena/preset go nie współdzieli (klon presetu współdzieli URL modelu).
- **Tokeny share** [REVIEW]: `crypto.randomBytes(32)` base64url, bearer w URL, przechowywany wprost, indeksowany; revoke = `revoked_at`.
- **Framing**: globalny nagłówek `X-Frame-Options: SAMEORIGIN` / CSP `frame-ancestors 'self'` przez `next.config` — **z wyjątkiem** `/embed/[token]`, który zezwala na osadzenie (`frame-ancestors *` lub konfigurowalne) [REVIEW].
- **Walidacja wejścia**: `zod` w każdej trasie API. Normalizacja e-maila: lowercase + trim.

## Zmienne środowiskowe (kumulatywnie)

```
DATABASE_URL                       # A — Neon/Vercel Postgres
SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM   # A
ADMIN_EMAILS                       # A — CSV bootstrap adminów
APP_URL                            # A — treść maila / linki share
BLOB_READ_WRITE_TOKEN              # B — Vercel Blob
```

## Format planów (każdy plan MUSI go trzymać — wg skilla writing-plans)

1. Nagłówek: linia „For agentic workers" (subagent-driven-development / executing-plans, checkboxy `- [ ]`), **Goal**, **Architecture**, **Tech Stack**.
2. Sekcja **File Structure** przed zadaniami (jakie pliki tworzymy/zmieniamy i za co odpowiadają).
3. Zadania **bite-sized** (2–5 min/krok), TDD red→green: napisz failing test → uruchom (FAIL) → minimalna implementacja → uruchom (PASS) → commit.
4. **Pełny kod w każdym kroku** (zero placeholderów typu „dodaj walidację"/„TODO"/„podobnie jak Task N"). Dokładne ścieżki plików. Dokładne komendy + oczekiwany wynik.
5. Spójne nazwy typów/metod z tym kontraktem.
6. Sekcja **Self-Review** na końcu (pokrycie zakresu, skan placeholderów, spójność typów).

## Granice zakresu (co do którego etapu należy)

- **A:** migracja Next, DB+Drizzle, logowanie kodem, sesje, middleware, panel admina. Bez scen.
- **B:** zapis/odczyt/lista własnych scen, upload modelu do Blob, miniatura, strona startowa. Bez współdzielenia, bez presetów (poza samą flagą/kolumną `is_preset`, która już jest w schemacie).
- **C:** „zapisz jako preset" (flaga), „nowa scena z presetu" (klon), sekcja presetów w UI. Bez uprawnień/współdzielenia.
- **D:** galeria, usuwanie, uprawnienia per-scena (widoczność + edycja), linki tylko-podgląd `/s/[token]`, embed `/embed/[token]`, nagłówki framingu.
