import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { sessions, users } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import type { User, Role, UserStatus } from '@/lib/types';
import { SESSION_COOKIE } from './cookie-name';

// Re-eksport nazwy cookie. Źródło: cookie-name.ts (bezzależnościowe — importowane
// też przez edge middleware, które nie może ciągnąć crypto/@/lib/db).
export { SESSION_COOKIE };
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
  // redirect() above throws, so user is non-null here
  return user!;
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
