// app/dev/gltf-import/page.tsx
'use client';
import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import * as THREE from 'three';
import { fromDataTransfer, fromFileList, fromZip } from '@/lib/gltf/extract';
import { findModelRoots, pickDefaultRoot } from '@/lib/gltf/virtualFs';
import { validateGltf } from '@/lib/gltf/validate';
import { loadFromFiles } from '@/lib/gltf/loadFromFiles';
import type { ValidationReport, VirtualFs } from '@/lib/gltf/types';

export default function GltfImportDevPage() {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [obj, setObj] = useState<THREE.Group | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleFs(fs: VirtualFs) {
    setErr(null); setObj(null); setReport(null);
    const root = pickDefaultRoot(findModelRoots(fs));
    if (!root) { setErr('Brak pliku .gltf/.glb w wejściu.'); return; }
    const rep = await validateGltf(fs, root);
    setReport(rep);
    if (!rep.ok) return;
    try {
      const { scene } = await loadFromFiles(fs, root);
      setObj(scene);
    } catch (e) { setErr(`Ładowanie nieudane: ${(e as Error).message}`); }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', height: '100vh' }}>
      <aside style={{ padding: 16, overflow: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
        <h3>glTF import — DEV</h3>
        <p>Przeciągnij folder lub .zip tutaj, albo wybierz folder:</p>
        <input
          type="file"
          // @ts-expect-error webkitdirectory nie jest w typach React
          webkitdirectory=""
          multiple
          onChange={(e) => e.target.files && handleFs(fromFileList(e.target.files))}
        />
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            try {
              const dt = e.dataTransfer;
              const file = dt.files?.[0];
              if (file && file.name.toLowerCase().endsWith('.zip')) handleFs(await fromZip(file));
              else handleFs(await fromDataTransfer(dt.items));
            } catch (err) {
              setErr(`Nie udało się odczytać wejścia: ${(err as Error).message}`);
            }
          }}
          style={{ marginTop: 12, padding: 24, border: '2px dashed #888', textAlign: 'center' }}
        >
          drop folder / .zip
        </div>
        {err && <pre style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>{err}</pre>}
        {report && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(report, null, 2)}</pre>}
      </aside>
      <main>
        <Canvas camera={{ position: [3, 2, 4] }}>
          <color attach="background" args={['#202227']} />
          {obj ? (
            <Stage environment="city" intensity={0.5}>
              <primitive object={obj} />
            </Stage>
          ) : null}
          <OrbitControls />
        </Canvas>
      </main>
    </div>
  );
}
