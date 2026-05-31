import { requireAdmin } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import AdminPanel from './AdminPanel';
import { TopNav } from '@/components/TopNav';

export default async function AdminPage() {
  const admin = await requireAdmin();

  const allUsers = await db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt));

  return (
    <>
      <TopNav isAdmin email={admin.email} active="admin" />
      <AdminPanel initialUsers={allUsers} />
    </>
  );
}
