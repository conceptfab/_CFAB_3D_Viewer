// components/studio/StudioProjectLoader.tsx
'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useStore, normalizeConfig } from '../store';
import { openProjectSource } from './openProject';
import type { StudioProjectRecord } from '@/lib/studio/types';

const Shell = dynamic(() => import('./StudioShell').then((m) => m.StudioShell), { ssr: false });

export function StudioProjectLoader({ project }: { project: StudioProjectRecord }) {
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    useStore.setState({ config: normalizeConfig(project.config) });
    openProjectSource(project)
      .then(({ scene, vfs, root, dispose }) => {
        useStore.getState().setStudioImport({ scene, vfs, root, dispose });
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Błąd otwarcia.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);
  if (err) return <div style={{ padding: 24 }}>Nie udało się otworzyć projektu: {err}</div>;
  return <Shell projectId={project.id} initialTitle={project.title} />;
}
