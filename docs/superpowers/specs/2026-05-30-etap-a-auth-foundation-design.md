# Etap A — Fundament: backend + auth + routing — Design

**Date:** 2026-05-30
**Status:** Approved (scope-level)
**Scope:** Etap A z dekompozycji A→B→C→D (patrz „Kontekst"). A = backend + system użytkowników + logowanie kodem e-mail + panel admina + migracja na Next.js. Bez zapisu scen.

## Kontekst (dekompozycja całości)

Pełne zlecenie (system użytkowników, logowanie kodem, zapis scen z miniaturą, presety, galeria, linki udostępniające/embed) to budowa platformy, nie pojedyncza funkcja. Rozbite na 4 samodzielnie działające etapy, budowane po kolei:

- **A — Fundament (TEN dokument):** backend + routing + użytkownicy (biała/czarna lista, role), logowanie kodem e-mail (15 min / cookie 7 dni), panel admina.
- **B — Zapis scen:** zapis kompletnej sceny (config + upload modelu) + auto-miniatura → strona startowa z miniaturami.
- **C — Presety:** zapis sceny jako preset; tworzenie nowej sceny z presetu.
- **D — Galeria + udostępnianie:** galeria z usuwaniem, uprawnienia widoczności/edycji per-scena, link tylko-podgląd + embed w iframe.

Każdy etap ma własny cykl: brainstorm → spec → plan → implementacja.

## Cel (Etap A)

Przekształcić jednoekranowy Vite SPA w aplikację **Next.js (App Router)** na Vercel, z logowaniem „na zaproszenie". Istniejący edytor 3D działa **identycznie jak dziś**, tylko pod adresem `/editor` i za bramką logowania.

**Zasada naczelna:** migracja jest **zachowawcza** — żadnych zmian funkcji edytora w tym etapie. Najpierw przenosimy szkielet 1:1, dopiero potem dokładamy auth i panel admina.

## Punkt wyjścia (istniejący kod)

- Czysto kliencki SPA: React 18 + `@react-three/fiber`/`drei`/`postprocessing` + three.js + `leva` + `zustand`, Vite/TS, vitest.
- „Scena" = `SceneConfig` w `src/store.ts` — w pełni serializowalny JSON. Zostaje nietknięty w Etapie A.
- Model 3D ulotny (`URL.createObjectURL`, `src/viewer/ModelDropzone.tsx`) — trwały zapis modelu to Etap B.
- Jeden ekran (`src/App.tsx`), brak routingu, brak backendu/bazy/auth.
- Projekt PL, conventional commits, specs/plany w `docs/superpowers/`. Integracja Vercel podłączona; brak git remote.

## Decyzje (z brainstormingu)

1. **Kolejność:** przyrostowo A→B→C→D; teraz tylko A.
2. **Platforma:** Vercel — funkcje serverless + Vercel Postgres (Neon) + (w B) Vercel Blob.
3. **Framework:** migracja Vite SPA → **Next.js App Router** (SSR przyda się stronom udostępniania w D; middleware do bramkowania logowania).
4. **Wysyłka maili:** **własny SMTP** przez `nodemailer`.
5. **Biała lista:** **tylko pojedyncze adresy e-mail** (bez reguł domenowych). **Czarna lista nadpisuje białą.** Jedna tabela `users` ze `status: allowed | blocked`.
6. **Role:** **`admin` + `user`** (uprawnienia per-scena dopiero w D).
7. **Warstwa DB:** **Drizzle ORM** + `drizzle-kit` (migracje), Vercel Postgres (Neon).
8. **Sesja:** trzymana w DB (token opaque w cookie), sztywne 7 dni; blokada usera działa natychmiast.

## Model danych (Postgres / Drizzle) — 3 tabele

```
users
  id            uuid pk (default gen_random_uuid())
  email         text unique not null        -- znormalizowany: lowercase + trim
  role          text not null default 'user'    -- 'admin' | 'user'
  status        text not null default 'allowed' -- 'allowed' | 'blocked' (blocked = czarna lista)
  created_at    timestamptz not null default now()
  last_login_at timestamptz
  invited_by    uuid references users(id)       -- null dla bootstrapu/seedu

login_codes
  id            uuid pk
  email         text not null               -- znormalizowany
  code_hash     text not null               -- SHA-256(hex) z 6-cyfrowego kodu
  expires_at    timestamptz not null        -- created_at + 15 min
  consumed_at   timestamptz                 -- null = niezużyty
  attempts      int not null default 0      -- liczba nieudanych prób weryfikacji
  created_at    timestamptz not null default now()
  index (email, created_at)                 -- do rate-limitu i wyszukania najnowszego

sessions
  id            uuid pk
  user_id       uuid not null references users(id) on delete cascade
  token_hash    text not null unique        -- SHA-256(hex) z losowego 32-bajtowego tokenu
  expires_at    timestamptz not null        -- created_at + 7 dni (sztywne)
  created_at    timestamptz not null default now()
  index (user_id)                           -- do kasowania sesji przy blokadzie/wylogowaniu wszędzie
```

Enumy `role`/`status` jako `text` z checkiem w schemacie Drizzle (prościej niż typy pg enum przy migracjach).

## Decyzja dostępu (`lib/auth/access.ts`)

Czysta funkcja na podstawie znormalizowanego e-maila i stanu DB + `ADMIN_EMAILS`:

1. Normalizuj e-mail (lowercase + trim).
2. Znajdź usera po e-mailu.
3. Jeśli istnieje i `status = blocked` → **DENY** (czarna lista nadpisuje wszystko).
4. Jeśli istnieje i `status = allowed` → **ALLOW** (istniejący).
5. Jeśli nie istnieje:
   - e-mail jest w `ADMIN_EMAILS` → **bootstrap**: utwórz `role='admin', status='allowed'` → **ALLOW**.
   - w przeciwnym razie → **DENY** (niezaproszony).

Wynik DENY/ALLOW steruje wyłącznie tym, czy faktycznie wysyłamy kod. Do klienta zawsze idzie generyczna odpowiedź (patrz niżej).

## Logowanie kodem — przepływ

1. `/login`: pole e-mail → `POST /api/auth/request-code`.
2. Serwer: normalizacja → decyzja dostępu → **zawsze** zwraca generyczny sukces („Jeśli adres jest na liście, wysłaliśmy kod"). Jeśli ALLOW i nie przekroczono limitu: generuje 6-cyfrowy kod (`crypto.randomInt`, zero-padding), zapisuje `code_hash` + `expires_at = now+15min`, wysyła SMTP-em.
3. `/login` krok 2: pole kodu → `POST /api/auth/verify-code` (e-mail + kod).
4. Serwer: szuka najnowszego niezużytego, nieprzeterminowanego kodu dla e-maila; sprawdza `attempts < 5`; porównuje hash. Niezgodność → `attempts++`, błąd. Zgodność → `consumed_at = now`, `users.last_login_at = now`, utwórz sesję, ustaw cookie, `200` → klient robi redirect `/`.

**Parametry bezpieczeństwa logowania:**
- Kod: 6 cyfr, ważny **15 min**, jednorazowy, max **5 prób** weryfikacji na kod.
- Rate-limit żądań kodu: max **5 / 60 min / e-mail** (liczone z `login_codes` — bez dodatkowej infry). Po przekroczeniu: pomijamy wysyłkę, klient nadal dostaje generyczny komunikat.
- Kod nigdy w plaintext w DB ani logach — tylko hash.
- Brak enumeracji adresów: identyczna odpowiedź dla dozwolonych i niedozwolonych.

## Sesja, cookie, egzekwowanie blokady

- Po weryfikacji: losowy 32-bajtowy token (`crypto.randomBytes`, base64url) → w cookie trafia **token jawny**, w DB jego **hash**.
- Cookie `cfab_session`: `httpOnly`, `Secure`, `SameSite=Lax`, `path=/`, `maxAge = 7 dni` (sztywne — „ciastko trzyma login 7 dni"; bez przedłużania ślizgowego).
- `middleware.ts` na trasach chronionych: brak cookie → redirect `/login` (tanio, bez DB na edge).
- Autorytatywna walidacja po stronie serwera: `getCurrentUser()` (`lib/auth/session.ts`) — hash tokenu → szukaj nieprzeterminowanej sesji + join `users` → **sprawdź `status = allowed` przy każdym żądaniu**. Niespełnione → traktuj jak niezalogowanego. Dzięki temu blokada działa natychmiast.
- `requireAdmin()` — jak wyżej + `role = 'admin'`.
- **Wylogowanie** (`POST /api/auth/logout`): usuń rekord sesji + wyczyść cookie.
- **Blokada usera**: kasuje wszystkie jego rekordy w `sessions`.

CSRF: `SameSite=Lax` + wywołania zmieniające stan tylko z tego samego originu (fetch z aplikacji). Wystarczające dla zakresu A.

## Role + panel admina (`/admin`, tylko admin)

Widok listy: e-mail, rola, status, ostatnie logowanie. Akcje:
- **Dodaj na białą listę** (`POST /api/admin/users`): tworzy `user` `status=allowed, role=user` (jeśli e-mail już istnieje — błąd 409).
- **Blokuj / odblokuj** (`PATCH /api/admin/users/[id]` `{status}`): zmienia status; blokada kasuje sesje usera.
- **Nadaj / odbierz admina** (`PATCH .../[id]` `{role}`).
- **Usuń użytkownika** (`DELETE .../[id]`): kaskadowo kasuje jego sesje.

**Zabezpieczenie anty-lockout:** nie można zablokować, zdegradować ani usunąć **ostatniego** usera o `role=admin, status=allowed` (sprawdzenie liczby adminów przed operacją → 400). Pierwszy admin powstaje przez `ADMIN_EMAILS`.

## Routing + struktura plików (Next App Router)

```
app/
  layout.tsx                 # root layout (port index.html + import styles.css)
  page.tsx                   # '/' minimalny home zalogowanego (w B → strona startowa)
  login/page.tsx             # dwukrokowy formularz: e-mail → kod; zalogowany → redirect '/'
  editor/page.tsx            # PORT istniejącego edytora (client, <Canvas> dynamiczny ssr:false)
  admin/page.tsx             # panel admina (server-side requireAdmin)
  api/
    auth/request-code/route.ts
    auth/verify-code/route.ts
    auth/logout/route.ts
    auth/me/route.ts                 # bieżący user (dla UI)
    admin/users/route.ts             # GET lista, POST zaproszenie
    admin/users/[id]/route.ts        # PATCH (rola/status), DELETE
middleware.ts                # bramka: chroni '/', '/editor', '/admin', '/api/admin/*'
lib/
  db/
    schema.ts                # tabele Drizzle: users, loginCodes, sessions
    index.ts                 # klient Drizzle (Neon serverless)
    migrations/              # output drizzle-kit
  auth/
    session.ts               # createSession / getCurrentUser / requireAdmin / destroySession / cookie helpers
    code.ts                  # generateCode / hashCode
    access.ts                # decyzja dostępu (allowed/blocked/bootstrap)
    email.ts                 # transport nodemailer + sendLoginCode
  validation.ts              # normalizeEmail + schematy zod (request-code, verify-code, admin)
components/                  # PORT z src/: viewer/*, ui/*, store.ts, scene/*, models/*, styles.css
```

Obecne `src/*` przenosimy do `components/` (jako komponenty klienckie) + `app/editor/page.tsx`. `src/store.test.ts` → `components/store.test.ts` (zostaje zielony). `public/models/*` bez zmian.

**Zmiany konfiguracji:** usunąć `vite.config.ts`, `index.html`; dodać `next.config.ts`, dostosować `tsconfig.json` pod Next; `package.json` scripts → `next dev/build/start`, vitest zostaje.

## Zmienne środowiskowe (`.env.example`)

```
DATABASE_URL=            # Vercel Postgres / Neon
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=               # np. "CFAB 3D Viewer <no-reply@conceptfab.com>"
ADMIN_EMAILS=            # CSV — bootstrap pierwszych adminów (np. michal@kleniewski.com)
APP_URL=                 # do treści maila / przyszłych linków
```

## Bezpieczeństwo (podsumowanie)

- Hasła nie istnieją — tylko kody jednorazowe (15 min) i sesje (7 dni).
- Kody i tokeny sesji tylko jako hashe w DB.
- Generyczne odpowiedzi logowania (brak enumeracji).
- Rate-limit żądań kodu i limit prób weryfikacji.
- Cookie `httpOnly/Secure/SameSite=Lax`; status usera sprawdzany przy każdym żądaniu (natychmiastowa blokada).
- Anty-lockout ostatniego admina.

## Testy (vitest, TDD)

Jednostkowe dla logiki czystej (bez DB):
- `code.ts`: `generateCode` (6 cyfr, zakres), `hashCode` (stabilny), poprawne/niepoprawne dopasowanie.
- `validation.ts`: `normalizeEmail` (lowercase/trim), schematy zod odrzucają śmieci.
- `access.ts`: decyzja dla istniejącego allowed / blocked (blacklist wygrywa) / nieistniejącego w ADMIN_EMAILS (bootstrap) / nieistniejącego spoza listy (deny). Wstrzykiwany „repo" usera (bez realnej DB).
- reguła „ostatni admin" (czysta funkcja na liczniku adminów).
- `session.ts`: hash tokenu stabilny; logika ważności (expired vs aktywny) na wstrzykiwanym zegarze/rekordzie.

Po migracji: `components/store.test.ts` nadal zielony (dowód zachowawczości).

Testy integracyjne tras API (z testową DB) — opcjonalnie, lżejsze pokrycie; nie blokują Etapu A.

## Walidacja (ręczna)

1. `npm run dev` (Next) — edytor pod `/editor` wygląda i działa jak przed migracją (model drag&drop, leva, kamery).
2. Niezalogowany na `/`, `/editor`, `/admin` → redirect `/login`.
3. E-mail z białej listy → przychodzi kod → po wpisaniu wpadasz na `/`; reload w ciągu 7 dni nie wylogowuje.
4. Błędny/przeterminowany kod → odrzucony; po 5 próbach kod martwy.
5. E-mail spoza listy → ten sam komunikat, brak maila.
6. Admin (`ADMIN_EMAILS`) widzi `/admin`; zwykły user dostaje 403/redirect.
7. Admin dodaje e-mail → ten e-mail może się zalogować. Admin blokuje go → natychmiast wylatuje (kolejne żądanie → `/login`).
8. Próba zablokowania/usunięcia ostatniego admina → odrzucona.
9. Wylogowanie czyści cookie i wymusza ponowne logowanie.

## Poza zakresem Etapu A (jawnie)

- Zapis scen, upload modelu, miniatury, strona startowa z kafelkami (Etap B).
- Presety i tworzenie scen z presetu (Etap C).
- Galeria, usuwanie scen, uprawnienia widoczności/edycji per-scena, linki tylko-podgląd, embed iframe (Etap D).
- Hasła, otwarta rejestracja, „poproś o dostęp", OAuth, MFA, reguły domenowe na białej liście.
- Vercel Blob (podłączymy w B).
