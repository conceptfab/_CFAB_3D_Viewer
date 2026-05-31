// app/editor/[id]/page.tsx
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { getScene } from '@/lib/scenes/repo';
import { ExistingSceneEditor } from '@/components/scenes/ExistingSceneEditor';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Server Component: pobiera scenę z DB, weryfikuje właściciela,
 * przekazuje dane do komponentu klienckiego.
 */
export default async function EditorScenePage({ params }: Props) {
  const user = await requireUser();
  // requireUser przekierowuje na /login jeśli niezalogowany.

  const { id } = await params;
  const scene = await getScene(id);

  if (!scene) notFound();
  // Etap C: admin może otworzyć każdą scenę/preset; zwykły user tylko własne.
  if (scene.ownerId !== user.id && user.role !== 'admin') notFound();

  const isAdmin = user.role === 'admin';

  return <ExistingSceneEditor scene={scene} isAdmin={isAdmin} />;
}
