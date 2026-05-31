// app/embed/[token]/page.tsx
// Minimal frameable embed page — zero chrome (no header, no nav, no branding bar).
// Only tokens with mode='embed' resolve here; mode='view' tokens → 404.
// No auth required — public, but token-gated.
// Framing: middleware sends CSP frame-ancestors * for /embed/* (cross-origin iframe OK).

import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { shareLinks } from '@/lib/scenes/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getScene } from '@/lib/scenes/repo';
import { ReadOnlyViewerClient } from '@/components/viewer/ReadOnlyViewerClient';

interface Props {
  params: Promise<{ token: string }>;
}

/** Returns an active embed share link, or null if missing/revoked/wrong mode. */
async function findActiveEmbedLink(token: string) {
  const rows = await db
    .select({
      id: shareLinks.id,
      sceneId: shareLinks.sceneId,
    })
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.token, token),
        eq(shareLinks.mode, 'embed'),
        isNull(shareLinks.revokedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export default async function EmbedPage({ params }: Props) {
  const { token } = await params;

  // Token gate — only active embed-mode links are served.
  const link = await findActiveEmbedLink(token);
  if (!link) notFound();

  const scene = await getScene(link.sceneId);
  if (!scene) notFound();

  // No wrapper element — ReadOnlyViewer fills 100vh (EmbedLayout resets body margin).
  return (
    <ReadOnlyViewerClient
      config={scene.config}
      modelUrl={scene.modelBlobUrl}
    />
  );
}
