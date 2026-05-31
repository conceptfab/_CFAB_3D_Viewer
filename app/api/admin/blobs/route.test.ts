// app/api/admin/blobs/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/session', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: 'admin-1', role: 'admin', email: 'a@b.com' }),
}));

vi.mock('@/lib/scenes/blobAudit', () => ({
  findOrphanedBlobs: vi.fn(),
  deleteOrphanedBlobs: vi.fn(),
}));

import { GET, DELETE } from '@/app/api/admin/blobs/route';
import { findOrphanedBlobs, deleteOrphanedBlobs } from '@/lib/scenes/blobAudit';

const MOCK_REPORT = {
  totalBlobs: 3,
  referencedCount: 1,
  orphans: [
    {
      url: 'https://b/models/x.glb',
      pathname: 'models/x.glb',
      kind: 'model',
      size: 100,
      uploadedAt: '2026-05-01T00:00:00.000Z',
      ageHours: 200,
      deletable: true,
    },
  ],
  recentSkipped: 0,
  safetyWindowHours: 24,
  summary: {
    count: 1,
    bytes: 100,
    byKind: {
      model: { count: 1, bytes: 100 },
      thumbnail: { count: 0, bytes: 0 },
      unknown: { count: 0, bytes: 0 },
    },
  },
};

describe('GET /api/admin/blobs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('zwraca 200 z raportem sierot', async () => {
    (findOrphanedBlobs as any).mockResolvedValue(MOCK_REPORT);

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary.count).toBe(1);
    expect(json.orphans[0].url).toBe('https://b/models/x.glb');
  });
});

describe('DELETE /api/admin/blobs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('kasuje podane URL-e i zwraca wynik', async () => {
    (deleteOrphanedBlobs as any).mockResolvedValue({
      deleted: ['https://b/models/x.glb'],
      skipped: [],
    });

    const req = new NextRequest('http://localhost/api/admin/blobs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: ['https://b/models/x.glb'] }),
    });

    const res = await DELETE(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deleted).toEqual(['https://b/models/x.glb']);
    expect(deleteOrphanedBlobs).toHaveBeenCalledWith(['https://b/models/x.glb']);
  });

  it('zwraca 422 gdy body nie zawiera tablicy urls', async () => {
    const req = new NextRequest('http://localhost/api/admin/blobs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: 'not-an-array' }),
    });

    const res = await DELETE(req);

    expect(res.status).toBe(422);
    expect(deleteOrphanedBlobs).not.toHaveBeenCalled();
  });
});
