// lib/scenes/repo.ts
import { eq, and, ne } from 'drizzle-orm';
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
    sharedModelCount = await countModelReferences(scene.modelBlobUrl, id);
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

/**
 * Zwraca wszystkie presety (is_preset=true) — globalne, widoczne dla każdego zalogowanego.
 */
export async function listAllPresets(): Promise<SceneRecord[]> {
  const rows = await db
    .select()
    .from(scenes)
    .where(eq(scenes.isPreset, true));

  return rows.map(rowToRecord);
}

// ─── NOWE W ETAPIE C ─────────────────────────────────────────────────────────

/**
 * Zlicza ile scen w DB wskazuje na dany model_blob_url (poza podanym sceneId).
 * Używane przez DELETE do decyzji o skasowaniu pliku z Blob (ref-count).
 */
export async function countModelReferences(
  modelBlobUrl: string,
  excludeSceneId: string
): Promise<number> {
  const rows = await db
    .select({ id: scenes.id })
    .from(scenes)
    .where(
      and(
        eq(scenes.modelBlobUrl, modelBlobUrl),
        ne(scenes.id, excludeSceneId)
      )
    );
  return rows.length;
}

/**
 * Klonuje preset na nową scenę należącą do `newOwnerId`.
 * - Nowa scena: is_preset=false, owner_id=newOwnerId
 * - Współdzieli model_blob_url, model_file_name i thumb_blob_url (nie kopiuje pliku w Blob)
 * - Tytuł klonu: `${preset.title} (kopia)`
 *
 * Rzuca Error jeśli rekord nie istnieje lub nie jest presetem.
 */
export async function instantiatePreset(
  presetId: string,
  newOwnerId: string
): Promise<SceneRecord> {
  // 1. Wczytaj preset
  const rows = await db
    .select()
    .from(scenes)
    .where(eq(scenes.id, presetId));

  if (rows.length === 0) {
    throw new Error('Preset nie istnieje');
  }

  const preset = rows[0];

  if (!preset.isPreset) {
    throw new Error('Scena nie jest presetem');
  }

  // 2. Wstaw klon
  const now = new Date();
  const [inserted] = await db
    .insert(scenes)
    .values({
      ownerId: newOwnerId,
      title: `${preset.title} (kopia)`,
      config: preset.config,
      modelBlobUrl: preset.modelBlobUrl,        // współdzielony URL — bez duplikowania pliku
      modelFileName: preset.modelFileName,
      thumbBlobUrl: preset.thumbBlobUrl,        // współdzielony — decyzja 3: kopiuj URL
      isPreset: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return rowToRecord(inserted);
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
