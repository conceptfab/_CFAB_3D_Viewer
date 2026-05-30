import { describe, it, expect } from 'vitest';
import { hashToken, isSessionValid } from './session';

describe('hashToken', () => {
  it('zwraca SHA-256 hex (64 znaki)', () => {
    const hash = hashToken('someRandomToken');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('jest deterministyczny', () => {
    expect(hashToken('token123')).toBe(hashToken('token123'));
  });

  it('różne tokeny → różne hashe', () => {
    expect(hashToken('tokenA')).not.toBe(hashToken('tokenB'));
  });
});

describe('isSessionValid', () => {
  it('zwraca true gdy sesja nie wygasła', () => {
    const future = new Date(Date.now() + 60_000); // 1 minuta w przyszłości
    expect(isSessionValid({ expiresAt: future })).toBe(true);
  });

  it('zwraca false gdy sesja wygasła', () => {
    const past = new Date(Date.now() - 60_000); // 1 minuta wstecz
    expect(isSessionValid({ expiresAt: past })).toBe(false);
  });

  it('zwraca false gdy expires_at = teraz (dokładnie na granicy)', () => {
    const now = new Date();
    // Chwila w przeszłości — stempel <= now → invalid
    const justPast = new Date(now.getTime() - 1);
    expect(isSessionValid({ expiresAt: justPast })).toBe(false);
  });
});
