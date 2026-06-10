// app/api/scenes/[id]/instantiate/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/session', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-test', role: 'user', email: 'a@b.com' }),
}));

vi.mock('@/lib/scenes/repo', () => ({
  instantiatePreset: vi.fn(),
}));

import { POST } from '@/app/api/scenes/[id]/instantiate/route';
import { instantiatePreset } from '@/lib/scenes/repo';

const MOCK_SCENE = {
  id: 'new-scene-id',
  ownerId: 'user-test',
  title: 'Studio (kopia)',
  config: {},
  modelBlobUrl: 'https://blob.vercel.com/models/abc.glb',
  modelFileName: 'abc.glb',
  thumbBlobUrl: null,
  isPreset: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('POST /api/scenes/[id]/instantiate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('zwraca 201 z nową sceną przy poprawnym klonowaniu', async () => {
    (instantiatePreset as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_SCENE);

    const req = new NextRequest('http://localhost/api/scenes/11111111-1111-4111-8111-111111111111/instantiate', {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe('new-scene-id');
    expect(json.isPreset).toBe(false);
  });

  it('zwraca 404 gdy preset nie istnieje', async () => {
    (instantiatePreset as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Preset nie istnieje')
    );

    const req = new NextRequest('http://localhost/api/scenes/22222222-2222-4222-8222-222222222222/instantiate', {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) });
    expect(res.status).toBe(404);
  });

  it('zwraca 422 gdy rekord nie jest presetem', async () => {
    (instantiatePreset as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Scena nie jest presetem')
    );

    const req = new NextRequest('http://localhost/api/scenes/33333333-3333-4333-8333-333333333333/instantiate', {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: '33333333-3333-4333-8333-333333333333' }) });
    expect(res.status).toBe(422);
  });

  it('zwraca 400 dla identyfikatora spoza formatu UUID', async () => {
    const req = new NextRequest('http://localhost/api/scenes/not-a-uuid/instantiate', {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(res.status).toBe(400);
    expect(instantiatePreset).not.toHaveBeenCalled();
  });
});
