// components/scenes/SceneCard.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { SceneRecord } from '@/lib/scenes/types';
import { useRenameScene } from './useRenameScene';

interface SceneCardProps {
  scene: SceneRecord;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

/**
 * Kafelek pojedynczej sceny na stronie startowej.
 * Pokazuje: miniatura (lub placeholder), tytuł, data, przycisk „Otwórz", przycisk „Usuń".
 */
export function SceneCard({ scene, onDelete, onRename }: SceneCardProps) {
  const [deleting, setDeleting] = useState(false);
  const rename = useRenameScene(scene.id, scene.title, (t) => onRename(scene.id, t));

  const handleDelete = async () => {
    if (!confirm(`Usunąć scenę „${scene.title}"? Tego nie można cofnąć.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/scenes/${scene.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Błąd usuwania');
      onDelete(scene.id);
    } catch {
      alert('Nie udało się usunąć sceny.');
      setDeleting(false);
    }
  };

  const dateStr = new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(scene.updatedAt));

  return (
    <article className="scene-card">
      <Link href={`/editor/${scene.id}`} className="scene-card-thumb-link">
        {scene.thumbBlobUrl ? (
          <Image
            src={scene.thumbBlobUrl}
            alt={`Miniatura: ${scene.title}`}
            width={256}
            height={160}
            className="scene-card-thumb"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="scene-card-thumb-placeholder">
            <span>Brak miniatury</span>
          </div>
        )}
      </Link>

      <div className="scene-card-body">
        {rename.editing ? (
          <input
            className="scene-card-title"
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
          <h3 className="scene-card-title" title={scene.title}>
            {scene.title}
          </h3>
        )}
        <time className="scene-card-date">{dateStr}</time>
        {rename.error && (
          <p style={{ color: 'var(--danger)', fontSize: 12, margin: '4px 0 0' }}>{rename.error}</p>
        )}

        <div className="scene-card-actions">
          {rename.editing ? (
            <>
              <button
                type="button"
                onClick={rename.save}
                disabled={rename.saving}
                className="scene-card-btn scene-card-btn--primary"
              >
                {rename.saving ? '…' : 'Zapisz'}
              </button>
              <button
                type="button"
                onClick={rename.cancel}
                disabled={rename.saving}
                className="scene-card-btn"
              >
                Anuluj
              </button>
            </>
          ) : (
            <>
              <Link href={`/editor/${scene.id}`} className="scene-card-btn scene-card-btn--primary">
                Otwórz
              </Link>
              <button type="button" onClick={rename.start} className="scene-card-btn">
                Zmień nazwę
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="scene-card-btn scene-card-btn--danger"
              >
                {deleting ? '…' : 'Usuń'}
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
