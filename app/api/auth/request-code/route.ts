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

  // 2. Normalizacja e-maila PRZED checkAccess i każdym zapytaniem DB
  const email = normalizeEmail(parse.data.email);

  // 3. Decyzja dostępu (czysta funkcja z wstrzykiwanym repo)
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const accessRepo = {
    findByEmail: async (e: string) => {
      const result = await db.select({ status: users.status }).from(users).where(eq(users.email, e)).limit(1);
      const row = result[0];
      if (!row) return null;
      return { status: row.status as 'allowed' | 'blocked' };
    },
  };

  const decision = await checkAccess(email, accessRepo, adminEmails);

  // 4. Bootstrap — utwórz admina jeśli nie istnieje
  if (decision === 'bootstrap') {
    await db.insert(users).values({
      email,
      role: 'admin',
      status: 'allowed',
    }).onConflictDoNothing();
  }

  // 5. DENY → generyczna odpowiedź (brak enumeracji)
  if (decision === 'deny') {
    return NextResponse.json(GENERIC_OK);
  }

  // 6. Rate-limit: zlicz kody z ostatniej godziny
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

  // 7. Generuj kod i zapisz hash w DB
  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minut

  await db.insert(loginCodes).values({
    email,
    codeHash,
    expiresAt,
  });

  // 8. Wyślij e-mail (błąd SMTP nie wycieka do klienta)
  try {
    const transport = createSmtpTransport();
    await sendLoginCode(email, code, {
      transport,
      from: process.env.SMTP_FROM ?? 'CFAB 3D Viewer <no-reply@conceptfab.com>',
      appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    });
  } catch (err) {
    // Logujemy błąd SMTP serwerowo, ale klient dostaje generyczny sukces.
    console.error('[request-code] Błąd wysyłki SMTP:', err);
  }

  return NextResponse.json(GENERIC_OK);
}
