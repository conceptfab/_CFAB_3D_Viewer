// app/gallery/page.tsx

import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { listAccessible } from '@/lib/scenes/repo';
import { SceneCard } from './_components/SceneCard';
import { TopNav } from '@/components/TopNav';

export const metadata = {
  title: 'Galeria scen — CFAB 3D Viewer',
};

export default async function GalleryPage() {
  // requireUser przekierowuje na /login jeśli niezalogowany
  const user = await requireUser();
  const isAdmin = user.role === 'admin';

  const scenes = await listAccessible(user.id);

  return (
    <>
      <TopNav isAdmin={isAdmin} email={user.email} active="gallery" />
      <main className="gallery-page">
      <header className="gallery-header">
        <h1>Galeria scen</h1>
        <Link href="/editor" className="btn-primary">
          + Nowa scena
        </Link>
      </header>

      {scenes.length === 0 ? (
        <div className="gallery-empty">
          <p>Nie masz jeszcze żadnych scen.</p>
          <Link href="/editor" className="btn-primary">
            Utwórz pierwszą scenę
          </Link>
        </div>
      ) : (
        <div className="gallery-grid">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              isOwner={scene.ownerId === user.id}
            />
          ))}
        </div>
      )}
    </main>
    </>
  );
}
