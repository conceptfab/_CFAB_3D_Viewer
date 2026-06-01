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
