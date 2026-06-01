// lib/gltf/virtualFs.ts
import type { VirtualFs } from './types';
import { extOf, isJunkPath } from './paths';

/** Klucze plików-rootów (.gltf/.glb), bez śmieci, posortowane:
 *  płycej w drzewie najpierw, potem alfabetycznie. */
export function findModelRoots(fs: VirtualFs): string[] {
  const roots: string[] = [];
  for (const key of fs.keys()) {
    if (isJunkPath(key)) continue;
    const e = extOf(key);
    if (e === '.gltf' || e === '.glb') roots.push(key);
  }
  return roots.sort((a, b) => {
    const da = a.split('/').length;
    const db = b.split('/').length;
    if (da !== db) return da - db;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/** Domyślny root: pierwszy kandydat (UI pozwala wybrać przy wielu). */
export function pickDefaultRoot(roots: string[]): string | null {
  return roots.length > 0 ? roots[0] : null;
}
