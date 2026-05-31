// app/login/layout.tsx
// Layout serwerowy dla /login — strona logowania jest komponentem klienckim
// ('use client'), więc metadane SEO muszą być eksportowane stąd.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Logowanie — CFAB 3D Viewer',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
