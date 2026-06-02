// lib/studio/sourceArtifact.ts
import { zipSync, unzipSync } from 'fflate';
import type { VirtualFs, VirtualFile } from '@/lib/gltf/types';
import type { SourceKind } from './types';
import { extOf, toKey, isJunkPath } from '@/lib/gltf/paths';

export interface SourceArtifact {
  blob: Blob;
  kind: SourceKind;
  /** Nazwa pliku artefaktu (do source_file_name). */
  fileName: string;
}

/** Z VFS + roota buduje JEDEN artefakt źródła: single .glb przepuszczony,
 *  multi-file spakowany do .zip (zachowuje oryginalne ścieżki względne). */
export async function buildSourceArtifact(fs: VirtualFs, rootKey: string): Promise<SourceArtifact> {
  const root = fs.get(rootKey);
  if (!root) throw new Error(`Brak roota w VFS: ${rootKey}`);

  if (fs.size === 1 && extOf(rootKey) === '.glb') {
    return { blob: root.blob, kind: 'glb', fileName: baseName(root.path) };
  }

  const entries: Record<string, Uint8Array> = {};
  for (const vf of fs.values()) {
    entries[vf.path] = new Uint8Array(await vf.blob.arrayBuffer());
  }
  const zipped = zipSync(entries);
  const zipName = `${stripExt(baseName(root.path))}.zip`;
  return { blob: new Blob([zipped as BlobPart], { type: 'application/zip' }), kind: 'gltf-zip', fileName: zipName };
}

/** Odtwarza VFS z pobranego artefaktu źródła (do ponownej edycji). */
export async function rebuildVfsFromSource(
  blob: Blob,
  kind: SourceKind,
  glbFileName = 'model.glb'
): Promise<VirtualFs> {
  const fs: VirtualFs = new Map();
  if (kind === 'glb') {
    const vf: VirtualFile = { path: glbFileName, blob, size: blob.size };
    fs.set(toKey(glbFileName), vf);
    return fs;
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const unzipped = unzipSync(bytes);
  for (const [path, data] of Object.entries(unzipped)) {
    if (path.endsWith('/') || isJunkPath(path)) continue;
    const b = new Blob([data as BlobPart]);
    fs.set(toKey(path), { path, blob: b, size: b.size });
  }
  return fs;
}

function baseName(p: string): string {
  const i = p.replace(/\\/g, '/').lastIndexOf('/');
  return i === -1 ? p : p.slice(i + 1);
}
function stripExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? name : name.slice(0, i);
}
