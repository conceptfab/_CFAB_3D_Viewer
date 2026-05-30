import { useStore } from '../store';

type Row =
  | { kind: 'section'; label: string }
  | { kind: 'item'; id: string; label: string; icon: string; depth: number; hint?: string };

/** Drzewo elementów sceny (jak outliner w C4D / Blenderze). */
export function Outliner() {
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);
  const fileName = useStore((s) => s.loadedModel?.fileName);
  const cameras = useStore((s) => s.config.camera.presets);
  const activeCam = useStore((s) => s.config.camera.active);

  const rows: Row[] = [
    { kind: 'section', label: 'Świat' },
    { kind: 'item', id: 'scene', label: 'Scene', icon: '🌐', depth: 0, hint: 'global' },
    { kind: 'item', id: 'render', label: 'Render', icon: '🎞', depth: 0 },
    { kind: 'item', id: 'background', label: 'Background', icon: '🌄', depth: 0 },
    { kind: 'item', id: 'environment', label: 'Environment', icon: '🌍', depth: 0, hint: 'HDRI' },

    { kind: 'section', label: 'Obiekty' },
    { kind: 'item', id: 'hero', label: 'HERO', icon: '◇', depth: 0, hint: 'NULL' },
  ];
  if (fileName) {
    rows.push({ kind: 'item', id: 'actor', label: fileName, icon: '🔒', depth: 1, hint: 'aktor' });
  }

  rows.push({ kind: 'section', label: 'Światła' });
  rows.push({ kind: 'item', id: 'light', label: 'Key Light', icon: '💡', depth: 1 });

  rows.push({ kind: 'section', label: 'Kamery' });
  for (const id of Object.keys(cameras)) {
    rows.push({
      kind: 'item',
      id: `cam:${id}`,
      label: id,
      icon: '📷',
      depth: 1,
      hint: id === activeCam ? 'aktywna' : undefined,
    });
  }

  return (
    <div className="outliner">
      {rows.map((r, i) =>
        r.kind === 'section' ? (
          <div key={`s${i}`} className="outliner__section">
            {r.label}
          </div>
        ) : (
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
        )
      )}
    </div>
  );
}
