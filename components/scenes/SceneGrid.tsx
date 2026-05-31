// components/scenes/SceneGrid.tsx
'use client';

import { useState } from 'react';
import { SceneCard } from './SceneCard';
import type { SceneRecord } from '@/lib/scenes/types';

interface SceneGridProps {
  initialScenes: SceneRecord[];
}

/**
 * Siatka kafelków scen. Zarządza stanem klienckim po usunięciu sceny
 * (optimistic removal bez reload strony).
 */
export function SceneGrid({ initialScenes }: SceneGridProps) {
  const [scenes, setScenes] = useState<SceneRecord[]>(initialScenes);

  const handleDelete = (id: string) => {
    setScenes((prev) => prev.filter((s) => s.id !== id));
  };

  if (scenes.length === 0) {
    return <p className="home-empty-after-delete">Wszystkie sceny usunięte.</p>;
  }

  return (
    <section className="scene-grid" aria-label="Lista scen">
      {scenes.map((scene) => (
        <SceneCard key={scene.id} scene={scene} onDelete={handleDelete} />
      ))}
    </section>
  );
}
