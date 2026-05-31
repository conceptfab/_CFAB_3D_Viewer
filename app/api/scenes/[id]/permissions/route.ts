// app/api/scenes/[id]/permissions/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { getScene } from '@/lib/scenes/repo';
import { db } from '@/lib/db';
import { scenePermissions } from '@/lib/scenes/schema';
import { users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { normalizeEmail } from '@/lib/validation';
import type { PermissionWithUser } from '@/lib/scenes/types';

type Ctx = { params: Promise<{ id: string }> };

// Walidacja UUID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── GET — lista uprawnień do sceny (tylko właściciel) ────────────────────────

export async function GET(_req: Request, ctx: Ctx): Promise<NextResponse> {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }

  const { id } = await ctx.params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Nieprawidłowy identyfikator' }, { status: 400 });
  }

  const scene = await getScene(id);
  if (!scene) {
    return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  }
  if (scene.ownerId !== caller.id) {
    return NextResponse.json(
      { error: 'Tylko właściciel może zarządzać uprawnieniami' },
      { status: 403 },
    );
  }

  const rows = await db
    .select({
      id: scenePermissions.id,
      sceneId: scenePermissions.sceneId,
      userId: scenePermissions.userId,
      email: users.email,
      canEdit: scenePermissions.canEdit,
      createdAt: scenePermissions.createdAt,
    })
    .from(scenePermissions)
    .innerJoin(users, eq(users.id, scenePermissions.userId))
    .where(eq(scenePermissions.sceneId, id));

  const result: PermissionWithUser[] = rows.map((r) => ({
    id: r.id,
    sceneId: r.sceneId,
    userId: r.userId,
    email: r.email,
    canEdit: r.canEdit,
    createdAt: r.createdAt,
  }));

  return NextResponse.json(result);
}

// ── POST — dodaj uprawnienie po e-mailu (tylko właściciel) ──────────────────

const PostSchema = z.object({
  email: z.email('Nieprawidłowy e-mail'),
  canEdit: z.boolean(),
});

export async function POST(request: Request, ctx: Ctx): Promise<NextResponse> {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }

  const { id } = await ctx.params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Nieprawidłowy identyfikator' }, { status: 400 });
  }

  const scene = await getScene(id);
  if (!scene) {
    return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  }
  if (scene.ownerId !== caller.id) {
    return NextResponse.json(
      { error: 'Tylko właściciel może dodawać uprawnienia' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);

  // Szukaj usera po e-mailu — brak użytkownika = 422 (decyzja R4: no auto-invite)
  const targetUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (targetUsers.length === 0) {
    return NextResponse.json(
      { error: 'Użytkownik o tym adresie nie istnieje' },
      { status: 422 },
    );
  }

  const targetUser = targetUsers[0];

  // Właściciel nie może dodać samego siebie
  if (targetUser.id === caller.id) {
    return NextResponse.json(
      { error: 'Nie możesz dodać siebie — jesteś właścicielem sceny' },
      { status: 422 },
    );
  }

  // Upsert (unique constraint na scene_id + user_id — aktualizuje canEdit przy duplikacie)
  const [perm] = await db
    .insert(scenePermissions)
    .values({
      sceneId: id,
      userId: targetUser.id,
      canEdit: parsed.data.canEdit,
    })
    .onConflictDoUpdate({
      target: [scenePermissions.sceneId, scenePermissions.userId],
      set: { canEdit: parsed.data.canEdit },
    })
    .returning();

  const result: PermissionWithUser = {
    id: perm.id,
    sceneId: perm.sceneId,
    userId: perm.userId,
    email: targetUser.email,
    canEdit: perm.canEdit,
    createdAt: perm.createdAt,
  };

  return NextResponse.json(result, { status: 201 });
}
