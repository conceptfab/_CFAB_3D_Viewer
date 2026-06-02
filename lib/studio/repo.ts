// lib/studio/repo.ts
import { eq, desc } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { db } from '@/lib/db';
import { studioProjects } from './schema';
import type { StudioProjectRecord, CreateStudioProjectInput, UpdateStudioProjectInput, SourceKind } from './types';

export type { StudioProjectRecord, CreateStudioProjectInput, UpdateStudioProjectInput } from './types';

export async function createProject(
  ownerId: string,
  input: CreateStudioProjectInput
): Promise<StudioProjectRecord> {
  const rows = await db
    .insert(studioProjects)
    .values({
      ownerId,
      title: input.title,
      sourceBlobUrl: input.sourceBlobUrl,
      sourceFileName: input.sourceFileName,
      sourceKind: input.sourceKind,
      config: input.config as unknown as Record<string, unknown>,
      thumbBlobUrl: input.thumbBlobUrl ?? null,
    })
    .returning();
  return rowToRecord(rows[0]);
}

export async function getProject(id: string): Promise<StudioProjectRecord | null> {
  const rows = await db.select().from(studioProjects).where(eq(studioProjects.id, id));
  return rows[0] ? rowToRecord(rows[0]) : null;
}

/** Projekty właściciela, najnowsze pierwsze. */
export async function listProjects(ownerId: string): Promise<StudioProjectRecord[]> {
  const rows = await db
    .select()
    .from(studioProjects)
    .where(eq(studioProjects.ownerId, ownerId))
    .orderBy(desc(studioProjects.updatedAt));
  return rows.map(rowToRecord);
}

/** Aktualizuje projekt; ustawia updatedAt=now(). Zwraca null gdy nie istnieje. */
export async function updateProject(
  id: string,
  patch: UpdateStudioProjectInput
): Promise<StudioProjectRecord | null> {
  const rows = await db
    .update(studioProjects)
    .set({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.config !== undefined && { config: patch.config as unknown as Record<string, unknown> }),
      ...(patch.thumbBlobUrl !== undefined && { thumbBlobUrl: patch.thumbBlobUrl }),
      ...(patch.sourceBlobUrl !== undefined && { sourceBlobUrl: patch.sourceBlobUrl }),
      ...(patch.sourceFileName !== undefined && { sourceFileName: patch.sourceFileName }),
      ...(patch.sourceKind !== undefined && { sourceKind: patch.sourceKind }),
      updatedAt: new Date(),
    })
    .where(eq(studioProjects.id, id))
    .returning();
  return rows[0] ? rowToRecord(rows[0]) : null;
}

/**
 * Usuwa projekt + jego pliki Blob (źródło i miniatura są PER-PROJEKT, nie współdzielone,
 * więc kasujemy bez ref-count). Kasowanie Blob jest best-effort (błąd nie wywala DELETE).
 * Ciche gdy projekt nie istnieje.
 */
export async function deleteProject(id: string): Promise<void> {
  const project = await getProject(id);
  if (!project) return;
  await db.delete(studioProjects).where(eq(studioProjects.id, id));
  try {
    await del(project.sourceBlobUrl);
    if (project.thumbBlobUrl) await del(project.thumbBlobUrl);
  } catch (err) {
    console.warn(`[deleteProject] czyszczenie Blob nieudane dla ${id} (rekord usunięty):`, err);
  }
}

/** Wszystkie niepuste source+thumb URL-e ze WSZYSTKICH projektów (dla audytu sierot). */
export async function getStudioReferencedBlobUrls(): Promise<Set<string>> {
  const rows = await db
    .select({ source: studioProjects.sourceBlobUrl, thumb: studioProjects.thumbBlobUrl })
    .from(studioProjects);
  const urls = new Set<string>();
  for (const row of rows) {
    if (row.source) urls.add(row.source);
    if (row.thumb) urls.add(row.thumb);
  }
  return urls;
}

function rowToRecord(row: typeof studioProjects.$inferSelect): StudioProjectRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    sourceBlobUrl: row.sourceBlobUrl,
    sourceFileName: row.sourceFileName,
    sourceKind: row.sourceKind as SourceKind,
    config: row.config as StudioProjectRecord['config'],
    thumbBlobUrl: row.thumbBlobUrl ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
