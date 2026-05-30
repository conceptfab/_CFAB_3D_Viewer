import { describe, it, expect } from 'vitest';
import { generateCode, hashCode, verifyCode } from './code';

describe('generateCode', () => {
  it('zwraca string o długości 6', () => {
    const code = generateCode();
    expect(code).toHaveLength(6);
  });

  it('zawiera wyłącznie cyfry', () => {
    const code = generateCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('jest zero-padded (może zaczynać się od 0)', () => {
    // Generujemy 200 kodów — statystycznie któryś będzie < 100000 i powinien być padded
    const codes = Array.from({ length: 200 }, () => generateCode());
    codes.forEach((c) => expect(c).toHaveLength(6));
  });

  it('zwraca różne wartości przy kolejnych wywołaniach (nielosowe byłoby podejrzane)', () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateCode()));
    // 10 losowych 6-cyfrowych kodów — szansa na kolizję wynosi < 0.01%
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('hashCode', () => {
  it('zwraca string hex (SHA-256 = 64 znaki)', () => {
    const hash = hashCode('123456');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('jest deterministyczny — ten sam input → ten sam hash', () => {
    expect(hashCode('123456')).toBe(hashCode('123456'));
  });

  it('różne kody → różne hashe', () => {
    expect(hashCode('123456')).not.toBe(hashCode('654321'));
  });
});

describe('verifyCode', () => {
  it('zwraca true gdy kod zgadza się z hashem', () => {
    const code = '123456';
    const hash = hashCode(code);
    expect(verifyCode(code, hash)).toBe(true);
  });

  it('zwraca false gdy kod nie zgadza się z hashem', () => {
    const hash = hashCode('123456');
    expect(verifyCode('999999', hash)).toBe(false);
  });

  it('zwraca false dla pustego kodu', () => {
    const hash = hashCode('123456');
    expect(verifyCode('', hash)).toBe(false);
  });
});
