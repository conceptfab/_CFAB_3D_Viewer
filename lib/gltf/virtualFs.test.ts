// lib/gltf/virtualFs.test.ts
import { describe, it, expect } from 'vitest';
import type { VirtualFs, VirtualFile } from './types';
import { findModelRoots, pickDefaultRoot } from './virtualFs';
import { toKey } from './paths';

/** Buduje VFS z listy ścieżek (zawartość nieistotna dla wykrycia roota). */
function fsOf(paths: string[]): VirtualFs {
  const m: VirtualFs = new Map();
  for (const p of paths) {
    const vf: VirtualFile = { path: p, blob: new Blob([]), size: 0 };
    m.set(toKey(p), vf);
  }
  return m;
}

describe('findModelRoots', () => {
  it('znajduje pojedynczy .gltf, ignorując tekstury i śmieci', () => {
    const fs = fsOf(['scene.gltf', 'scene.bin', 'textures/t.png', '.DS_Store']);
    expect(findModelRoots(fs)).toEqual(['scene.gltf']);
  });

  it('znajduje .glb w podkatalogu source (układ Sketchfab)', () => {
    const fs = fsOf(['source/model.glb', 'textures/a.png', 'textures/b.png']);
    expect(findModelRoots(fs)).toEqual(['source/model.glb']);
  });

  it('przy wielu kandydatach sortuje płycej-w-drzewie najpierw', () => {
    const fs = fsOf(['sub/b.gltf', 'a.glb']);
    expect(findModelRoots(fs)).toEqual(['a.glb', 'sub/b.gltf']);
  });

  it('zwraca pustą listę gdy brak modelu', () => {
    expect(findModelRoots(fsOf(['textures/a.png']))).toEqual([]);
  });
});

describe('pickDefaultRoot', () => {
  it('zwraca pierwszego kandydata lub null', () => {
    expect(pickDefaultRoot(['a.glb', 'sub/b.gltf'])).toBe('a.glb');
    expect(pickDefaultRoot([])).toBeNull();
  });
});
