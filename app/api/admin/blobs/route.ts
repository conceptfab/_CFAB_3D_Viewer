// app/api/admin/blobs/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/session';
import { findOrphanedBlobs, deleteOrphanedBlobs } from '@/lib/scenes/blobAudit';

// ─── GET /api/admin/blobs ────────────────────────────────────────────────────
// Raport osieroconych plików w Vercel Blob. Admin-only.
export async function GET(): Promise<NextResponse> {
  await requireAdmin();
  const report = await findOrphanedBlobs();
  return NextResponse.json(report);
}

// ─── DELETE /api/admin/blobs ─────────────────────────────────────────────────
// Kasuje wskazane sieroty. blobAudit re-weryfikuje listę z żywej bazy, więc
// referencjonowany lub zbyt świeży URL nie zostanie skasowany. Admin-only.
const DeleteSchema = z.object({
  urls: z.array(z.url()).min(1),
  /** Pomiń 24h okno bezpieczeństwa — tylko admin, po świadomym potwierdzeniu w UI. */
  forceRecent: z.boolean().optional(),
});

export async function DELETE(request: Request): Promise<NextResponse> {
  await requireAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
  }

  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Błąd walidacji', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const result = await deleteOrphanedBlobs(parsed.data.urls, {
    ignoreSafetyWindow: parsed.data.forceRecent === true,
  });
  return NextResponse.json(result);
}
