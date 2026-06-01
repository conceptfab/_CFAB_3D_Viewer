// lib/gltf/extract.test.ts
import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { fromZip, fromFileList } from './extract';

describe('fromZip', () => {
  it('buduje VFS z zip, pomija katalogi i śmieci, klucze lower-case', async () => {
    const zipped = zipSync({
      'scene.gltf': strToU8('{}'),
      'scene.bin': new Uint8Array([1, 2, 3]),
      'Textures/T.png': new Uint8Array([9, 9]),
      '.DS_Store': new Uint8Array([0]),
    });
    const blob = new Blob([zipped]);
    const fs = await fromZip(blob);
    expect(fs.has('scene.gltf')).toBe(true);
    expect(fs.has('scene.bin')).toBe(true);
    expect(fs.has('textures/t.png')).toBe(true); // lower-case klucz
    expect(fs.has('.ds_store')).toBe(false);       // junk pominięty
    expect(fs.get('textures/t.png')!.size).toBe(2);
  });
});

describe('fromFileList', () => {
  it('używa webkitRelativePath i pomija śmieci', () => {
    const a = Object.assign(new File([new Uint8Array([1, 2])], 't.png'), { webkitRelativePath: 'model/textures/t.png' });
    const b = Object.assign(new File([new Uint8Array([0])], '.DS_Store'), { webkitRelativePath: 'model/.DS_Store' });
    const fs = fromFileList([a, b] as unknown as File[]);
    expect(fs.has('model/textures/t.png')).toBe(true);
    expect(fs.size).toBe(1); // .DS_Store pominięty
  });
});
