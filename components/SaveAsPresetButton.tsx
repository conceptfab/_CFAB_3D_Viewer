// components/SaveAsPresetButton.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SceneConfig } from '@/components/store';

interface SaveAsPresetButtonProps {
  /** Aktualny config sceny ze store */
  config: SceneConfig;
  /** URL modelu wgranego do Blob (może być null jeśli brak modelu) */
  modelBlobUrl: string | null;
  modelFileName: string | null;
  /** URL miniatury wgranej do Blob (może być null) */
  thumbBlobUrl: string | null;
  /** Tytuł do użycia jako preset — pytamy użytkownika */
  defaultTitle?: string;
}

export function SaveAsPresetButton({
  config,
  modelBlobUrl,
  modelFileName,
  thumbBlobUrl,
  defaultTitle = 'Nowy preset',
}: SaveAsPresetButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveAsPreset() {
    const title = prompt('Nazwa presetu:', defaultTitle);
    if (!title || !title.trim()) return; // anulowanie dialogu

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          config,
          modelBlobUrl,
          modelFileName,
          thumbBlobUrl,
          isPreset: true, // <-- kluczowa flaga; serwer sprawdza role==='admin'
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Błąd ${res.status}`);
      }

      // Po zapisaniu jako preset — przekieruj na stronę główną
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <button
        type="button"
        onClick={handleSaveAsPreset}
        disabled={loading}
        style={{
          padding: '6px 14px',
          background: 'transparent',
          color: '#4a6fa5',
          border: '1.5px solid #4a6fa5',
          borderRadius: 5,
          fontSize: 12,
          fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
          whiteSpace: 'nowrap',
        }}
        title="Zapisz bieżącą scenę jako preset dostępny dla wszystkich użytkowników"
      >
        {loading ? 'Zapisuję preset...' : 'Zapisz jako preset'}
      </button>
      {error && (
        <span style={{ color: '#ff6b6b', fontSize: 11 }}>{error}</span>
      )}
    </div>
  );
}
