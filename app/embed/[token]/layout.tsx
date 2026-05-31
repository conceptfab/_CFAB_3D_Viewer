// app/embed/[token]/layout.tsx
// Isolated layout for embed pages — does NOT inherit the global app/layout.tsx.
// This means no global CSS import; the embed page gets a clean, zero-margin shell
// suitable for dropping straight into a cross-origin <iframe>.
//
// Styles needed by ReadOnlyViewer (.read-only-viewer, .branding, .viewport-bar)
// are imported from components/styles.css here so they are available.

import type { ReactNode } from 'react';
import '@/components/styles.css';

export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <style>{`
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; overflow: hidden; background: #dcdde0; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
