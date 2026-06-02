// components/studio/RootPicker.tsx
'use client';
export function RootPicker({ roots, onPick }: { roots: string[]; onPick: (r: string) => void }) {
  return (
    <div className="root-picker">
      <p>Wykryto kilka plików modelu — wybierz główny:</p>
      <ul>{roots.map((r) => <li key={r}><button type="button" onClick={() => onPick(r)}>{r}</button></li>)}</ul>
    </div>
  );
}
