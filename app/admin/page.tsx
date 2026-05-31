import { requireAdmin } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import AdminPanel from './AdminPanel';
import { TopNav } from '@/components/TopNav';
import { findOrphanedBlobs, type OrphanReport } from '@/lib/scenes/blobAudit';

export default async function AdminPage() {
  const admin = await requireAdmin();

  const allUsers = await db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt));

  // Skan osieroconych plików przy wejściu. W try/catch — brak BLOB_READ_WRITE_TOKEN
  // lub błąd Blob NIE może zablokować całego panelu (lista użytkowników ma działać).
  let initialOrphans: OrphanReport | null = null;
  let initialOrphansError: string | null = null;
  try {
    initialOrphans = await findOrphanedBlobs();
  } catch (e) {
    initialOrphansError = e instanceof Error ? e.message : 'Skan Blob nieudany.';
  }

  return (
    <>
      <TopNav isAdmin email={admin.email} active="admin" />
      <AdminPanel
        initialUsers={allUsers}
        initialOrphans={initialOrphans}
        initialOrphansError={initialOrphansError}
      />
    </>
  );
}
