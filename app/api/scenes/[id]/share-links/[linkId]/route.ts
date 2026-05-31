// app/api/scenes/[id]/share-links/[linkId]/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { getScene } from '@/lib/scenes/repo';
import { db } from '@/lib/db';
import { shareLinks } from '@/lib/scenes/schema';
import { eq, and, sql } from 'drizzle-orm';

type Ctx = { params: Promise<{ id: string; linkId: string }> };

// Walidacja UUID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── DELETE — revoke linku (ustawia revoked_at = now(), nie kasuje wiersza) ──

export async function DELETE(_req: Request, ctx: Ctx): Promise<NextResponse> {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }

  const { id, linkId } = await ctx.params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Nieprawidłowy identyfikator sceny' }, { status: 400 });
  }
  if (!UUID_RE.test(linkId)) {
    return NextResponse.json({ error: 'Nieprawidłowy identyfikator linku' }, { status: 400 });
  }

  const scene = await getScene(id);
  if (!scene) {
    return NextResponse.json({ error: 'Scena nie istnieje' }, { status: 404 });
  }
  if (scene.ownerId !== caller.id) {
    return NextResponse.json(
      { error: 'Tylko właściciel może revokować linki' },
      { status: 403 },
    );
  }

  const revoked = await db
    .update(shareLinks)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(shareLinks.id, linkId),
        eq(shareLinks.sceneId, id),
      ),
    )
    .returning({ id: shareLinks.id });

  if (revoked.length === 0) {
    return NextResponse.json({ error: 'Link nie istnieje' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
