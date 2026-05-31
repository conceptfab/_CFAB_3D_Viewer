'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { UserRow } from '@/lib/db/schema';
import type { OrphanReport } from '@/lib/scenes/blobAudit';

export default function AdminPanel({
  initialUsers,
  initialOrphans,
  initialOrphansError,
}: {
  initialUsers: UserRow[];
  initialOrphans: OrphanReport | null;
  initialOrphansError: string | null;
}) {
  const [userList, setUserList] = useState<UserRow[]>(initialUsers);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Sekcja „Osierocone pliki Blob".
  const [orphans, setOrphans] = useState<OrphanReport | null>(initialOrphans);
  const [orphansError, setOrphansError] = useState<string | null>(initialOrphansError);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [blobMessage, setBlobMessage] = useState('');

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

  // ── Osierocone pliki Blob ──────────────────────────────────────────────────
  async function scanOrphans() {
    setScanning(true);
    setOrphansError(null);
    setSelected(new Set());
    try {
      const res = await fetch('/api/admin/blobs');
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `Błąd skanu: ${res.status}`);
      }
      setOrphans(await res.json());
    } catch (e) {
      setOrphansError(e instanceof Error ? e.message : 'Skan nieudany.');
      setOrphans(null);
    } finally {
      setScanning(false);
    }
  }

  function toggleOrphan(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function toggleAllOrphans() {
    setSelected((prev) => (prev.size === deletableUrls.length ? new Set() : new Set(deletableUrls)));
  }

  async function deleteSelectedOrphans() {
    if (selected.size === 0) return;
    if (!confirm(`Usunąć ${selected.size} plik(ów) z Blob? Tej operacji nie można cofnąć.`)) return;
    setDeleting(true);
    setOrphansError(null);
    try {
      const res = await fetch('/api/admin/blobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Błąd kasowania: ${res.status}`);
      await scanOrphans(); // odśwież listę (czyści też zaznaczenie)
      setBlobMessage(`Usunięto: ${data.deleted.length}. Pominięto: ${data.skipped.length}.`);
    } catch (e) {
      setOrphansError(e instanceof Error ? e.message : 'Kasowanie nieudane.');
    } finally {
      setDeleting(false);
    }
  }

  const deletableUrls = orphans ? orphans.orphans.filter((o) => o.deletable).map((o) => o.url) : [];

  return (
    <main style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Panel admina</h1>
        <Link href="/" style={styles.backLink}>← Strona główna</Link>
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
                        color: u.status === 'blocked' ? 'var(--danger)' : 'var(--ink)',
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
                      type="button"
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

      {/* Osierocone pliki Blob */}
      <section style={styles.section}>
        <div style={styles.blobHeader}>
          <h2 style={{ ...styles.sectionTitle, margin: 0 }}>
            Osierocone pliki Blob{orphans ? ` (${orphans.summary.count})` : ''}
          </h2>
          <button
            type="button"
            onClick={() => {
              setBlobMessage('');
              scanOrphans();
            }}
            disabled={scanning}
            style={styles.btn}
          >
            {scanning ? 'Skanowanie…' : 'Skanuj ponownie'}
          </button>
        </div>

        {orphansError && <p style={styles.error}>{orphansError}</p>}
        {blobMessage && <p style={styles.success}>{blobMessage}</p>}

        {orphans && orphans.summary.count === 0 && !orphansError && (
          <p style={styles.blobEmpty}>Brak osieroconych plików — wszystko jest w użyciu. 🎉</p>
        )}

        {orphans && orphans.summary.count > 0 && (
          <>
            <p style={styles.blobSummary}>
              Łącznie {formatBytes(orphans.summary.bytes)} do odzyskania
              {` · modele: ${orphans.summary.byKind.model.count}`}
              {` · miniatury: ${orphans.summary.byKind.thumbnail.count}`}
              {orphans.recentSkipped > 0 &&
                ` · świeżych pominiętych: ${orphans.recentSkipped} (młodsze niż ${orphans.safetyWindowHours} godz.)`}
            </p>

            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                onClick={deleteSelectedOrphans}
                disabled={deleting || selected.size === 0}
                style={{ ...styles.deleteBtn, opacity: selected.size === 0 ? 0.5 : 1 }}
              >
                {deleting ? 'Usuwanie…' : `Usuń zaznaczone (${selected.size})`}
              </button>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>
                      <input
                        type="checkbox"
                        checked={deletableUrls.length > 0 && selected.size === deletableUrls.length}
                        onChange={toggleAllOrphans}
                        disabled={deletableUrls.length === 0}
                        title="Zaznacz/odznacz wszystkie kasowalne"
                      />
                    </th>
                    <th style={styles.th}>Plik</th>
                    <th style={styles.th}>Typ</th>
                    <th style={styles.th}>Rozmiar</th>
                    <th style={styles.th}>Wiek</th>
                  </tr>
                </thead>
                <tbody>
                  {orphans.orphans.map((o) => (
                    <tr key={o.url} style={{ ...styles.tr, opacity: o.deletable ? 1 : 0.5 }}>
                      <td style={styles.td}>
                        <input
                          type="checkbox"
                          checked={selected.has(o.url)}
                          onChange={() => toggleOrphan(o.url)}
                          disabled={!o.deletable}
                          title={
                            o.deletable
                              ? 'Zaznacz do usunięcia'
                              : `Świeży — pomijany (młodszy niż ${orphans.safetyWindowHours} godz.)`
                          }
                        />
                      </td>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12 }}>{o.pathname}</td>
                      <td style={styles.td}>
                        {o.kind === 'model' ? 'model' : o.kind === 'thumbnail' ? 'miniatura' : '—'}
                      </td>
                      <td style={styles.td}>{formatBytes(o.size)}</td>
                      <td style={styles.td}>
                        {formatAge(o.ageHours)}
                        {!o.deletable && <span style={styles.blobFresh}> · świeży</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1).replace('.', ',')} ${units[i]}`;
}

function formatAge(hours: number): string {
  if (hours < 1) return '< 1 godz.';
  if (hours < 24) return `${Math.floor(hours)} godz.`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'dzień' : 'dni'}`;
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 900, margin: '0 auto', padding: '32px 20px', fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  title: { fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--ink)' },
  backLink: { fontSize: 14, color: 'var(--muted)', textDecoration: 'none' },
  section: { marginBottom: 32, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: 24 },
  sectionTitle: { fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: 'var(--ink)' },
  addForm: { display: 'flex', gap: 10 },
  input: { flex: 1, padding: '9px 13px', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: 14, color: 'var(--ink)', background: 'var(--surface-2)' },
  btn: { padding: '9px 20px', background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  success: { fontSize: 13, color: 'var(--ok)', margin: '10px 0 0' },
  error: { fontSize: 13, color: 'var(--danger)', margin: '10px 0 0' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '10px 12px', color: 'var(--ink)' },
  select: { padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 5, fontSize: 13, color: 'var(--ink)', background: 'var(--surface-2)', cursor: 'pointer' },
  deleteBtn: { padding: '4px 10px', background: 'none', border: '1px solid var(--danger-border)', color: 'var(--danger)', borderRadius: 5, fontSize: 12, cursor: 'pointer' },
  blobHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  blobEmpty: { fontSize: 14, color: 'var(--muted)', margin: 0 },
  blobSummary: { fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' },
  blobFresh: { color: 'var(--muted)', fontSize: 11 },
};
