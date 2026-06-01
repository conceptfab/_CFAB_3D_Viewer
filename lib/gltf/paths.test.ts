// lib/gltf/paths.test.ts
import { describe, it, expect } from 'vitest';
import { normalizePath, toKey, dirOf, joinRelative, extOf, isJunkPath } from './paths';

describe('normalizePath', () => {
  it('zamienia backslashe i zwija powtórzone slashe', () => {
    expect(normalizePath('a\\b//c')).toBe('a/b/c');
  });
  it('rozwija ./ i ../', () => {
    expect(normalizePath('a/b/../c')).toBe('a/c');
    expect(normalizePath('./a/./b')).toBe('a/b');
  });
  it('usuwa wiodące ./ i /', () => {
    expect(normalizePath('/a/b')).toBe('a/b');
  });
});

describe('toKey', () => {
  it('normalizuje i sprowadza do lower-case', () => {
    expect(toKey('Textures/T.PNG')).toBe('textures/t.png');
  });
});

describe('dirOf', () => {
  it('zwraca katalog lub pusty string dla roota', () => {
    expect(dirOf('source/x.glb')).toBe('source');
    expect(dirOf('scene.gltf')).toBe('');
  });
});

describe('joinRelative', () => {
  it('łączy względem katalogu bazowego i rozwija ../', () => {
    expect(joinRelative('', 'scene.bin')).toBe('scene.bin');
    expect(joinRelative('source', 'textures/t.png')).toBe('source/textures/t.png');
    expect(joinRelative('a/b', '../c.bin')).toBe('a/c.bin');
  });
});

describe('extOf', () => {
  it('zwraca rozszerzenie w lower-case', () => {
    expect(extOf('Model.GLTF')).toBe('.gltf');
    expect(extOf('a/b.glb')).toBe('.glb');
    expect(extOf('noext')).toBe('');
  });
});

describe('isJunkPath', () => {
  it('wykrywa śmieci systemowe i dotfiles', () => {
    expect(isJunkPath('.DS_Store')).toBe(true);
    expect(isJunkPath('folder/.DS_Store')).toBe(true);
    expect(isJunkPath('__MACOSX/x.png')).toBe(true);
    expect(isJunkPath('Thumbs.db')).toBe(true);
  });
  it('przepuszcza prawdziwe assety (też ze spacją i @)', () => {
    expect(isJunkPath('textures/t.png')).toBe(false);
    expect(isJunkPath('source/caravane real.glb')).toBe(false);
    expect(isJunkPath('textures/T_RMAO_5@channels=B.png')).toBe(false);
  });
  it('wykrywa __MACOSX jako dowolny segment i dotfile w podkatalogu', () => {
    expect(isJunkPath('a/__MACOSX')).toBe(true);       // ostatni segment
    expect(isJunkPath('a/__MACOSX/b.png')).toBe(true); // segment pośredni
    expect(isJunkPath('folder/.hidden')).toBe(true);   // dotfile zagnieżdżony
  });
  it('nie daje fałszywego trafienia na nazwę podobną do __MACOSX', () => {
    expect(isJunkPath('a/__MACOSXfoo.png')).toBe(false);
  });
});
