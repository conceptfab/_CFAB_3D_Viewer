// app/api/cron/cleanup/route.ts
// Cron housekeeping — kasuje wygasłe sesje i kody logowania.
// Uruchamiany przez Vercel Cron (harmonogram w vercel.json).
// Zabezpieczenie: Vercel Cron wysyła nagłówek `Authorization: Bearer <CRON_SECRET>`.
import { NextResponse } from 'next/server';
import { cleanupExpiredAuthRecords } from '@/lib/auth/cleanup';

export async function GET(request: Request): Promise<NextResponse> {
  // Gdy CRON_SECRET jest ustawiony, wymagamy poprawnego nagłówka Authorization.
  // Bez sekretu (np. lokalnie) endpoint działa otwarcie — nie zwraca danych wrażliwych.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
    }
  }

  const result = await cleanupExpiredAuthRecords();
  return NextResponse.json({ ok: true, ...result });
}
