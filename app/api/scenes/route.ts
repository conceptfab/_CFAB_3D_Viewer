// app/api/scenes/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { createScene, listAllPresets, listAccessible } from '@/lib/scenes/repo';
import type { SceneConfig } from '@/components/store';

// ─── GET /api/scenes?preset=0|1 ─────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const presetParam = searchParams.get('preset');

  if (presetParam === '1') {
    // Presety są globalne — widoczne dla każdego zalogowanego (bez filtra owner)
    const scenes = await listAllPresets();
    return NextResponse.json(scenes);
  }

  // Etap D: galeria = własne + udostępnione mi (listAccessible)
  const scenes = await listAccessible(user.id);
  return NextResponse.json(scenes);
}

// ─── POST /api/scenes ────────────────────────────────────────────────────────

const CreateSceneSchema = z.object({
  title: z.string().min(1).max(200),
  config: z.record(z.string(), z.unknown()),   // SceneConfig jako opaque object
  modelBlobUrl: z.string().url().nullable(),
  modelFileName: z.string().max(255).nullable(),
  thumbBlobUrl: z.string().url().nullable(),
  isPreset: z.boolean().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
  }

  const parsed = CreateSceneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Błąd walidacji', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  // Admin-only: tworzenie presetów wymaga roli admin
  if (parsed.data.isPreset && user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Tylko administrator może tworzyć presety' },
      { status: 403 }
    );
  }

  const scene = await createScene(user.id, {
    title: parsed.data.title,
    config: parsed.data.config as unknown as SceneConfig,
    modelBlobUrl: parsed.data.modelBlobUrl,
    modelFileName: parsed.data.modelFileName,
    thumbBlobUrl: parsed.data.thumbBlobUrl,
    isPreset: parsed.data.isPreset ?? false,
  });

  return NextResponse.json(scene, { status: 201 });
}
