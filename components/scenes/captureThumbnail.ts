// components/scenes/captureThumbnail.ts

/**
 * Przechwytuje aktualną klatkę renderowanego canvasu r3f i zwraca ją jako PNG Blob
 * przeskalowany do maksymalnie 512 px na dłuższym boku.
 *
 * Wymaga: preserveDrawingBuffer: true na <Canvas> (ustawione w Viewer.tsx).
 *
 * @param gl - obiekt WebGL renderer (dostępny z useThree().gl lub przekazany z onCreated)
 * @returns Blob PNG lub null jeśli canvas jest niedostępny
 */
export async function captureThumbnail(
  gl: { domElement: HTMLCanvasElement }
): Promise<Blob | null> {
  const source = gl.domElement;
  if (!source || source.width === 0 || source.height === 0) return null;

  const MAX_SIZE = 512;
  const ratio = source.width / source.height;
  let w: number;
  let h: number;

  if (source.width >= source.height) {
    w = Math.min(source.width, MAX_SIZE);
    h = Math.round(w / ratio);
  } else {
    h = Math.min(source.height, MAX_SIZE);
    w = Math.round(h * ratio);
  }

  // Rysujemy na tymczasowym canvasie o docelowym rozmiarze.
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(source, 0, 0, w, h);

  return new Promise<Blob | null>((resolve) => {
    out.toBlob((blob) => resolve(blob), 'image/png');
  });
}
