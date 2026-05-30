'use client';

import dynamic from 'next/dynamic';

const EditorApp = dynamic(() => import('@/components/App'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#f5f5f4' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2a8a66', animation: 'pulse 1.4s ease-in-out infinite' }} />
    </div>
  ),
});

export default function EditorPage() {
  return <EditorApp />;
}
