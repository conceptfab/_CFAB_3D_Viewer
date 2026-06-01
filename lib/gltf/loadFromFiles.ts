// lib/gltf/loadFromFiles.ts
'use client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { VirtualFs } from './types';
import { dirOf, extOf, toKey } from './paths';

// Ten sam CDN dekodera Draco, którego domyślnie używa drei (useGLTF) — spójność.
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

export interface LoadFromFilesResult {
  scene: THREE.Group;
  /** Zwalnia object-URL-e i dekoder Draco. Wołać po wczytaniu / odmontowaniu. */
  dispose: () => void;
}

/**
 * Ładuje model glTF/glb z wirtualnego FS, mapując referencje URI → object-URL-e Blob.
 * Strategia: `loader.parse(content, baseDir, …)` z `manager.setURLModifier`, który
 * tłumaczy KAŻDY żądany URI (znormalizowany przez toKey) na object-URL z mapy.
 */
export async function loadFromFiles(fs: VirtualFs, rootKey: string): Promise<LoadFromFilesResult> {
  const objectUrls = new Map<string, string>();
  for (const [key, vf] of fs) objectUrls.set(key, URL.createObjectURL(vf.blob));

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    // Object-URL roota i już-zmapowane URL-e przepuszczamy bez zmian.
    if (url.startsWith('blob:')) return url;
    let u = url;
    try { u = decodeURIComponent(url); } catch { /* zostaw */ }
    return objectUrls.get(toKey(u)) ?? url;
  });

  const loader = new GLTFLoader(manager);
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);

  const root = fs.get(rootKey);
  if (!root) throw new Error(`Brak roota w VFS: ${rootKey}`);

  // baseDir z końcowym '/' → GLTFLoader rozwiązuje względne URI do pełnej ścieżki VFS.
  const baseDir = dirOf(rootKey);
  const path = baseDir === '' ? '' : `${baseDir}/`;

  const content: ArrayBuffer | string =
    extOf(rootKey) === '.glb' ? await root.blob.arrayBuffer() : await root.blob.text();

  const dispose = () => {
    for (const u of objectUrls.values()) URL.revokeObjectURL(u);
    draco.dispose();
  };

  try {
    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      loader.parse(content, path, resolve as (g: unknown) => void, reject);
    });
    return { scene: gltf.scene, dispose };
  } catch (e) {
    dispose();
    throw e;
  }
}
