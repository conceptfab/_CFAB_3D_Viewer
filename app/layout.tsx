import type { Metadata } from 'next';
import '@/components/styles.css';

export const metadata: Metadata = {
  title: 'CFAB 3D Viewer',
  description: 'Furniture 3D visualization tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
