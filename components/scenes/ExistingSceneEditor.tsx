// components/scenes/ExistingSceneEditor.tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useStore, normalizeConfig } from '@/components/store';
import type { SceneRecord } from '@/lib/scenes/types';

// Dynamiczny import edytora (ssr: false) — jak app/editor/page.tsx.
const EditorApp = dynamic(() => import('@/components/App'), { ssr: false });

interface Props {
  scene: SceneRecord;
  /** Czy zalogowany użytkownik jest adminem — pokazuje „Jako preset" w App */
  isAdmin?: boolean;
  /** Czy zalogowany user jest właścicielem sceny — pokazuje przycisk „Link publiczny". */
  isOwner?: boolean;
}

/**
 * Komponent kliencki: hydruje store danymi ze sceny i renderuje edytor.
 * Model ładowany z modelBlobUrl (zdalny URL zamiast objectUrl).
 */
export function ExistingSceneEditor({ scene, isAdmin = false, isOwner = false }: Props) {
  const setLoadedModel = useStore((s) => s.setLoadedModel);
  const rawSet = useStore.setState;

  useEffect(() => {
    rawSet({ config: normalizeConfig(scene.config) });
    if (scene.modelBlobUrl) {
      setLoadedModel({
        objectUrl: scene.modelBlobUrl, // useGLTF akceptuje HTTPS URL
        fileName: scene.modelFileName ?? 'model.glb',
        file: null, // plik z Blob, nie z dysku (zapis reużyje URL)
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  return <EditorApp isAdmin={isAdmin} sceneId={isOwner ? scene.id : undefined} />;
}
