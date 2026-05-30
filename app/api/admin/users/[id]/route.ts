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
  await requireAdmin();
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

  // Anty-lockout: nie można zdegradować/zablokować ostatniego aktywnego admina
  if (role === 'user' || status === 'blocked') {
    const targetRows = await db
      .select({ role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    const target = targetRows[0];
    if (!target) {
      return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });
    }

    // Sprawdź anty-lockout tylko gdy target jest aktywnym adminem
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
  await requireAdmin();
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
