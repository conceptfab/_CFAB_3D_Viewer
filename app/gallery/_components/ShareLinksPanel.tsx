// app/gallery/_components/ShareLinksPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import type { ShareLink, ShareMode } from '@/lib/scenes/types';

interface Props {
  sceneId: string;
}

function buildShareUrl(token: string, mode: ShareMode): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
  return mode === 'embed'
    ? `${base}/embed/${token}`
    : `${base}/s/${token}`;
}

export function ShareLinksPanel({ sceneId }: Props) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<ShareMode>('view');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/scenes/${sceneId}/share-links`)
      .then((r) => r.json())
      .then((data) => {
        setLinks(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sceneId]);

  async function handleCreate() {
    setCreating(true);
    const res = await fetch(`/api/scenes/${sceneId}/share-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (res.ok) {
      const link: ShareLink = await res.json();
      setLinks((prev) => [link, ...prev]);
    }
    setCreating(false);
  }

  async function handleRevoke(linkId: string) {
    const res = await fetch(
      `/api/scenes/${sceneId}/share-links/${linkId}`,
      { method: 'DELETE' },
    );
    if (!res.ok) return;
    setLinks((prev) =>
      prev.map((l) =>
        l.id === linkId ? { ...l, revokedAt: new Date() } : l,
      ),
    );
  }

  function handleCopy(token: string, linkMode: ShareMode) {
    const url = buildShareUrl(token, linkMode);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const activeLinks = links.filter((l) => l.revokedAt === null);
  const revokedLinks = links.filter((l) => l.revokedAt !== null);

  return (
    <section className="panel share-links-panel">
      <h3>Linki do udostępnienia</h3>

      {loading ? (
        <p>Ładowanie…</p>
      ) : (
        <>
          {activeLinks.length === 0 ? (
            <p className="panel__empty">Brak aktywnych linków.</p>
          ) : (
            <ul className="share-links-list">
              {activeLinks.map((link) => {
                const url = buildShareUrl(link.token, link.mode);
                return (
                  <li key={link.id} className="share-links-list__item">
                    <span className="share-links-list__mode">
                      {link.mode === 'embed' ? 'Embed' : 'Podgląd'}
                    </span>
                    <code className="share-links-list__url">{url}</code>
                    <button
                      className="btn-xs"
                      onClick={() => handleCopy(link.token, link.mode)}
                    >
                      {copied === link.token ? 'Skopiowano!' : 'Kopiuj'}
                    </button>
                    <button
                      className="btn-xs btn-danger"
                      onClick={() => handleRevoke(link.id)}
                    >
                      Revoke
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {revokedLinks.length > 0 && (
            <details className="revoked-links">
              <summary>Revoked ({revokedLinks.length})</summary>
              <ul className="share-links-list share-links-list--revoked">
                {revokedLinks.map((link) => (
                  <li key={link.id} className="share-links-list__item">
                    <span className="share-links-list__mode">
                      {link.mode === 'embed' ? 'Embed' : 'Podgląd'} (revoked)
                    </span>
                    <code className="share-links-list__url share-links-list__url--revoked">
                      {buildShareUrl(link.token, link.mode)}
                    </code>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Formularz tworzenia nowego linku */}
          <div className="create-link-form">
            <label className="radio-label">
              <input
                type="radio"
                name={`mode-${sceneId}`}
                value="view"
                checked={mode === 'view'}
                onChange={() => setMode('view')}
              />
              Podgląd (/s/)
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name={`mode-${sceneId}`}
                value="embed"
                checked={mode === 'embed'}
                onChange={() => setMode('embed')}
              />
              Embed (/embed/)
            </label>
            <button
              className="btn-sm btn-primary"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? 'Tworzę…' : 'Utwórz link'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
