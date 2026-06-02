// lib/studio/repo.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StudioProjectRecord, CreateStudioProjectInput } from './types';

vi.mock('@/lib/db', () => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('@vercel/blob', () => ({ del: vi.fn() }));

import {
  createProject, getProject, listProjects, updateProject, deleteProject, getStudioReferencedBlobUrls,
} from './repo';

const OWNER = 'user-uuid-1';
const PID = 'proj-uuid-1';

const rec: StudioProjectRecord = {
  id: PID,
  ownerId: OWNER,
  title: 'Mój model',
  sourceBlobUrl: 'https://b/sources/abc.zip',
  sourceFileName: 'scene.zip',
  sourceKind: 'gltf-zip',
  config: {} as StudioProjectRecord['config'],
  thumbBlobUrl: 'https://b/thumbnails/abc.png',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

beforeEach(() => vi.clearAllMocks());

describe('createProject', () => {
  it('zwraca rekord po zapisie', async () => {
    const { db } = await import('@/lib/db');
    (db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([rec]) }),
    });
    const input: CreateStudioProjectInput = {
      title: 'Mój model',
      sourceBlobUrl: rec.sourceBlobUrl,
      sourceFileName: 'scene.zip',
      sourceKind: 'gltf-zip',
      config: {} as CreateStudioProjectInput['config'],
      thumbBlobUrl: rec.thumbBlobUrl,
    };
    const out = await createProject(OWNER, input);
    expect(out.id).toBe(PID);
    expect(out.ownerId).toBe(OWNER);
    expect(out.sourceKind).toBe('gltf-zip');
  });
});

describe('getProject', () => {
  it('zwraca rekord gdy istnieje', async () => {
    const { db } = await import('@/lib/db');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([rec]) }),
    });
    const out = await getProject(PID);
    expect(out!.id).toBe(PID);
  });
  it('zwraca null gdy nie istnieje', async () => {
    const { db } = await import('@/lib/db');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });
    expect(await getProject('nope')).toBeNull();
  });
});

describe('listProjects', () => {
  it('zwraca projekty właściciela', async () => {
    const { db } = await import('@/lib/db');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([rec]) }),
      }),
    });
    const out = await listProjects(OWNER);
    expect(out).toHaveLength(1);
    expect(out[0].ownerId).toBe(OWNER);
  });
});

describe('updateProject', () => {
  it('utrwala patch i zwraca rekord', async () => {
    const { db } = await import('@/lib/db');
    const updated = { ...rec, title: 'Nowy' };
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([updated]) }),
    });
    (db.update as any).mockReturnValue({ set: setSpy });
    const out = await updateProject(PID, { title: 'Nowy' });
    expect(setSpy.mock.calls[0][0]).toMatchObject({ title: 'Nowy' });
    expect(out!.title).toBe('Nowy');
  });
  it('zwraca null gdy rekord nie istnieje', async () => {
    const { db } = await import('@/lib/db');
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    });
    expect(await updateProject('nope', { title: 'x' })).toBeNull();
  });
});

describe('deleteProject', () => {
  it('kasuje rekord oraz źródło i miniaturę z Blob', async () => {
    const { db } = await import('@/lib/db');
    const { del } = await import('@vercel/blob');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([rec]) }),
    });
    (db.delete as any).mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    await deleteProject(PID);
    expect(del).toHaveBeenCalledWith(rec.sourceBlobUrl);
    expect(del).toHaveBeenCalledWith(rec.thumbBlobUrl);
    expect(del).toHaveBeenCalledTimes(2);
  });
  it('jest ciche gdy rekord nie istnieje', async () => {
    const { db } = await import('@/lib/db');
    const { del } = await import('@vercel/blob');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });
    await deleteProject('nope');
    expect(del).not.toHaveBeenCalled();
  });
});

describe('getStudioReferencedBlobUrls', () => {
  it('zbiera niepuste source+thumb URL-e ze wszystkich projektów (dedup, bez null)', async () => {
    const { db } = await import('@/lib/db');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockResolvedValue([
        { source: 'https://b/sources/a.zip', thumb: 'https://b/thumbnails/a.png' },
        { source: 'https://b/sources/b.glb', thumb: null },
        { source: 'https://b/sources/a.zip', thumb: 'https://b/thumbnails/a.png' }, // dup
      ]),
    });
    const set = await getStudioReferencedBlobUrls();
    expect(set.has('https://b/sources/a.zip')).toBe(true);
    expect(set.has('https://b/sources/b.glb')).toBe(true);
    expect(set.has('https://b/thumbnails/a.png')).toBe(true);
    expect(set.size).toBe(3);
  });
});
