// app/studio/[id]/page.tsx
import { requireUser } from '@/lib/auth/session';
import { getProject } from '@/lib/studio/repo';
import { notFound, redirect } from 'next/navigation';
import { StudioProjectLoader } from '@/components/studio/StudioProjectLoader';

export default async function StudioProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  if (project.ownerId !== user.id) redirect('/');
  return <StudioProjectLoader project={project} />;
}
