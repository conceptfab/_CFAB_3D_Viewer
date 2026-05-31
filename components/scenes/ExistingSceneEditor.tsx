// components/scenes/ExistingSceneEditor.tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useStore } from '@/components/store';
import type { SceneRecord } from '@/lib/scenes/types';

// Dynamically import the editor app (ssr: false) — same as app/editor/page.tsx.
// This avoids SSR issues with R3F / Three.js.
const EditorApp = dynamic(() => import('@/components/App'), { ssr: false });

interface Props {
  scene: SceneRecord;
}

/**
 * Komponent kliencki: hydruje store danymi ze sceny i renderuje edytor.
 * Model ładowany z modelBlobUrl (zdalny URL zamiast objectUrl).
 */
export function ExistingSceneEditor({ scene }: Props) {
  const setLoadedModel = useStore((s) => s.setLoadedModel);

  // Bezpośrednie ustawienie całego config (nie przez poszczególne settery).
  // Drizzle zwraca config jako any (jsonb) — rzutujemy przez SceneConfig.
  const rawSet = useStore.setState;

  useEffect(() => {
    // Hydratacja: ustawienie configu ze sceny do store.
    rawSet({ config: scene.config });

    // Jeśli scena ma model: ustaw loadedModel z URL Blob (nie objectUrl).
    if (scene.modelBlobUrl) {
      setLoadedModel({
        objectUrl: scene.modelBlobUrl,  // useGLTF akceptuje HTTPS URL
        fileName: scene.modelFileName ?? 'model.glb',
        file: null,  // plik niedostępny (pochodzi z Blob, nie z dysku)
      });
    }

    // Czyszczenie przy odmontowaniu (opcjonalne — edytor reset).
    // return () => rawSet({ config: DEFAULT_CONFIG, loadedModel: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]); // Celowe: scene.id jako dep — scene.config jest stały per render (SSR).

  return <EditorApp />;
}
