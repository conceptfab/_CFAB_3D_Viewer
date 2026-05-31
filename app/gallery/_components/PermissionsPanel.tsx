// app/gallery/_components/PermissionsPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import type { PermissionWithUser } from '@/lib/scenes/types';

interface Props {
  sceneId: string;
}

export function PermissionsPanel({ sceneId }: Props) {
  const [permissions, setPermissions] = useState<PermissionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pobierz listę uprawnień przy montażu
  useEffect(() => {
    fetch(`/api/scenes/${sceneId}/permissions`)
      .then((r) => r.json())
      .then((data) => {
        setPermissions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sceneId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenes/${sceneId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), canEdit }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Błąd dodawania uprawnienia');
        setAdding(false);
        return;
      }
      // Zaktualizuj listę (upsert — jeśli już był, odśwież jego canEdit)
      setPermissions((prev) => {
        const existing = prev.findIndex((p) => p.userId === data.userId);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = data;
          return next;
        }
        return [...prev, data];
      });
      setEmail('');
      setCanEdit(false);
    } catch {
      setError('Błąd sieciowy');
    }
    setAdding(false);
  }

  async function handleToggleEdit(perm: PermissionWithUser) {
    const res = await fetch(
      `/api/scenes/${sceneId}/permissions/${perm.userId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canEdit: !perm.canEdit }),
      },
    );
    if (!res.ok) return;
    setPermissions((prev) =>
      prev.map((p) =>
        p.userId === perm.userId ? { ...p, canEdit: !p.canEdit } : p,
      ),
    );
  }

  async function handleRemove(perm: PermissionWithUser) {
    const res = await fetch(
      `/api/scenes/${sceneId}/permissions/${perm.userId}`,
      { method: 'DELETE' },
    );
    if (!res.ok) return;
    setPermissions((prev) => prev.filter((p) => p.userId !== perm.userId));
  }

  return (
    <section className="panel permissions-panel">
      <h3>Dostęp do sceny</h3>

      {loading ? (
        <p>Ładowanie…</p>
      ) : (
        <>
          {permissions.length === 0 ? (
            <p className="panel__empty">Brak dodatkowych użytkowników.</p>
          ) : (
            <ul className="permissions-list">
              {permissions.map((perm) => (
                <li key={perm.userId} className="permissions-list__item">
                  <span className="permissions-list__email">{perm.email}</span>
                  <span className="permissions-list__role">
                    {perm.canEdit ? 'Edycja' : 'Podgląd'}
                  </span>
                  <button
                    type="button"
                    className="btn-xs"
                    onClick={() => handleToggleEdit(perm)}
                    title={perm.canEdit ? 'Ogranicz do podglądu' : 'Przyznaj edycję'}
                  >
                    {perm.canEdit ? '→ Podgląd' : '→ Edycja'}
                  </button>
                  <button
                    type="button"
                    className="btn-xs btn-danger"
                    onClick={() => handleRemove(perm)}
                    title="Usuń dostęp"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAdd} className="add-permission-form">
            <input
              type="email"
              placeholder="adres@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={canEdit}
                onChange={(e) => setCanEdit(e.target.checked)}
              />
              Może edytować
            </label>
            <button type="submit" className="btn-sm btn-primary" disabled={adding}>
              {adding ? 'Dodaję…' : 'Dodaj'}
            </button>
            {error && <p className="error-msg">{error}</p>}
          </form>
        </>
      )}
    </section>
  );
}
