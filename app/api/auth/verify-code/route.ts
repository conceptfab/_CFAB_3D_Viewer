import { NextResponse } from 'next/server';
import { normalizeEmail, verifyCodeSchema } from '@/lib/validation';
import { verifyCode } from '@/lib/auth/code';
import { createSession, sessionCookieOptions } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { loginCodes, users } from '@/lib/db/schema';
import { eq, and, isNull, gt, desc } from 'drizzle-orm';

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

  // 2. Normalizacja e-maila PRZED zapytaniem DB
  const email = normalizeEmail(parse.data.email);
  const { code } = parse.data;
  const now = new Date();

  // 3. Znajdź najnowszy niezużyty, nieprzeterminowany kod dla e-maila z < 5 prób
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
    .orderBy(desc(loginCodes.createdAt)) // najnowszy pierwszy
    .limit(1);

  const codeRow = codeRows[0];

  if (!codeRow) {
    return NextResponse.json({ error: 'Kod wygasł lub nie istnieje' }, { status: 400 });
  }

  // 4. Sprawdź limit prób
  if (codeRow.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Kod zablokowany — zbyt wiele prób' }, { status: 400 });
  }

  // 5. Weryfikuj kod (timing-safe)
  const isValid = verifyCode(code, codeRow.codeHash);

  if (!isValid) {
    // Zwiększ licznik prób przy nieudanej próbie
    await db
      .update(loginCodes)
      .set({ attempts: codeRow.attempts + 1 })
      .where(eq(loginCodes.id, codeRow.id));

    return NextResponse.json({ error: 'Nieprawidłowy kod' }, { status: 400 });
  }

  // 6. Kod poprawny — oznacz jako zużyty
  await db
    .update(loginCodes)
    .set({ consumedAt: now })
    .where(eq(loginCodes.id, codeRow.id));

  // 7. Znajdź usera (powinien istnieć po request-code, ale defensywnie)
  const userRows = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = userRows[0];

  if (!user || user.status === 'blocked') {
    return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
  }

  // 8. Zaktualizuj lastLoginAt (carry-over requirement)
  await db
    .update(users)
    .set({ lastLoginAt: now })
    .where(eq(users.id, user.id));

  // 9. Utwórz sesję
  const token = await createSession(user.id);

  // 10. Ustaw cookie i zwróć 200
  const res = NextResponse.json({ ok: true });
  const cookieOpts = sessionCookieOptions(token);
  res.cookies.set(cookieOpts);

  return res;
}
