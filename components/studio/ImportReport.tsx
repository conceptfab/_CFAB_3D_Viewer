// components/studio/ImportReport.tsx
'use client';
import type { ValidationReport } from '@/lib/gltf/types';
export function ImportReport({ report }: { report: ValidationReport }) {
  const fatals = report.issues.filter((i) => i.level === 'fatal');
  const warns = report.issues.filter((i) => i.level === 'warning');
  const infos = report.issues.filter((i) => i.level === 'info');
  return (
    <div className="import-report" role="status">
      <p><strong>{report.ok ? '✅ Model gotowy do wczytania' : '❌ Nie można wczytać'}</strong> — {report.kind}, {Math.round(report.totalBytes / 1_000_000)} MB</p>
      {fatals.length > 0 && <ul className="import-report__fatal">{fatals.map((i, k) => <li key={k}>⛔ {i.message}</li>)}</ul>}
      {warns.length > 0 && <ul className="import-report__warn">{warns.map((i, k) => <li key={k}>⚠️ {i.message}</li>)}</ul>}
      {report.resolved.length > 0 && <p>Rozwiązane zależności: {report.resolved.length}</p>}
      {infos.length > 0 && <details><summary>Zignorowane pliki ({infos.length})</summary><ul>{infos.map((i, k) => <li key={k}>{i.path}</li>)}</ul></details>}
    </div>
  );
}
