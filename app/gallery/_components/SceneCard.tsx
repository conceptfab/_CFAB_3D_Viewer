// app/gallery/_components/SceneCard.tsx
'use client';

import { useState } from 'react';
import type { SceneRecord } from '@/lib/scenes/repo';
import { useRenameScene } from '@/components/scenes/useRenameScene';
import { PermissionsPanel } from './PermissionsPanel';
import { ShareLinksPanel } from './ShareLinksPanel';

interface SceneCardProps {
  scene: SceneRecord;
  isOwner: boolean;
}

export function SceneCard({ scene, isOwner }: SceneCardProps) {
  const [showPermissions, setShowPermissions] = useState(false);
  const [showShareLinks, setShowShareLinks] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [title, setTitle] = useState(scene.title);
  const rename = useRenameScene(scene.id, title, (t) => setTitle(t));

  async function handleDelete() {
    if (!confirm(`Czy na pewno chcesz usunąć scenę "${scene.title}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/scenes/${scene.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? 'Błąd usuwania sceny');
        setDeleting(false);
        return;
      }
      // Odśwież stronę po usunięciu
      window.location.reload();
    } catch {
      alert('Błąd sieciowy');
      setDeleting(false);
    }
  }

  return (
    <article className="gallery-card">
      {/* Miniatura */}
      <a href={`/editor/${scene.id}`} className="scene-card__thumb-link">
        {scene.thumbBlobUrl ? (
          <img
            src={scene.thumbBlobUrl}
            alt={title}
            className="scene-card__thumb"
          />
        ) : (
          <div className="scene-card__thumb-placeholder">
            <span>Brak miniatury</span>
          </div>
        )}
      </a>

      {/* Metadane */}
      <div className="scene-card__body">
        {rename.editing ? (
          <input
            className="scene-card__title"
            value={rename.draft}
            onChange={(e) => rename.setDraft(e.target.value)}
            onKeyDown={rename.onKeyDown}
            maxLength={200}
            autoFocus
            disabled={rename.saving}
            aria-label="Nowa nazwa sceny"
            style={{
              width: '100%',
              font: 'inherit',
              padding: '2px 6px',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <h2 className="scene-card__title">{title}</h2>
        )}
        <p className="scene-card__meta">
          Zaktualizowano: {scene.updatedAt.toLocaleDateString('pl-PL')}
          {!isOwner && <span className="scene-card__badge">Udostępniona</span>}
        </p>
        {rename.error && (
          <p style={{ color: 'var(--danger)', fontSize: 12, margin: '4px 0 0' }}>{rename.error}</p>
        )}
      </div>

      {/* Akcje */}
      <div className="scene-card__actions">
        <a href={`/editor/${scene.id}`} className="btn-sm">
          Edytuj
        </a>

        {isOwner &&
          (rename.editing ? (
            <>
              <button type="button" className="btn-sm" onClick={rename.save} disabled={rename.saving}>
                {rename.saving ? 'Zapisuję…' : 'Zapisz'}
              </button>
              <button type="button" className="btn-sm" onClick={rename.cancel} disabled={rename.saving}>
                Anuluj
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-sm" onClick={rename.start}>
                Zmień nazwę
              </button>
              <button
                type="button"
                className="btn-sm"
                onClick={() => {
                  setShowPermissions(!showPermissions);
                  setShowShareLinks(false);
                }}
              >
                Dostęp
              </button>
              <button
                type="button"
                className="btn-sm"
                onClick={() => {
                  setShowShareLinks(!showShareLinks);
                  setShowPermissions(false);
                }}
              >
                Linki
              </button>
              <button
                type="button"
                className="btn-sm btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Usuwam…' : 'Usuń'}
              </button>
            </>
          ))}
      </div>

      {/* Panele rozwijane (owner-only) */}
      {isOwner && showPermissions && (
        <PermissionsPanel sceneId={scene.id} />
      )}
      {isOwner && showShareLinks && (
        <ShareLinksPanel sceneId={scene.id} />
      )}
    </article>
  );
}
