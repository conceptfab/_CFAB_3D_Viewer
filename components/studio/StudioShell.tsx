// components/studio/StudioShell.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StudioViewport } from './StudioViewport';
import { ViewToggle, type StudioMode } from './ViewToggle';
import { AssetDropzone } from './AssetDropzone';
import { PresetPicker } from './PresetPicker';
import { Outliner } from '../ui/Outliner';
import { Inspector } from '../ui/Inspector';
import { saveProject } from './saveProject';
import { useStore } from '../store';

export function StudioShell({ projectId, initialTitle }: { projectId?: string; initialTitle?: string }) {
  const [mode, setMode] = useState<StudioMode>('edit');
  const [title, setTitle] = useState(initialTitle ?? 'Nowy model');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pid, setPid] = useState(projectId);

  useEffect(() => () => useStore.getState().setStudioImport(null), []);

  async function handleSave() {
    const st = useStore.getState();
    if (!st.studioVfs || !st.studioRoot) { setToast('Najpierw wczytaj model.'); return; }
    if (!st.glRef) { setToast('Renderer niedostępny.'); return; }
    setBusy(true);
    try {
      const { id } = await saveProject({
        projectId: pid,
        title,
        vfs: st.studioVfs,
        rootKey: st.studioRoot,
        config: st.config,
        glRef: st.glRef,
      });
      setToast('Zapisano.');
      if (!pid) {
        setPid(id);
        window.history.replaceState(null, '', `/studio/${id}`);
      }
    } catch (e) { setToast(e instanceof Error ? e.message : 'Błąd zapisu.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="studio-layout">
      <header className="studio-toolbar">
        <Link href="/" className="studio-back">&#8592; Sceny</Link>
        <input
          className="studio-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Tytuł projektu"
        />
        <ViewToggle mode={mode} onChange={setMode} />
        <AssetDropzone />
        <PresetPicker />
        <button type="button" onClick={handleSave} disabled={busy}>Zapisz</button>
      </header>
      <main className="studio-viewport"><StudioViewport mode={mode} /></main>
      <aside className="studio-panel"><Outliner /><Inspector /></aside>
      {toast && <div className="save-toast" role="status">{toast}</div>}
    </div>
  );
}
