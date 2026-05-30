import { useStore } from '../store';

const CAMERA_LABELS: { id: string; label: string }[] = [
  { id: 'hero', label: 'Hero' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Bok' },
  { id: 'top', label: 'Góra' },
  { id: 'detail', label: 'Detal' },
];

/** Predefiniowane ujęcia kamery — overlay w głównym oknie renderera. */
export function CameraButtons() {
  const active = useStore((s) => s.config.camera.active);
  const setCamera = useStore((s) => s.setCamera);
  return (
    <div className="camera-buttons">
      {CAMERA_LABELS.map((c) => (
        <button
          key={c.id}
          className={active === c.id ? 'active' : ''}
          onClick={() => setCamera({ active: c.id })}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
