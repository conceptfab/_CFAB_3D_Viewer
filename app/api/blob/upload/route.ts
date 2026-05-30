// app/api/blob/upload/route.ts
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';

/**
 * Token route dla @vercel/blob/client.
 * Klient wysyła plik bezpośrednio do Blob, tu tylko autoryzacja i wygenerowanie tokenu.
 * Ścieżki dozwolone: models/<uuid>.glb oraz thumbnails/<uuid>.png.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();
  // requireUser rzuca redirect/401 jeśli niezalogowany — obsługa jest w requireUser.

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Upewniamy się, że ścieżka jest dozwolona (modele i miniatury).
        const allowed =
          pathname.startsWith('models/') || pathname.startsWith('thumbnails/');
        if (!allowed) {
          throw new Error(`Niedozwolona ścieżka Blob: ${pathname}`);
        }

        return {
          allowedContentTypes: [
            'model/gltf-binary',
            'application/octet-stream',
            'image/png',
          ],
          // Maksymalny rozmiar: 100 MB dla modeli, 1 MB dla miniatur.
          maximumSizeInBytes: pathname.startsWith('models/') ? 100_000_000 : 1_000_000,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Callback po zakończeniu uploadu (logowanie lub przyszłe użycie).
        console.log(`[blob] upload zakończony: ${blob.url}`);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Błąd uploadu';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
