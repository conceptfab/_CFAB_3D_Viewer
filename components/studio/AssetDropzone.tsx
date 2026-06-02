// components/studio/AssetDropzone.tsx
'use client';
import { useRef, useState } from 'react';
import { fromDataTransfer, fromFileList, fromZip } from '@/lib/gltf/extract';
import { findModelRoots, pickDefaultRoot } from '@/lib/gltf/virtualFs';
import { validateGltf } from '@/lib/gltf/validate';
import { loadFromFiles } from '@/lib/gltf/loadFromFiles';
import type { VirtualFs, ValidationReport } from '@/lib/gltf/types';
import * as THREE from 'three';
import { useStore } from '../store';
import { ImportReport } from './ImportReport';
import { RootPicker } from './RootPicker';

export function AssetDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [vfs, setVfs] = useState<VirtualFs | null>(null);
  const [roots, setRoots] = useState<string[]>([]);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const setStudioImport = useStore((s) => s.setStudioImport);
  const setModelError = useStore((s) => s.setModelError);

  async function ingest(fs: VirtualFs) {
    setReport(null); setVfs(fs);
    const found = findModelRoots(fs);
    setRoots(found);
    const root = pickDefaultRoot(found);
    if (!root) { setModelError('Brak pliku .gltf/.glb w wejściu.'); return; }
    await validateAndMaybeLoad(fs, root);
  }

  async function validateAndMaybeLoad(fs: VirtualFs, root: string) {
    setBusy(true);
    try {
      const rep = await validateGltf(fs, root);
      setReport(rep);
      if (rep.ok) {
        const { scene, dispose } = await loadFromFiles(fs, root);
        setStudioImport({ scene: scene as THREE.Group, vfs: fs, root, dispose });
      }
    } catch (e) {
      setModelError(`Wczytanie nieudane: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`asset-dropzone ${dragging ? 'is-drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (e) => {
        e.preventDefault(); setDragging(false);
        try {
          const f = e.dataTransfer.files?.[0];
          if (f && f.name.toLowerCase().endsWith('.zip')) await ingest(await fromZip(f));
          else await ingest(await fromDataTransfer(e.dataTransfer.items));
        } catch (err) { setModelError(`Odczyt wejścia nieudany: ${(err as Error).message}`); }
      }}>
      <input ref={inputRef} type="file" multiple
        // @ts-expect-error webkitdirectory nie jest w typach React
        webkitdirectory=""
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files) ingest(fromFileList(e.target.files)); e.target.value = ''; }} />
      <button type="button" onClick={() => inputRef.current?.click()}>Wczytaj folder modelu</button>
      <span className="asset-dropzone__hint">albo przeciągnij folder / .zip tutaj</span>
      {busy && <span> — przetwarzanie…</span>}
      {roots.length > 1 && vfs && <RootPicker roots={roots} onPick={(r) => validateAndMaybeLoad(vfs, r)} />}
      {report && <ImportReport report={report} />}
    </div>
  );
}
