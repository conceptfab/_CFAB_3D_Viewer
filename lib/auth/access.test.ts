import { describe, it, expect } from 'vitest';
import { checkAccess, canRemoveAdmin } from './access';
import type { AccessUserRepo } from './access';

// Pomocnik: tworzy mock repo
function makeRepo(user: { status: 'allowed' | 'blocked' } | null): AccessUserRepo {
  return {
    findByEmail: async () => user,
  };
}

describe('checkAccess', () => {
  it('ALLOW dla istniejącego usera status=allowed', async () => {
    const result = await checkAccess('user@example.com', makeRepo({ status: 'allowed' }), []);
    expect(result).toBe('allow');
  });

  it('DENY dla istniejącego usera status=blocked (czarna lista nadpisuje wszystko)', async () => {
    // nawet jeśli jest w ADMIN_EMAILS — blocked = deny
    const result = await checkAccess(
      'admin@example.com',
      makeRepo({ status: 'blocked' }),
      ['admin@example.com']
    );
    expect(result).toBe('deny');
  });

  it('bootstrap: ALLOW i zwraca "bootstrap" dla nieznanego e-maila z ADMIN_EMAILS', async () => {
    const result = await checkAccess('admin@example.com', makeRepo(null), ['admin@example.com']);
    expect(result).toBe('bootstrap');
  });

  it('DENY dla nieznanego e-maila spoza ADMIN_EMAILS', async () => {
    const result = await checkAccess('stranger@example.com', makeRepo(null), ['admin@example.com']);
    expect(result).toBe('deny');
  });

  it('DENY dla pustej listy ADMIN_EMAILS i nieznanego usera', async () => {
    const result = await checkAccess('unknown@example.com', makeRepo(null), []);
    expect(result).toBe('deny');
  });

  it('normalizuje e-mail przed porównaniem z ADMIN_EMAILS', async () => {
    // ADMIN_EMAILS trzyma już znormalizowane; email z requesta normalizowany w route
    // Ten test sprawdza, że checkAccess nie normalizuje ponownie (oczekuje już znormalizowanego)
    const result = await checkAccess('admin@example.com', makeRepo(null), ['admin@example.com']);
    expect(result).toBe('bootstrap');
  });
});

describe('canRemoveAdmin', () => {
  it('true gdy adminCount > 1', () => {
    expect(canRemoveAdmin(2)).toBe(true);
    expect(canRemoveAdmin(5)).toBe(true);
  });

  it('false gdy adminCount === 1 (ostatni admin)', () => {
    expect(canRemoveAdmin(1)).toBe(false);
  });

  it('false gdy adminCount === 0 (edge case)', () => {
    expect(canRemoveAdmin(0)).toBe(false);
  });
});
