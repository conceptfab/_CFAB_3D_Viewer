// components/EditorShell.tsx
// Cienki wrapper renderujący edytor (App). Zapis sceny/presetu jest teraz w nagłówku
// panelu (App + SaveSceneDialog) — bez pływających nakładek.
'use client';

import dynamic from 'next/dynamic';

const EditorApp = dynamic(() => import('@/components/App'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#f5f5f4' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2a8a66', animation: 'pulse 1.4s ease-in-out infinite' }} />
    </div>
  ),
});

interface EditorShellProps {
  /** Czy zalogowany użytkownik jest adminem (pokazuje „Jako preset") */
  isAdmin: boolean;
  // Poniższe pozostają dla zgodności z wywołaniem strony, ale nie są już używane
  // (zapis presetu robi SaveSceneDialog w App, uploadując model jak przy zapisie sceny).
  modelBlobUrl?: string | null;
  modelFileName?: string | null;
  thumbBlobUrl?: string | null;
  sceneTitle?: string;
}

export function EditorShell({ isAdmin }: EditorShellProps) {
  return <EditorApp isAdmin={isAdmin} />;
}
