// app/editor/page.tsx
// Server Component: detects admin role, renders EditorShell with isAdmin prop.
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { EditorShell } from '@/components/EditorShell';

export const metadata: Metadata = {
  title: 'Nowa scena — CFAB 3D Viewer',
};

export default async function EditorPage() {
  // getCurrentUser returns null for unauthenticated — EditorShell still renders
  // (the middleware / requireUser in API routes handles auth enforcement).
  // For the new-scene editor, we just want to know if admin to show preset button.
  const user = await getCurrentUser();
  const isAdmin = user !== null && user.role === 'admin';

  return (
    <EditorShell
      isAdmin={isAdmin}
      modelBlobUrl={null}
      modelFileName={null}
      thumbBlobUrl={null}
      sceneTitle="Nowy preset"
    />
  );
}
