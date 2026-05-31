import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/components/styles.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CFAB 3D Viewer',
  description: 'Furniture 3D visualization tool',
};

// viewport-fit=cover — aktywuje env(safe-area-inset-*) na telefonach (notch /
// pasek gestów), aby dolny pasek menu trzymał się nad krawędzią ekranu.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
