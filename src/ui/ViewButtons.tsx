import { useStore, type EditorView } from '../store';

const VIEWS: { id: EditorView; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'perspective', label: 'Persp' },
  { id: 'camera', label: 'Kamera' },
];

/** Przełącznik rzutów środkowego viewportu edycyjnego. */
export function ViewButtons() {
  const view = useStore((s) => s.editorView);
  const setEditorView = useStore((s) => s.setEditorView);
  return (
    <div className="viewport-bar viewport-bar--bottom">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          className={view === v.id ? 'active' : ''}
          onClick={() => setEditorView(v.id)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
