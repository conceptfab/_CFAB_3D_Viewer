'use client';
import { useStore } from '../store';

type Row =
  | { kind: 'section'; label: string }
  | {
      kind: 'item';
      id: string;
      label: string;
      icon: string;
      depth: number;
      hint?: string;
    }
  | {
      kind: 'camera';
      id: string;
      label: string;
      depth: number;
      hint?: string;
      canUp: boolean;
      canDown: boolean;
      canRemove: boolean;
    }
  | { kind: 'add-camera' };

export function Outliner() {
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);
  const fileName = useStore((s) => s.loadedModel?.fileName);
  const cameras = useStore((s) => s.config.camera.cameras);
  const activeCam = useStore((s) => s.config.camera.active);
  const moveCamera = useStore((s) => s.moveCamera);
  const removeCamera = useStore((s) => s.removeCamera);
  const addCamera = useStore((s) => s.addCamera);
  const removeModel = useStore((s) => s.removeModel);

  const rows: Row[] = [
    { kind: 'section', label: 'Świat' },
    { kind: 'item', id: 'scene', label: 'Scene', icon: '🌐', depth: 0, hint: 'global' },
    { kind: 'item', id: 'render', label: 'Render', icon: '🎞', depth: 0 },
    { kind: 'item', id: 'background', label: 'Background', icon: '🌄', depth: 0 },
    { kind: 'item', id: 'environment', label: 'Environment', icon: '🌍', depth: 0, hint: 'HDRI' },
    { kind: 'item', id: 'branding', label: 'Branding', icon: '🏷️', depth: 0, hint: 'logo' },

    { kind: 'section', label: 'Obiekty' },
    { kind: 'item', id: 'hero', label: 'HERO', icon: '◇', depth: 0, hint: 'NULL' },
  ];
  if (fileName) {
    rows.push({ kind: 'item', id: 'actor', label: fileName, icon: '🔒', depth: 1, hint: 'aktor' });
  }

  rows.push({ kind: 'section', label: 'Światła' });
  rows.push({ kind: 'item', id: 'light', label: 'Key Light', icon: '💡', depth: 1 });

  rows.push({ kind: 'section', label: 'Kamery' });
  cameras.forEach((c, i) => {
    rows.push({
      kind: 'camera',
      id: c.id,
      label: c.name,
      depth: 1,
      hint: c.id === activeCam ? 'aktywna' : undefined,
      canUp: i > 0,
      canDown: i < cameras.length - 1,
      canRemove: cameras.length > 1,
    });
  });
  rows.push({ kind: 'add-camera' });

  return (
    <div className="outliner">
      {rows.map((r, i) => {
        if (r.kind === 'section') {
          return (
            <div key={`s${i}`} className="outliner__section">
              {r.label}
            </div>
          );
        }
        if (r.kind === 'add-camera') {
          return (
            <button
              type="button"
              key={`add${i}`}
              className="outliner__add"
              onClick={() => addCamera()}
            >
              + dodaj kamerę
            </button>
          );
        }
        if (r.kind === 'camera') {
          const isSel = selected === `cam:${r.id}`;
          return (
            <div
              key={`cam:${r.id}`}
              className={`outliner__row outliner__row--camera ${isSel ? 'is-selected' : ''}`}
              style={{ paddingLeft: 10 + r.depth * 18 }}
            >
              <button
                type="button"
                className="outliner__main"
                onClick={() => setSelected(`cam:${r.id}`)}
              >
                <span className="outliner__icon">📷</span>
                <span className="outliner__label">{r.label}</span>
                {r.hint && <span className="outliner__hint">{r.hint}</span>}
              </button>
              <div className="outliner__ops">
                <button
                  type="button"
                  className="outliner__op"
                  disabled={!r.canUp}
                  title="W górę"
                  onClick={() => moveCamera(r.id, 'up')}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="outliner__op"
                  disabled={!r.canDown}
                  title="W dół"
                  onClick={() => moveCamera(r.id, 'down')}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="outliner__op outliner__op--danger"
                  disabled={!r.canRemove}
                  title="Usuń"
                  onClick={() => removeCamera(r.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        }
        // r.kind === 'item' — aktor (model) dostaje przycisk usunięcia (✕)
        if (r.id === 'actor') {
          return (
            <div
              key={r.id}
              className={`outliner__row outliner__row--camera ${selected === 'actor' ? 'is-selected' : ''}`}
              style={{ paddingLeft: 10 + r.depth * 18 }}
            >
              <button type="button" className="outliner__main" onClick={() => setSelected('actor')}>
                <span className="outliner__icon">{r.icon}</span>
                <span className="outliner__label">{r.label}</span>
                {r.hint && <span className="outliner__hint">{r.hint}</span>}
              </button>
              <div className="outliner__ops">
                <button
                  type="button"
                  className="outliner__op outliner__op--danger"
                  title="Usuń model ze sceny"
                  onClick={() => {
                    removeModel();
                    if (selected === 'actor') setSelected('hero');
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        }
        return (
          <button
            type="button"
            key={r.id}
            className={`outliner__row ${selected === r.id ? 'is-selected' : ''}`}
            style={{ paddingLeft: 10 + r.depth * 18 }}
            onClick={() => setSelected(r.id)}
          >
            <span className="outliner__icon">{r.icon}</span>
            <span className="outliner__label">{r.label}</span>
            {r.hint && <span className="outliner__hint">{r.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
