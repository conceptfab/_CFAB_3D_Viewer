import { requireAdmin } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import AdminPanel from './AdminPanel';

export default async function AdminPage() {
  await requireAdmin();

  const allUsers = await db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt));

  return <AdminPanel initialUsers={allUsers} />;
}
