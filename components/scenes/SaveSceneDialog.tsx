'use client';
// components/scenes/SaveSceneDialog.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { captureThumbnail } from './captureThumbnail';
import { uploadAssets } from './uploadAssets';

interface SaveSceneDialogProps {
  onClose: () => void;
}

/**
 * Modal „Zapisz scenę" wywołany z paska narzędzi edytora.
 * Renderowany poza drzewem <Canvas>. Dostęp do WebGLRenderer przez store.glRef
 * (rejestrowany przez onCreated callbacku Canvas w Viewer.tsx).
 */
export function SaveSceneDialog({ onClose }: SaveSceneDialogProps) {
  const router = useRouter();
  const config = useStore((s) => s.config);
  const loadedModel = useStore((s) => s.loadedModel);
  const glRef = useStore((s) => s.glRef);

  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Podaj tytuł sceny.');
      return;
    }
    if (!loadedModel?.file) {
      setError('Załaduj model .glb przed zapisem.');
      return;
    }
    if (!glRef) {
      setError('Renderer niedostępny — spróbuj ponownie.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 1. Zrzut miniatury.
      const thumbBlob = await captureThumbnail(glRef);
      if (!thumbBlob) throw new Error('Nie udało się przechwycić miniatury.');

      // 2. Równoległy upload modelu i miniatury do Vercel Blob.
      const { modelBlobUrl, thumbBlobUrl } = await uploadAssets(
        loadedModel.file,
        thumbBlob
      );

      // 3. Zapis sceny przez API.
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          config,
          modelBlobUrl,
          modelFileName: loadedModel.fileName,
          thumbBlobUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? `Błąd API: ${response.status}`);
      }

      const scene = await response.json();

      // 4. Redirect do widoku zapisanej sceny.
      router.push(`/editor/${scene.id}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd zapisu.');
      setSaving(false);
    }
  };

  return (
    <div className="save-scene-overlay" role="dialog" aria-modal="true">
      <div className="save-scene-modal">
        <h2>Zapisz scenę</h2>

        {!loadedModel?.file && (
          <p className="save-scene-warning">
            Uwaga: model załadowany z URL (nie z dysku) — plik nie będzie zapisany do Blob.
            Cofnij i załaduj model z dysku (.glb drag&amp;drop).
          </p>
        )}

        <label htmlFor="scene-title">Tytuł sceny</label>
        <input
          id="scene-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="np. Krzesło minimalistyczne v1"
          autoFocus
          maxLength={200}
          disabled={saving}
        />

        {error && <p className="save-scene-error">{error}</p>}

        <div className="save-scene-actions">
          <button onClick={onClose} disabled={saving} type="button">
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            type="button"
            className="save-scene-primary"
          >
            {saving ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>
  );
}
