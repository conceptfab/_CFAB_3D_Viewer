// lib/scenes/blobAudit.ts
// Audyt osieroconych plików w Vercel Blob: pliki w store, których NIE wskazuje
// żadna scena (model_blob_url / thumb_blob_url). Store jest globalny, więc audyt
// patrzy na referencje ze WSZYSTKICH scen (getReferencedBlobUrls).
//
// Bezpieczeństwo kasowania:
//   • okno bezpieczeństwa — świeży plik (np. upload modelu przed zapisem sceny)
//     NIE jest kasowalny, choć chwilowo nie ma referencji,
//   • deleteOrphanedBlobs re-weryfikuje listę z żywej bazy — referencjonowany
//     URL nigdy nie zostanie skasowany, nawet jeśli ktoś go wprost poda,
//   • del() jest best-effort per plik — błąd jednego nie przerywa reszty.

import { list, del } from '@vercel/blob';
import { getReferencedBlobUrls } from './repo';

/** Domyślne okno bezpieczeństwa: pliki młodsze niż tyle godzin nie są kasowalne. */
export const DEFAULT_SAFETY_WINDOW_HOURS = 24;

export type OrphanKind = 'model' | 'thumbnail' | 'unknown';

export interface OrphanBlob {
  url: string;
  pathname: string;
  kind: OrphanKind;
  size: number; // bajty
  uploadedAt: string; // ISO
  ageHours: number;
  /** Czy starszy niż okno bezpieczeństwa (a więc bezpieczny do skasowania). */
  deletable: boolean;
}

export interface OrphanReport {
  totalBlobs: number;
  referencedCount: number;
  orphans: OrphanBlob[]; // sort. malejąco po rozmiarze
  recentSkipped: number; // sieroty zbyt świeże (deletable=false)
  safetyWindowHours: number;
  summary: {
    count: number;
    bytes: number;
    byKind: Record<OrphanKind, { count: number; bytes: number }>;
  };
}

export interface DeleteResult {
  deleted: string[];
  skipped: { url: string; reason: 'too-recent' | 'not-orphan' | 'delete-failed' }[];
}

interface AuditOpts {
  /** Bieżący czas (ms) — wstrzykiwalny dla testów. Domyślnie Date.now(). */
  now?: number;
  safetyWindowHours?: number;
}

function kindFromPath(pathname: string): OrphanKind {
  if (pathname.startsWith('models/')) return 'model';
  if (pathname.startsWith('thumbnails/')) return 'thumbnail';
  return 'unknown';
}

/** Zbiera dane o osieroconych plikach w Blob (bez kasowania). */
export async function findOrphanedBlobs(opts: AuditOpts = {}): Promise<OrphanReport> {
  const now = opts.now ?? Date.now();
  const safetyWindowHours = opts.safetyWindowHours ?? DEFAULT_SAFETY_WINDOW_HOURS;

  const referenced = await getReferencedBlobUrls();

  // Pętla po stronach — listujemy CAŁY store, nie tylko pierwszą stronę.
  let totalBlobs = 0;
  const orphans: OrphanBlob[] = [];
  let cursor: string | undefined;
  do {
    const page = await list(cursor ? { cursor } : {});
    for (const b of page.blobs) {
      totalBlobs++;
      if (referenced.has(b.url)) continue;
      const ageHours = (now - new Date(b.uploadedAt).getTime()) / 3_600_000;
      orphans.push({
        url: b.url,
        pathname: b.pathname,
        kind: kindFromPath(b.pathname),
        size: b.size,
        uploadedAt: new Date(b.uploadedAt).toISOString(),
        ageHours,
        deletable: ageHours >= safetyWindowHours,
      });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  orphans.sort((a, b) => b.size - a.size);

  const byKind: Record<OrphanKind, { count: number; bytes: number }> = {
    model: { count: 0, bytes: 0 },
    thumbnail: { count: 0, bytes: 0 },
    unknown: { count: 0, bytes: 0 },
  };
  let bytes = 0;
  for (const o of orphans) {
    byKind[o.kind].count++;
    byKind[o.kind].bytes += o.size;
    bytes += o.size;
  }

  return {
    totalBlobs,
    referencedCount: referenced.size,
    orphans,
    recentSkipped: orphans.filter((o) => !o.deletable).length,
    safetyWindowHours,
    summary: { count: orphans.length, bytes, byKind },
  };
}

/**
 * Kasuje wskazane URL-e, ale TYLKO te, które po ponownym skanie nadal są
 * kasowalnymi sierotami. Wszystko inne jest pomijane z powodem.
 */
export async function deleteOrphanedBlobs(
  urls: string[],
  opts: AuditOpts = {}
): Promise<DeleteResult> {
  const report = await findOrphanedBlobs(opts);
  const orphanByUrl = new Map(report.orphans.map((o) => [o.url, o]));

  const deleted: string[] = [];
  const skipped: DeleteResult['skipped'] = [];

  for (const url of urls) {
    const o = orphanByUrl.get(url);
    if (!o) {
      // Referencjonowany albo nieistniejący — nie ruszamy.
      skipped.push({ url, reason: 'not-orphan' });
      continue;
    }
    if (!o.deletable) {
      skipped.push({ url, reason: 'too-recent' });
      continue;
    }
    try {
      await del(url);
      deleted.push(url);
    } catch (err) {
      console.warn(`[blobAudit] del() nieudane dla ${url}:`, err);
      skipped.push({ url, reason: 'delete-failed' });
    }
  }

  return { deleted, skipped };
}
