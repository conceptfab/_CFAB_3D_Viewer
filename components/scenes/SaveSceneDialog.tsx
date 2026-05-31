'use client';
// components/scenes/SaveSceneDialog.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { captureThumbnail } from './captureThumbnail';
import { uploadAssets } from './uploadAssets';

interface SaveSceneDialogProps {
  onClose: () => void;
  /** true = zapis jako preset (admin-only, egzekwowane też serwerowo) */
  preset?: boolean;
  /** Wstępna nazwa (np. „<tytuł> (kopia)" przy „Zapisz jako"). */
  defaultTitle?: string;
}

/**
 * Modal „Zapisz scenę" wywołany z paska narzędzi edytora.
 * Renderowany poza drzewem <Canvas>. Dostęp do WebGLRenderer przez store.glRef
 * (rejestrowany w onCreated callbacku Canvas w Viewer.tsx).
 */
export function SaveSceneDialog({ onClose, preset = false, defaultTitle = '' }: SaveSceneDialogProps) {
  const router = useRouter();
  const config = useStore((s) => s.config);
  const loadedModel = useStore((s) => s.loadedModel);
  const glRef = useStore((s) => s.glRef);

  const [title, setTitle] = useState(defaultTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim()) {
      setError(preset ? 'Podaj nazwę presetu.' : 'Podaj tytuł sceny.');
      return;
    }
    // Model wymagany TYLKO dla sceny. Preset = sam config (światło, kamery, tło,
    // branding…) — model wczytuje się dopiero przy użyciu presetu jako nowej sceny.
    const modelFile = loadedModel?.file ?? null;
    const existingModelUrl =
      loadedModel && !loadedModel.file && loadedModel.objectUrl.startsWith('https://')
        ? loadedModel.objectUrl
        : null;
    if (!preset && !modelFile && !existingModelUrl) {
      setError('Załaduj model .glb przed zapisem sceny.');
      return;
    }
    if (!glRef) {
      setError('Renderer niedostępny — spróbuj ponownie.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 1. Zrzut miniatury z aktualnego widoku.
      const thumbBlob = await captureThumbnail(glRef);
      if (!thumbBlob) throw new Error('Nie udało się przechwycić miniatury.');

      // 2. Upload miniatury (zawsze) + modelu (świeży plik / istniejący URL; preset bez modelu → null).
      const { modelBlobUrl, thumbBlobUrl } = await uploadAssets(modelFile, thumbBlob, existingModelUrl);

      // 3. Zapis przez API.
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          config,
          modelBlobUrl,
          modelFileName: loadedModel?.fileName ?? null,
          thumbBlobUrl,
          isPreset: preset,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? `Błąd API: ${response.status}`);
      }

      const scene = await response.json();

      // 4. Preset → strona startowa (lista presetów); scena → edytor zapisanej sceny.
      router.push(preset ? '/' : `/editor/${scene.id}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd zapisu.');
      setSaving(false);
    }
  };

  return (
    <div className="save-scene-overlay" role="dialog" aria-modal="true">
      <div className="save-scene-modal">
        <h2>{preset ? 'Zapisz jako preset' : 'Zapisz scenę'}</h2>

        <label htmlFor="scene-title">{preset ? 'Nazwa presetu' : 'Tytuł sceny'}</label>
        <input
          id="scene-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={preset ? 'np. Studio — miękkie światło' : 'np. Krzesło minimalistyczne v1'}
          autoFocus
          maxLength={200}
          disabled={saving}
        />
        {preset && (
          <p style={{ fontSize: 12, color: '#9aa0ab', margin: '6px 0 0' }}>
            Preset zapisuje sam układ sceny (światło, kamery, tło, branding) — bez modelu 3D.
          </p>
        )}

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
