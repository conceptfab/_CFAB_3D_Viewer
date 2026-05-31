'use client';
// components/LogoutButton.tsx
import { useState } from 'react';

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
          /* i tak przekierowujemy */
        }
        window.location.href = '/login';
      }}
      style={{
        padding: '6px 12px',
        borderRadius: 6,
        border: '1px solid #d0d0d4',
        background: '#fff',
        color: '#1b1c20',
        fontSize: 13,
        fontWeight: 600,
        cursor: busy ? 'default' : 'pointer',
      }}
    >
      {busy ? '…' : 'Wyloguj'}
    </button>
  );
}
