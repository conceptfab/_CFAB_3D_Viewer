// app/gallery/_components/SceneCard.tsx
'use client';

import { useState } from 'react';
import type { SceneRecord } from '@/lib/scenes/repo';
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
    <article className="scene-card">
      {/* Miniatura */}
      <a href={`/editor/${scene.id}`} className="scene-card__thumb-link">
        {scene.thumbBlobUrl ? (
          <img
            src={scene.thumbBlobUrl}
            alt={scene.title}
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
        <h2 className="scene-card__title">{scene.title}</h2>
        <p className="scene-card__meta">
          Zaktualizowano: {scene.updatedAt.toLocaleDateString('pl-PL')}
          {!isOwner && <span className="scene-card__badge">Udostępniona</span>}
        </p>
      </div>

      {/* Akcje */}
      <div className="scene-card__actions">
        <a href={`/editor/${scene.id}`} className="btn-sm">
          Edytuj
        </a>

        {isOwner && (
          <>
            <button
              className="btn-sm"
              onClick={() => {
                setShowPermissions(!showPermissions);
                setShowShareLinks(false);
              }}
            >
              Dostęp
            </button>
            <button
              className="btn-sm"
              onClick={() => {
                setShowShareLinks(!showShareLinks);
                setShowPermissions(false);
              }}
            >
              Linki
            </button>
            <button
              className="btn-sm btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Usuwam…' : 'Usuń'}
            </button>
          </>
        )}
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
