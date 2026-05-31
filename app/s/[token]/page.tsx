// app/s/[token]/page.tsx
// Public share page — view-only, no auth required.
// Token resolves to an active share_link (revoked → 404); scene is loaded from DB.

import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { shareLinks } from '@/lib/scenes/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getScene } from '@/lib/scenes/repo';
import { ReadOnlyViewerClient } from '@/components/viewer/ReadOnlyViewerClient';

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const link = await findActiveLink(token);
  if (!link) return { title: 'Scena niedostępna' };
  const scene = await getScene(link.sceneId);
  return {
    title: scene ? `${scene.title} — CFAB 3D Viewer` : 'Scena',
  };
}

/** Returns the active share link row for a given token, or null if revoked/missing. */
async function findActiveLink(token: string) {
  const rows = await db
    .select({
      id: shareLinks.id,
      sceneId: shareLinks.sceneId,
      mode: shareLinks.mode,
    })
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.token, token),
        isNull(shareLinks.revokedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;

  // Token gate — revoked or unknown token → 404.
  const link = await findActiveLink(token);
  if (!link) notFound();

  // Load the scene from DB.
  const scene = await getScene(link.sceneId);
  if (!scene) notFound();

  return (
    // Zero padding/margin — ReadOnlyViewer fills 100vh.
    <main style={{ margin: 0, padding: 0 }}>
      <ReadOnlyViewerClient
        config={scene.config}
        modelUrl={scene.modelBlobUrl}
      />
    </main>
  );
}
