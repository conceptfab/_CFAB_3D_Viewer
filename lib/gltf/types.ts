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

// Typ wyniku ładowania (scene + dispose) żyje razem z loadFromFiles.ts
// (LoadFromFilesResult), bo zależy od THREE — tutaj go nie duplikujemy.
