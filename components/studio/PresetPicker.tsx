// components/studio/PresetPicker.tsx
'use client';
import { useEffect, useState } from 'react';
import { useStore, normalizeConfig } from '../store';
import type { SceneRecord } from '@/lib/scenes/types';

export function PresetPicker() {
  const [presets, setPresets] = useState<SceneRecord[]>([]);
  const [open, setOpen] = useState(false);
  const applyPreset = useStore((s) => s.applyPreset);

  useEffect(() => {
    if (!open || presets.length) return;
    fetch('/api/scenes?preset=1').then((r) => r.ok ? r.json() : []).then(setPresets).catch(() => setPresets([]));
  }, [open, presets.length]);

  return (
    <div className="preset-picker">
      <button type="button" onClick={() => setOpen((o) => !o)}>Wczytaj preset sceny</button>
      {open && (
        <ul className="preset-picker__list">
          {presets.length === 0 && <li>Brak presetów</li>}
          {presets.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => { applyPreset(normalizeConfig(p.config)); setOpen(false); }}>{p.title}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
