// components/TopNav.tsx
// Górny pasek nawigacji dla zalogowanych stron (start, galeria, admin).
// Edytor ma osobny link powrotny (pełnoekranowy layout).
import Link from 'next/link';
import { LogoutButton } from './LogoutButton';

type NavKey = 'home' | 'gallery' | 'editor' | 'admin';

export function TopNav({
  isAdmin,
  email,
  active,
}: {
  isAdmin: boolean;
  email: string;
  active?: NavKey;
}) {
  const item = (href: string, label: string, key: NavKey) => (
    <Link
      href={href}
      style={{
        padding: '6px 12px',
        borderRadius: 6,
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: active === key ? 'var(--accent-ink)' : 'var(--ink)',
        background: active === key ? 'var(--accent)' : 'transparent',
      }}
    >
      {label}
    </Link>
  );

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        flexWrap: 'wrap',
      }}
    >
      <Link
        href="/"
        style={{
          fontWeight: 800,
          fontSize: 16,
          color: 'var(--ink)',
          textDecoration: 'none',
          marginRight: 8,
        }}
      >
        CFAB&nbsp;3D
      </Link>
      {item('/', 'Moje sceny', 'home')}
      {item('/gallery', 'Galeria', 'gallery')}
      {item('/editor', '+ Nowa scena', 'editor')}
      {isAdmin && item('/admin', 'Admin', 'admin')}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{email}</span>
        <LogoutButton />
      </div>
    </nav>
  );
}
