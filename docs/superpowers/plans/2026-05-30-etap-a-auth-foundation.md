# Etap A — Fundament: Next.js + Auth + Panel admina — Plan implementacji

> **For agentic workers:** WYMAGANY SUB-SKILL: Use `superpowers:subagent-driven-development` (rekomendowany) lub `superpowers:executing-plans` do implementacji zadanie po zadaniu. Każdy krok ma checkbox (`- [ ]`). TDD red→green: napisz failing test → uruchom (FAIL) → minimalna implementacja → uruchom (PASS) → commit. Nie pomijaj kroków weryfikacji.

**Goal:** Przekształcić jednoekranowy Vite SPA w aplikację Next.js (App Router) na Vercel z logowaniem „na zaproszenie" (kod e-mail, 15 min, jednorazowy). Istniejący edytor 3D działa identycznie jak dziś — tylko pod `/editor` i za bramką logowania. Efekt końcowy: system użytkowników (biała/czarna lista, role admin/user), panel admina, pełny auth flow z sesją w DB.

**Architecture:** Next.js 15 App Router + Vercel Postgres (Neon) + Drizzle ORM. Czyste biblioteki (`lib/auth/*`, `lib/validation.ts`) tesowane vitest (TDD). Trasy API w `app/api/`. Middleware bramkuje chronione ścieżki sprawdzając cookie bez hitu DB (tanio). Autorytatywna walidacja sesji w każdym żądaniu serwera (`getCurrentUser()`) — natychmiastowa blokada. Komponenty edytora przenoszone 1:1 do `components/` bez zmian funkcji.

**Tech Stack:** Next.js 15 (App Router), React 18, TypeScript 5, Drizzle ORM + drizzle-kit, @neondatabase/serverless, zod, nodemailer, vitest (testy jednostkowe), @types/nodemailer. Istniejące: @react-three/fiber, drei, postprocessing, three, leva, zustand (bez zmian).

---

## File Structure

### Pliki usuwane
- `vite.config.ts` — zastąpiony przez `next.config.ts`
- `index.html` — zastąpiony przez `app/layout.tsx`

### Pliki przenoszone (src/ → components/)
- `src/store.ts` → `components/store.ts`
- `src/store.test.ts` → `components/store.test.ts`
- `src/styles.css` → `components/styles.css`
- `src/App.tsx` → `components/App.tsx`
- `src/main.tsx` → usunięty (Next.js nie używa)
- `src/viewer/*` → `components/viewer/*`
- `src/ui/*` → `components/ui/*`
- `src/scene/*` → `components/scene/*` (jeśli istnieją)
- `src/models/*` → `components/models/*` (jeśli istnieją)

### Pliki tworzone — konfiguracja
- `next.config.ts` — konfiguracja Next.js (transpilePackages dla three.js/R3F)
- `tsconfig.json` — dostosowany pod Next.js (paths, moduleResolution: Bundler)
- `package.json` — nowe skrypty next dev/build/start; vitest zostaje
- `.env.example` — zmienne środowiskowe (bez wartości)
- `.env.local` — (NIE commitujemy) lokalne wartości dev

### Pliki tworzone — Next.js App Router
- `app/layout.tsx` — root layout: `<html lang="pl">`, import `components/styles.css`, meta
- `app/page.tsx` — home zalogowanego: e-mail, linki `/editor` i `/admin` (jeśli admin), wyloguj
- `app/login/page.tsx` — dwukrokowy formularz: e-mail → kod; zalogowany → redirect `/`
- `app/editor/page.tsx` — dynamic import `components/App` z `ssr:false`
- `app/admin/page.tsx` — panel admina (requireAdmin po stronie serwera)
- `middleware.ts` — bramka: `/`, `/editor`, `/admin`, `/api/admin/*` → brak cookie → redirect `/login`

### Pliki tworzone — API routes
- `app/api/auth/request-code/route.ts` — normalizacja → decyzja → rate-limit → wyślij
- `app/api/auth/verify-code/route.ts` — walidacja kodu → sesja → Set-Cookie
- `app/api/auth/logout/route.ts` — usuń sesję → wyczyść cookie
- `app/api/auth/me/route.ts` — bieżący user lub 401
- `app/api/admin/users/route.ts` — GET lista, POST zaproszenie
- `app/api/admin/users/[id]/route.ts` — PATCH rola/status, DELETE

### Pliki tworzone — lib/
- `lib/validation.ts` — `normalizeEmail`, schematy zod (requestCode, verifyCode, adminPatch, adminPost)
- `lib/auth/code.ts` — `generateCode` (6 cyfr, crypto.randomInt), `hashCode` (SHA-256), `verifyCode`
- `lib/auth/access.ts` — decyzja allowed/blocked/bootstrap (wstrzykiwany lookup usera)
- `lib/auth/session.ts` — `createSession`, `getCurrentUser`, `requireUser`, `requireAdmin`, `destroySession`, helper cookie
- `lib/auth/email.ts` — transport nodemailer, `sendLoginCode`
- `lib/db/schema.ts` — tabele Drizzle: `users`, `loginCodes`, `sessions`
- `lib/db/index.ts` — klient Drizzle (Neon serverless)
- `drizzle.config.ts` — konfiguracja drizzle-kit

### Pliki tworzone — testy
- `lib/auth/code.test.ts` — testy TDD dla generateCode, hashCode, verifyCode
- `lib/auth/access.test.ts` — testy TDD dla decyzji dostępu (4 ścieżki)
- `lib/auth/session.test.ts` — testy TDD dla hash tokenu i logiki ważności
- `lib/validation.test.ts` — testy TDD dla normalizeEmail i schematów zod

---

## Kamień M1 — Migracja Next.js (zachowawcza)

### Task M1-1: Zainstaluj Next.js i dostosuj package.json

**Files:** `package.json`

- [ ] **Step 1: Zainstaluj Next.js i usuń Vite**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer
npm install next@15
npm uninstall vite @vitejs/plugin-react
npm install --save-dev @types/node
```

Oczekiwany output: instalacja bez błędów, `next` pojawia się w `dependencies`.

- [ ] **Step 2: Zaktualizuj skrypty w `package.json`**

Zastąp sekcję `"scripts"`:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Sprawdź `package.json`**

Końcowy `package.json` musi wyglądać następująco (bez `vite`, `@vitejs/plugin-react`; `next` w dependencies):

```json
{
  "name": "furniture-viewer",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@react-three/drei": "^9.117.3",
    "@react-three/fiber": "^8.17.10",
    "@react-three/postprocessing": "^2.19.1",
    "leva": "^0.9.35",
    "next": "^15.0.0",
    "postprocessing": "^6.39.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "0.169.0",
    "zustand": "^5.0.1"
  },
  "devDependencies": {
    "@types/node": "^25.9.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/three": "^0.169.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): replace vite with next 15"
```

---

### Task M1-2: next.config.ts i tsconfig.json

**Files:** `next.config.ts` (nowy), `tsconfig.json` (modify)

- [ ] **Step 1: Utwórz `next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // three.js i powiązane pakiety muszą być transpilowane przez Next.js (ESM)
  transpilePackages: [
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    '@react-three/postprocessing',
    'postprocessing',
    'leva',
  ],
  // Wyłącz strict mode React na czas migracji (R3F canvas nie lubi double-mount)
  reactStrictMode: false,
};

export default nextConfig;
```

- [ ] **Step 2: Zastąp `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Usuń `vite.config.ts` i `index.html`**

```bash
rm /Users/micz/__DEV__/_CFAB_3D_Viewer/vite.config.ts
rm /Users/micz/__DEV__/_CFAB_3D_Viewer/index.html
```

- [ ] **Step 4: Commit**

```bash
git add next.config.ts tsconfig.json
git commit -m "chore(config): add next.config.ts, update tsconfig for Next.js App Router"
```

---

### Task M1-3: Przenieś src/ → components/

**Files:** katalog `components/` (nowy), `src/` (usuwany po przeniesieniu)

- [ ] **Step 1: Utwórz katalog components/ i przenieś pliki**

```bash
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/components/viewer
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/components/ui
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/components/scene
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/components/models

# Przenieś pliki główne
cp /Users/micz/__DEV__/_CFAB_3D_Viewer/src/store.ts /Users/micz/__DEV__/_CFAB_3D_Viewer/components/store.ts
cp /Users/micz/__DEV__/_CFAB_3D_Viewer/src/store.test.ts /Users/micz/__DEV__/_CFAB_3D_Viewer/components/store.test.ts
cp /Users/micz/__DEV__/_CFAB_3D_Viewer/src/styles.css /Users/micz/__DEV__/_CFAB_3D_Viewer/components/styles.css
cp /Users/micz/__DEV__/_CFAB_3D_Viewer/src/App.tsx /Users/micz/__DEV__/_CFAB_3D_Viewer/components/App.tsx

# Przenieś podkatalogi
cp -r /Users/micz/__DEV__/_CFAB_3D_Viewer/src/viewer/. /Users/micz/__DEV__/_CFAB_3D_Viewer/components/viewer/
cp -r /Users/micz/__DEV__/_CFAB_3D_Viewer/src/ui/. /Users/micz/__DEV__/_CFAB_3D_Viewer/components/ui/
# scene i models — jeśli istnieją
[ -d /Users/micz/__DEV__/_CFAB_3D_Viewer/src/scene ] && cp -r /Users/micz/__DEV__/_CFAB_3D_Viewer/src/scene/. /Users/micz/__DEV__/_CFAB_3D_Viewer/components/scene/
[ -d /Users/micz/__DEV__/_CFAB_3D_Viewer/src/models ] && cp -r /Users/micz/__DEV__/_CFAB_3D_Viewer/src/models/. /Users/micz/__DEV__/_CFAB_3D_Viewer/components/models/
```

- [ ] **Step 2: Zaktualizuj importy w components/ — zmień `'../store'` → `'@/components/store'` i podobne relative paths**

Wszystkie pliki w `components/viewer/*` i `components/ui/*` mają importy względne do `../store` — te działają nadal (relative w obrębie `components/`). Sprawdź czy żaden import nie zaczyna od `src/`:

```bash
grep -r "from 'src/" /Users/micz/__DEV__/_CFAB_3D_Viewer/components/ || echo "OK — brak importów src/"
grep -r 'from "src/' /Users/micz/__DEV__/_CFAB_3D_Viewer/components/ || echo "OK — brak importów src/"
```

Oczekiwany output: `OK — brak importów src/`

- [ ] **Step 3: Dodaj dyrektywę `'use client'` do plików komponentów**

Każdy plik komponentu React w `components/` musi mieć `'use client'` na początku (są to komponenty klienckie — używają hooków, R3F Canvas, Zustand).

Dodaj `'use client';` jako **pierwszą linię** do następujących plików:
- `components/App.tsx`
- `components/store.ts` — NIE dodawaj (to moduł ze stanem, nie komponent)
- `components/viewer/Viewer.tsx`
- `components/viewer/EditorView.tsx`
- `components/viewer/ModelDropzone.tsx`
- `components/ui/Inspector.tsx`
- `components/ui/Outliner.tsx`
- `components/ui/CameraButtons.tsx`
- `components/ui/ViewButtons.tsx`
- `components/ui/Branding.tsx`
- Wszystkie inne pliki `.tsx` w `components/viewer/` i `components/ui/`

Przykład edycji `components/App.tsx` — wstaw przed pierwszą linią:

```tsx
'use client';

import { Viewer } from './viewer/Viewer';
// ... reszta pliku bez zmian
```

Skrypt pomocniczy do sprawdzenia które pliki .tsx nie mają dyrektywy:
```bash
for f in $(find /Users/micz/__DEV__/_CFAB_3D_Viewer/components -name "*.tsx"); do
  head -1 "$f" | grep -q "'use client'" || echo "BRAK: $f"
done
```

- [ ] **Step 4: Usuń katalog src/**

```bash
rm -rf /Users/micz/__DEV__/_CFAB_3D_Viewer/src
```

- [ ] **Step 5: Sprawdź czy `npm test` nadal przechodzi (store.test.ts)**

Zaktualizuj ścieżkę `include` w konfiguracji vitest — sprawdź czy w `package.json` lub `vite.config.ts` był jakiś glob dla testów. Vitest po usunięciu vite.config.ts potrzebuje własnej konfiguracji.

Utwórz `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['components/**/*.test.ts', 'lib/**/*.test.ts'],
  },
});
```

Uruchom:
```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm test
```

Oczekiwany output: wszystkie testy zielone (te same co przed migracją, teraz z `components/store.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add components/ vitest.config.ts
git rm -r src/
git commit -m "refactor(migrate): move src/ to components/ with 'use client' directives"
```

---

### Task M1-4: app/layout.tsx i app/editor/page.tsx

**Files:** `app/layout.tsx` (nowy), `app/editor/page.tsx` (nowy)

- [ ] **Step 1: Utwórz katalog app/**

```bash
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/app/editor
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/app/login
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/app/admin
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/app/api/auth/request-code
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/app/api/auth/verify-code
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/app/api/auth/logout
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/app/api/auth/me
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/app/api/admin/users
```

- [ ] **Step 2: Utwórz `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import '@/components/styles.css';

export const metadata: Metadata = {
  title: 'CFAB 3D Viewer',
  description: 'Furniture 3D visualization tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Utwórz `app/editor/page.tsx`**

Edytor 3D wymaga `ssr:false` (Canvas nie działa w SSR). Używamy `next/dynamic`:

```tsx
import dynamic from 'next/dynamic';

// App (edytor 3D) ładowany wyłącznie po stronie klienta — Canvas WebGL
// nie może być renderowany w SSR.
const EditorApp = dynamic(() => import('@/components/App'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#f5f5f4' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2a8a66', animation: 'pulse 1.4s ease-in-out infinite' }} />
    </div>
  ),
});

export default function EditorPage() {
  return <EditorApp />;
}
```

- [ ] **Step 4: Utwórz tymczasowe `app/page.tsx`** (zostanie rozbudowany w M7)

```tsx
export default function HomePage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>CFAB 3D Viewer</h1>
      <a href="/editor">Edytor 3D</a>
    </main>
  );
}
```

- [ ] **Step 5: Sprawdź czy `next dev` startuje i edytor działa pod `/editor`**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm run dev
```

Otwórz `http://localhost:3000/editor`. Sprawdź:
- Edytor 3D ładuje się (Canvas, leva panel, outliner)
- Drag&drop `.glb` działa
- Brak błędów w konsoli przeglądarki i terminalu

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "feat(app): add Next.js App Router shell — layout + editor page"
```

---

**Weryfikacja kamienia M1:**
- `npm test` — zielony (store.test.ts z nowej lokalizacji)
- `npm run dev` → `/editor` — edytor działa identycznie jak przed migracją

---

## Kamień M2 — DB + Drizzle

### Task M2-1: Zainstaluj zależności DB

**Files:** `package.json`, `drizzle.config.ts` (nowy), `.env.example` (nowy)

- [ ] **Step 1: Zainstaluj pakiety**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer
npm install drizzle-orm @neondatabase/serverless
npm install --save-dev drizzle-kit
```

Oczekiwany output: instalacja bez błędów.

- [ ] **Step 2: Utwórz `.env.example`**

```bash
# Vercel Postgres / Neon — connection string
DATABASE_URL=

# SMTP — wysyłka kodów logowania
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="CFAB 3D Viewer <no-reply@conceptfab.com>"

# Bootstrap adminów — CSV adresów e-mail
# Pierwszy użytkownik z tej listy, który spróbuje się zalogować,
# automatycznie dostaje role=admin, status=allowed.
ADMIN_EMAILS=michal@kleniewski.com

# Bazowy URL aplikacji (do treści maili i przyszłych linków share)
APP_URL=http://localhost:3000
```

- [ ] **Step 3: Utwórz `drizzle.config.ts`**

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts .env.example
git commit -m "chore(deps): add drizzle-orm, @neondatabase/serverless, drizzle-kit"
```

---

### Task M2-2: Schema Drizzle (3 tabele)

**Files:** `lib/db/schema.ts` (nowy), `lib/db/index.ts` (nowy)

- [ ] **Step 1: Utwórz katalogi**

```bash
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/lib/db
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/lib/auth
```

- [ ] **Step 2: Utwórz `lib/db/schema.ts`**

Nazwy kolumn w snake_case (Postgres) — Drizzle mapuje je na camelCase w TypeScript przez `.`-notację lub jawny alias.

```ts
import { pgTable, text, uuid, timestamp, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Tabela użytkowników (biała lista = status='allowed', czarna = status='blocked').
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').unique().notNull(),
  // 'admin' | 'user'
  role: text('role').notNull().default('user'),
  // 'allowed' | 'blocked'
  status: text('status').notNull().default('allowed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  // null = bootstrap / seed; ref do usera który zaprosił
  invitedBy: uuid('invited_by').references((): any => users.id),
});

// Kody logowania jednorazowe (6 cyfr, 15 min, max 5 prób).
export const loginCodes = pgTable('login_codes', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull(),
  // SHA-256(hex) z 6-cyfrowego kodu — nigdy plaintext
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  // null = niezużyty
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  // liczba nieudanych prób weryfikacji
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// Sesje (token opaque w cookie, hash w DB).
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // SHA-256(hex) z losowego 32-bajtowego tokenu
  tokenHash: text('token_hash').notNull().unique(),
  // sztywne 7 dni od utworzenia
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// Typy TS eksportowane dla warstwy aplikacji
export type UserRow = typeof users.$inferSelect;
export type LoginCodeRow = typeof loginCodes.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
```

- [ ] **Step 3: Utwórz `lib/db/index.ts`**

```ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Klient Drizzle dla Vercel Serverless / Neon.
// DATABASE_URL musi być ustawiony jako zmienna środowiskowa.
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 4: Wygeneruj migrację**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer
npx drizzle-kit generate
```

Oczekiwany output: `lib/db/migrations/0000_*.sql` — plik z `CREATE TABLE users`, `CREATE TABLE login_codes`, `CREATE TABLE sessions`.

Sprawdź wygenerowany SQL:
```bash
cat /Users/micz/__DEV__/_CFAB_3D_Viewer/lib/db/migrations/*.sql
```

Powinien zawierać `CREATE TABLE "users"`, `CREATE TABLE "login_codes"`, `CREATE TABLE "sessions"`.

- [ ] **Step 5: Commit**

```bash
git add lib/db/ drizzle.config.ts
git commit -m "feat(db): Drizzle schema — users, login_codes, sessions + migration"
```

---

## Kamień M3 — Czyste biblioteki (TDD)

### Task M3-1: lib/validation.ts (TDD)

**Files:** `lib/validation.ts` (nowy), `lib/validation.test.ts` (nowy)

- [ ] **Step 1: Zainstaluj zod**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm install zod
```

- [ ] **Step 2: Napisz failing testy `lib/validation.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  requestCodeSchema,
  verifyCodeSchema,
  adminPostSchema,
  adminPatchSchema,
} from './validation';

describe('normalizeEmail', () => {
  it('zamienia na lowercase', () => {
    expect(normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
  });

  it('usuwa białe znaki z początku i końca', () => {
    expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
  });

  it('łączy trim i lowercase', () => {
    expect(normalizeEmail('  ADMIN@Test.Org  ')).toBe('admin@test.org');
  });

  it('pusty string zostaje pustym stringiem', () => {
    expect(normalizeEmail('')).toBe('');
  });
});

describe('requestCodeSchema', () => {
  it('akceptuje poprawny e-mail', () => {
    const result = requestCodeSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('odrzuca niepoprawny e-mail', () => {
    const result = requestCodeSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('odrzuca brak pola email', () => {
    const result = requestCodeSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('verifyCodeSchema', () => {
  it('akceptuje e-mail i 6-cyfrowy kod', () => {
    const result = verifyCodeSchema.safeParse({ email: 'u@e.com', code: '123456' });
    expect(result.success).toBe(true);
  });

  it('odrzuca kod krótszy niż 6 cyfr', () => {
    const result = verifyCodeSchema.safeParse({ email: 'u@e.com', code: '123' });
    expect(result.success).toBe(false);
  });

  it('odrzuca kod dłuższy niż 6 cyfr', () => {
    const result = verifyCodeSchema.safeParse({ email: 'u@e.com', code: '1234567' });
    expect(result.success).toBe(false);
  });

  it('odrzuca kod z literami', () => {
    const result = verifyCodeSchema.safeParse({ email: 'u@e.com', code: '12345a' });
    expect(result.success).toBe(false);
  });
});

describe('adminPostSchema', () => {
  it('akceptuje poprawny e-mail', () => {
    const result = adminPostSchema.safeParse({ email: 'new@example.com' });
    expect(result.success).toBe(true);
  });

  it('odrzuca niepoprawny e-mail', () => {
    const result = adminPostSchema.safeParse({ email: 'bad' });
    expect(result.success).toBe(false);
  });
});

describe('adminPatchSchema', () => {
  it('akceptuje role=admin', () => {
    const result = adminPatchSchema.safeParse({ role: 'admin' });
    expect(result.success).toBe(true);
  });

  it('akceptuje role=user', () => {
    const result = adminPatchSchema.safeParse({ role: 'user' });
    expect(result.success).toBe(true);
  });

  it('akceptuje status=allowed', () => {
    const result = adminPatchSchema.safeParse({ status: 'allowed' });
    expect(result.success).toBe(true);
  });

  it('akceptuje status=blocked', () => {
    const result = adminPatchSchema.safeParse({ status: 'blocked' });
    expect(result.success).toBe(true);
  });

  it('odrzuca nieznana role', () => {
    const result = adminPatchSchema.safeParse({ role: 'superuser' });
    expect(result.success).toBe(false);
  });

  it('odrzuca nieznany status', () => {
    const result = adminPatchSchema.safeParse({ status: 'pending' });
    expect(result.success).toBe(false);
  });

  it('odrzuca pusty obiekt (wymaga co najmniej role lub status)', () => {
    const result = adminPatchSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Uruchom testy — oczekiwany FAIL**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm test
```

Oczekiwany output: FAIL — `Cannot find module './validation'`.

- [ ] **Step 4: Utwórz `lib/validation.ts`**

```ts
import { z } from 'zod';

/** Normalizuje e-mail: lowercase + trim. Używany wszędzie gdzie przyjmujemy e-mail. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Schemat żądania kodu logowania. */
export const requestCodeSchema = z.object({
  email: z.string().email(),
});

/** Schemat weryfikacji kodu logowania: e-mail + dokładnie 6 cyfr. */
export const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Kod musi być 6-cyfrową liczbą'),
});

/** Schemat zaproszenia użytkownika przez admina. */
export const adminPostSchema = z.object({
  email: z.string().email(),
});

/** Schemat patcha użytkownika przez admina — wymagany co najmniej jeden z pól. */
export const adminPatchSchema = z
  .object({
    role: z.enum(['admin', 'user']).optional(),
    status: z.enum(['allowed', 'blocked']).optional(),
  })
  .refine((data) => data.role !== undefined || data.status !== undefined, {
    message: 'Wymagane co najmniej role lub status',
  });
```

- [ ] **Step 5: Uruchom testy — oczekiwany PASS**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm test
```

Oczekiwany output: PASS — wszystkie testy validation zielone.

- [ ] **Step 6: Commit**

```bash
git add lib/validation.ts lib/validation.test.ts
git commit -m "feat(validation): normalizeEmail + zod schemas (TDD)"
```

---

### Task M3-2: lib/auth/code.ts (TDD)

**Files:** `lib/auth/code.ts` (nowy), `lib/auth/code.test.ts` (nowy)

- [ ] **Step 1: Napisz failing testy `lib/auth/code.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { generateCode, hashCode, verifyCode } from './code';

describe('generateCode', () => {
  it('zwraca string o długości 6', () => {
    const code = generateCode();
    expect(code).toHaveLength(6);
  });

  it('zawiera wyłącznie cyfry', () => {
    const code = generateCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('jest zero-padded (może zaczynać się od 0)', () => {
    // Generujemy 200 kodów — statystycznie któryś będzie < 100000 i powinien być padded
    const codes = Array.from({ length: 200 }, () => generateCode());
    codes.forEach((c) => expect(c).toHaveLength(6));
  });

  it('zwraca różne wartości przy kolejnych wywołaniach (nielosowe byłoby podejrzane)', () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateCode()));
    // 10 losowych 6-cyfrowych kodów — szansa na kolizję wynosi < 0.01%
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('hashCode', () => {
  it('zwraca string hex (SHA-256 = 64 znaki)', () => {
    const hash = hashCode('123456');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('jest deterministyczny — ten sam input → ten sam hash', () => {
    expect(hashCode('123456')).toBe(hashCode('123456'));
  });

  it('różne kody → różne hashe', () => {
    expect(hashCode('123456')).not.toBe(hashCode('654321'));
  });
});

describe('verifyCode', () => {
  it('zwraca true gdy kod zgadza się z hashem', () => {
    const code = '123456';
    const hash = hashCode(code);
    expect(verifyCode(code, hash)).toBe(true);
  });

  it('zwraca false gdy kod nie zgadza się z hashem', () => {
    const hash = hashCode('123456');
    expect(verifyCode('999999', hash)).toBe(false);
  });

  it('zwraca false dla pustego kodu', () => {
    const hash = hashCode('123456');
    expect(verifyCode('', hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Uruchom testy — oczekiwany FAIL**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm test
```

Oczekiwany output: FAIL — `Cannot find module './code'`.

- [ ] **Step 3: Utwórz `lib/auth/code.ts`**

```ts
import { createHash, randomInt } from 'crypto';

/**
 * Generuje losowy 6-cyfrowy kod logowania.
 * Używa crypto.randomInt (CSPRNG) dla bezpiecznej losowości.
 * Zero-padding zapewnia stałą długość 6 znaków.
 */
export function generateCode(): string {
  // randomInt(0, 1_000_000) → [0, 999999]
  const n = randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

/**
 * Hashuje kod SHA-256 i zwraca hex string.
 * Kod nigdy nie jest przechowywany w plaintext w DB.
 */
export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * Porównuje kod z hashem (constant-time poprzez ponowne hashowanie).
 * Bezpieczne przed timing attacks — hashowanie jest determinystyczne,
 * więc porównanie stringów jest OK po zhashowaniu.
 */
export function verifyCode(code: string, storedHash: string): boolean {
  if (!code) return false;
  return hashCode(code) === storedHash;
}
```

- [ ] **Step 4: Uruchom testy — oczekiwany PASS**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm test
```

Oczekiwany output: PASS — wszystkie testy code zielone.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/code.ts lib/auth/code.test.ts
git commit -m "feat(auth): generateCode/hashCode/verifyCode (TDD)"
```

---

### Task M3-3: lib/auth/access.ts (TDD)

**Files:** `lib/auth/access.ts` (nowy), `lib/auth/access.test.ts` (nowy)

Logika dostępu jest czystą funkcją z wstrzykiwanym "repo" usera — bez realnej DB w testach.

- [ ] **Step 1: Napisz failing testy `lib/auth/access.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { checkAccess, canRemoveAdmin } from './access';
import type { AccessUserRepo } from './access';

// Pomocnik: tworzy mock repo
function makeRepo(user: { status: 'allowed' | 'blocked' } | null): AccessUserRepo {
  return {
    findByEmail: async () => user,
  };
}

describe('checkAccess', () => {
  it('ALLOW dla istniejącego usera status=allowed', async () => {
    const result = await checkAccess('user@example.com', makeRepo({ status: 'allowed' }), []);
    expect(result).toBe('allow');
  });

  it('DENY dla istniejącego usera status=blocked (czarna lista nadpisuje wszystko)', async () => {
    // nawet jeśli jest w ADMIN_EMAILS — blocked = deny
    const result = await checkAccess(
      'admin@example.com',
      makeRepo({ status: 'blocked' }),
      ['admin@example.com']
    );
    expect(result).toBe('deny');
  });

  it('bootstrap: ALLOW i zwraca "bootstrap" dla nieznanego e-maila z ADMIN_EMAILS', async () => {
    const result = await checkAccess('admin@example.com', makeRepo(null), ['admin@example.com']);
    expect(result).toBe('bootstrap');
  });

  it('DENY dla nieznanego e-maila spoza ADMIN_EMAILS', async () => {
    const result = await checkAccess('stranger@example.com', makeRepo(null), ['admin@example.com']);
    expect(result).toBe('deny');
  });

  it('DENY dla pustej listy ADMIN_EMAILS i nieznanego usera', async () => {
    const result = await checkAccess('unknown@example.com', makeRepo(null), []);
    expect(result).toBe('deny');
  });

  it('normalizuje e-mail przed porównaniem z ADMIN_EMAILS', async () => {
    // ADMIN_EMAILS trzyma już znormalizowane; email z requesta normalizowany w route
    // Ten test sprawdza, że checkAccess nie normalizuje ponownie (oczekuje już znormalizowanego)
    const result = await checkAccess('admin@example.com', makeRepo(null), ['admin@example.com']);
    expect(result).toBe('bootstrap');
  });
});

describe('canRemoveAdmin', () => {
  it('true gdy adminCount > 1', () => {
    expect(canRemoveAdmin(2)).toBe(true);
    expect(canRemoveAdmin(5)).toBe(true);
  });

  it('false gdy adminCount === 1 (ostatni admin)', () => {
    expect(canRemoveAdmin(1)).toBe(false);
  });

  it('false gdy adminCount === 0 (edge case)', () => {
    expect(canRemoveAdmin(0)).toBe(false);
  });
});
```

- [ ] **Step 2: Uruchom testy — oczekiwany FAIL**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm test
```

Oczekiwany output: FAIL — `Cannot find module './access'`.

- [ ] **Step 3: Utwórz `lib/auth/access.ts`**

```ts
/** Wynik decyzji dostępu. */
export type AccessResult = 'allow' | 'deny' | 'bootstrap';

/**
 * Interfejs repo do wstrzykiwania w testach (bez realnej DB).
 * W produkcji implementowany przez zapytanie Drizzle do tabeli `users`.
 */
export interface AccessUserRepo {
  findByEmail: (email: string) => Promise<{ status: 'allowed' | 'blocked' } | null>;
}

/**
 * Decyzja dostępu na podstawie znormalizowanego e-maila i stanu DB.
 *
 * Reguły (w kolejności priorytetu):
 * 1. Istnieje i status=blocked → DENY (czarna lista nadpisuje wszystko, w tym ADMIN_EMAILS)
 * 2. Istnieje i status=allowed → ALLOW
 * 3. Nie istnieje + e-mail w ADMIN_EMAILS → BOOTSTRAP (utwórz admina)
 * 4. Nie istnieje + spoza ADMIN_EMAILS → DENY
 *
 * @param email - znormalizowany e-mail (lowercase + trim)
 * @param repo - wstrzykiwany dostęp do DB (testowalność bez DB)
 * @param adminEmails - lista znormalizowanych ADMIN_EMAILS (bootstrap)
 */
export async function checkAccess(
  email: string,
  repo: AccessUserRepo,
  adminEmails: string[]
): Promise<AccessResult> {
  const user = await repo.findByEmail(email);

  if (user !== null) {
    if (user.status === 'blocked') return 'deny';
    if (user.status === 'allowed') return 'allow';
  }

  // User nie istnieje — sprawdź bootstrap
  if (adminEmails.includes(email)) return 'bootstrap';
  return 'deny';
}

/**
 * Czysta funkcja anty-lockout: czy można usunąć/zablokować/zdegradować admina?
 * Wymaga wiedzy o aktualnej liczbie aktywnych adminów (adminCount).
 *
 * @param adminCount - liczba userów role='admin' AND status='allowed' (przed operacją)
 */
export function canRemoveAdmin(adminCount: number): boolean {
  return adminCount > 1;
}
```

- [ ] **Step 4: Uruchom testy — oczekiwany PASS**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm test
```

Oczekiwany output: PASS — wszystkie testy access zielone.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/access.ts lib/auth/access.test.ts
git commit -m "feat(auth): checkAccess + canRemoveAdmin (TDD)"
```

---

### Task M3-4: lib/auth/session.ts — czyste funkcje (TDD)

**Files:** `lib/auth/session.ts` (nowy), `lib/auth/session.test.ts` (nowy)

Testujemy wyłącznie czyste funkcje: hash tokenu, logika ważności. Integracja z DB (createSession, getCurrentUser) — bez testów automatycznych (wymaga DB).

- [ ] **Step 1: Napisz failing testy `lib/auth/session.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { hashToken, isSessionValid } from './session';

describe('hashToken', () => {
  it('zwraca SHA-256 hex (64 znaki)', () => {
    const hash = hashToken('someRandomToken');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('jest deterministyczny', () => {
    expect(hashToken('token123')).toBe(hashToken('token123'));
  });

  it('różne tokeny → różne hashe', () => {
    expect(hashToken('tokenA')).not.toBe(hashToken('tokenB'));
  });
});

describe('isSessionValid', () => {
  it('zwraca true gdy sesja nie wygasła', () => {
    const future = new Date(Date.now() + 60_000); // 1 minuta w przyszłości
    expect(isSessionValid({ expiresAt: future })).toBe(true);
  });

  it('zwraca false gdy sesja wygasła', () => {
    const past = new Date(Date.now() - 60_000); // 1 minuta wstecz
    expect(isSessionValid({ expiresAt: past })).toBe(false);
  });

  it('zwraca false gdy expires_at = teraz (dokładnie na granicy)', () => {
    const now = new Date();
    // Chwila w przeszłości — stempel <= now → invalid
    const justPast = new Date(now.getTime() - 1);
    expect(isSessionValid({ expiresAt: justPast })).toBe(false);
  });
});
```

- [ ] **Step 2: Uruchom testy — oczekiwany FAIL**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm test
```

Oczekiwany output: FAIL — `Cannot find module './session'`.

- [ ] **Step 3: Utwórz `lib/auth/session.ts`**

```ts
import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { sessions, users } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import type { User, Role, UserStatus } from '@/lib/types';

// Nazwa cookie sesji (spójna z kontraktem).
export const SESSION_COOKIE = 'cfab_session';
// Czas życia sesji: 7 dni (sztywne — bez sliding expiration).
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Czyste funkcje (testowalne bez DB) ──────────────────────────────────────

/**
 * Hashuje token sesji SHA-256 → hex.
 * Token jawny → cookie; hash → DB.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Sprawdza czy rekord sesji nie wygasł.
 * Czysta funkcja na obiekcie sesji — testowalność bez DB.
 */
export function isSessionValid(session: { expiresAt: Date }): boolean {
  return session.expiresAt.getTime() > Date.now();
}

// ─── Funkcje z dostępem do DB ────────────────────────────────────────────────

/**
 * Tworzy sesję w DB i zwraca token do ustawienia w cookie.
 * Token = losowe 32 bajty base64url; w DB przechowywany jako hash.
 */
export async function createSession(userId: string): Promise<string> {
  const tokenBytes = randomBytes(32);
  const token = tokenBytes.toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return token;
}

/**
 * Odczytuje cookie sesji, weryfikuje w DB, sprawdza status usera.
 * Zwraca User lub null (brak cookie / wygasła / user blocked).
 *
 * Wywoływana w każdym żądaniu wymagającym auth — natychmiastowa blokada
 * dzięki sprawdzeniu status='allowed' przy każdym żądaniu.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const now = new Date();

  const result = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      invitedBy: users.invitedBy,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, now)
      )
    )
    .limit(1);

  const row = result[0];
  if (!row) return null;
  // Blokada działa natychmiastowo — sprawdzamy status przy każdym żądaniu.
  if (row.status !== 'allowed') return null;

  return {
    id: row.id,
    email: row.email,
    role: row.role as Role,
    status: row.status as UserStatus,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
    invitedBy: row.invitedBy,
  };
}

/**
 * Jak getCurrentUser, ale rzuca redirect do /login gdy brak auth.
 * Używany w server components wymagających zalogowania.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    // next/navigation redirect — wychodzi przez throw
    const { redirect } = await import('next/navigation');
    redirect('/login');
  }
  return user;
}

/**
 * Jak requireUser, ale dodatkowo sprawdza role='admin'.
 * Jeśli user nie jest adminem — redirect do /.
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'admin') {
    const { redirect } = await import('next/navigation');
    redirect('/');
  }
  return user;
}

/**
 * Usuwa sesję z DB (wylogowanie).
 * Nie rzuca błędu gdy sesja nie istnieje (idempotentne).
 */
export async function destroySession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

/**
 * Pomocnik: zwraca atrybuty cookie sesji do ustawienia (Set-Cookie).
 * Używany w route.ts po verify-code.
 */
export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_MS / 1000, // maxAge w sekundach
  };
}

/**
 * Pomocnik: atrybuty cookie czyszczącego sesję (przy logout).
 */
export function clearSessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
}
```

- [ ] **Step 4: Utwórz `lib/types.ts`** — wspólne typy TS z kontraktu

```ts
// Typy z kontraktu platformy (docs/superpowers/plans/2026-05-30-platform-interface-contract.md)

export type Role = 'admin' | 'user';
export type UserStatus = 'allowed' | 'blocked';

export interface User {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  invitedBy: string | null;
}
```

- [ ] **Step 5: Uruchom testy — oczekiwany PASS (tylko czyste funkcje)**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm test
```

Oczekiwany output: PASS — testy `hashToken` i `isSessionValid` zielone. (Funkcje DB nie są testowane — wymagają połączenia z Neon.)

- [ ] **Step 6: Commit**

```bash
git add lib/auth/session.ts lib/auth/session.test.ts lib/types.ts
git commit -m "feat(auth): session helpers + pure function tests (TDD)"
```

---

## Kamień M4 — Transport mailowy

### Task M4-1: lib/auth/email.ts (TDD — wstrzykiwany transport)

**Files:** `lib/auth/email.ts` (nowy), `lib/auth/email.test.ts` (nowy)

- [ ] **Step 1: Zainstaluj nodemailer**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer
npm install nodemailer
npm install --save-dev @types/nodemailer
```

- [ ] **Step 2: Napisz failing testy `lib/auth/email.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { buildLoginEmail, sendLoginCode } from './email';

describe('buildLoginEmail', () => {
  it('zawiera kod w treści wiadomości', () => {
    const { text, html } = buildLoginEmail('123456', 'http://localhost:3000');
    expect(text).toContain('123456');
    expect(html).toContain('123456');
  });

  it('zawiera APP_URL w treści', () => {
    const { text, html } = buildLoginEmail('000000', 'https://app.example.com');
    expect(text).toContain('https://app.example.com');
    expect(html).toContain('https://app.example.com');
  });

  it('zawiera informację o czasie ważności (15 minut)', () => {
    const { text } = buildLoginEmail('123456', 'http://localhost:3000');
    expect(text).toContain('15');
  });
});

describe('sendLoginCode', () => {
  it('wywołuje transport.sendMail z poprawnym adresem odbiorcy', async () => {
    const mockTransport = {
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    };

    await sendLoginCode('user@example.com', '654321', {
      transport: mockTransport as any,
      from: 'Test Sender <no-reply@test.com>',
      appUrl: 'http://localhost:3000',
    });

    expect(mockTransport.sendMail).toHaveBeenCalledTimes(1);
    const callArg = mockTransport.sendMail.mock.calls[0][0];
    expect(callArg.to).toBe('user@example.com');
    expect(callArg.from).toBe('Test Sender <no-reply@test.com>');
  });

  it('wywołuje sendMail z kodem w treści', async () => {
    const mockTransport = {
      sendMail: vi.fn().mockResolvedValue({ messageId: 'x' }),
    };

    await sendLoginCode('u@e.com', '111222', {
      transport: mockTransport as any,
      from: 'App <a@b.com>',
      appUrl: 'http://localhost:3000',
    });

    const callArg = mockTransport.sendMail.mock.calls[0][0];
    expect(callArg.text).toContain('111222');
    expect(callArg.html).toContain('111222');
  });
});
```

- [ ] **Step 3: Uruchom testy — oczekiwany FAIL**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm test
```

Oczekiwany output: FAIL — `Cannot find module './email'`.

- [ ] **Step 4: Utwórz `lib/auth/email.ts`**

```ts
import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

/** Treść i HTML wiadomości z kodem logowania. */
export function buildLoginEmail(
  code: string,
  appUrl: string
): { subject: string; text: string; html: string } {
  const subject = `Twój kod logowania: ${code}`;

  const text = `
Witaj,

Twój kod logowania do ${appUrl} to:

  ${code}

Kod jest ważny przez 15 minut i może być użyty tylko raz.

Jeśli nie prosiłeś/aś o ten kod, zignoruj tę wiadomość.
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="utf-8"></head>
<body style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 20px; color: #1c1917;">
  <h2 style="margin: 0 0 16px;">Kod logowania</h2>
  <p>Twój kod logowania do <a href="${appUrl}">${appUrl}</a>:</p>
  <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; text-align: center;
              padding: 24px; background: #f5f5f4; border-radius: 8px; margin: 24px 0;">
    ${code}
  </div>
  <p style="color: #78716c; font-size: 14px;">
    Kod jest ważny przez <strong>15 minut</strong> i może być użyty tylko raz.<br>
    Jeśli nie prosiłeś/aś o ten kod, zignoruj tę wiadomość.
  </p>
</body>
</html>
`.trim();

  return { subject, text, html };
}

/** Opcje wstrzykiwane do sendLoginCode (produkcja vs test). */
export interface SendOptions {
  transport: Pick<Mail, 'sendMail'>;
  from: string;
  appUrl: string;
}

/**
 * Wysyła kod logowania na podany adres e-mail.
 * Transport jest wstrzykiwany — w testach używamy mocka,
 * w produkcji createTransport() z nodemailer.
 */
export async function sendLoginCode(
  to: string,
  code: string,
  options: SendOptions
): Promise<void> {
  const { subject, text, html } = buildLoginEmail(code, options.appUrl);

  await options.transport.sendMail({
    from: options.from,
    to,
    subject,
    text,
    html,
  });
}

/**
 * Tworzy produkcyjny transport SMTP z zmiennych środowiskowych.
 * Wywoływany w route.ts (nie w testach).
 */
export function createSmtpTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}
```

- [ ] **Step 5: Uruchom testy — oczekiwany PASS**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm test
```

Oczekiwany output: PASS — wszystkie testy email zielone.

- [ ] **Step 6: Commit**

```bash
git add lib/auth/email.ts lib/auth/email.test.ts
git commit -m "feat(auth): email transport + buildLoginEmail (TDD)"
```

---

## Kamień M5 — Trasy auth API

### Task M5-1: POST /api/auth/request-code

**Files:** `app/api/auth/request-code/route.ts` (nowy)

- [ ] **Step 1: Utwórz `app/api/auth/request-code/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { normalizeEmail, requestCodeSchema } from '@/lib/validation';
import { checkAccess } from '@/lib/auth/access';
import { generateCode, hashCode } from '@/lib/auth/code';
import { sendLoginCode, createSmtpTransport } from '@/lib/auth/email';
import { db } from '@/lib/db';
import { loginCodes, users } from '@/lib/db/schema';
import { eq, and, gt, isNull, count } from 'drizzle-orm';

// Odpowiedź zawsze identyczna — brak enumeracji adresów.
const GENERIC_OK = { message: 'Jeśli adres jest na liście, wysłaliśmy kod logowania.' };

// Rate-limit: max 5 żądań kodu / 60 minut / e-mail (liczone z login_codes).
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  // 1. Walidacja wejścia
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(GENERIC_OK); // złośliwy request — generyczna odpowiedź
  }

  const parse = requestCodeSchema.safeParse(body);
  if (!parse.success) {
    // Nie ujawniamy szczegółów błędu walidacji
    return NextResponse.json(GENERIC_OK);
  }

  const email = normalizeEmail(parse.data.email);

  // 2. Decyzja dostępu (czysta funkcja z wstrzykiwanym repo)
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const accessRepo = {
    findByEmail: async (e: string) => {
      const result = await db.select({ status: users.status }).from(users).where(eq(users.email, e)).limit(1);
      return result[0] ?? null;
    },
  };

  const decision = await checkAccess(email, accessRepo, adminEmails);

  // 3. Bootstrap — utwórz admina jeśli nie istnieje
  if (decision === 'bootstrap') {
    await db.insert(users).values({
      email,
      role: 'admin',
      status: 'allowed',
    }).onConflictDoNothing();
  }

  // 4. DENY → generyczna odpowiedź (brak enumeracji)
  if (decision === 'deny') {
    return NextResponse.json(GENERIC_OK);
  }

  // 5. Rate-limit: zlicz kody z ostatniej godziny
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentCodesResult = await db
    .select({ value: count() })
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.email, email),
        gt(loginCodes.createdAt, windowStart)
      )
    );
  const recentCount = recentCodesResult[0]?.value ?? 0;

  if (recentCount >= RATE_LIMIT_MAX) {
    // Przekroczono limit — nie wysyłamy, ale klient dostaje generyczny sukces
    return NextResponse.json(GENERIC_OK);
  }

  // 6. Generuj kod i zapisz hash w DB
  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minut

  await db.insert(loginCodes).values({
    email,
    codeHash,
    expiresAt,
  });

  // 7. Wyślij e-mail (błąd SMTP nie wycieka do klienta)
  try {
    const transport = createSmtpTransport();
    await sendLoginCode(email, code, {
      transport,
      from: process.env.SMTP_FROM ?? 'CFAB 3D Viewer <no-reply@conceptfab.com>',
      appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    });
  } catch (err) {
    // Logujemy błąd SMTP serwerowo, ale klient dostaje generyczny sukces.
    // W produkcji: podłącz logger (np. Vercel logs).
    console.error('[request-code] Błąd wysyłki SMTP:', err);
  }

  return NextResponse.json(GENERIC_OK);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/auth/request-code/route.ts
git commit -m "feat(api): POST /api/auth/request-code — rate-limit + generic response"
```

---

### Task M5-2: POST /api/auth/verify-code

**Files:** `app/api/auth/verify-code/route.ts` (nowy)

- [ ] **Step 1: Utwórz `app/api/auth/verify-code/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { normalizeEmail, verifyCodeSchema } from '@/lib/validation';
import { verifyCode } from '@/lib/auth/code';
import { createSession, sessionCookieOptions } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { loginCodes, users } from '@/lib/db/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';

// Max prób weryfikacji na jeden kod — po przekroczeniu kod martwy.
const MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
  // 1. Walidacja wejścia
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie' }, { status: 400 });
  }

  const parse = verifyCodeSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: 'Nieprawidłowe dane' }, { status: 400 });
  }

  const email = normalizeEmail(parse.data.email);
  const { code } = parse.data;
  const now = new Date();

  // 2. Znajdź najnowszy niezużyty, nieprzeterminowany kod dla e-maila
  const codeRows = await db
    .select()
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.email, email),
        isNull(loginCodes.consumedAt),
        gt(loginCodes.expiresAt, now)
      )
    )
    .orderBy(loginCodes.createdAt)
    .limit(1);

  const codeRow = codeRows[0];

  if (!codeRow) {
    return NextResponse.json({ error: 'Kod wygasł lub nie istnieje' }, { status: 400 });
  }

  // 3. Sprawdź limit prób
  if (codeRow.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Kod zablokowany — zbyt wiele prób' }, { status: 400 });
  }

  // 4. Weryfikuj kod
  const isValid = verifyCode(code, codeRow.codeHash);

  if (!isValid) {
    // Zwiększ licznik prób
    await db
      .update(loginCodes)
      .set({ attempts: codeRow.attempts + 1 })
      .where(eq(loginCodes.id, codeRow.id));

    return NextResponse.json({ error: 'Nieprawidłowy kod' }, { status: 400 });
  }

  // 5. Kod poprawny — oznacz jako zużyty
  await db
    .update(loginCodes)
    .set({ consumedAt: now })
    .where(eq(loginCodes.id, codeRow.id));

  // 6. Znajdź lub obsłuż usera (powinien istnieć po request-code, ale defensywnie)
  const userRows = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = userRows[0];

  if (!user || user.status === 'blocked') {
    return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
  }

  // 7. Zaktualizuj last_login_at
  await db
    .update(users)
    .set({ lastLoginAt: now })
    .where(eq(users.id, user.id));

  // 8. Utwórz sesję
  const token = await createSession(user.id);

  // 9. Ustaw cookie i zwróć 200
  const res = NextResponse.json({ ok: true });
  const cookieOpts = sessionCookieOptions(token);
  res.cookies.set(cookieOpts);

  return res;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/auth/verify-code/route.ts
git commit -m "feat(api): POST /api/auth/verify-code — verify + session + Set-Cookie"
```

---

### Task M5-3: POST /api/auth/logout i GET /api/auth/me

**Files:** `app/api/auth/logout/route.ts` (nowy), `app/api/auth/me/route.ts` (nowy)

- [ ] **Step 1: Utwórz `app/api/auth/logout/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, SESSION_COOKIE, clearSessionCookieOptions } from '@/lib/auth/session';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await destroySession(token);
  }

  const res = NextResponse.json(null, { status: 204 });
  res.cookies.set(clearSessionCookieOptions());
  return res;
}
```

- [ ] **Step 2: Utwórz `app/api/auth/me/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/logout/route.ts app/api/auth/me/route.ts
git commit -m "feat(api): POST /api/auth/logout + GET /api/auth/me"
```

---

## Kamień M6 — Middleware

### Task M6-1: middleware.ts — bramka tras chronionych

**Files:** `middleware.ts` (nowy, w katalogu głównym projektu)

- [ ] **Step 1: Utwórz `middleware.ts`**

Middleware sprawdza wyłącznie obecność cookie — bez hitu DB (tanie, edge-friendly). Autorytatywna walidacja sesji odbywa się po stronie serwera w `getCurrentUser()`.

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session';

// Ścieżki chronione — brak cookie → redirect /login.
const PROTECTED_PATHS = ['/', '/editor', '/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Sprawdź czy ścieżka jest chroniona (exact match lub prefix dla /api/admin/*)
  const isProtected =
    PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/api/admin/');

  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE);

  if (!sessionCookie) {
    // API routes → 401 (nie redirect)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Uruchom middleware dla tras chronionych (wyklucz _next/static, _next/image, favicon)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login).*)',
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat(middleware): guard protected routes — no DB hit on edge"
```

---

## Kamień M7 — UI logowania i strona home

### Task M7-1: app/login/page.tsx — dwukrokowy formularz

**Files:** `app/login/page.tsx` (nowy)

- [ ] **Step 1: Utwórz `app/login/page.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') ?? '/';

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Sprawdź czy już zalogowany → redirect
  useEffect(() => {
    fetch('/api/auth/me').then((res) => {
      if (res.ok) router.replace(from);
    });
  }, [from, router]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Zawsze generyczna odpowiedź — nie zdradzamy czy e-mail jest na liście
      setMessage('Jeśli adres jest na liście, wysłaliśmy kod na Twoją skrzynkę.');
      setStep('code');
    } catch {
      setError('Błąd sieci — spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      if (res.ok) {
        router.replace(from);
      } else {
        const data = await res.json();
        setError(data.error ?? 'Nieprawidłowy kod.');
      }
    } catch {
      setError('Błąd sieci — spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>CFAB 3D Viewer</h1>

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} style={styles.form}>
            <p style={styles.subtitle}>Zaloguj się adresem e-mail</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="twoj@email.com"
              required
              autoFocus
              style={styles.input}
            />
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'Wysyłanie…' : 'Wyślij kod'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit} style={styles.form}>
            {message && <p style={styles.info}>{message}</p>}
            <p style={styles.subtitle}>Wpisz 6-cyfrowy kod z e-maila</p>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              autoFocus
              maxLength={6}
              style={{ ...styles.input, letterSpacing: '8px', textAlign: 'center', fontSize: '24px' }}
            />
            <button type="submit" disabled={loading || code.length < 6} style={styles.button}>
              {loading ? 'Weryfikacja…' : 'Zaloguj się'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setCode(''); setError(''); }}
              style={styles.link}
            >
              Zmień adres e-mail
            </button>
          </form>
        )}

        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: '#f5f5f4',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.08)',
    padding: '40px 36px',
    width: '100%',
    maxWidth: 380,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    margin: '0 0 24px',
    color: '#1c1917',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#78716c',
    margin: '0 0 16px',
    textAlign: 'center',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
  },
  button: {
    padding: '11px 0',
    background: '#2a8a66',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#78716c',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '4px 0',
  },
  info: { fontSize: 13, color: '#2a8a66', margin: 0, textAlign: 'center' },
  error: { fontSize: 13, color: '#dc2626', margin: '12px 0 0', textAlign: 'center' },
};
```

- [ ] **Step 2: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(ui): login page — two-step email/code form"
```

---

### Task M7-2: app/page.tsx — home zalogowanego

**Files:** `app/page.tsx` (modify)

- [ ] **Step 1: Zastąp tymczasowy `app/page.tsx`**

```tsx
import { requireUser } from '@/lib/auth/session';

export default async function HomePage() {
  const user = await requireUser();

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>CFAB 3D Viewer</h1>
        <p style={styles.greeting}>Zalogowano jako <strong>{user.email}</strong></p>

        <nav style={styles.nav}>
          <a href="/editor" style={styles.navLink}>
            Edytor 3D
          </a>
          {user.role === 'admin' && (
            <a href="/admin" style={styles.navLink}>
              Panel admina
            </a>
          )}
        </nav>

        <form action="/api/auth/logout" method="POST" style={{ marginTop: 32 }}>
          <button type="submit" style={styles.logoutBtn}>
            Wyloguj się
          </button>
        </form>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: '#f5f5f4',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.08)',
    padding: '40px 36px',
    width: '100%',
    maxWidth: 400,
  },
  title: { fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: '#1c1917' },
  greeting: { fontSize: 14, color: '#78716c', margin: '0 0 24px' },
  nav: { display: 'flex', flexDirection: 'column', gap: 8 },
  navLink: {
    display: 'block',
    padding: '12px 16px',
    background: '#f5f5f4',
    borderRadius: 8,
    color: '#1c1917',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 15,
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 8,
    padding: '8px 16px',
    color: '#78716c',
    cursor: 'pointer',
    fontSize: 13,
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): home page — user greeting + editor/admin links + logout"
```

---

## Kamień M8 — Panel admina

### Task M8-1: Trasy API admina (users)

**Files:** `app/api/admin/users/route.ts` (nowy), `app/api/admin/users/[id]/route.ts` (nowy)

- [ ] **Step 1: Utwórz katalog dla [id]**

```bash
mkdir -p /Users/micz/__DEV__/_CFAB_3D_Viewer/app/api/admin/users/\[id\]
```

- [ ] **Step 2: Utwórz `app/api/admin/users/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { normalizeEmail, adminPostSchema } from '@/lib/validation';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import type { User } from '@/lib/types';

// GET /api/admin/users — lista wszystkich użytkowników
export async function GET() {
  await requireAdmin();

  const rows = await db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt));

  return NextResponse.json(rows);
}

// POST /api/admin/users — dodaj użytkownika na białą listę
export async function POST(req: Request) {
  await requireAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie' }, { status: 400 });
  }

  const parse = adminPostSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: 'Nieprawidłowy e-mail' }, { status: 400 });
  }

  const email = normalizeEmail(parse.data.email);

  // Sprawdź czy e-mail już istnieje
  const existing = await db.select({ id: users.id }).from(users).where(
    (u) => u.email === email
  ).limit(1);

  // Drizzle — poprawne zapytanie z eq
  const { eq } = await import('drizzle-orm');
  const existingRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingRows.length > 0) {
    return NextResponse.json({ error: 'Użytkownik już istnieje' }, { status: 409 });
  }

  const inserted = await db.insert(users).values({
    email,
    role: 'user',
    status: 'allowed',
  }).returning();

  return NextResponse.json(inserted[0], { status: 201 });
}
```

- [ ] **Step 3: Utwórz `app/api/admin/users/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { adminPatchSchema } from '@/lib/validation';
import { canRemoveAdmin } from '@/lib/auth/access';
import { db } from '@/lib/db';
import { users, sessions } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';

// PATCH /api/admin/users/[id] — zmiana roli lub statusu
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie' }, { status: 400 });
  }

  const parse = adminPatchSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { role, status } = parse.data;

  // Anty-lockout: nie można zdegradować/zablokować ostatniego admina
  if (role === 'user' || status === 'blocked') {
    // Pobierz aktualnego usera
    const targetRows = await db
      .select({ role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    const target = targetRows[0];
    if (!target) {
      return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });
    }

    // Sprawdź anty-lockout tylko gdy target jest adminem
    if (target.role === 'admin' && target.status === 'allowed') {
      const adminCountResult = await db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.status, 'allowed')));
      const adminCount = adminCountResult[0]?.value ?? 0;

      if (!canRemoveAdmin(adminCount)) {
        return NextResponse.json(
          { error: 'Nie można zmodyfikować ostatniego aktywnego admina' },
          { status: 400 }
        );
      }
    }
  }

  // Wykonaj aktualizację
  const patch: Record<string, string> = {};
  if (role !== undefined) patch.role = role;
  if (status !== undefined) patch.status = status;

  const updated = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, id))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });
  }

  // Jeśli zablokowano — usuń wszystkie sesje usera (natychmiastowe wylogowanie)
  if (status === 'blocked') {
    await db.delete(sessions).where(eq(sessions.userId, id));
  }

  return NextResponse.json(updated[0]);
}

// DELETE /api/admin/users/[id] — usuń użytkownika
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  const { id } = await params;

  // Pobierz usera do sprawdzenia anty-lockout
  const targetRows = await db
    .select({ role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  const target = targetRows[0];
  if (!target) {
    return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });
  }

  // Anty-lockout: nie można usunąć ostatniego aktywnego admina
  if (target.role === 'admin' && target.status === 'allowed') {
    const adminCountResult = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.status, 'allowed')));
    const adminCount = adminCountResult[0]?.value ?? 0;

    if (!canRemoveAdmin(adminCount)) {
      return NextResponse.json(
        { error: 'Nie można usunąć ostatniego aktywnego admina' },
        { status: 400 }
      );
    }
  }

  // Usuń (sessions są kasowane kaskadowo przez ON DELETE CASCADE)
  await db.delete(users).where(eq(users.id, id));

  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Napraw zduplikowane zapytanie w route.ts (GET /api/admin/users)**

Edytuj `app/api/admin/users/route.ts` — usuń błędny fragment z `existing` (przed `existingRows`). Całość POST powinna wyglądać:

```ts
export async function POST(req: Request) {
  await requireAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie' }, { status: 400 });
  }

  const parse = adminPostSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: 'Nieprawidłowy e-mail' }, { status: 400 });
  }

  const email = normalizeEmail(parse.data.email);

  const { eq } = await import('drizzle-orm');
  const existingRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingRows.length > 0) {
    return NextResponse.json({ error: 'Użytkownik już istnieje' }, { status: 409 });
  }

  const inserted = await db.insert(users).values({
    email,
    role: 'user',
    status: 'allowed',
  }).returning();

  return NextResponse.json(inserted[0], { status: 201 });
}
```

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/users/route.ts" "app/api/admin/users/[id]/route.ts"
git commit -m "feat(api): admin users CRUD — GET/POST/PATCH/DELETE + anti-lockout"
```

---

### Task M8-2: app/admin/page.tsx — panel admina

**Files:** `app/admin/page.tsx` (nowy)

- [ ] **Step 1: Utwórz `app/admin/page.tsx`**

```tsx
import { requireAdmin } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import AdminPanel from './AdminPanel';

export default async function AdminPage() {
  await requireAdmin();

  const allUsers = await db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt));

  return <AdminPanel initialUsers={allUsers} />;
}
```

- [ ] **Step 2: Utwórz `app/admin/AdminPanel.tsx`** — interaktywny komponent kliencki

```tsx
'use client';

import { useState } from 'react';
import type { UserRow } from '@/lib/db/schema';

export default function AdminPanel({ initialUsers }: { initialUsers: UserRow[] }) {
  const [userList, setUserList] = useState<UserRow[]>(initialUsers);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    const res = await fetch('/api/admin/users');
    if (res.ok) setUserList(await res.json());
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError('');
    setMessage('');

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail }),
    });

    if (res.ok) {
      setMessage(`Dodano użytkownika: ${newEmail}`);
      setNewEmail('');
      await refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Błąd dodawania.');
    }
    setAdding(false);
  }

  async function handlePatch(id: string, patch: { role?: string; status?: string }) {
    setError('');
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Błąd aktualizacji.');
    }
    await refresh();
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Usunąć użytkownika ${email}?`)) return;
    setError('');
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const data = await res.json();
      setError(data.error ?? 'Błąd usuwania.');
    }
    await refresh();
  }

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Panel admina</h1>
        <a href="/" style={styles.backLink}>← Strona główna</a>
      </div>

      {/* Formularz dodawania */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Dodaj użytkownika</h2>
        <form onSubmit={handleAddUser} style={styles.addForm}>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            required
            style={styles.input}
          />
          <button type="submit" disabled={adding} style={styles.btn}>
            {adding ? 'Dodawanie…' : 'Dodaj'}
          </button>
        </form>
        {message && <p style={styles.success}>{message}</p>}
        {error && <p style={styles.error}>{error}</p>}
      </section>

      {/* Tabela użytkowników */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Użytkownicy ({userList.length})</h2>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>E-mail</th>
                <th style={styles.th}>Rola</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Ostatnie logowanie</th>
                <th style={styles.th}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((u) => (
                <tr key={u.id} style={styles.tr}>
                  <td style={styles.td}>{u.email}</td>
                  <td style={styles.td}>
                    <select
                      value={u.role}
                      onChange={(e) => handlePatch(u.id, { role: e.target.value })}
                      style={styles.select}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td style={styles.td}>
                    <select
                      value={u.status}
                      onChange={(e) => handlePatch(u.id, { status: e.target.value })}
                      style={{
                        ...styles.select,
                        color: u.status === 'blocked' ? '#dc2626' : 'inherit',
                      }}
                    >
                      <option value="allowed">allowed</option>
                      <option value="blocked">blocked</option>
                    </select>
                  </td>
                  <td style={styles.td}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('pl') : '—'}
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => handleDelete(u.id, u.email)}
                      style={styles.deleteBtn}
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 900, margin: '0 auto', padding: '32px 20px', fontFamily: 'ui-sans-serif, system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  title: { fontSize: 22, fontWeight: 700, margin: 0, color: '#1c1917' },
  backLink: { fontSize: 14, color: '#78716c', textDecoration: 'none' },
  section: { marginBottom: 32, background: '#fff', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', padding: 24 },
  sectionTitle: { fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: '#1c1917' },
  addForm: { display: 'flex', gap: 10 },
  input: { flex: 1, padding: '9px 13px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 7, fontSize: 14 },
  btn: { padding: '9px 20px', background: '#2a8a66', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  success: { fontSize: 13, color: '#2a8a66', margin: '10px 0 0' },
  error: { fontSize: 13, color: '#dc2626', margin: '10px 0 0' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.08)', color: '#78716c', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
  tr: { borderBottom: '1px solid rgba(0,0,0,0.05)' },
  td: { padding: '10px 12px', color: '#1c1917' },
  select: { padding: '4px 8px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 5, fontSize: 13, background: '#fff', cursor: 'pointer' },
  deleteBtn: { padding: '4px 10px', background: 'none', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 5, fontSize: 12, cursor: 'pointer' },
};
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/
git commit -m "feat(admin): admin panel — user list, invite, role/status change, delete"
```

---

## Weryfikacja końcowa

### Task Final-1: Uruchom migrację DB i przetestuj ręcznie

**Wymagania wstępne:** `.env.local` z `DATABASE_URL` (Vercel Postgres / Neon), `ADMIN_EMAILS`, `SMTP_*`, `APP_URL`.

- [ ] **Step 1: Zastosuj migrację**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer
npx drizzle-kit migrate
```

Oczekiwany output: `Applying migration 0000_*.sql... done`.

- [ ] **Step 2: Uruchom dev server**

```bash
npm run dev
```

- [ ] **Step 3: Przejdź checklistę walidacji ręcznej (ze specyfikacji)**

1. `npm run dev` → `/editor` wygląda i działa jak przed migracją (model drag&drop, leva, kamery).
2. Niezalogowany na `/`, `/editor`, `/admin` → redirect `/login`.
3. Niezalogowany na `/api/admin/users` → 401 (nie redirect).
4. E-mail z `ADMIN_EMAILS` → przychodzi kod → po wpisaniu wpadasz na `/`; reload w ciągu 7 dni nie wylogowuje.
5. Błędny kod → odrzucony z komunikatem; po 5 próbach kod martwy (kolejna próba → 400 „zablokowany").
6. Przeterminowany kod (15 min) → odrzucony.
7. E-mail spoza listy → ten sam komunikat, brak maila.
8. Admin (`ADMIN_EMAILS`) widzi link `/admin` na home; wejście na `/admin` działa.
9. Zwykły user (zaproszony przez admina) NIE widzi `/admin`; próba wejścia → redirect `/`.
10. Admin dodaje nowy e-mail → zaproszony może się zalogować.
11. Admin blokuje usera → kolejne żądanie wylogowanego zablokowanego → `/login`.
12. Próba zablokowania/usunięcia ostatniego admina → 400.
13. Wylogowanie czyści cookie; kolejne wejście na `/` → redirect `/login`.

- [ ] **Step 4: npm test — wszystkie testy zielone**

```bash
cd /Users/micz/__DEV__/_CFAB_3D_Viewer && npm test
```

Oczekiwany output: PASS — testy validation, code, access, session, store (components/store.test.ts).

- [ ] **Step 5: Commit końcowy (jeśli były poprawki z walidacji)**

```bash
git add -A
git commit -m "fix: address manual validation findings (Etap A)"
```

---

## Self-Review

### Pokrycie specyfikacji (2026-05-30-etap-a-auth-foundation-design.md)

| Wymaganie ze spec | Pokryte przez | Status |
|---|---|---|
| Migracja Vite → Next.js App Router | M1-1..M1-4 | tak |
| Edytor pod `/editor` z `ssr:false` | M1-4 Task `app/editor/page.tsx` | tak |
| Tabela `users` (uuid, email, role, status, created_at, last_login_at, invited_by) | M2-2 `lib/db/schema.ts` | tak |
| Tabela `login_codes` (uuid, email, code_hash, expires_at, consumed_at, attempts) | M2-2 `lib/db/schema.ts` | tak |
| Tabela `sessions` (uuid, user_id→cascade, token_hash unique, expires_at) | M2-2 `lib/db/schema.ts` | tak |
| Drizzle ORM + drizzle-kit + Neon serverless | M2-1..M2-2 | tak |
| `normalizeEmail` (lowercase + trim) | M3-1 `lib/validation.ts` | tak |
| Schematy zod dla tras API | M3-1 `lib/validation.ts` | tak |
| `generateCode` (6 cyfr, crypto.randomInt, zero-padding) | M3-2 `lib/auth/code.ts` | tak |
| `hashCode` SHA-256 hex | M3-2 `lib/auth/code.ts` | tak |
| `checkAccess` (allowed/blocked/bootstrap/deny), wstrzykiwany repo | M3-3 `lib/auth/access.ts` | tak |
| Czarna lista nadpisuje ADMIN_EMAILS | M3-3 test `blocked` z ADMIN_EMAILS | tak |
| `canRemoveAdmin` czysta funkcja na liczniku | M3-3 `lib/auth/access.ts` | tak |
| `hashToken` / `isSessionValid` (czyste funkcje) | M3-4 `lib/auth/session.ts` | tak |
| `createSession` / `getCurrentUser` / `requireUser` / `requireAdmin` / `destroySession` | M3-4 `lib/auth/session.ts` | tak |
| Cookie `cfab_session` httpOnly/Secure/SameSite=Lax/7dni | M3-4 `sessionCookieOptions` | tak |
| Sprawdzenie `status=allowed` przy każdym żądaniu | M3-4 `getCurrentUser` | tak |
| nodemailer transport + `sendLoginCode` | M4-1 `lib/auth/email.ts` | tak |
| `POST /api/auth/request-code` (rate-limit 5/60min, generyczna odpowiedź) | M5-1 | tak |
| `POST /api/auth/verify-code` (max 5 prób, Set-Cookie, consumed_at) | M5-2 | tak |
| `POST /api/auth/logout` (usuń sesję, wyczyść cookie) | M5-3 | tak |
| `GET /api/auth/me` (bieżący user lub 401) | M5-3 | tak |
| Middleware bramkuje `/`, `/editor`, `/admin`, `/api/admin/*` | M6-1 `middleware.ts` | tak |
| `/login` dwukrokowy formularz (e-mail → kod) | M7-1 | tak |
| Redirect z `/login` jeśli zalogowany | M7-1 (`/api/auth/me` check) | tak |
| Home (`/`) — e-mail, linki /editor i /admin (jeśli admin), wyloguj | M7-2 | tak |
| `GET /api/admin/users` | M8-1 | tak |
| `POST /api/admin/users` (zaproszenie, 409 przy duplikacie) | M8-1 | tak |
| `PATCH /api/admin/users/[id]` (rola/status, anty-lockout, kasuj sesje przy blokadzie) | M8-1 | tak |
| `DELETE /api/admin/users/[id]` (anty-lockout) | M8-1 | tak |
| `/admin` panel (tabela, akcje) | M8-2 | tak |
| `.env.example` z wszystkimi zmiennymi | M2-1 | tak |
| `components/store.test.ts` zielony po migracji | M1-3 | tak |

### Skan placeholderów

Brak „TODO", „dodaj walidację", „podobnie jak Task N" w treści planu. Każdy krok zawiera pełny kod gotowy do kopiowania.

### Spójność typów z kontraktem (platform-interface-contract.md)

| Nazwa w kontrakcie | Użyta w planie | Plik |
|---|---|---|
| `Role = 'admin' \| 'user'` | `lib/types.ts` eksportuje `Role` | M3-4 |
| `UserStatus = 'allowed' \| 'blocked'` | `lib/types.ts` eksportuje `UserStatus` | M3-4 |
| `User { id, email, role, status, createdAt, lastLoginAt, invitedBy }` | `lib/types.ts` + zwracany z `getCurrentUser` | M3-4 |
| `getCurrentUser()` | `lib/auth/session.ts` | M3-4 |
| `requireUser()` | `lib/auth/session.ts` | M3-4 |
| `requireAdmin()` | `lib/auth/session.ts` | M3-4 |
| `cfab_session` | `SESSION_COOKIE` w `lib/auth/session.ts` | M3-4 |
| tabele: `users`, `loginCodes`, `sessions` | `lib/db/schema.ts` (Drizzle camelCase) | M2-2 |
| `POST /api/auth/request-code` | `app/api/auth/request-code/route.ts` | M5-1 |
| `POST /api/auth/verify-code` | `app/api/auth/verify-code/route.ts` | M5-2 |
| `POST /api/auth/logout` | `app/api/auth/logout/route.ts` | M5-3 |
| `GET /api/auth/me` | `app/api/auth/me/route.ts` | M5-3 |
| `GET /api/admin/users` | `app/api/admin/users/route.ts` | M8-1 |
| `POST /api/admin/users` | `app/api/admin/users/route.ts` | M8-1 |
| `PATCH /api/admin/users/[id]` | `app/api/admin/users/[id]/route.ts` | M8-1 |
| `DELETE /api/admin/users/[id]` | `app/api/admin/users/[id]/route.ts` | M8-1 |

### Ryzyka i uwagi implementacyjne

1. **`requireAdmin()` w server components rzuca redirect przez `throw`** — to standardowe zachowanie Next.js. Nie otaczaj wywołań `requireAdmin()` blokiem `try/catch` w page.tsx.

2. **`middleware.ts` nie sprawdza DB** — sprawdza wyłącznie obecność cookie. Autorytatywna walidacja (hash tokenu + status usera) odbywa się w `getCurrentUser()` na serwerze. Pozwala to utrzymać middleware na Edge Runtime bez połączenia z Neon.

3. **`transpilePackages` w next.config.ts** — konieczny dla pakietów ESM-only (three.js, R3F, leva). Bez niego Next.js zgłosi błąd `SyntaxError: Cannot use import statement`.

4. **Kasowanie sesji przy blokadzie** — `PATCH {status: 'blocked'}` musi kasować sesje z tabeli `sessions` dla danego `user_id`. Zaimplementowane w `app/api/admin/users/[id]/route.ts`. Sesja zablokowanego usera i tak zostałaby odrzucona przez `getCurrentUser()` (sprawdza `status=allowed`), ale kasowanie daje natychmiastowy efekt również dla middleware-level check — gdy token wygaśnie.

5. **Testy integracyjne tras API z DB** — oznaczone jako opcjonalne (wymagają testowej bazy Neon lub lokalnego Postgres). Nie blokują Etapu A.

6. **`vitest.config.ts`** — po usunięciu `vite.config.ts` vitest potrzebuje własnej konfiguracji (tworzony w M1-3). Glob `lib/**/*.test.ts` musi być dodany dla nowych testów bibliotek.
