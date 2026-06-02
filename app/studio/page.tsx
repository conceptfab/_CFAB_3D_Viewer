// app/studio/page.tsx
import { requireUser } from '@/lib/auth/session';
import { StudioShell } from '@/components/studio/StudioShell';

export default async function StudioNewPage() {
  await requireUser();
  return <StudioShell />;
}
