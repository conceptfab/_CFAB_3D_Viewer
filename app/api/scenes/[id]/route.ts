// app/api/scenes/[id]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { getScene, updateScene, deleteScene } from '@/lib/scenes/repo';

type Ctx = { params: Promise<{ id: string }> };

// Walidacja kształtu UUID — chroni przed błędem 500 z Postgresa przy nie-UUID id.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── GET /api/scenes/[id] ────────────────────────────────────────────────────

export async function GET(_req: Request, ctx: Ctx): Promise<NextResponse> {
  const user = await requireUser();
  const { id } = await ctx.params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Nieprawidłowy identyfikator' }, { status: 400 });
  }

  const scene = await getScene(id);
  if (!scene) {
    return NextResponse.json({ error: 'Nie znaleziono sceny' }, { status: 404 });
  }

  // Etap B: tylko właściciel. Etap D doda uprawnienia per-scena.
  if (scene.ownerId !== user.id) {
    return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
  }

  return NextResponse.json(scene);
}

// ─── PATCH /api/scenes/[id] ──────────────────────────────────────────────────

const PatchSceneSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  thumbBlobUrl: z.string().url().nullable().optional(),
});

export async function PATCH(request: Request, ctx: Ctx): Promise<NextResponse> {
  const user = await requireUser();
  const { id } = await ctx.params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Nieprawidłowy identyfikator' }, { status: 400 });
  }

  const scene = await getScene(id);
  if (!scene) {
    return NextResponse.json({ error: 'Nie znaleziono sceny' }, { status: 404 });
  }
  if (scene.ownerId !== user.id) {
    return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
  }

  const parsed = PatchSceneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Błąd walidacji', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const updated = await updateScene(id, {
    ...(parsed.data.title !== undefined && { title: parsed.data.title }),
    ...(parsed.data.config !== undefined && { config: parsed.data.config as any }),
    ...(parsed.data.thumbBlobUrl !== undefined && { thumbBlobUrl: parsed.data.thumbBlobUrl }),
  });

  if (!updated) {
    // Wyścig: scena usunięta między getScene a updateScene.
    return NextResponse.json({ error: 'Nie znaleziono sceny' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

// ─── DELETE /api/scenes/[id] ─────────────────────────────────────────────────

export async function DELETE(_req: Request, ctx: Ctx): Promise<NextResponse> {
  const user = await requireUser();
  const { id } = await ctx.params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Nieprawidłowy identyfikator' }, { status: 400 });
  }

  const scene = await getScene(id);
  if (!scene) {
    return NextResponse.json({ error: 'Nie znaleziono sceny' }, { status: 404 });
  }

  // Presety może usuwać tylko admin
  if (scene.isPreset) {
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Tylko administrator może usuwać presety' },
        { status: 403 }
      );
    }
  } else if (scene.ownerId !== user.id) {
    // Zwykłe sceny: tylko właściciel
    return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
  }

  await deleteScene(id);
  return new NextResponse(null, { status: 204 });
}
