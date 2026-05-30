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
