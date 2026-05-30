import { useStore } from '../store';

/**
 * Predefiniowane ujęcia kamery — overlay w głównym oknie renderera.
 * Etykiety pochodzą wprost z nazw kamer w storze, więc są spójne z outlinerem.
 */
export function CameraButtons() {
  const presets = useStore((s) => s.config.camera.presets);
  const active = useStore((s) => s.config.camera.active);
  const setCamera = useStore((s) => s.setCamera);
  const ids = Object.keys(presets);
  return (
    <div className="viewport-bar viewport-bar--bottom">
      {ids.map((id) => (
        <button
          key={id}
          className={active === id ? 'active' : ''}
          onClick={() => setCamera({ active: id })}
        >
          {id}
        </button>
      ))}
    </div>
  );
}
