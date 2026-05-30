// lib/scenes/repo.ts
import { eq, and, sql } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { db } from '@/lib/db';
import { scenes } from './schema';
import type { SceneRecord, CreateSceneInput, UpdateSceneInput } from './types';

// Re-eksport typów domeny scen — by można je importować także z `@/lib/scenes/repo`
// (Etapy C i D korzystają z tej ścieżki).
export type { SceneRecord, CreateSceneInput, UpdateSceneInput } from './types';

/** Tworzy nową scenę w DB. Zwraca pełny SceneRecord. */
export async function createScene(
  ownerId: string,
  input: CreateSceneInput
): Promise<SceneRecord> {
  const rows = await db
    .insert(scenes)
    .values({
      ownerId,
      title: input.title,
      config: input.config as any,
      modelBlobUrl: input.modelBlobUrl ?? null,
      modelFileName: input.modelFileName ?? null,
      thumbBlobUrl: input.thumbBlobUrl ?? null,
      isPreset: input.isPreset ?? false,
    })
    .returning();

  return rowToRecord(rows[0]);
}

/** Pobiera pojedynczą scenę po id. Zwraca null jeśli nie istnieje. */
export async function getScene(id: string): Promise<SceneRecord | null> {
  const rows = await db
    .select()
    .from(scenes)
    .where(eq(scenes.id, id));

  return rows[0] ? rowToRecord(rows[0]) : null;
}

/**
 * Lista scen właściciela.
 * preset=false → tylko własne (nie-presetowe); preset=true → tylko presety.
 * Domyślnie zwraca nie-presetowe (Etap C doda dedykowane trasy presetów).
 */
export async function listScenes(
  ownerId: string,
  opts: { preset: boolean } = { preset: false }
): Promise<SceneRecord[]> {
  const rows = await db
    .select()
    .from(scenes)
    .where(
      and(
        eq(scenes.ownerId, ownerId),
        eq(scenes.isPreset, opts.preset)
      )
    );

  return rows.map(rowToRecord);
}

/**
 * Aktualizuje scenę (tytuł, config lub miniatura).
 * Automatycznie ustawia updatedAt = now().
 * Zwraca null jeśli scena nie istnieje (nie rzuca wyjątku).
 */
export async function updateScene(
  id: string,
  patch: UpdateSceneInput
): Promise<SceneRecord | null> {
  const rows = await db
    .update(scenes)
    .set({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.config !== undefined && { config: patch.config as any }),
      ...(patch.thumbBlobUrl !== undefined && { thumbBlobUrl: patch.thumbBlobUrl }),
      updatedAt: new Date(),
    })
    .where(eq(scenes.id, id))
    .returning();

  return rows[0] ? rowToRecord(rows[0]) : null;
}

/**
 * Usuwa scenę z DB oraz pliki z Vercel Blob (ref-count dla modelu).
 *
 * Miniatura jest kasowana zawsze.
 * Model kasowany tylko gdy żadna inna scena nie współdzieli tego URL-a
 * (klon presetu z Etapu C będzie współdzielić URL modelu).
 *
 * Jeśli scena nie istnieje — funkcja kończy się cicho (idempotent).
 */
export async function deleteScene(id: string): Promise<void> {
  const scene = await getScene(id);
  if (!scene) return;

  // Ref-count: ile innych scen używa tego samego model_blob_url?
  let sharedModelCount = 0;
  if (scene.modelBlobUrl) {
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(scenes)
      .where(
        and(
          eq(scenes.modelBlobUrl, scene.modelBlobUrl),
          sql`${scenes.id} != ${id}`
        )
      );
    sharedModelCount = Number(countRows[0]?.count ?? 0);
  }

  // Usuń rekord z DB.
  await db.delete(scenes).where(eq(scenes.id, id));

  // Usuń miniatury z Blob (zawsze).
  if (scene.thumbBlobUrl) {
    await del(scene.thumbBlobUrl);
  }

  // Usuń model z Blob (tylko gdy nie współdzielony).
  if (scene.modelBlobUrl && sharedModelCount === 0) {
    await del(scene.modelBlobUrl);
  }
}

// ─── Mapper ────────────────────────────────────────────────────────────────

function rowToRecord(row: typeof scenes.$inferSelect): SceneRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    config: row.config as any,
    modelBlobUrl: row.modelBlobUrl ?? null,
    modelFileName: row.modelFileName ?? null,
    thumbBlobUrl: row.thumbBlobUrl ?? null,
    isPreset: row.isPreset,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
