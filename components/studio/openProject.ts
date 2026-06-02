// components/studio/openProject.ts
'use client';
import { rebuildVfsFromSource } from '@/lib/studio/sourceArtifact';
import { findModelRoots, pickDefaultRoot } from '@/lib/gltf/virtualFs';
import { loadFromFiles } from '@/lib/gltf/loadFromFiles';
import type { StudioProjectRecord } from '@/lib/studio/types';
import type { VirtualFs } from '@/lib/gltf/types';
import type * as THREE from 'three';

export async function openProjectSource(project: StudioProjectRecord): Promise<{ scene: THREE.Group; vfs: VirtualFs; root: string }> {
  const res = await fetch(project.sourceBlobUrl);
  if (!res.ok) throw new Error(`Nie udało się pobrać źródła: ${res.status}`);
  const blob = await res.blob();
  const vfs = await rebuildVfsFromSource(blob, project.sourceKind, project.sourceFileName);
  const root = pickDefaultRoot(findModelRoots(vfs));
  if (!root) throw new Error('Źródło nie zawiera pliku modelu.');
  const { scene } = await loadFromFiles(vfs, root);
  return { scene: scene as THREE.Group, vfs, root };
}
