// app/api/scenes/[id]/share-links/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { getScene } from '@/lib/scenes/repo';
import { db } from '@/lib/db';
import { shareLinks } from '@/lib/scenes/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import type { ShareLink } from '@/lib/scenes/types';

type Ctx = { params: Promise<{ id: string }> };

// Walidacja UUID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

// ── GET — lista linków do sceny (właściciel widzi wszystkie, w tym revoked) ──

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
      { error: 'Tylko właściciel może zarządzać linkami' },
      { status: 403 },
    );
  }

  const rows = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.sceneId, id));

  const result: ShareLink[] = rows.map((r) => ({
    id: r.id,
    sceneId: r.sceneId,
    token: r.token,
    mode: r.mode as 'view' | 'embed',
    createdAt: r.createdAt,
    revokedAt: r.revokedAt,
  }));

  return NextResponse.json(result);
}

// ── POST — utwórz nowy token (tylko właściciel) ──────────────────────────────

const PostSchema = z.object({
  mode: z.enum(['view', 'embed']),
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
      { error: 'Tylko właściciel może tworzyć linki' },
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

  const token = generateToken();

  const [link] = await db
    .insert(shareLinks)
    .values({
      sceneId: id,
      token,
      mode: parsed.data.mode,
    })
    .returning();

  const result: ShareLink = {
    id: link.id,
    sceneId: link.sceneId,
    token: link.token,
    mode: link.mode as 'view' | 'embed',
    createdAt: link.createdAt,
    revokedAt: link.revokedAt,
  };

  return NextResponse.json(result, { status: 201 });
}
