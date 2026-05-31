// lib/scenes/repo.ts
import { eq, and, ne, inArray, desc, or } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { db } from '@/lib/db';
import { scenes, scenePermissions } from './schema';
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
 * Aktualizuje scenę (tytuł, config, model lub miniatura).
 * Automatycznie ustawia updatedAt = now().
 * Pola modelu (modelBlobUrl/modelFileName) są utrwalane także gdy === null —
 * pozwala to wyczyścić model po jego usunięciu w edytorze.
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
      ...(patch.modelBlobUrl !== undefined && { modelBlobUrl: patch.modelBlobUrl }),
      ...(patch.modelFileName !== undefined && { modelFileName: patch.modelFileName }),
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

  // Usuń rekord z DB — to jest najważniejsze i musi się udać.
  await db.delete(scenes).where(eq(scenes.id, id));

  // Czyszczenie plików Blob jest BEST-EFFORT. Jeśli del() rzuci (np. plik leży
  // w skasowanym/innym store → „Vercel Blob: This store does not exist"), NIE
  // może to wywalić całego DELETE — rekord jest już usunięty. Logujemy i idziemy dalej.
  try {
    if (scene.thumbBlobUrl) await del(scene.thumbBlobUrl);
    if (scene.modelBlobUrl && sharedModelCount === 0) await del(scene.modelBlobUrl);
  } catch (err) {
    console.warn(
      `[deleteScene] czyszczenie Blob nieudane dla sceny ${id} (rekord i tak usunięty):`,
      err
    );
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
 * Zwraca zbiór wszystkich niepustych URL-i Blob (model + miniatura) używanych
 * przez JAKĄKOLWIEK scenę — wszyscy właściciele, łącznie z presetami.
 * Store Blob jest globalny, więc audyt sierot musi widzieć referencje ze
 * wszystkich scen. Używane przez lib/scenes/blobAudit.
 */
export async function getReferencedBlobUrls(): Promise<Set<string>> {
  const rows = await db
    .select({ model: scenes.modelBlobUrl, thumb: scenes.thumbBlobUrl })
    .from(scenes);

  const urls = new Set<string>();
  for (const row of rows) {
    if (row.model) urls.add(row.model);
    if (row.thumb) urls.add(row.thumb);
  }
  return urls;
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

// ─── Etap D ──────────────────────────────────────────────────────────────────

/**
 * Zwraca wszystkie sceny, do których user ma dostęp:
 * własne (owner_id = userId) + udostępnione mu przez scene_permissions.
 * Sortowanie: updatedAt DESC.
 */
export async function listAccessible(userId: string): Promise<SceneRecord[]> {
  // Podzapytanie: sceneId, gdzie userId ma uprawnienie
  const permittedSceneIds = db
    .select({ sceneId: scenePermissions.sceneId })
    .from(scenePermissions)
    .where(eq(scenePermissions.userId, userId));

  const rows = await db
    .select()
    .from(scenes)
    .where(
      or(
        eq(scenes.ownerId, userId),
        inArray(scenes.id, permittedSceneIds),
      ),
    )
    .orderBy(desc(scenes.updatedAt));

  return rows.map(rowToRecord);
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
