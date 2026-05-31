// lib/scenes/readOnlyStore.ts
// Read-only store for public share/embed viewer pages.
// Each /s/[token] and /embed/[token] page creates its own isolated instance —
// completely decoupled from the editor's global useStore.

import { create } from 'zustand';
import type { SceneConfig } from '@/components/store';

interface ReadOnlyState {
  config: SceneConfig;
  modelUrl: string | null;
}

/**
 * Creates a new read-only zustand store pre-populated with the given scene
 * config and model URL.
 *
 * Usage: call once at the module level (or inside a React context initialiser)
 * and pass the returned hook down via props or context.
 * Do NOT call inside a render loop.
 */
export function createReadOnlyStore(config: SceneConfig, modelUrl: string | null) {
  return create<ReadOnlyState>()(() => ({
    config,
    modelUrl,
  }));
}
