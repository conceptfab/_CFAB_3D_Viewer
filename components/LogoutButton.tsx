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
        border: '1px solid var(--border-strong)',
        background: 'var(--surface-2)',
        color: 'var(--ink)',
        fontSize: 13,
        fontWeight: 600,
        cursor: busy ? 'default' : 'pointer',
      }}
    >
      {busy ? '…' : 'Wyloguj'}
    </button>
  );
}
