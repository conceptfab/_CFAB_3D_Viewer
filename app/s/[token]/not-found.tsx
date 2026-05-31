// app/s/[token]/not-found.tsx
// Shown when a share token is invalid, revoked, or the linked scene is deleted.

import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'Inter, system-ui, sans-serif',
        background: 'var(--bg)',
        color: 'var(--muted)',
        gap: '1rem',
      }}
    >
      <h1 style={{ fontSize: '2rem', margin: 0, color: 'var(--ink)' }}>Link wygasł lub nie istnieje</h1>
      <p style={{ margin: 0 }}>Ten link do podglądu sceny jest nieaktywny.</p>
      <Link href="/" style={{ color: 'var(--accent-2)', textDecoration: 'underline' }}>
        Przejdź do strony głównej
      </Link>
    </div>
  );
}
