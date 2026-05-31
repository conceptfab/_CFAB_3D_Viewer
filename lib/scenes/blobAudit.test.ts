// lib/scenes/blobAudit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Vercel Blob (list + del) i warstwy danych scen (getReferencedBlobUrls).
vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  del: vi.fn(),
}));
vi.mock('./repo', () => ({
  getReferencedBlobUrls: vi.fn(),
}));

import { findOrphanedBlobs, deleteOrphanedBlobs, pruneOrphanReport } from './blobAudit';

const NOW = new Date('2026-05-31T12:00:00Z').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);

// Buduje pozycję taką, jaką zwraca @vercel/blob list().
function blob(pathname: string, size: number, uploadedAt: Date) {
  const url = `https://store.blob.vercel-storage.com/${pathname}`;
  return { url, downloadUrl: `${url}?download=1`, pathname, size, uploadedAt };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findOrphanedBlobs', () => {
  it('oznacza nieużywany blob jako sierotę, a referencjonowany pomija', async () => {
    const { list } = await import('@vercel/blob');
    const { getReferencedBlobUrls } = await import('./repo');
    const used = blob('models/used.glb', 1000, hoursAgo(100));
    const orphan = blob('models/orphan.glb', 2000, hoursAgo(100));

    (getReferencedBlobUrls as any).mockResolvedValue(new Set([used.url]));
    (list as any).mockResolvedValue({ blobs: [used, orphan], hasMore: false });

    const report = await findOrphanedBlobs({ now: NOW });

    expect(report.totalBlobs).toBe(2);
    expect(report.referencedCount).toBe(1);
    expect(report.orphans).toHaveLength(1);
    expect(report.orphans[0].url).toBe(orphan.url);
    expect(report.orphans[0].kind).toBe('model');
    expect(report.orphans[0].deletable).toBe(true);
  });

  it('nieużywany ale świeży plik (≤ okno) → deletable=false + recentSkipped', async () => {
    const { list } = await import('@vercel/blob');
    const { getReferencedBlobUrls } = await import('./repo');
    const fresh = blob('models/fresh.glb', 500, hoursAgo(2));

    (getReferencedBlobUrls as any).mockResolvedValue(new Set());
    (list as any).mockResolvedValue({ blobs: [fresh], hasMore: false });

    const report = await findOrphanedBlobs({ now: NOW, safetyWindowHours: 24 });

    expect(report.orphans).toHaveLength(1);
    expect(report.orphans[0].deletable).toBe(false);
    expect(report.recentSkipped).toBe(1);
  });

  it('iteruje przez WSZYSTKIE strony list() (bez cichego limitu 1000)', async () => {
    const { list } = await import('@vercel/blob');
    const { getReferencedBlobUrls } = await import('./repo');
    const p1 = blob('models/p1.glb', 10, hoursAgo(100));
    const p2 = blob('thumbnails/p2.png', 20, hoursAgo(100));

    (getReferencedBlobUrls as any).mockResolvedValue(new Set());
    (list as any)
      .mockResolvedValueOnce({ blobs: [p1], hasMore: true, cursor: 'c1' })
      .mockResolvedValueOnce({ blobs: [p2], hasMore: false });

    const report = await findOrphanedBlobs({ now: NOW });

    expect(list).toHaveBeenCalledTimes(2);
    expect((list as any).mock.calls[1][0]).toMatchObject({ cursor: 'c1' });
    expect(report.totalBlobs).toBe(2);
    expect(report.orphans).toHaveLength(2);
  });

  it('liczy podsumowanie: łączne bajty oraz per typ', async () => {
    const { list } = await import('@vercel/blob');
    const { getReferencedBlobUrls } = await import('./repo');
    const m = blob('models/m.glb', 1000, hoursAgo(100));
    const t = blob('thumbnails/t.png', 200, hoursAgo(100));

    (getReferencedBlobUrls as any).mockResolvedValue(new Set());
    (list as any).mockResolvedValue({ blobs: [m, t], hasMore: false });

    const report = await findOrphanedBlobs({ now: NOW });

    expect(report.summary.count).toBe(2);
    expect(report.summary.bytes).toBe(1200);
    expect(report.summary.byKind.model).toEqual({ count: 1, bytes: 1000 });
    expect(report.summary.byKind.thumbnail).toEqual({ count: 1, bytes: 200 });
  });

  it('sortuje sieroty malejąco po rozmiarze', async () => {
    const { list } = await import('@vercel/blob');
    const { getReferencedBlobUrls } = await import('./repo');
    const small = blob('models/small.glb', 100, hoursAgo(100));
    const big = blob('models/big.glb', 9000, hoursAgo(100));

    (getReferencedBlobUrls as any).mockResolvedValue(new Set());
    (list as any).mockResolvedValue({ blobs: [small, big], hasMore: false });

    const report = await findOrphanedBlobs({ now: NOW });

    expect(report.orphans.map((o) => o.url)).toEqual([big.url, small.url]);
  });
});

describe('deleteOrphanedBlobs', () => {
  it('kasuje wyłącznie kasowalne sieroty; del() z właściwym URL', async () => {
    const { list, del } = await import('@vercel/blob');
    const { getReferencedBlobUrls } = await import('./repo');
    const orphan = blob('models/orphan.glb', 2000, hoursAgo(100));

    (getReferencedBlobUrls as any).mockResolvedValue(new Set());
    (list as any).mockResolvedValue({ blobs: [orphan], hasMore: false });
    (del as any).mockResolvedValue(undefined);

    const result = await deleteOrphanedBlobs([orphan.url], { now: NOW });

    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith(orphan.url);
    expect(result.deleted).toEqual([orphan.url]);
    expect(result.skipped).toHaveLength(0);
  });

  it('NIE kasuje referencjonowanego URL, nawet jeśli wprost podany (re-weryfikacja)', async () => {
    const { list, del } = await import('@vercel/blob');
    const { getReferencedBlobUrls } = await import('./repo');
    const used = blob('models/used.glb', 2000, hoursAgo(100));

    (getReferencedBlobUrls as any).mockResolvedValue(new Set([used.url]));
    (list as any).mockResolvedValue({ blobs: [used], hasMore: false });

    const result = await deleteOrphanedBlobs([used.url], { now: NOW });

    expect(del).not.toHaveBeenCalled();
    expect(result.deleted).toHaveLength(0);
    expect(result.skipped[0]).toMatchObject({ url: used.url });
  });

  it('NIE kasuje zbyt świeżego pliku — powód too-recent', async () => {
    const { list, del } = await import('@vercel/blob');
    const { getReferencedBlobUrls } = await import('./repo');
    const fresh = blob('models/fresh.glb', 500, hoursAgo(1));

    (getReferencedBlobUrls as any).mockResolvedValue(new Set());
    (list as any).mockResolvedValue({ blobs: [fresh], hasMore: false });

    const result = await deleteOrphanedBlobs([fresh.url], { now: NOW, safetyWindowHours: 24 });

    expect(del).not.toHaveBeenCalled();
    expect(result.skipped[0]).toMatchObject({ url: fresh.url, reason: 'too-recent' });
  });

  it('pruneOrphanReport usuwa wpisy i przelicza summary', () => {
    const report = {
      totalBlobs: 2,
      referencedCount: 0,
      orphans: [
        {
          url: 'https://b/a',
          pathname: 'models/a.glb',
          kind: 'model' as const,
          size: 100,
          uploadedAt: '2026-05-01T00:00:00.000Z',
          ageHours: 48,
          deletable: true,
        },
        {
          url: 'https://b/b',
          pathname: 'thumbnails/b.png',
          kind: 'thumbnail' as const,
          size: 50,
          uploadedAt: '2026-05-01T00:00:00.000Z',
          ageHours: 48,
          deletable: true,
        },
      ],
      recentSkipped: 0,
      safetyWindowHours: 24,
      summary: {
        count: 2,
        bytes: 150,
        byKind: {
          model: { count: 1, bytes: 100 },
          thumbnail: { count: 1, bytes: 50 },
          unknown: { count: 0, bytes: 0 },
        },
      },
    };
    const pruned = pruneOrphanReport(report, ['https://b/a']);
    expect(pruned.orphans).toHaveLength(1);
    expect(pruned.summary.count).toBe(1);
    expect(pruned.summary.bytes).toBe(50);
  });

  it('ignoreSafetyWindow kasuje świeżą sierotę', async () => {
    const { list, del } = await import('@vercel/blob');
    const { getReferencedBlobUrls } = await import('./repo');
    const fresh = blob('models/fresh.glb', 500, hoursAgo(1));

    (getReferencedBlobUrls as any).mockResolvedValue(new Set());
    (list as any).mockResolvedValue({ blobs: [fresh], hasMore: false });

    const result = await deleteOrphanedBlobs([fresh.url], {
      now: NOW,
      safetyWindowHours: 24,
      ignoreSafetyWindow: true,
    });

    expect(del).toHaveBeenCalledWith(fresh.url);
    expect(result.deleted).toEqual([fresh.url]);
  });

  it('błąd del() nie przerywa reszty — zgłoszony jako delete-failed (best-effort)', async () => {
    const { list, del } = await import('@vercel/blob');
    const { getReferencedBlobUrls } = await import('./repo');
    const o1 = blob('models/o1.glb', 100, hoursAgo(100));
    const o2 = blob('models/o2.glb', 100, hoursAgo(100));

    (getReferencedBlobUrls as any).mockResolvedValue(new Set());
    (list as any).mockResolvedValue({ blobs: [o1, o2], hasMore: false });
    (del as any)
      .mockRejectedValueOnce(new Error('Blob down'))
      .mockResolvedValueOnce(undefined);

    // Oczekiwany log błędu del() — wyciszamy, by wyjście testów było czyste.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await deleteOrphanedBlobs([o1.url, o2.url], { now: NOW });
    warn.mockRestore();

    expect(result.deleted).toEqual([o2.url]);
    expect(result.skipped).toEqual([{ url: o1.url, reason: 'delete-failed' }]);
  });
});
