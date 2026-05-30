import { requireUser } from '@/lib/auth/session';

export default async function HomePage() {
  const user = await requireUser();

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>CFAB 3D Viewer</h1>
        <p style={styles.greeting}>Zalogowano jako <strong>{user.email}</strong></p>

        <nav style={styles.nav}>
          <a href="/editor" style={styles.navLink}>
            Edytor 3D
          </a>
          {user.role === 'admin' && (
            <a href="/admin" style={styles.navLink}>
              Panel admina
            </a>
          )}
        </nav>

        <form action="/api/auth/logout" method="POST" style={{ marginTop: 32 }}>
          <button type="submit" style={styles.logoutBtn}>
            Wyloguj się
          </button>
        </form>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: '#f5f5f4',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.08)',
    padding: '40px 36px',
    width: '100%',
    maxWidth: 400,
  },
  title: { fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: '#1c1917' },
  greeting: { fontSize: 14, color: '#78716c', margin: '0 0 24px' },
  nav: { display: 'flex', flexDirection: 'column', gap: 8 },
  navLink: {
    display: 'block',
    padding: '12px 16px',
    background: '#f5f5f4',
    borderRadius: 8,
    color: '#1c1917',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 15,
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 8,
    padding: '8px 16px',
    color: '#78716c',
    cursor: 'pointer',
    fontSize: 13,
  },
};
