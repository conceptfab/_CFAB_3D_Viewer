// app/page.tsx
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { listScenes, listAllPresets } from '@/lib/scenes/repo';
import { SceneGrid } from '@/components/scenes/SceneGrid';
import { PresetCard } from '@/components/PresetCard';
import { TopNav } from '@/components/TopNav';

/**
 * Strona startowa zalogowanego użytkownika.
 * Server Component: pobiera listę scen + presetów z DB.
 */
export default async function HomePage() {
  const user = await requireUser();
  const isAdmin = user.role === 'admin';

  // Własne sceny (is_preset=false)
  const scenes = await listScenes(user.id, { preset: false });

  // Globalne presety (is_preset=true) — widoczne dla wszystkich zalogowanych
  const presets = await listAllPresets();

  return (
    <>
      <TopNav isAdmin={isAdmin} email={user.email} active="home" />
      <main className="home-page">
      <header className="home-header">
        <h1>Moje sceny</h1>
        <Link href="/editor" className="home-btn-new">
          + Nowa scena
        </Link>
      </header>

      {/* Sekcja presetów — widoczna gdy istnieją jakiekolwiek presety */}
      {presets.length > 0 && (
        <section aria-labelledby="presety-heading" style={{ marginBottom: 40 }}>
          <h2
            id="presety-heading"
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: '#4a6fa5',
              margin: '0 0 16px',
            }}
          >
            Presety scen
          </h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {presets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        </section>
      )}

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
    </>
  );
}
