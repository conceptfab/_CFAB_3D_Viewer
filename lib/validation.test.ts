import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  requestCodeSchema,
  verifyCodeSchema,
  adminPostSchema,
  adminPatchSchema,
} from './validation';

describe('normalizeEmail', () => {
  it('zamienia na lowercase', () => {
    expect(normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
  });

  it('usuwa białe znaki z początku i końca', () => {
    expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
  });

  it('łączy trim i lowercase', () => {
    expect(normalizeEmail('  ADMIN@Test.Org  ')).toBe('admin@test.org');
  });

  it('pusty string zostaje pustym stringiem', () => {
    expect(normalizeEmail('')).toBe('');
  });
});

describe('requestCodeSchema', () => {
  it('akceptuje poprawny e-mail', () => {
    const result = requestCodeSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('odrzuca niepoprawny e-mail', () => {
    const result = requestCodeSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('odrzuca brak pola email', () => {
    const result = requestCodeSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('verifyCodeSchema', () => {
  it('akceptuje e-mail i 6-cyfrowy kod', () => {
    const result = verifyCodeSchema.safeParse({ email: 'u@e.com', code: '123456' });
    expect(result.success).toBe(true);
  });

  it('odrzuca kod krótszy niż 6 cyfr', () => {
    const result = verifyCodeSchema.safeParse({ email: 'u@e.com', code: '123' });
    expect(result.success).toBe(false);
  });

  it('odrzuca kod dłuższy niż 6 cyfr', () => {
    const result = verifyCodeSchema.safeParse({ email: 'u@e.com', code: '1234567' });
    expect(result.success).toBe(false);
  });

  it('odrzuca kod z literami', () => {
    const result = verifyCodeSchema.safeParse({ email: 'u@e.com', code: '12345a' });
    expect(result.success).toBe(false);
  });
});

describe('adminPostSchema', () => {
  it('akceptuje poprawny e-mail', () => {
    const result = adminPostSchema.safeParse({ email: 'new@example.com' });
    expect(result.success).toBe(true);
  });

  it('odrzuca niepoprawny e-mail', () => {
    const result = adminPostSchema.safeParse({ email: 'bad' });
    expect(result.success).toBe(false);
  });
});

describe('adminPatchSchema', () => {
  it('akceptuje role=admin', () => {
    const result = adminPatchSchema.safeParse({ role: 'admin' });
    expect(result.success).toBe(true);
  });

  it('akceptuje role=user', () => {
    const result = adminPatchSchema.safeParse({ role: 'user' });
    expect(result.success).toBe(true);
  });

  it('akceptuje status=allowed', () => {
    const result = adminPatchSchema.safeParse({ status: 'allowed' });
    expect(result.success).toBe(true);
  });

  it('akceptuje status=blocked', () => {
    const result = adminPatchSchema.safeParse({ status: 'blocked' });
    expect(result.success).toBe(true);
  });

  it('odrzuca nieznana role', () => {
    const result = adminPatchSchema.safeParse({ role: 'superuser' });
    expect(result.success).toBe(false);
  });

  it('odrzuca nieznany status', () => {
    const result = adminPatchSchema.safeParse({ status: 'pending' });
    expect(result.success).toBe(false);
  });

  it('odrzuca pusty obiekt (wymaga co najmniej role lub status)', () => {
    const result = adminPatchSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
