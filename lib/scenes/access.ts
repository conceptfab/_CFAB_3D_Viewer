// lib/scenes/access.ts
import type { SceneRecord } from '@/lib/scenes/repo';
import type { User } from '@/lib/auth/types';

// Dependency injection — łatwe mockowanie w testach, brak twardego importu DB.
export interface AccessDeps {
  findPermission: (
    sceneId: string,
    userId: string,
  ) => Promise<{ canEdit: boolean } | null>;
  findActiveShareLink: (
    sceneId: string,
    token: string,
  ) => Promise<{ id: string } | null>;
}

/**
 * Tworzy domyślne deps podpięte pod prawdziwe DB.
 * Import DB jest lazy — nie łamie testów jednostkowych.
 */
export async function defaultDeps(): Promise<AccessDeps> {
  const [{ db }, { scenePermissions, shareLinks }, { eq, and, isNull }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/scenes/schema'),
    import('drizzle-orm'),
  ]);

  return {
    findPermission: async (sceneId, userId) => {
      const rows = await db
        .select({ canEdit: scenePermissions.canEdit })
        .from(scenePermissions)
        .where(
          and(
            eq(scenePermissions.sceneId, sceneId),
            eq(scenePermissions.userId, userId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },

    findActiveShareLink: async (sceneId, token) => {
      const rows = await db
        .select({ id: shareLinks.id })
        .from(shareLinks)
        .where(
          and(
            eq(shareLinks.sceneId, sceneId),
            eq(shareLinks.token, token),
            isNull(shareLinks.revokedAt),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },
  };
}

/**
 * Zwraca true jeśli user (lub anonimowy z tokenem) ma dostęp do podglądu sceny.
 *
 * Kolejność sprawdzeń (szybkie → wolne):
 * 1. user === owner → true (bez DB)
 * 2. user istnieje → sprawdź scene_permissions
 * 3. token istnieje → sprawdź aktywny share_link
 * 4. false
 */
export async function canView(
  scene: SceneRecord,
  user: User | null,
  shareToken?: string,
  deps?: AccessDeps,
): Promise<boolean> {
  const d = deps ?? (await defaultDeps());

  // 1. Owner
  if (user && scene.ownerId === user.id) return true;

  // 2. Uprawnienie per-scena
  if (user) {
    const perm = await d.findPermission(scene.id, user.id);
    if (perm) return true;
  }

  // 3. Token share (działa dla niezalogowanych i zalogowanych bez perma)
  if (shareToken) {
    const link = await d.findActiveShareLink(scene.id, shareToken);
    if (link) return true;
  }

  return false;
}

/**
 * Rzuca błąd z kodem "403" jeśli user nie może edytować sceny.
 * Edytować może: owner lub user z can_edit=true.
 */
export async function assertCanEdit(
  scene: SceneRecord,
  user: User,
  deps?: AccessDeps,
): Promise<void> {
  const d = deps ?? (await defaultDeps());

  if (scene.ownerId === user.id) return;

  const perm = await d.findPermission(scene.id, user.id);
  if (perm?.canEdit) return;

  throw new Error('403');
}
