// app/api/studio/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { listProjects, createProject } from '@/lib/studio/repo';
import type { SceneConfig } from '@/components/store';

export async function GET(): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }
  const projects = await listProjects(user.id);
  return NextResponse.json(projects);
}

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  sourceBlobUrl: z.url(),
  sourceFileName: z.string().min(1).max(255),
  sourceKind: z.enum(['glb', 'gltf-zip']),
  config: z.record(z.string(), z.unknown()),
  thumbBlobUrl: z.url().nullable(),
});

export async function POST(request: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Błąd walidacji', details: parsed.error.flatten() }, { status: 422 });
  }

  const project = await createProject(user.id, {
    title: parsed.data.title,
    sourceBlobUrl: parsed.data.sourceBlobUrl,
    sourceFileName: parsed.data.sourceFileName,
    sourceKind: parsed.data.sourceKind,
    config: parsed.data.config as unknown as SceneConfig,
    thumbBlobUrl: parsed.data.thumbBlobUrl,
  });
  return NextResponse.json(project, { status: 201 });
}
