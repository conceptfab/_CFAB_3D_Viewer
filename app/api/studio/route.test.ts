// app/api/studio/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/session', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-test', role: 'user', email: 'a@b.com' }),
}));
vi.mock('@/lib/studio/repo', () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
}));

import { GET, POST } from '@/app/api/studio/route';
import { listProjects, createProject } from '@/lib/studio/repo';
import { requireUser } from '@/lib/auth/session';

const PROJ = {
  id: 'p1', ownerId: 'user-test', title: 'T', sourceBlobUrl: 'https://b/sources/a.zip',
  sourceFileName: 'a.zip', sourceKind: 'gltf-zip', config: {}, thumbBlobUrl: null,
  createdAt: new Date(), updatedAt: new Date(),
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/studio', () => {
  it('zwraca listę projektów właściciela', async () => {
    (listProjects as any).mockResolvedValue([PROJ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(listProjects).toHaveBeenCalledWith('user-test');
  });

  it('401 gdy niezalogowany', async () => {
    (requireUser as any).mockRejectedValueOnce(new Error('unauth'));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(listProjects).not.toHaveBeenCalled();
  });
});

describe('POST /api/studio', () => {
  it('tworzy projekt → 201', async () => {
    (createProject as any).mockResolvedValue(PROJ);
    const req = new NextRequest('http://localhost/api/studio', {
      method: 'POST',
      body: JSON.stringify({
        title: 'T', sourceBlobUrl: 'https://b/sources/a.zip', sourceFileName: 'a.zip',
        sourceKind: 'gltf-zip', config: {}, thumbBlobUrl: null,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe('p1');
    expect(createProject).toHaveBeenCalledWith('user-test', expect.objectContaining({ sourceKind: 'gltf-zip' }));
  });

  it('zła walidacja (brak sourceBlobUrl) → 422', async () => {
    const req = new NextRequest('http://localhost/api/studio', {
      method: 'POST',
      body: JSON.stringify({ title: 'T', config: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('401 gdy niezalogowany (createProject NIE wołane)', async () => {
    (requireUser as any).mockRejectedValueOnce(new Error('unauth'));
    const req = new NextRequest('http://localhost/api/studio', {
      method: 'POST',
      body: JSON.stringify({
        title: 'T', sourceBlobUrl: 'https://b/sources/a.zip', sourceFileName: 'a.zip',
        sourceKind: 'gltf-zip', config: {}, thumbBlobUrl: null,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(createProject).not.toHaveBeenCalled();
  });
});
