// lib/gltf/paths.ts
// Czyste utils ścieżek dla wirtualnego FS importu glTF. Bez DOM, bez I/O.

/** Backslash→slash, zwinięcie powtórzonych slashy, rozwinięcie ./ i ../, bez wiodącego /. */
export function normalizePath(p: string): string {
  const s = p.replace(/\\/g, '/');
  const parts: string[] = [];
  for (const seg of s.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { parts.pop(); continue; }
    parts.push(seg);
  }
  return parts.join('/');
}

/** Klucz VFS / porównań: znormalizowana ścieżka w lower-case. */
export function toKey(p: string): string {
  return normalizePath(p).toLowerCase();
}

/** Katalog ścieżki ('' dla roota). */
export function dirOf(p: string): string {
  const n = normalizePath(p);
  const i = n.lastIndexOf('/');
  return i === -1 ? '' : n.slice(0, i);
}

/** Łączy względny URI z katalogiem bazowym i normalizuje. */
export function joinRelative(baseDir: string, rel: string): string {
  const base = normalizePath(baseDir);
  return normalizePath(base === '' ? rel : `${base}/${rel}`);
}

/** Rozszerzenie pliku w lower-case (z kropką) lub ''. */
export function extOf(p: string): string {
  const n = normalizePath(p);
  const slash = n.lastIndexOf('/');
  const name = slash === -1 ? n : n.slice(slash + 1);
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

const JUNK_BASENAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);

/** Śmieci do zignorowania: __MACOSX (dowolny segment), .DS_Store, Thumbs.db, dotfiles. */
export function isJunkPath(p: string): boolean {
  const segments = normalizePath(p).split('/');
  // __MACOSX jako KTÓRYKOLWIEK segment (folder lub jego dziecko) — bez fałszywych
  // trafień na nazwy typu „__MACOSXfoo".
  if (segments.includes('__MACOSX')) return true;
  const name = segments[segments.length - 1] ?? '';
  if (JUNK_BASENAMES.has(name.toLowerCase())) return true;
  if (name.startsWith('.')) return true;
  return false;
}
