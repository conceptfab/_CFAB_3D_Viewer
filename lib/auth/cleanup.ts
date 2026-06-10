import { db } from '@/lib/db';
import { sessions, loginCodes } from '@/lib/db/schema';
import { lt, or, isNotNull } from 'drizzle-orm';

/**
 * Housekeeping rekordów autoryzacji. Tabele `sessions` i `login_codes` rosną w
 * nieskończoność, bo wygasłe/zużyte rekordy nie są nigdzie kasowane przy normalnym
 * przepływie. Te funkcje wołane są przez cron (app/api/cron/cleanup) — patrz vercel.json.
 */

/** Kasuje wygasłe sesje. Zwraca liczbę usuniętych rekordów. */
export async function deleteExpiredSessions(now: Date = new Date()): Promise<number> {
  const rows = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id });
  return rows.length;
}

/**
 * Kasuje kody logowania, które są wygasłe LUB już zużyte (consumedAt != null).
 * Zużyty kod nie jest do niczego potrzebny — jednorazowy z definicji.
 */
export async function deleteExpiredLoginCodes(now: Date = new Date()): Promise<number> {
  const rows = await db
    .delete(loginCodes)
    .where(or(lt(loginCodes.expiresAt, now), isNotNull(loginCodes.consumedAt)))
    .returning({ id: loginCodes.id });
  return rows.length;
}

/** Czyści wygasłe sesje i kody jednym wywołaniem (równolegle). */
export async function cleanupExpiredAuthRecords(
  now: Date = new Date(),
): Promise<{ sessionsDeleted: number; loginCodesDeleted: number }> {
  const [sessionsDeleted, loginCodesDeleted] = await Promise.all([
    deleteExpiredSessions(now),
    deleteExpiredLoginCodes(now),
  ]);
  return { sessionsDeleted, loginCodesDeleted };
}
