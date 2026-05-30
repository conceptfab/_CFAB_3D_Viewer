'use client';
import { useStore, type EditorView } from '../store';

const PROJECTIONS: { id: EditorView; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'perspective', label: 'Persp' },
];

/**
 * Pasek dolny środkowego viewportu — DWA RZĘDY:
 *  - górny: rzuty ortho + Persp (setEditorView)
 *  - dolny: kamery sceny w kolejności outlinera; klik = ustawia kamerę
 *    aktywną i przełącza editorView='camera'.
 */
export function ViewButtons() {
  const view = useStore((s) => s.editorView);
  const setEditorView = useStore((s) => s.setEditorView);
  const cameras = useStore((s) => s.config.camera.cameras);
  const active = useStore((s) => s.config.camera.active);
  const setCamera = useStore((s) => s.setCamera);

  return (
    <div className="viewport-stack viewport-stack--bottom">
      <div className="viewport-bar">
        {PROJECTIONS.map((v) => (
          <button
            key={v.id}
            className={view === v.id ? 'active' : ''}
            onClick={() => setEditorView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="viewport-bar">
        {cameras.map((c) => {
          const isActive = view === 'camera' && active === c.id;
          return (
            <button
              key={c.id}
              className={isActive ? 'active' : ''}
              onClick={() => {
                setCamera({ active: c.id });
                setEditorView('camera');
              }}
              title={c.id}
            >
              📷 {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
