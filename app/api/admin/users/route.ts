import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/session';
import { normalizeEmail, adminPostSchema } from '@/lib/validation';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';

// GET /api/admin/users — lista wszystkich użytkowników
export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt));

  return NextResponse.json(rows);
}

// POST /api/admin/users — dodaj użytkownika na białą listę
export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) return auth;

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
