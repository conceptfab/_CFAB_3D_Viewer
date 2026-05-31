// components/EditorShell.tsx
// Thin client wrapper that renders the full editor App and overlays
// the admin-only SaveAsPresetButton in the bottom-right corner.
'use client';

import dynamic from 'next/dynamic';
import { useStore } from '@/components/store';
import { SaveAsPresetButton } from '@/components/SaveAsPresetButton';

const EditorApp = dynamic(() => import('@/components/App'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#f5f5f4' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2a8a66', animation: 'pulse 1.4s ease-in-out infinite' }} />
    </div>
  ),
});

interface EditorShellProps {
  /** Czy zalogowany użytkownik jest adminem */
  isAdmin: boolean;
  modelBlobUrl: string | null;
  modelFileName: string | null;
  thumbBlobUrl: string | null;
  sceneTitle: string;
}

export function EditorShell({
  isAdmin,
  modelBlobUrl,
  modelFileName,
  thumbBlobUrl,
  sceneTitle,
}: EditorShellProps) {
  const config = useStore((s) => s.config);

  return (
    <>
      <EditorApp />
      {isAdmin && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 100,
          }}
        >
          <SaveAsPresetButton
            config={config}
            modelBlobUrl={modelBlobUrl}
            modelFileName={modelFileName}
            thumbBlobUrl={thumbBlobUrl}
            defaultTitle={sceneTitle}
          />
        </div>
      )}
    </>
  );
}
