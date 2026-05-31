'use client';
import { useStore } from '../store';

/**
 * Pasek presetów kamery w finalnym widoku. Lista pochodzi z `cameras`,
 * filtrowana po `showInFinalBar`. Kolejność przycisków = kolejność w outlinerze
 * (kamera na szczycie outlinera = pierwsza z lewej).
 */
export function CameraButtons() {
  const cameras = useStore((s) => s.config.camera.cameras);
  const active = useStore((s) => s.config.camera.active);
  const setCamera = useStore((s) => s.setCamera);
  const visible = cameras.filter((c) => c.showInFinalBar);
  if (visible.length === 0) return null;
  return (
    <div className="viewport-bar viewport-bar--bottom">
      {visible.map((c) => (
        <button
          type="button"
          key={c.id}
          className={active === c.id ? 'active' : ''}
          onClick={() => setCamera({ active: c.id })}
          title={c.id}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
