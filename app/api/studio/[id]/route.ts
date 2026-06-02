// app/api/studio/[id]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { getProject, updateProject, deleteProject } from '@/lib/studio/repo';
import type { StudioProjectRecord } from '@/lib/studio/repo';

type Ctx = { params: Promise<{ id: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AuthErr = { ok: false; res: NextResponse };
type AuthOk = { ok: true; user: { id: string; role: string; email: string }; project: StudioProjectRecord };
type AuthResult = AuthErr | AuthOk;

async function authOwner(id: string): Promise<AuthResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, res: NextResponse.json({ error: 'Nieprawidłowy identyfikator' }, { status: 400 }) };
  }
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, res: NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 }) };
  }
  const project = await getProject(id);
  if (!project) {
    return { ok: false, res: NextResponse.json({ error: 'Nie znaleziono projektu' }, { status: 404 }) };
  }
  if (project.ownerId !== user.id) {
    return { ok: false, res: NextResponse.json({ error: 'Brak dostępu' }, { status: 403 }) };
  }
  return { ok: true, user, project };
}

export async function GET(_req: Request, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const r = await authOwner(id);
  if (!r.ok) return r.res;
  return NextResponse.json(r.project);
}

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  thumbBlobUrl: z.url().nullable().optional(),
  sourceBlobUrl: z.url().optional(),
  sourceFileName: z.string().min(1).max(255).optional(),
  sourceKind: z.enum(['glb', 'gltf-zip']).optional(),
});

export async function PATCH(request: Request, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const r = await authOwner(id);
  if (!r.ok) return r.res;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Błąd walidacji', details: parsed.error.flatten() }, { status: 422 });
  }

  const updated = await updateProject(id, {
    ...(parsed.data.title !== undefined && { title: parsed.data.title }),
    ...(parsed.data.config !== undefined && { config: parsed.data.config as any }),
    ...(parsed.data.thumbBlobUrl !== undefined && { thumbBlobUrl: parsed.data.thumbBlobUrl }),
    ...(parsed.data.sourceBlobUrl !== undefined && { sourceBlobUrl: parsed.data.sourceBlobUrl }),
    ...(parsed.data.sourceFileName !== undefined && { sourceFileName: parsed.data.sourceFileName }),
    ...(parsed.data.sourceKind !== undefined && { sourceKind: parsed.data.sourceKind }),
  });
  if (!updated) return NextResponse.json({ error: 'Nie znaleziono projektu' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const r = await authOwner(id);
  if (!r.ok) return r.res;
  await deleteProject(id);
  return new NextResponse(null, { status: 204 });
}
