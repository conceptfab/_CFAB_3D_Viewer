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

    const req = new NextRequest('http://localhost/api/scenes/preset-001/instantiate', {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'preset-001' }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe('new-scene-id');
    expect(json.isPreset).toBe(false);
  });

  it('zwraca 404 gdy preset nie istnieje', async () => {
    (instantiatePreset as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Preset nie istnieje')
    );

    const req = new NextRequest('http://localhost/api/scenes/nie-ma/instantiate', {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'nie-ma' }) });
    expect(res.status).toBe(404);
  });

  it('zwraca 422 gdy rekord nie jest presetem', async () => {
    (instantiatePreset as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Scena nie jest presetem')
    );

    const req = new NextRequest('http://localhost/api/scenes/scena/instantiate', {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'scena' }) });
    expect(res.status).toBe(422);
  });
});
