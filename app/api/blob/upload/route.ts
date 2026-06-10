// app/api/blob/upload/route.ts
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { MAX_MODEL_BYTES, MAX_THUMB_BYTES } from '@/lib/blob/limits';

/**
 * Token route dla @vercel/blob/client.
 * Klient wysyła plik bezpośrednio do Blob, tu tylko autoryzacja i wygenerowanie tokenu.
 * Ścieżki dozwolone: models/<uuid>.glb oraz thumbnails/<uuid>.png.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Dozwolone prefiksy: models/ (sceny .glb), thumbnails/ (miniatury),
        // sources/ (edytowalne źródła Studio: .glb lub .zip multi-file glTF).
        const allowed =
          pathname.startsWith('models/') ||
          pathname.startsWith('thumbnails/') ||
          pathname.startsWith('sources/');
        if (!allowed) {
          throw new Error(`Niedozwolona ścieżka Blob: ${pathname}`);
        }

        const isThumb = pathname.startsWith('thumbnails/');
        return {
          allowedContentTypes: [
            'model/gltf-binary',
            'application/octet-stream',
            'application/zip',
            'image/png',
          ],
          // Miniatury: 5 MB; modele i źródła Studio: do 1 GB.
          // Modele >100 MB ładują się wolno i mocno zużywają transfer/Blob —
          // warto kompresować (Draco / meshopt / gltfpack).
          maximumSizeInBytes: isThumb ? MAX_THUMB_BYTES : MAX_MODEL_BYTES,
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
