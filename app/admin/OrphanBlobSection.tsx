'use client';

import {
  memo,
  useCallback,
  useMemo,
  useState,
  startTransition,
  type ChangeEvent,
  type CSSProperties,
} from 'react';
import type { OrphanBlob, OrphanReport } from '@/lib/scenes/blobAudit';
import { pruneOrphanReport } from '@/lib/scenes/blobAudit';

const OrphanRow = memo(function OrphanRow({
  orphan,
  checked,
  safetyWindowHours,
  onToggle,
}: {
  orphan: OrphanBlob;
  checked: boolean;
  safetyWindowHours: number;
  onToggle: (url: string) => void;
}) {
  const handleCheck = useCallback(
    (_e: ChangeEvent<HTMLInputElement>) => onToggle(orphan.url),
    [onToggle, orphan.url]
  );
  return (
    <tr style={{ ...rowStyle, opacity: orphan.deletable ? 1 : 0.5 }}>
      <td style={cellStyle}>
        <input
          type="checkbox"
          checked={checked}
          onChange={handleCheck}
          title={
            orphan.deletable
              ? 'Zaznacz do usunięcia'
              : `Świeży (< ${safetyWindowHours} godz.) — wymaga potwierdzenia przy kasowaniu`
          }
        />
      </td>
      <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: 12 }}>{orphan.pathname}</td>
      <td style={cellStyle}>
        {orphan.kind === 'model' ? 'model' : orphan.kind === 'thumbnail' ? 'miniatura' : '—'}
      </td>
      <td style={cellStyle}>{formatBytes(orphan.size)}</td>
      <td style={cellStyle}>
        {formatAge(orphan.ageHours)}
        {!orphan.deletable && <span style={freshStyle}> · świeży</span>}
      </td>
    </tr>
  );
});

export default function OrphanBlobSection({
  initialOrphans,
  initialOrphansError,
}: {
  initialOrphans: OrphanReport | null;
  initialOrphansError: string | null;
}) {
  const [orphans, setOrphans] = useState<OrphanReport | null>(initialOrphans);
  const [orphansError, setOrphansError] = useState<string | null>(initialOrphansError);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [blobMessage, setBlobMessage] = useState('');

  const allOrphanUrls = useMemo(
    () => (orphans ? orphans.orphans.map((o) => o.url) : []),
    [orphans]
  );
  const deletableCount = useMemo(
    () => (orphans ? orphans.orphans.filter((o) => o.deletable).length : 0),
    [orphans]
  );
  const freshCount = orphans?.recentSkipped ?? 0;

  const updateSelected = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    startTransition(() => {
      setSelected(updater);
    });
  }, []);

  const toggleOrphan = useCallback(
    (url: string) => {
      updateSelected((prev) => {
        const next = new Set(prev);
        if (next.has(url)) next.delete(url);
        else next.add(url);
        return next;
      });
    },
    [updateSelected]
  );

  const toggleAllOrphans = useCallback(() => {
    updateSelected((prev) =>
      prev.size === allOrphanUrls.length ? new Set() : new Set(allOrphanUrls)
    );
  }, [allOrphanUrls, updateSelected]);

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
      const data: OrphanReport = await res.json();
      startTransition(() => setOrphans(data));
    } catch (e) {
      setOrphansError(e instanceof Error ? e.message : 'Skan nieudany.');
      setOrphans(null);
    } finally {
      setScanning(false);
    }
  }

  async function deleteSelectedOrphans() {
    if (selected.size === 0) return;
    const selectedList = orphans?.orphans.filter((o) => selected.has(o.url)) ?? [];
    const freshSelected = selectedList.filter((o) => !o.deletable).length;
    const confirmMsg =
      freshSelected > 0
        ? `Usunąć ${selected.size} plik(ów)? W tym ${freshSelected} świeżych (młodszych niż ${orphans?.safetyWindowHours ?? 24} godz.). Kontynuować?`
        : `Usunąć ${selected.size} plik(ów) z Blob? Tej operacji nie można cofnąć.`;
    if (!confirm(confirmMsg)) return;

    setDeleting(true);
    setOrphansError(null);
    try {
      const res = await fetch('/api/admin/blobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: Array.from(selected),
          forceRecent: freshSelected > 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Błąd kasowania: ${res.status}`);

      const deleted: string[] = data.deleted ?? [];
      startTransition(() => {
        setSelected(new Set());
        if (orphans && deleted.length > 0) {
          setOrphans(pruneOrphanReport(orphans, deleted));
        }
      });
      setBlobMessage(`Usunięto: ${deleted.length}. Pominięto: ${(data.skipped ?? []).length}.`);
    } catch (e) {
      setOrphansError(e instanceof Error ? e.message : 'Kasowanie nieudane.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section style={sectionStyle}>
      <div style={blobHeaderStyle}>
        <h2 style={{ ...sectionTitleStyle, margin: 0 }}>
          Osierocone pliki Blob{orphans ? ` (${orphans.summary.count})` : ''}
        </h2>
        <button
          type="button"
          onClick={() => {
            setBlobMessage('');
            void scanOrphans();
          }}
          disabled={scanning}
          style={btnStyle}
        >
          {scanning ? 'Skanowanie…' : 'Skanuj ponownie'}
        </button>
      </div>

      {orphansError && <p style={errorStyle}>{orphansError}</p>}
      {blobMessage && <p style={successStyle}>{blobMessage}</p>}

      {orphans && orphans.summary.count === 0 && !orphansError && (
        <p style={blobEmptyStyle}>Brak osieroconych plików — wszystko jest w użyciu.</p>
      )}

      {orphans && orphans.summary.count > 0 && (
        <>
          <p style={blobSummaryStyle}>
            Łącznie {formatBytes(orphans.summary.bytes)} do odzyskania
            {` · modele: ${orphans.summary.byKind.model.count}`}
            {` · miniatury: ${orphans.summary.byKind.thumbnail.count}`}
            {` · kasowalne od razu: ${deletableCount}`}
            {freshCount > 0 && ` · świeże (< ${orphans.safetyWindowHours} godz.): ${freshCount}`}
          </p>

          {freshCount > 0 && deletableCount === 0 && (
            <p style={blobHintStyle}>
              Wszystkie pliki są w oknie bezpieczeństwa ({orphans.safetyWindowHours} godz.).
              Zaznacz i usuń — przy świeżych plikach pojawi się dodatkowe potwierdzenie.
            </p>
          )}

          <div style={{ marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => void deleteSelectedOrphans()}
              disabled={deleting || selected.size === 0}
              style={{ ...deleteBtnStyle, opacity: selected.size === 0 ? 0.5 : 1 }}
            >
              {deleting ? 'Usuwanie…' : `Usuń zaznaczone (${selected.size})`}
            </button>
          </div>

          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>
                    <input
                      type="checkbox"
                      checked={allOrphanUrls.length > 0 && selected.size === allOrphanUrls.length}
                      onChange={toggleAllOrphans}
                      disabled={allOrphanUrls.length === 0}
                      title="Zaznacz/odznacz wszystkie"
                    />
                  </th>
                  <th style={thStyle}>Plik</th>
                  <th style={thStyle}>Typ</th>
                  <th style={thStyle}>Rozmiar</th>
                  <th style={thStyle}>Wiek</th>
                </tr>
              </thead>
              <tbody>
                {orphans.orphans.map((o) => (
                  <OrphanRow
                    key={o.url}
                    orphan={o}
                    checked={selected.has(o.url)}
                    safetyWindowHours={orphans.safetyWindowHours}
                    onToggle={toggleOrphan}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
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

const sectionStyle: CSSProperties = {
  marginBottom: 32,
  background: 'var(--surface)',
  borderRadius: 10,
  border: '1px solid var(--border)',
  padding: 24,
};
const sectionTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  margin: '0 0 16px',
  color: 'var(--ink)',
};
const btnStyle: CSSProperties = {
  padding: '9px 20px',
  background: 'var(--accent)',
  color: 'var(--accent-ink)',
  border: 'none',
  borderRadius: 7,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
const errorStyle: CSSProperties = { fontSize: 13, color: 'var(--danger)', margin: '10px 0 0' };
const successStyle: CSSProperties = { fontSize: 13, color: 'var(--ok)', margin: '10px 0 0' };
const blobHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
};
const blobEmptyStyle: CSSProperties = { fontSize: 14, color: 'var(--muted)', margin: 0 };
const blobSummaryStyle: CSSProperties = { fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' };
const blobHintStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--ink)',
  margin: '0 0 14px',
  padding: '10px 12px',
  background: 'rgba(245, 158, 11, 0.12)',
  borderRadius: 8,
  border: '1px solid rgba(245, 158, 11, 0.35)',
  lineHeight: 1.5,
};
const tableWrapperStyle: CSSProperties = { overflowX: 'auto' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};
const rowStyle: CSSProperties = { borderBottom: '1px solid var(--border)' };
const cellStyle: CSSProperties = { padding: '10px 12px', color: 'var(--ink)' };
const deleteBtnStyle: CSSProperties = {
  padding: '4px 10px',
  background: 'none',
  border: '1px solid var(--danger-border)',
  color: 'var(--danger)',
  borderRadius: 5,
  fontSize: 12,
  cursor: 'pointer',
};
const freshStyle: CSSProperties = { color: 'var(--muted)', fontSize: 11 };
