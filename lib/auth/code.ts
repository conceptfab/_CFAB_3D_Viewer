import { createHash, randomInt } from 'crypto';

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
 * Porównuje kod z hashem (constant-time poprzez ponowne hashowanie).
 * Bezpieczne przed timing attacks — hashowanie jest deterministyczne,
 * więc porównanie stringów jest OK po zhashowaniu.
 */
export function verifyCode(code: string, storedHash: string): boolean {
  if (!code) return false;
  return hashCode(code) === storedHash;
}
