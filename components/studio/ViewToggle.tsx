// components/studio/ViewToggle.tsx
'use client';
export type StudioMode = 'edit' | 'render';
export function ViewToggle({ mode, onChange }: { mode: StudioMode; onChange: (m: StudioMode) => void }) {
  return (
    <div className="studio-toggle" role="tablist" aria-label="Tryb widoku">
      <button type="button" role="tab" aria-selected={mode === 'edit'} className={mode === 'edit' ? 'is-active' : ''} onClick={() => onChange('edit')}>Edycja</button>
      <button type="button" role="tab" aria-selected={mode === 'render'} className={mode === 'render' ? 'is-active' : ''} onClick={() => onChange('render')}>Render</button>
    </div>
  );
}
