'use client';

import { useState } from 'react';
import type { UserRow } from '@/lib/db/schema';

export default function AdminPanel({ initialUsers }: { initialUsers: UserRow[] }) {
  const [userList, setUserList] = useState<UserRow[]>(initialUsers);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    const res = await fetch('/api/admin/users');
    if (res.ok) setUserList(await res.json());
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError('');
    setMessage('');

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail }),
    });

    if (res.ok) {
      setMessage(`Dodano użytkownika: ${newEmail}`);
      setNewEmail('');
      await refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Błąd dodawania.');
    }
    setAdding(false);
  }

  async function handlePatch(id: string, patch: { role?: string; status?: string }) {
    setError('');
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Błąd aktualizacji.');
    }
    await refresh();
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Usunąć użytkownika ${email}?`)) return;
    setError('');
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const data = await res.json();
      setError(data.error ?? 'Błąd usuwania.');
    }
    await refresh();
  }

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Panel admina</h1>
        <a href="/" style={styles.backLink}>← Strona główna</a>
      </div>

      {/* Formularz dodawania */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Dodaj użytkownika</h2>
        <form onSubmit={handleAddUser} style={styles.addForm}>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            required
            style={styles.input}
          />
          <button type="submit" disabled={adding} style={styles.btn}>
            {adding ? 'Dodawanie…' : 'Dodaj'}
          </button>
        </form>
        {message && <p style={styles.success}>{message}</p>}
        {error && <p style={styles.error}>{error}</p>}
      </section>

      {/* Tabela użytkowników */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Użytkownicy ({userList.length})</h2>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>E-mail</th>
                <th style={styles.th}>Rola</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Ostatnie logowanie</th>
                <th style={styles.th}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((u) => (
                <tr key={u.id} style={styles.tr}>
                  <td style={styles.td}>{u.email}</td>
                  <td style={styles.td}>
                    <select
                      value={u.role}
                      onChange={(e) => handlePatch(u.id, { role: e.target.value })}
                      style={styles.select}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td style={styles.td}>
                    <select
                      value={u.status}
                      onChange={(e) => handlePatch(u.id, { status: e.target.value })}
                      style={{
                        ...styles.select,
                        color: u.status === 'blocked' ? '#dc2626' : 'inherit',
                      }}
                    >
                      <option value="allowed">allowed</option>
                      <option value="blocked">blocked</option>
                    </select>
                  </td>
                  <td style={styles.td}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('pl') : '—'}
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => handleDelete(u.id, u.email)}
                      style={styles.deleteBtn}
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 900, margin: '0 auto', padding: '32px 20px', fontFamily: 'ui-sans-serif, system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  title: { fontSize: 22, fontWeight: 700, margin: 0, color: '#1c1917' },
  backLink: { fontSize: 14, color: '#78716c', textDecoration: 'none' },
  section: { marginBottom: 32, background: '#fff', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', padding: 24 },
  sectionTitle: { fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: '#1c1917' },
  addForm: { display: 'flex', gap: 10 },
  input: { flex: 1, padding: '9px 13px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 7, fontSize: 14 },
  btn: { padding: '9px 20px', background: '#2a8a66', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  success: { fontSize: 13, color: '#2a8a66', margin: '10px 0 0' },
  error: { fontSize: 13, color: '#dc2626', margin: '10px 0 0' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.08)', color: '#78716c', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
  tr: { borderBottom: '1px solid rgba(0,0,0,0.05)' },
  td: { padding: '10px 12px', color: '#1c1917' },
  select: { padding: '4px 8px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 5, fontSize: 13, background: '#fff', cursor: 'pointer' },
  deleteBtn: { padding: '4px 10px', background: 'none', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 5, fontSize: 12, cursor: 'pointer' },
};
