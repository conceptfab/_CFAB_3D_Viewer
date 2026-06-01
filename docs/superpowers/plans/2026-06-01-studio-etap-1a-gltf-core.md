# Studio — Etap 1a: rdzeń import/walidacja glTF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Wykonuj na osobnej gałęzi/worktree (NIE na `main`).**
> Plan 1 z 3 dla Etapu 1 (spec: `docs/superpowers/specs/2026-06-01-studio-etap-1-import-design.md`). Następne: 1b (persystencja), 1c (workspace UI).

**Goal:** Czysta, przetestowana biblioteka do importu i walidacji modeli glTF (single `.glb` oraz multi-file `.gltf` + `.bin` + tekstury, także z folderu/`.zip`), produkująca `ValidationReport` i ładująca model do THREE z mapowaniem URI → Blob.

**Architecture:** Twardy podział na **czystą logikę** (ścieżki, wykrycie roota, walidacja — testowane jednostkowo w Node) i **cienką warstwę glue przeglądarki** (ekstrakcja z DataTransfer/`webkitdirectory`/zip, ładowanie THREE — weryfikowane na tymczasowej stronie dev). Walidacja jest funkcją async operującą na wirtualnym FS (`Map<znormalizowana_ścieżka, {blob,size}>`) i nie zależy od DOM ani DB.

**Tech Stack:** TypeScript, three 0.169 (`examples/jsm` GLTFLoader/DRACOLoader/MeshoptDecoder), fflate (zip), vitest (env node).

---

## Struktura plików

| Plik | Odpowiedzialność | Testowany |
|---|---|---|
| `lib/gltf/types.ts` | Typy współdzielone (`VirtualFile`, `VirtualFs`, `ValidationIssue`, `ValidationReport`, `LoadResult`) | — (interfejsy) |
| `lib/gltf/paths.ts` | Czyste utils ścieżek: normalizacja, klucz, dir, join, ext, junk | ✅ node |
| `lib/gltf/virtualFs.ts` | Wykrycie plików-rootów (`.gltf`/`.glb`) w VFS | ✅ node |
| `lib/gltf/validate.ts` | `validateGltf(fs, rootKey)` → `ValidationReport` (serce) | ✅ node |
| `lib/gltf/extract.ts` | Glue: budowa VFS z `FileList`/`DataTransfer`/`.zip` | ✅ częściowo (zip, FileList) |
| `lib/gltf/loadFromFiles.ts` | Glue: `GLTFLoader` + `setURLModifier` + Draco/meshopt | ⛔ ręcznie (THREE/DOM) |
| `app/_dev/gltf-import/page.tsx` | Tymczasowa strona dev do ręcznej weryfikacji (usuwana w Planie 1c) | ⛔ ręcznie |

---

## Task 0: Zależności

**Files:** `package.json`

- [ ] **Step 1: Zainstaluj fflate jako zależność bezpośrednią**

`fflate` jest już obecne tranzytywnie, ale import musi być stabilny — czynimy je bezpośrednim.

Run: `npm install fflate`
Expected: `package.json` → `dependencies.fflate` pojawia się; `npm ls fflate` pokazuje wersję.

- [ ] **Step 2: Sanity build typów (three addons istnieją)**

Run: `node -e "require('fs').accessSync('node_modules/three/examples/jsm/loaders/GLTFLoader.js'); console.log('ok')"`
Expected: wypisuje `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(studio): add fflate as direct dependency for gltf import"
```

---

## Task 1: `lib/gltf/paths.ts` — czyste utils ścieżek

**Files:**
- Create: `lib/gltf/paths.ts`
- Test: `lib/gltf/paths.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/gltf/paths.test.ts`
Expected: FAIL — `Failed to resolve import "./paths"`.

- [ ] **Step 3: Write minimal implementation**

```ts
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

/** Śmieci do zignorowania: __MACOSX, .DS_Store, Thumbs.db, dotfiles. */
export function isJunkPath(p: string): boolean {
  const n = normalizePath(p);
  if (n === '__MACOSX' || n.startsWith('__MACOSX/') || n.includes('/__MACOSX/')) return true;
  const slash = n.lastIndexOf('/');
  const name = slash === -1 ? n : n.slice(slash + 1);
  if (JUNK_BASENAMES.has(name.toLowerCase())) return true;
  if (name.startsWith('.')) return true;
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/gltf/paths.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add lib/gltf/paths.ts lib/gltf/paths.test.ts
git commit -m "feat(studio): add pure path utils for gltf virtual FS"
```

---

## Task 2: `lib/gltf/types.ts` — typy współdzielone

**Files:**
- Create: `lib/gltf/types.ts`

- [ ] **Step 1: Write the types**

```ts
// lib/gltf/types.ts
// Typy współdzielone rdzenia import/walidacja glTF.

/** Pojedynczy plik w wirtualnym FS importu. `path` zachowuje oryginalną wielkość liter. */
export interface VirtualFile {
  path: string;
  blob: Blob;
  size: number;
}

/** Klucz = znormalizowana ścieżka w lower-case (patrz paths.toKey). */
export type VirtualFs = Map<string, VirtualFile>;

export type IssueLevel = 'fatal' | 'warning' | 'info';

export interface ValidationIssue {
  level: IssueLevel;
  /** Maszynowy kod: PARSE_ERROR | BAD_VERSION | UNSUPPORTED_EXTENSION | MISSING_BUFFER
   *  | MISSING_TEXTURE | TOO_LARGE | UNUSED_FILE | ROOT_NOT_FOUND */
  code: string;
  /** Komunikat dla UI (PL). */
  message: string;
  /** Ścieżka pliku, którego dotyczy (jeśli dotyczy). */
  path?: string;
}

export interface ValidationReport {
  /** true gdy brak problemów `fatal`. */
  ok: boolean;
  root: string;
  kind: 'gltf' | 'glb';
  issues: ValidationIssue[];
  /** Klucze rozwiązanych zależności (obecne bufory + tekstury). */
  resolved: string[];
  /** Klucze referencji nierozwiązanych. */
  missing: string[];
  /** Klucze plików obecnych, ale nieużywanych (poza rootem, bez śmieci). */
  unused: string[];
  /** Suma bajtów: root + rozwiązane zależności. */
  totalBytes: number;
}

/** Wynik załadowania modelu do THREE (loadFromFiles). */
export interface LoadResult {
  /** THREE.Group (gltf.scene) — typ luźny, by types.ts nie zależał od three. */
  scene: unknown;
  /** Zwalnia wszystkie object-URL-e i dekodery. */
  dispose: () => void;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: brak błędów dotyczących `lib/gltf/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/gltf/types.ts
git commit -m "feat(studio): add shared types for gltf import core"
```

---

## Task 3: `lib/gltf/virtualFs.ts` — wykrycie roota

**Files:**
- Create: `lib/gltf/virtualFs.ts`
- Test: `lib/gltf/virtualFs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/gltf/virtualFs.test.ts
import { describe, it, expect } from 'vitest';
import type { VirtualFs, VirtualFile } from './types';
import { findModelRoots, pickDefaultRoot } from './virtualFs';
import { toKey } from './paths';

/** Buduje VFS z listy ścieżek (zawartość nieistotna dla wykrycia roota). */
function fsOf(paths: string[]): VirtualFs {
  const m: VirtualFs = new Map();
  for (const p of paths) {
    const vf: VirtualFile = { path: p, blob: new Blob([]), size: 0 };
    m.set(toKey(p), vf);
  }
  return m;
}

describe('findModelRoots', () => {
  it('znajduje pojedynczy .gltf, ignorując tekstury i śmieci', () => {
    const fs = fsOf(['scene.gltf', 'scene.bin', 'textures/t.png', '.DS_Store']);
    expect(findModelRoots(fs)).toEqual(['scene.gltf']);
  });

  it('znajduje .glb w podkatalogu source (układ Sketchfab)', () => {
    const fs = fsOf(['source/model.glb', 'textures/a.png', 'textures/b.png']);
    expect(findModelRoots(fs)).toEqual(['source/model.glb']);
  });

  it('przy wielu kandydatach sortuje płycej-w-drzewie najpierw', () => {
    const fs = fsOf(['sub/b.gltf', 'a.glb']);
    expect(findModelRoots(fs)).toEqual(['a.glb', 'sub/b.gltf']);
  });

  it('zwraca pustą listę gdy brak modelu', () => {
    expect(findModelRoots(fsOf(['textures/a.png']))).toEqual([]);
  });
});

describe('pickDefaultRoot', () => {
  it('zwraca pierwszego kandydata lub null', () => {
    expect(pickDefaultRoot(['a.glb', 'sub/b.gltf'])).toBe('a.glb');
    expect(pickDefaultRoot([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/gltf/virtualFs.test.ts`
Expected: FAIL — `Failed to resolve import "./virtualFs"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/gltf/virtualFs.ts
import type { VirtualFs } from './types';
import { extOf, isJunkPath } from './paths';

/** Klucze plików-rootów (.gltf/.glb), bez śmieci, posortowane:
 *  płycej w drzewie najpierw, potem alfabetycznie. */
export function findModelRoots(fs: VirtualFs): string[] {
  const roots: string[] = [];
  for (const key of fs.keys()) {
    if (isJunkPath(key)) continue;
    const e = extOf(key);
    if (e === '.gltf' || e === '.glb') roots.push(key);
  }
  return roots.sort((a, b) => {
    const da = a.split('/').length;
    const db = b.split('/').length;
    if (da !== db) return da - db;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/** Domyślny root: pierwszy kandydat (UI pozwala wybrać przy wielu). */
export function pickDefaultRoot(roots: string[]): string | null {
  return roots.length > 0 ? roots[0] : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/gltf/virtualFs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gltf/virtualFs.ts lib/gltf/virtualFs.test.ts
git commit -m "feat(studio): detect gltf/glb roots in virtual FS"
```

---

## Task 4: `lib/gltf/validate.ts` — walidacja (serce)

**Files:**
- Create: `lib/gltf/validate.ts`
- Test: `lib/gltf/validate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/gltf/validate.test.ts
import { describe, it, expect } from 'vitest';
import type { VirtualFs, VirtualFile } from './types';
import { validateGltf } from './validate';
import { toKey } from './paths';

type Entry = { text?: string; bytes?: Uint8Array; size?: number };

function fsOf(entries: Record<string, Entry>): VirtualFs {
  const m: VirtualFs = new Map();
  for (const [path, e] of Object.entries(entries)) {
    const blob = e.bytes ? new Blob([e.bytes]) : new Blob([e.text ?? '']);
    const size = e.size ?? blob.size;
    const vf: VirtualFile = { path, blob, size };
    m.set(toKey(path), vf);
  }
  return m;
}

const gltf = (obj: object) => JSON.stringify(obj);

/** Buduje minimalny binarny GLB z podanym JSON-em (chunk JSON, bez BIN). */
function makeGlb(json: object): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (jsonBytes.length % 4)) % 4;
  const chunk = new Uint8Array(jsonBytes.length + pad).fill(0x20);
  chunk.set(jsonBytes, 0);
  const total = 12 + 8 + chunk.length;
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, chunk.length, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  new Uint8Array(buf, 20).set(chunk);
  return new Uint8Array(buf);
}

describe('validateGltf — .gltf multi-file', () => {
  it('OK gdy bufor i tekstura obecne; plik nieużywany → info', async () => {
    const fs = fsOf({
      'scene.gltf': { text: gltf({ asset: { version: '2.0' }, buffers: [{ uri: 'scene.bin' }], images: [{ uri: 'textures/t.png' }] }) },
      'scene.bin': { size: 100 },
      'textures/t.png': { size: 50 },
      'license.txt': { size: 10 },
      '.DS_Store': { size: 5 },
    });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('gltf');
    expect(r.resolved).toContain('scene.bin');
    expect(r.resolved).toContain('textures/t.png');
    expect(r.missing).toHaveLength(0);
    expect(r.unused).toEqual(['license.txt']); // .DS_Store pominięty (junk)
    expect(r.issues.some((i) => i.code === 'UNUSED_FILE' && i.path === 'license.txt')).toBe(true);
  });

  it('brak tekstury → warning, ale ok=true', async () => {
    const fs = fsOf({
      'scene.gltf': { text: gltf({ asset: { version: '2.0' }, buffers: [{ uri: 'scene.bin' }], images: [{ uri: 'textures/t.png' }] }) },
      'scene.bin': { size: 100 },
    });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.ok).toBe(true);
    expect(r.missing).toContain('textures/t.png');
    expect(r.issues.some((i) => i.level === 'warning' && i.code === 'MISSING_TEXTURE')).toBe(true);
  });

  it('brak bufora .bin → fatal, ok=false', async () => {
    const fs = fsOf({
      'scene.gltf': { text: gltf({ asset: { version: '2.0' }, buffers: [{ uri: 'scene.bin' }] }) },
    });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.level === 'fatal' && i.code === 'MISSING_BUFFER')).toBe(true);
  });

  it('zła wersja → fatal', async () => {
    const fs = fsOf({ 'scene.gltf': { text: gltf({ asset: { version: '1.0' } }) } });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'BAD_VERSION')).toBe(true);
  });

  it('niewspierane wymagane rozszerzenie (KTX2/Basis) → fatal', async () => {
    const fs = fsOf({
      'scene.gltf': { text: gltf({ asset: { version: '2.0' }, extensionsRequired: ['KHR_texture_basisu'] }) },
    });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'UNSUPPORTED_EXTENSION')).toBe(true);
  });

  it('Draco/meshopt jako wymagane → dozwolone (brak fatala z tego tytułu)', async () => {
    const fs = fsOf({
      'scene.gltf': { text: gltf({ asset: { version: '2.0' }, extensionsRequired: ['KHR_draco_mesh_compression'] }) },
    });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.issues.some((i) => i.code === 'UNSUPPORTED_EXTENSION')).toBe(false);
  });

  it('uszkodzony JSON → fatal PARSE_ERROR', async () => {
    const fs = fsOf({ 'scene.gltf': { text: 'to-nie-json' } });
    const r = await validateGltf(fs, 'scene.gltf');
    expect(r.ok).toBe(false);
    expect(r.issues[0].code).toBe('PARSE_ERROR');
  });

  it('osadzony data: URI nie jest traktowany jako brakujący', async () => {
    const fs = fsOf({
      'm.gltf': { text: gltf({ asset: { version: '2.0' }, buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }] }) },
    });
    const r = await validateGltf(fs, 'm.gltf');
    expect(r.missing).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it('przekroczenie limitu rozmiaru → fatal TOO_LARGE', async () => {
    const fs = fsOf({
      'scene.gltf': { text: gltf({ asset: { version: '2.0' }, buffers: [{ uri: 'scene.bin' }] }), size: 10 },
      'scene.bin': { size: 1000 },
    });
    const r = await validateGltf(fs, 'scene.gltf', { maxBytes: 500 });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'TOO_LARGE')).toBe(true);
  });
});

describe('validateGltf — .glb single-file', () => {
  it('OK dla poprawnego GLB; luźna tekstura obok → info UNUSED_FILE', async () => {
    const fs = fsOf({
      'source/model.glb': { bytes: makeGlb({ asset: { version: '2.0' } }) },
      'textures/x.png': { size: 50 },
    });
    const r = await validateGltf(fs, 'source/model.glb');
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('glb');
    expect(r.unused).toContain('textures/x.png');
  });

  it('zły nagłówek GLB → fatal PARSE_ERROR', async () => {
    const fs = fsOf({ 'bad.glb': { bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) } });
    const r = await validateGltf(fs, 'bad.glb');
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'PARSE_ERROR')).toBe(true);
  });
});

describe('validateGltf — root nieobecny', () => {
  it('zwraca fatal ROOT_NOT_FOUND', async () => {
    const r = await validateGltf(new Map(), 'brak.gltf');
    expect(r.ok).toBe(false);
    expect(r.issues[0].code).toBe('ROOT_NOT_FOUND');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/gltf/validate.test.ts`
Expected: FAIL — `Failed to resolve import "./validate"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/gltf/validate.ts
import type { VirtualFs, ValidationIssue, ValidationReport } from './types';
import { dirOf, joinRelative, toKey, extOf, isJunkPath } from './paths';

/** Rozszerzenia, które potrafimy obsłużyć nawet gdy są `required`. */
const SUPPORTED_REQUIRED_EXTENSIONS = new Set<string>([
  'KHR_draco_mesh_compression',
  'EXT_meshopt_compression',
  'KHR_mesh_quantization',
]);

const GLB_MAGIC = 0x46546c67; // 'glTF'
const GLB_CHUNK_JSON = 0x4e4f534a; // 'JSON'

export const DEFAULT_MAX_BYTES = 1_000_000_000; // 1 GB (zgodnie z lib/blob/limits)

const mb = (n: number) => Math.round(n / 1_000_000);

export async function validateGltf(
  fs: VirtualFs,
  rootKey: string,
  opts: { maxBytes?: number } = {}
): Promise<ValidationReport> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const issues: ValidationIssue[] = [];
  const resolved: string[] = [];
  const missing: string[] = [];
  const kind: 'gltf' | 'glb' = extOf(rootKey) === '.glb' ? 'glb' : 'gltf';

  const root = fs.get(rootKey);
  if (!root) {
    return {
      ok: false, root: rootKey, kind, resolved, missing, unused: [], totalBytes: 0,
      issues: [{ level: 'fatal', code: 'ROOT_NOT_FOUND', message: `Nie znaleziono pliku głównego: ${rootKey}` }],
    };
  }

  let totalBytes = root.size;
  let json: any;
  try {
    json = kind === 'glb' ? await parseGlbJson(root.blob) : JSON.parse(await root.blob.text());
  } catch (e) {
    issues.push({ level: 'fatal', code: 'PARSE_ERROR', message: `Nie udało się odczytać glTF: ${(e as Error).message}`, path: rootKey });
    return { ok: false, root: rootKey, kind, issues, resolved, missing, unused: [], totalBytes };
  }

  if (json?.asset?.version !== '2.0') {
    issues.push({ level: 'fatal', code: 'BAD_VERSION', message: `Wymagana wersja glTF 2.0 (znaleziono: ${json?.asset?.version ?? 'brak'}).`, path: rootKey });
  }

  for (const ext of (json?.extensionsRequired ?? [])) {
    if (!SUPPORTED_REQUIRED_EXTENSIONS.has(ext)) {
      issues.push({ level: 'fatal', code: 'UNSUPPORTED_EXTENSION', message: `Niewspierane wymagane rozszerzenie: ${ext}.` });
    }
  }

  // Referencje zewnętrzne: buffers[].uri + images[].uri (pomijamy data:).
  const baseDir = dirOf(rootKey);
  const refs: Array<{ uri: string; type: 'buffer' | 'image' }> = [];
  for (const b of (json?.buffers ?? [])) if (typeof b?.uri === 'string') refs.push({ uri: b.uri, type: 'buffer' });
  for (const im of (json?.images ?? [])) if (typeof im?.uri === 'string') refs.push({ uri: im.uri, type: 'image' });

  const referencedKeys = new Set<string>();
  for (const ref of refs) {
    if (ref.uri.startsWith('data:')) continue;
    let decoded = ref.uri;
    try { decoded = decodeURIComponent(ref.uri); } catch { /* zostaw surowy */ }
    const key = toKey(joinRelative(baseDir, decoded));
    referencedKeys.add(key);
    const file = fs.get(key);
    if (file) {
      resolved.push(key);
      totalBytes += file.size;
    } else {
      missing.push(key);
      if (ref.type === 'buffer') {
        issues.push({ level: 'fatal', code: 'MISSING_BUFFER', message: `Brak bufora danych: ${ref.uri}`, path: key });
      } else {
        issues.push({ level: 'warning', code: 'MISSING_TEXTURE', message: `Brak tekstury: ${ref.uri} — wczytanie z placeholderem.`, path: key });
      }
    }
  }

  if (totalBytes > maxBytes) {
    issues.push({ level: 'fatal', code: 'TOO_LARGE', message: `Model (${mb(totalBytes)} MB) przekracza limit ${mb(maxBytes)} MB.` });
  }

  const unused: string[] = [];
  for (const key of fs.keys()) {
    if (key === rootKey || isJunkPath(key) || referencedKeys.has(key)) continue;
    unused.push(key);
    issues.push({ level: 'info', code: 'UNUSED_FILE', message: `Plik nieużywany przez model (zignorowany): ${key}`, path: key });
  }

  const ok = !issues.some((i) => i.level === 'fatal');
  return { ok, root: rootKey, kind, issues, resolved, missing, unused, totalBytes };
}

/** Odczytuje chunk JSON z binarnego GLB. Rzuca przy złym nagłówku/chunku. */
async function parseGlbJson(blob: Blob): Promise<any> {
  const buf = await blob.arrayBuffer();
  if (buf.byteLength < 20) throw new Error('Plik GLB za krótki.');
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== GLB_MAGIC) throw new Error('Nieprawidłowy nagłówek GLB (magic).');
  const chunkLen = dv.getUint32(12, true);
  const chunkType = dv.getUint32(16, true);
  if (chunkType !== GLB_CHUNK_JSON) throw new Error('Pierwszy chunk GLB nie jest typu JSON.');
  const jsonBytes = new Uint8Array(buf, 20, chunkLen);
  return JSON.parse(new TextDecoder().decode(jsonBytes));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/gltf/validate.test.ts`
Expected: PASS (all 12).

- [ ] **Step 5: Commit**

```bash
git add lib/gltf/validate.ts lib/gltf/validate.test.ts
git commit -m "feat(studio): add gltf validation core (refs/version/extensions/size)"
```

---

## Task 5: `lib/gltf/extract.ts` — budowa VFS z wejścia

**Files:**
- Create: `lib/gltf/extract.ts`
- Test: `lib/gltf/extract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/gltf/extract.test.ts`
Expected: FAIL — `Failed to resolve import "./extract"`.

- [ ] **Step 3: Write minimal implementation**

```ts
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
    addFile(fs, path, new Blob([data as Uint8Array]));
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/gltf/extract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gltf/extract.ts lib/gltf/extract.test.ts
git commit -m "feat(studio): build virtual FS from folder/zip/file-list input"
```

---

## Task 6: `lib/gltf/loadFromFiles.ts` — ładowanie do THREE

**Files:**
- Create: `lib/gltf/loadFromFiles.ts`

> Brak testu jednostkowego: moduł zależy od THREE i `URL.createObjectURL` (DOM).
> Weryfikacja w Task 7 (strona dev). Logika mapowania URI jest zminimalizowana
> i deterministyczna (klucz przez `toKey`).

- [ ] **Step 1: Write the implementation**

```ts
// lib/gltf/loadFromFiles.ts
'use client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { VirtualFs } from './types';
import { dirOf, extOf, toKey } from './paths';

// Ten sam CDN dekodera Draco, którego domyślnie używa drei (useGLTF) — spójność.
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

export interface LoadFromFilesResult {
  scene: THREE.Group;
  /** Zwalnia object-URL-e i dekoder Draco. Wołać po wczytaniu / odmontowaniu. */
  dispose: () => void;
}

/**
 * Ładuje model glTF/glb z wirtualnego FS, mapując referencje URI → object-URL-e Blob.
 * Strategia: `loader.parse(content, baseDir, …)` z `manager.setURLModifier`, który
 * tłumaczy KAŻDY żądany URI (znormalizowany przez toKey) na object-URL z mapy.
 */
export async function loadFromFiles(fs: VirtualFs, rootKey: string): Promise<LoadFromFilesResult> {
  const objectUrls = new Map<string, string>();
  for (const [key, vf] of fs) objectUrls.set(key, URL.createObjectURL(vf.blob));

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    // Object-URL roota i już-zmapowane URL-e przepuszczamy bez zmian.
    if (url.startsWith('blob:')) return url;
    let u = url;
    try { u = decodeURIComponent(url); } catch { /* zostaw */ }
    return objectUrls.get(toKey(u)) ?? url;
  });

  const loader = new GLTFLoader(manager);
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);

  const root = fs.get(rootKey);
  if (!root) throw new Error(`Brak roota w VFS: ${rootKey}`);

  // baseDir z końcowym '/' → GLTFLoader rozwiązuje względne URI do pełnej ścieżki VFS.
  const baseDir = dirOf(rootKey);
  const path = baseDir === '' ? '' : `${baseDir}/`;

  const content: ArrayBuffer | string =
    extOf(rootKey) === '.glb' ? await root.blob.arrayBuffer() : await root.blob.text();

  const dispose = () => {
    for (const u of objectUrls.values()) URL.revokeObjectURL(u);
    draco.dispose();
  };

  try {
    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      loader.parse(content, path, resolve as (g: unknown) => void, reject);
    });
    return { scene: gltf.scene, dispose };
  } catch (e) {
    dispose();
    throw e;
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: brak błędów w `lib/gltf/loadFromFiles.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/gltf/loadFromFiles.ts
git commit -m "feat(studio): load gltf/glb from virtual FS via URI->blob mapping"
```

---

## Task 7: Strona dev — ręczna weryfikacja na danych `_test`

**Files:**
- Create: `app/_dev/gltf-import/page.tsx`

> Tymczasowa strona do ręcznej weryfikacji ekstrakcji + walidacji + ładowania.
> **Usuwana w Planie 1c**, gdy powstaje prawdziwy workspace.

- [ ] **Step 1: Write the dev page**

```tsx
// app/_dev/gltf-import/page.tsx
'use client';
import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import * as THREE from 'three';
import { fromDataTransfer, fromFileList, fromZip } from '@/lib/gltf/extract';
import { findModelRoots, pickDefaultRoot } from '@/lib/gltf/virtualFs';
import { validateGltf } from '@/lib/gltf/validate';
import { loadFromFiles } from '@/lib/gltf/loadFromFiles';
import type { ValidationReport } from '@/lib/gltf/types';

export default function GltfImportDevPage() {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [obj, setObj] = useState<THREE.Group | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleFs(fs: Map<string, { path: string; blob: Blob; size: number }>) {
    setErr(null); setObj(null); setReport(null);
    const root = pickDefaultRoot(findModelRoots(fs));
    if (!root) { setErr('Brak pliku .gltf/.glb w wejściu.'); return; }
    const rep = await validateGltf(fs, root);
    setReport(rep);
    if (!rep.ok) return;
    try {
      const { scene } = await loadFromFiles(fs, root);
      setObj(scene);
    } catch (e) { setErr(`Ładowanie nieudane: ${(e as Error).message}`); }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', height: '100vh' }}>
      <aside style={{ padding: 16, overflow: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
        <h3>glTF import — DEV</h3>
        <p>Przeciągnij folder lub .zip tutaj, albo wybierz folder:</p>
        <input
          type="file"
          // @ts-expect-error webkitdirectory nie jest w typach React
          webkitdirectory=""
          multiple
          onChange={(e) => e.target.files && handleFs(fromFileList(e.target.files))}
        />
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            const dt = e.dataTransfer;
            const file = dt.files?.[0];
            if (file && file.name.toLowerCase().endsWith('.zip')) handleFs(await fromZip(file));
            else handleFs(await fromDataTransfer(dt.items));
          }}
          style={{ marginTop: 12, padding: 24, border: '2px dashed #888', textAlign: 'center' }}
        >
          drop folder / .zip
        </div>
        {err && <pre style={{ color: 'crimson' }}>{err}</pre>}
        {report && <pre>{JSON.stringify(report, null, 2)}</pre>}
      </aside>
      <main>
        <Canvas camera={{ position: [3, 2, 4] }}>
          <color attach="background" args={['#202227']} />
          {obj ? (
            <Stage environment="city" intensity={0.5}>
              <primitive object={obj} />
            </Stage>
          ) : null}
          <OrbitControls />
        </Canvas>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Uruchom dev server i zweryfikuj ręcznie**

Run: `npm run dev` i otwórz `http://localhost:3000/_dev/gltf-import`

Weryfikacja na `_test/`:
- Przeciągnij folder `_test/battlefield_4_-_t-90a/` → raport: `ok:true`, `resolved` zawiera `scene.bin` + 15 wpisów `textures/...`, `unused` zawiera `license.txt`, model renderuje się w prawym panelu.
- Przeciągnij folder `_test/firefly-saunders-sp/` → root = `source/j34_firefly_gup.glb`, `unused` zawiera luźne tekstury, model się ładuje.
- Przeciągnij folder `_test/realistic-caravan-caravelle-3d-model/` → root = `.glb` (nazwa ze spacją), model się ładuje.
- Spakuj `battlefield` do `.zip` i upuść → identyczny wynik.
- Usuń jedną teksturę z folderu → `ok:true` + warning `MISSING_TEXTURE`; model ładuje się (placeholder).
- Usuń `scene.bin` → `ok:false` + fatal `MISSING_BUFFER`; model NIE ładowany.

Expected: wszystkie powyższe zgodne. Jeśli nie — popraw odpowiedni moduł (`extract`/`validate`/`loadFromFiles`) i powtórz.

- [ ] **Step 3: Commit**

```bash
git add app/_dev/gltf-import/page.tsx
git commit -m "chore(studio): add temporary dev page to verify gltf import (removed in 1c)"
```

---

## Self-Review

**Spec coverage (sekcja 2 specu — Import + walidacja):**
- 2a wejście (folder/zip/picker/glb) → Task 5 (`extract.ts`: fromDataTransfer/fromZip/fromFileList). ✅
- 2b wykrycie roota → Task 3 (`virtualFs.ts`). ✅
- 2c walidacja (tabela reguł: PARSE/version/ext/bufor/rozmiar/tekstura/unused) → Task 4 (`validate.ts`), pełne pokrycie testami. ✅
- 2d raport → struktura `ValidationReport` (Task 2) + render na stronie dev (Task 7); pełne UI raportu w Planie 1c. ✅ (granica jawna)
- 2e wczytanie (GLTFLoader + setURLModifier + Draco/meshopt) → Task 6 (`loadFromFiles.ts`). ✅
- KTX2 jako niewspierane → Task 4 test `UNSUPPORTED_EXTENSION`. ✅
- Fixtures bez binariów (synthetic inline) + integracja na `_test` ręcznie → Task 4 + Task 7. ✅

**Placeholder scan:** brak TBD/TODO; każdy krok kodu ma pełny kod; komendy z oczekiwanym wynikiem. ✅

**Type consistency:** `VirtualFs`/`VirtualFile`/`ValidationReport`/`ValidationIssue` zdefiniowane w Task 2 i używane spójnie w Task 3–7. `validateGltf(fs, rootKey, {maxBytes?})` o tej samej sygnaturze w teście i implementacji (Task 4). `toKey/dirOf/joinRelative/extOf/isJunkPath` z Task 1 używane w Task 3/4/5/6 pod tymi samymi nazwami. ✅

**Granice (poza Planem 1a, do 1b/1c):** pełne UI raportu i `RootPicker`, integracja ze store i dual-view, persystencja, upload źródła, presety. Usunięcie strony dev `app/_dev/gltf-import` należy do Planu 1c.
