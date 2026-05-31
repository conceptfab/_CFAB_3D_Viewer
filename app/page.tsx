// app/page.tsx
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { listScenes } from '@/lib/scenes/repo';
import { SceneGrid } from '@/components/scenes/SceneGrid';

/**
 * Strona startowa zalogowanego użytkownika.
 * Server Component: pobiera listę scen użytkownika z DB.
 */
export default async function HomePage() {
  const user = await requireUser();
  const scenes = await listScenes(user.id, { preset: false });

  return (
    <main className="home-page">
      <header className="home-header">
        <h1>Moje sceny</h1>
        <Link href="/editor" className="home-btn-new">
          + Nowa scena
        </Link>
      </header>

      {scenes.length === 0 ? (
        <div className="home-empty">
          <p>Nie masz jeszcze żadnych scen.</p>
          <Link href="/editor" className="home-btn-new">
            Utwórz pierwszą scenę
          </Link>
        </div>
      ) : (
        <SceneGrid initialScenes={scenes} />
      )}
    </main>
  );
}
