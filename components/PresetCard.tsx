// components/PresetCard.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SceneRecord } from '@/lib/scenes/repo';

interface PresetCardProps {
  preset: SceneRecord;
  /** Czy zalogowany użytkownik jest adminem — decyduje o widoczności przycisku Usuń */
  isAdmin: boolean;
  onDelete?: (id: string) => void;
}

export function PresetCard({ preset, isAdmin, onDelete }: PresetCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUse() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenes/${preset.id}/instantiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Błąd ${res.status}`);
      }
      const newScene: SceneRecord = await res.json();
      router.push(`/editor/${newScene.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Usunąć preset „${preset.title}"? Tej operacji nie można cofnąć.`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenes/${preset.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Błąd ${res.status}`);
      }
      onDelete?.(preset.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
      setLoading(false);
    }
  }

  return (
    <article
      style={{
        position: 'relative',
        border: '2px solid #4a6fa5',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#1a1a2e',
        color: '#e0e0e0',
        width: 220,
        flexShrink: 0,
      }}
      aria-label={`Preset: ${preset.title}`}
    >
      {/* Badge PRESET */}
      <span
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          background: '#4a6fa5',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.2,
          padding: '2px 7px',
          borderRadius: 4,
          textTransform: 'uppercase',
          zIndex: 1,
        }}
      >
        PRESET
      </span>

      {/* Miniatura */}
      <div style={{ width: '100%', height: 130, background: '#111', overflow: 'hidden' }}>
        {preset.thumbBlobUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preset.thumbBlobUrl}
            alt={`Miniatura presetu ${preset.title}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#555',
              fontSize: 12,
            }}
          >
            brak miniatury
          </div>
        )}
      </div>

      {/* Treść */}
      <div style={{ padding: '10px 12px 12px' }}>
        <h3
          style={{
            margin: '0 0 4px',
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={preset.title}
        >
          {preset.title}
        </h3>
        <p style={{ margin: '0 0 10px', fontSize: 11, color: '#888' }}>
          {preset.modelFileName ?? 'brak modelu'}
        </p>

        {error && (
          <p style={{ color: '#ff6b6b', fontSize: 11, margin: '0 0 8px' }}>{error}</p>
        )}

        {/* Akcje */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleUse}
            disabled={loading}
            style={{
              flex: 1,
              padding: '6px 0',
              background: '#4a6fa5',
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '...' : 'Użyj jako nowa scena'}
          </button>

          {/* Usuń — tylko admin (gated server-side also) */}
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{
                padding: '6px 10px',
                background: 'transparent',
                color: '#ff6b6b',
                border: '1px solid #ff6b6b',
                borderRadius: 5,
                fontSize: 12,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
              aria-label="Usuń preset"
            >
              Usuń
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
