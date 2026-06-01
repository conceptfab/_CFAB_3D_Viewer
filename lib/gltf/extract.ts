// lib/gltf/extract.ts
'use client';
// Glue przeglądarki: budowa wirtualnego FS z różnych wejść.
// fromZip / fromFileList są czyste (testowalne w Node); fromDataTransfer wymaga DOM.
import { unzipSync } from 'fflate';
import type { VirtualFs, VirtualFile } from './types';
import { toKey, isJunkPath } from './paths';

function addFile(fs: VirtualFs, path: string, blob: Blob): void {
  if (isJunkPath(path)) return;
  const vf: VirtualFile = { path, blob, size: blob.size };
  fs.set(toKey(path), vf);
}

/** Z `<input multiple webkitdirectory>` lub File[]: ścieżka = webkitRelativePath||name. */
export function fromFileList(files: FileList | File[]): VirtualFs {
  const fs: VirtualFs = new Map();
  for (const f of Array.from(files)) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    addFile(fs, rel, f);
  }
  return fs;
}

/** Z archiwum .zip (rozpakowanie w pamięci). */
export async function fromZip(blob: Blob): Promise<VirtualFs> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const entries = unzipSync(bytes);
  const fs: VirtualFs = new Map();
  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith('/')) continue; // wpis katalogu
    const arr = data as Uint8Array;
    const buf = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
    addFile(fs, path, new Blob([buf]));
  }
  return fs;
}

/** Z drag&drop folderu (DataTransferItemList → rekurencja webkitGetAsEntry). */
export async function fromDataTransfer(items: DataTransferItemList): Promise<VirtualFs> {
  const fs: VirtualFs = new Map();
  const roots: FileSystemEntry[] = [];
  for (const it of Array.from(items)) {
    const entry = it.webkitGetAsEntry?.();
    if (entry) roots.push(entry);
  }
  for (const entry of roots) await walkEntry(entry, fs);
  return fs;
}

async function walkEntry(entry: FileSystemEntry, fs: VirtualFs): Promise<void> {
  if (entry.isFile) {
    const file = await fileFromEntry(entry as FileSystemFileEntry);
    addFile(fs, entry.fullPath.replace(/^\//, ''), file);
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    let batch: FileSystemEntry[];
    do {
      batch = await readEntries(reader);
      for (const child of batch) await walkEntry(child, fs);
    } while (batch.length > 0);
  }
}

function fileFromEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}
