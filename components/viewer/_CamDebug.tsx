'use client';
// TEMPORARY DEBUG INSTRUMENTATION — remove after diagnosing camera framing.
// Renders a live readout of each viewport camera's fov / aspect / size / position
// so we can compare the FINAL view vs the EDITOR view for the same active camera.

import { create } from 'zustand';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

export interface CamProbeData {
  type: string;
  fov: number;
  zoom: number;
  aspect: number;
  w: number;
  h: number;
  pos: [number, number, number];
}

interface DebugState {
  probes: Record<string, CamProbeData>;
  set: (k: string, p: CamProbeData) => void;
}

export const useCamDebug = create<DebugState>((set) => ({
  probes: {},
  set: (k, p) => set((s) => ({ probes: { ...s.probes, [k]: p } })),
}));

const r = (n: number) => Math.round(n * 100) / 100;

/** Mount inside a <Canvas>. Reports the live default camera each frame (throttled). */
export function CamProbe({ label }: { label: string }) {
  const set = useCamDebug((s) => s.set);
  const last = useRef('');
  useFrame(({ camera, size }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = camera as any;
    const data: CamProbeData = {
      type: c.type,
      fov: c.fov != null ? r(c.fov) : -1,
      zoom: c.zoom != null ? r(c.zoom) : -1,
      aspect: c.aspect != null ? r(c.aspect) : -1,
      w: Math.round(size.width),
      h: Math.round(size.height),
      pos: [r(c.position.x), r(c.position.y), r(c.position.z)],
    };
    const key = JSON.stringify(data);
    if (key !== last.current) {
      last.current = key;
      set(label, data);
    }
  });
  return null;
}

/** Mount once outside the canvases (in App). Fixed overlay listing all probes. */
export function CamDebugHud() {
  const probes = useCamDebug((s) => s.probes);
  const lines = Object.entries(probes).map(
    ([k, p]) =>
      `${k.padEnd(6)} ${p.type} fov=${p.fov} zoom=${p.zoom} aspect=${p.aspect} px=${p.w}x${p.h} pos=[${p.pos.join(', ')}]`,
  );
  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        background: 'rgba(0,0,0,0.85)',
        color: '#39ff14',
        font: '11px/1.5 ui-monospace, Menlo, monospace',
        padding: '6px 10px',
        borderRadius: 6,
        whiteSpace: 'pre',
        pointerEvents: 'none',
        border: '1px solid #39ff14',
      }}
    >
      {lines.length ? lines.join('\n') : 'CamDebug: waiting for cameras…'}
    </div>
  );
}
