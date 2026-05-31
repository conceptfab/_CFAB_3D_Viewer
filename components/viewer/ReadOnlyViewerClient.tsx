'use client';

// components/viewer/ReadOnlyViewerClient.tsx
// Dynamic (ssr:false) wrapper around ReadOnlyViewer.
// Next.js Server Components cannot mount a WebGL Canvas; this wrapper ensures
// ReadOnlyViewer is only ever evaluated in the browser.

import dynamic from 'next/dynamic';
import type { ReadOnlyViewerProps } from './ReadOnlyViewer';

const ReadOnlyViewer = dynamic(
  () => import('./ReadOnlyViewer').then((m) => ({ default: m.ReadOnlyViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="read-only-viewer-loading">
        <span>Ładowanie sceny…</span>
      </div>
    ),
  },
);

export function ReadOnlyViewerClient(props: ReadOnlyViewerProps) {
  return <ReadOnlyViewer {...props} />;
}
