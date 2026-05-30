// lib/scenes/repo.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SceneRecord, CreateSceneInput } from './types';

// Mockujemy moduł db aby testy były jednostkowe (bez realnej bazy).
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mockujemy @vercel/blob (del) — używane w deleteScene.
vi.mock('@vercel/blob', () => ({
  del: vi.fn(),
}));

import { createScene, getScene, listScenes, updateScene, deleteScene } from './repo';

const MOCK_OWNER_ID = 'user-uuid-1';
const MOCK_SCENE_ID = 'scene-uuid-1';

const mockSceneRecord: SceneRecord = {
  id: MOCK_SCENE_ID,
  ownerId: MOCK_OWNER_ID,
  title: 'Moja scena',
  config: {} as any,
  modelBlobUrl: 'https://blob.vercel.com/models/abc.glb',
  modelFileName: 'model.glb',
  thumbBlobUrl: 'https://blob.vercel.com/thumbnails/abc.png',
  isPreset: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('createScene', () => {
  it('zwraca SceneRecord po zapisaniu', async () => {
    const { db } = await import('@/lib/db');
    (db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockSceneRecord]),
      }),
    });

    const input: CreateSceneInput = {
      title: 'Moja scena',
      config: {} as any,
      modelBlobUrl: 'https://blob.vercel.com/models/abc.glb',
      modelFileName: 'model.glb',
      thumbBlobUrl: 'https://blob.vercel.com/thumbnails/abc.png',
    };

    const result = await createScene(MOCK_OWNER_ID, input);
    expect(result.id).toBe(MOCK_SCENE_ID);
    expect(result.title).toBe('Moja scena');
  });
});

describe('getScene', () => {
  it('zwraca SceneRecord gdy istnieje', async () => {
    const { db } = await import('@/lib/db');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockSceneRecord]),
      }),
    });

    const result = await getScene(MOCK_SCENE_ID);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(MOCK_SCENE_ID);
  });

  it('zwraca null gdy nie istnieje', async () => {
    const { db } = await import('@/lib/db');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await getScene('nonexistent');
    expect(result).toBeNull();
  });
});

describe('listScenes', () => {
  it('zwraca tablicę SceneRecord dla ownerId', async () => {
    const { db } = await import('@/lib/db');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockSceneRecord]),
      }),
    });

    const results = await listScenes(MOCK_OWNER_ID, { preset: false });
    expect(results).toHaveLength(1);
    expect(results[0].ownerId).toBe(MOCK_OWNER_ID);
  });
});

describe('updateScene', () => {
  it('zwraca zaktualizowany SceneRecord', async () => {
    const { db } = await import('@/lib/db');
    const updated = { ...mockSceneRecord, title: 'Nowa nazwa' };
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updated]),
        }),
      }),
    });

    const result = await updateScene(MOCK_SCENE_ID, { title: 'Nowa nazwa' });
    expect(result!.title).toBe('Nowa nazwa');
  });
});

describe('deleteScene', () => {
  it('kasuje miniaturę zawsze i model gdy nie współdzielony', async () => {
    const { db } = await import('@/lib/db');
    const { del } = await import('@vercel/blob');

    // getScene returns mockSceneRecord
    (db.select as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockSceneRecord]),
        }),
      })
      // countShared: 0 innych scen z tym modelem
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

    (db.delete as any).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await deleteScene(MOCK_SCENE_ID);

    // del wywołany dwukrotnie: thumb + model
    expect(del).toHaveBeenCalledTimes(2);
  });

  it('kasuje tylko miniaturę gdy model współdzielony', async () => {
    const { db } = await import('@/lib/db');
    const { del } = await import('@vercel/blob');
    vi.clearAllMocks();

    (db.select as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockSceneRecord]),
        }),
      })
      // countShared: 1 inna scena współdzieli ten model
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

    (db.delete as any).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await deleteScene(MOCK_SCENE_ID);

    // del wywołany tylko raz: thumb (model NIE kasowany)
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith(mockSceneRecord.thumbBlobUrl);
  });
});
