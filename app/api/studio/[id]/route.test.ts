// app/api/studio/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/session', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'owner-1', role: 'user', email: 'a@b.com' }),
}));
vi.mock('@/lib/studio/repo', () => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));

import { GET, PATCH, DELETE } from '@/app/api/studio/[id]/route';
import { getProject, updateProject, deleteProject } from '@/lib/studio/repo';
import { requireUser } from '@/lib/auth/session';

const ID = '11111111-1111-1111-1111-111111111111';
const OWN = { id: ID, ownerId: 'owner-1', title: 'T', sourceBlobUrl: 'u', sourceFileName: 'a.zip', sourceKind: 'gltf-zip', config: {}, thumbBlobUrl: null, createdAt: new Date(), updatedAt: new Date() };
const FOREIGN = { ...OWN, ownerId: 'someone-else' };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/studio/[id]', () => {
  it('400 dla nie-UUID', async () => {
    const res = await GET(new NextRequest('http://localhost/api/studio/bad'), ctx('bad'));
    expect(res.status).toBe(400);
  });
  it('404 gdy nie istnieje', async () => {
    (getProject as any).mockResolvedValue(null);
    const res = await GET(new NextRequest(`http://localhost/api/studio/${ID}`), ctx(ID));
    expect(res.status).toBe(404);
  });
  it('403 gdy nie właściciel', async () => {
    (getProject as any).mockResolvedValue(FOREIGN);
    const res = await GET(new NextRequest(`http://localhost/api/studio/${ID}`), ctx(ID));
    expect(res.status).toBe(403);
  });
  it('200 + rekord dla właściciela', async () => {
    (getProject as any).mockResolvedValue(OWN);
    const res = await GET(new NextRequest(`http://localhost/api/studio/${ID}`), ctx(ID));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(ID);
  });
  it('401 gdy niezalogowany (po walidacji UUID)', async () => {
    (requireUser as any).mockRejectedValueOnce(new Error('unauth'));
    const res = await GET(new NextRequest(`http://localhost/api/studio/${ID}`), ctx(ID));
    expect(res.status).toBe(401);
    expect(getProject).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/studio/[id]', () => {
  it('403 gdy nie właściciel (updateProject NIE wołane)', async () => {
    (getProject as any).mockResolvedValue(FOREIGN);
    const req = new NextRequest(`http://localhost/api/studio/${ID}`, { method: 'PATCH', body: JSON.stringify({ title: 'X' }) });
    const res = await PATCH(req, ctx(ID));
    expect(res.status).toBe(403);
    expect(updateProject).not.toHaveBeenCalled();
  });
  it('200 gdy właściciel aktualizuje', async () => {
    (getProject as any).mockResolvedValue(OWN);
    (updateProject as any).mockResolvedValue({ ...OWN, title: 'X' });
    const req = new NextRequest(`http://localhost/api/studio/${ID}`, { method: 'PATCH', body: JSON.stringify({ title: 'X' }) });
    const res = await PATCH(req, ctx(ID));
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe('X');
  });
});

describe('DELETE /api/studio/[id]', () => {
  it('403 gdy nie właściciel (deleteProject NIE wołane)', async () => {
    (getProject as any).mockResolvedValue(FOREIGN);
    const res = await DELETE(new NextRequest(`http://localhost/api/studio/${ID}`), ctx(ID));
    expect(res.status).toBe(403);
    expect(deleteProject).not.toHaveBeenCalled();
  });
  it('204 gdy właściciel kasuje', async () => {
    (getProject as any).mockResolvedValue(OWN);
    (deleteProject as any).mockResolvedValue(undefined);
    const res = await DELETE(new NextRequest(`http://localhost/api/studio/${ID}`), ctx(ID));
    expect(res.status).toBe(204);
    expect(deleteProject).toHaveBeenCalledWith(ID);
  });
});
