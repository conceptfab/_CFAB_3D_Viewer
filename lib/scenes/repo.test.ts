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

import { createScene, getScene, listScenes, updateScene, deleteScene, instantiatePreset } from './repo';

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

beforeEach(() => {
  vi.clearAllMocks();
});

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

  it('utrwala nowy modelBlobUrl i modelFileName (podmiana modelu w istniejącej scenie)', async () => {
    const { db } = await import('@/lib/db');
    const NEW_URL = 'https://blob.vercel.com/models/NOWY.glb';
    const updated = { ...mockSceneRecord, modelBlobUrl: NEW_URL, modelFileName: 'nowy.glb' };
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([updated]),
      }),
    });
    (db.update as any).mockReturnValue({ set: setSpy });

    const result = await updateScene(MOCK_SCENE_ID, {
      modelBlobUrl: NEW_URL,
      modelFileName: 'nowy.glb',
    });

    // Pola modelu MUSZĄ trafić do db.set(), inaczej podmiana modelu nie utrwala się.
    expect(setSpy.mock.calls[0][0]).toMatchObject({
      modelBlobUrl: NEW_URL,
      modelFileName: 'nowy.glb',
    });
    expect(result!.modelBlobUrl).toBe(NEW_URL);
  });

  it('czyści model (null) gdy scenę zapisano po usunięciu modelu', async () => {
    const { db } = await import('@/lib/db');
    const updated = { ...mockSceneRecord, modelBlobUrl: null, modelFileName: null };
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([updated]),
      }),
    });
    (db.update as any).mockReturnValue({ set: setSpy });

    await updateScene(MOCK_SCENE_ID, { modelBlobUrl: null, modelFileName: null });

    // null jest jawnie utrwalany (różny od „pole nieobecne").
    expect(setSpy.mock.calls[0][0]).toHaveProperty('modelBlobUrl', null);
    expect(setSpy.mock.calls[0][0]).toHaveProperty('modelFileName', null);
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
      // countShared: 0 innych scen z tym modelem (countModelReferences zwraca rows.length)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

    (db.delete as any).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await deleteScene(MOCK_SCENE_ID);

    // del wywołany dwukrotnie: thumb + model — z właściwymi URL-ami
    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith(mockSceneRecord.thumbBlobUrl);
    expect(del).toHaveBeenCalledWith(mockSceneRecord.modelBlobUrl);
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
      // countShared: 1 inna scena współdzieli ten model (countModelReferences zwraca rows.length)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'other-scene' }]),
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

// ─── instantiatePreset tests ──────────────────────────────────────────────────

const PRESET_FIXTURE: SceneRecord = {
  id: 'preset-001',
  ownerId: 'admin-001',
  title: 'Studio Neutral',
  config: {
    environment: { hdriUrl: 'https://example.com/env.hdr', intensity: 0.45 },
    background: { stops: ['#eee', '#ddd', '#ccc', '#bbb'], centerY: 0.44 },
    keyLight: {
      position: [-2.5, 4, 3],
      intensity: 0.55,
      color: '#ffffff',
      castShadow: true,
      shadowMapSize: 4096,
      shadowBias: -0.00012,
      normalBias: 0.012,
    },
    shadows: { catcherOpacity: 0.3, contactOpacity: 0.3, contactBlur: 2 },
    tone: { mode: 'NEUTRAL', exposure: 1.0 },
    material: { envMapIntensity: 1.0 },
    branding: {
      mode: 'text',
      text: 'CONCEPTFAB',
      fontFamily: 'Inter',
      color: '#1b1c20',
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: 1.5,
      bgEnabled: true,
      bgColor: '#ffffff',
      imageUrl: '',
      imageName: '',
    },
    hero: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    camera: {
      near: 0.05,
      far: 80,
      orbit: { minDist: 1.2, maxDist: 8, minPolar: 0.15, maxPolar: 1.52, damping: 0.08 },
      active: 'hero',
      cameras: [{ id: 'hero', name: 'Hero', position: [2.4, 1.4, 3.0], target: [0, 0.6, 0], fov: 28, showInFinalBar: true }],
    },
  } as SceneRecord['config'],
  modelBlobUrl: 'https://blob.vercel.com/models/abc123.glb',
  modelFileName: 'produkt.glb',
  thumbBlobUrl: 'https://blob.vercel.com/thumbnails/abc123.png',
  isPreset: true,
  createdAt: new Date('2026-05-30T10:00:00Z'),
  updatedAt: new Date('2026-05-30T10:00:00Z'),
};

describe('instantiatePreset', () => {
  it('tworzy nową scenę z is_preset=false i owner_id=wywołującego', async () => {
    const { db } = await import('@/lib/db');
    const newUserId = 'user-999';
    const newSceneId = 'scene-new-001';
    const insertedAt = new Date('2026-05-30T11:00:00Z');

    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([PRESET_FIXTURE]),
      }),
    });

    const newRecord: SceneRecord = {
      ...PRESET_FIXTURE,
      id: newSceneId,
      ownerId: newUserId,
      isPreset: false,
      createdAt: insertedAt,
      updatedAt: insertedAt,
    };

    (db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([newRecord]),
      }),
    });

    const result = await instantiatePreset('preset-001', newUserId);

    expect(result.isPreset).toBe(false);
    expect(result.ownerId).toBe(newUserId);
    expect(result.id).toBe(newSceneId);
  });

  it('klon współdzieli model_blob_url bez kopiowania pliku', async () => {
    const { db } = await import('@/lib/db');
    const newUserId = 'user-999';

    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([PRESET_FIXTURE]),
      }),
    });

    (db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          ...PRESET_FIXTURE,
          id: 'scene-new-002',
          ownerId: newUserId,
          isPreset: false,
        }]),
      }),
    });

    const result = await instantiatePreset('preset-001', newUserId);

    expect(result.modelBlobUrl).toBe(PRESET_FIXTURE.modelBlobUrl);
    expect(result.modelFileName).toBe(PRESET_FIXTURE.modelFileName);
  });

  it('klon współdzieli thumb_blob_url (decyzja 3 — kopiuj URL)', async () => {
    const { db } = await import('@/lib/db');
    const newUserId = 'user-999';

    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([PRESET_FIXTURE]),
      }),
    });

    (db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          ...PRESET_FIXTURE,
          id: 'scene-new-003',
          ownerId: newUserId,
          isPreset: false,
        }]),
      }),
    });

    const result = await instantiatePreset('preset-001', newUserId);

    expect(result.thumbBlobUrl).toBe(PRESET_FIXTURE.thumbBlobUrl);
  });

  it('rzuca błąd gdy id nie wskazuje na preset', async () => {
    const { db } = await import('@/lib/db');

    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ ...PRESET_FIXTURE, isPreset: false }]),
      }),
    });

    await expect(instantiatePreset('scene-regular', 'user-999')).rejects.toThrow(
      'Scena nie jest presetem'
    );
  });

  it('rzuca błąd gdy preset nie istnieje', async () => {
    const { db } = await import('@/lib/db');

    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    await expect(instantiatePreset('nie-istnieje', 'user-999')).rejects.toThrow(
      'Preset nie istnieje'
    );
  });
});
