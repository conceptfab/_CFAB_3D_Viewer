import { useStore, type SceneElementId } from '../store';

interface Row {
  id: SceneElementId;
  label: string;
  icon: string;
  depth: number;
  hint?: string;
}

/** Drzewo elementów sceny (jak outliner w C4D / Blenderze). */
export function Outliner() {
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);
  const fileName = useStore((s) => s.loadedModel?.fileName);

  const rows: Row[] = [
    { id: 'hero', label: 'HERO', icon: '◇', depth: 0, hint: 'NULL' },
  ];
  if (fileName) {
    rows.push({ id: 'actor', label: fileName, icon: '🔒', depth: 1, hint: 'aktor' });
  }
  rows.push(
    { id: 'light', label: 'Key Light', icon: '💡', depth: 0 },
    { id: 'camera', label: 'Kamera', icon: '🎥', depth: 0 },
    { id: 'environment', label: 'Środowisko', icon: '🌍', depth: 0 }
  );

  return (
    <div className="outliner">
      <div className="outliner__head">Scena</div>
      {rows.map((r) => (
        <button
          key={r.id}
          className={`outliner__row ${selected === r.id ? 'is-selected' : ''}`}
          style={{ paddingLeft: 10 + r.depth * 18 }}
          onClick={() => setSelected(r.id)}
        >
          <span className="outliner__icon">{r.icon}</span>
          <span className="outliner__label">{r.label}</span>
          {r.hint && <span className="outliner__hint">{r.hint}</span>}
        </button>
      ))}
    </div>
  );
}
