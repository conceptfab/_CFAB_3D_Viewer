'use client';
// TEMP DEBUG ROUTE (public) — reproduces the real editor: BOTH canvases (Viewer +
// EditorView) with the real METRO.glb loaded via the store. Instrument blitFramebuffer
// in-page (preview_eval) to find which path blits depth/stencil + capture its stack.
// Delete after debugging (and remove public/METRO.glb).
import { useEffect, useState } from 'react';
import { Viewer } from '@/components/viewer/Viewer';
import { EditorView } from '@/components/viewer/EditorView';
import { ViewButtons } from '@/components/ui/ViewButtons';
import { useStore } from '@/components/store';

export default function GlBlitDebugPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (window as unknown as { __store: typeof useStore }).__store = useStore;
    useStore.getState().setLoadedModel({
      objectUrl: '/METRO.glb',
      fileName: 'METRO.glb',
      file: null,
    });
    setReady(true);
  }, []);

  if (!ready) return <div style={{ color: '#fff', padding: 20 }}>loading…</div>;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <div style={{ position: 'relative', background: '#dcdde0' }}>
        <Viewer />
      </div>
      <div style={{ position: 'relative', background: '#202227' }}>
        <ViewButtons />
        <EditorView />
      </div>
    </div>
  );
}
