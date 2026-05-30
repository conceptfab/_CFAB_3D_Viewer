import { createHash, randomInt, timingSafeEqual } from 'crypto';

/**
 * Generuje losowy 6-cyfrowy kod logowania.
 * Używa crypto.randomInt (CSPRNG) dla bezpiecznej losowości.
 * Zero-padding zapewnia stałą długość 6 znaków.
 */
export function generateCode(): string {
  // randomInt(0, 1_000_000) → [0, 999999]
  const n = randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

/**
 * Hashuje kod SHA-256 i zwraca hex string.
 * Kod nigdy nie jest przechowywany w plaintext w DB.
 */
export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * Porównuje kod ze składowanym hashem odpornie na timing-attacki.
 * Hashujemy podany kod (SHA-256), po czym porównujemy oba 64-znakowe hexy
 * przez crypto.timingSafeEqual — porównanie w stałym czasie, bez short-circuitu.
 */
export function verifyCode(code: string, storedHash: string): boolean {
  if (!code) return false;
  const candidate = hashCode(code);
  // timingSafeEqual wymaga buforów równej długości; różna długość = brak dopasowania
  if (candidate.length !== storedHash.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(storedHash));
}
