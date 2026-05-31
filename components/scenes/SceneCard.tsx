// components/scenes/SceneCard.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { SceneRecord } from '@/lib/scenes/types';

interface SceneCardProps {
  scene: SceneRecord;
  onDelete: (id: string) => void;
}

/**
 * Kafelek pojedynczej sceny na stronie startowej.
 * Pokazuje: miniatura (lub placeholder), tytuł, data, przycisk „Otwórz", przycisk „Usuń".
 */
export function SceneCard({ scene, onDelete }: SceneCardProps) {
  const [deleting, setDeleting] = useState(false);

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
        <h3 className="scene-card-title" title={scene.title}>
          {scene.title}
        </h3>
        <time className="scene-card-date">{dateStr}</time>

        <div className="scene-card-actions">
          <Link href={`/editor/${scene.id}`} className="scene-card-btn scene-card-btn--primary">
            Otwórz
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="scene-card-btn scene-card-btn--danger"
          >
            {deleting ? '…' : 'Usuń'}
          </button>
        </div>
      </div>
    </article>
  );
}
