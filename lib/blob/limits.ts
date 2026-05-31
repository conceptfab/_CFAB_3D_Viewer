// lib/blob/limits.ts
// Wspólne limity rozmiaru uploadu Blob — JEDNO źródło prawdy dla walidacji
// po stronie klienta (przed wczytaniem pliku, ModelDropzone) i serwera
// (token route /api/blob/upload). Dzięki temu nie da się rozjechać.
export const MAX_MODEL_BYTES = 1_000_000_000; // 1 GB — model .glb
export const MAX_THUMB_BYTES = 5_000_000; // 5 MB — miniatura PNG
