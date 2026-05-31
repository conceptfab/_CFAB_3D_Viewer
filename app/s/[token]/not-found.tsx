// app/s/[token]/not-found.tsx
// Shown when a share token is invalid, revoked, or the linked scene is deleted.

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
        color: '#444',
        gap: '1rem',
      }}
    >
      <h1 style={{ fontSize: '2rem', margin: 0 }}>Link wygasł lub nie istnieje</h1>
      <p style={{ margin: 0 }}>Ten link do podglądu sceny jest nieaktywny.</p>
      <a href="/" style={{ color: '#1b1c20', textDecoration: 'underline' }}>
        Przejdź do strony głównej
      </a>
    </div>
  );
}
