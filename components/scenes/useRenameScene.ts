'use client';
// components/scenes/useRenameScene.ts
// Współdzielona logika edycji nazwy sceny w miejscu (dla kart obu galerii).
// Trzyma stan edycji/brudnopisu/zapisu/błędu; Enter zapisuje, Esc anuluje.
// Samą sieć/walidację deleguje do renameScene (osobno przetestowane).

import { useCallback, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { renameScene } from './renameScene';

export function useRenameScene(
  sceneId: string,
  currentTitle: string,
  onRenamed?: (title: string) => void
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(() => {
    setDraft(currentTitle);
    setError(null);
    setEditing(true);
  }, [currentTitle]);

  const cancel = useCallback(() => {
    setEditing(false);
    setError(null);
  }, []);

  const save = useCallback(async () => {
    if (saving) return;
    // Brak zmiany → zamykamy bez zbędnego PATCH-a.
    if (draft.trim() === currentTitle) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await renameScene(sceneId, draft);
      onRenamed?.(saved);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zmienić nazwy.');
    } finally {
      setSaving(false);
    }
  }, [saving, draft, currentTitle, sceneId, onRenamed]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    },
    [save, cancel]
  );

  return { editing, draft, setDraft, saving, error, start, cancel, save, onKeyDown };
}
