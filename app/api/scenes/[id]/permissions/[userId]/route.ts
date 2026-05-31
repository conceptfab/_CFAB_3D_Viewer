// app/api/scenes/[id]/permissions/[userId]/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { getScene } from '@/lib/scenes/repo';
import { db } from '@/lib/db';
import { scenePermissions } from '@/lib/scenes/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

type Ctx = { params: Promise<{ id: string; userId: string }> };

// Walidacja UUID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── PATCH — zmień canEdit ────────────────────────────────────────────────────

const PatchSchema = z.object({
  canEdit: z.boolean(),
});

export async function PATCH(request: Request, ctx: Ctx): Promise<NextResponse> {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }

  const { id, userId } = await ctx.params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Nieprawidłowy identyfikator sceny' }, { status: 400 });
  }
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Nieprawidłowy identyfikator użytkownika' }, { status: 400 });
  }

  const scene = await getScene(id);
  if (!scene) {
    return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  }
  if (scene.ownerId !== caller.id) {
    return NextResponse.json(
      { error: 'Tylko właściciel może zmieniać uprawnienia' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updated = await db
    .update(scenePermissions)
    .set({ canEdit: parsed.data.canEdit })
    .where(
      and(
        eq(scenePermissions.sceneId, id),
        eq(scenePermissions.userId, userId),
      ),
    )
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: 'Uprawnienie nie istnieje' }, { status: 404 });
  }

  return NextResponse.json(updated[0]);
}

// ── DELETE — usuń uprawnienie ────────────────────────────────────────────────

export async function DELETE(_req: Request, ctx: Ctx): Promise<NextResponse> {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }

  const { id, userId } = await ctx.params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Nieprawidłowy identyfikator sceny' }, { status: 400 });
  }
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Nieprawidłowy identyfikator użytkownika' }, { status: 400 });
  }

  const scene = await getScene(id);
  if (!scene) {
    return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  }
  if (scene.ownerId !== caller.id) {
    return NextResponse.json(
      { error: 'Tylko właściciel może usuwać uprawnienia' },
      { status: 403 },
    );
  }

  const deleted = await db
    .delete(scenePermissions)
    .where(
      and(
        eq(scenePermissions.sceneId, id),
        eq(scenePermissions.userId, userId),
      ),
    )
    .returning({ id: scenePermissions.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Uprawnienie nie istnieje' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
