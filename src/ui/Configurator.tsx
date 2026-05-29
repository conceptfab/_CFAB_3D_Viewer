import { useStore, MODELS } from '../store';
import { MATERIALS } from '../viewer/materials/library';
import type { CameraPreset } from '../store';

const CAMERA_LABELS: { id: CameraPreset; label: string }[] = [
  { id: 'hero', label: 'Hero' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Bok' },
  { id: 'top', label: 'Góra' },
  { id: 'detail', label: 'Detal' },
];

export function Configurator() {
  const modelId = useStore((s) => s.modelId);
  const setModel = useStore((s) => s.setModel);
  const material = useStore((s) => s.material);
  const setMaterial = useStore((s) => s.setMaterial);

  const def = MODELS.find((m) => m.id === modelId) ?? MODELS[0];

  return (
    <aside className="sidebar">
      <h1>Produkt</h1>
      <h2>{def.name}</h2>

      <div className="section">
        <div className="section-label">Model</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {MODELS.map((m) => (
            <button
              key={m.id}
              className={`model-btn ${modelId === m.id ? 'active' : ''}`}
              onClick={() => setModel(m.id)}
              style={{
                appearance: 'none',
                border: `1px solid ${modelId === m.id ? 'var(--ink)' : 'var(--border)'}`,
                background: modelId === m.id ? 'var(--ink)' : '#fff',
                color: modelId === m.id ? '#fff' : 'var(--ink)',
                padding: '8px 10px',
                borderRadius: 8,
                font: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {def.overrideMaterial && (
        <div className="section">
          <div className="section-label">Materiał</div>
          <div className="material-grid">
            {MATERIALS.map((m) => (
              <button
                key={m.id}
                className={`swatch ${material === m.id ? 'active' : ''}`}
                onClick={() => setMaterial(m.id)}
                title={m.name}
              >
                <span className="swatch-chip" style={{ background: m.swatch }} />
                <span className="swatch-name">{m.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!def.overrideMaterial && (
        <div className="section">
          <div className="section-label">Materiał</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>
            Model dostarcza własne PBR tekstury embedded w GLB.
            Przełącz na <em>JadeToad</em> żeby zobaczyć podmianę presetów.
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-label">Pipeline</div>
        <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--muted)', fontSize: 12, lineHeight: 1.7 }}>
          <li>Tło: radialny gradient (jasne centrum → ciemniejsze brzegi)</li>
          <li>HDRI: studio_small_03 4k (IBL, niewidoczne tło)</li>
          <li>Światło: jedno delikatne kierunkowe (key)</li>
          <li>Podłoga: brak (samo tło) + niewidoczny shadow-catcher</li>
          <li>Cień: kierunkowy PCSS + kontakt AO (na podłodze)</li>
          <li>Self-shadow: key directional (PCSS, 4K)</li>
          <li>Post: SMAA (bez N8AO/Bloom — czysto)</li>
          <li>Tone mapping: Khronos PBR Neutral</li>
        </ul>
      </div>
    </aside>
  );
}

export function CameraButtons() {
  const camera = useStore((s) => s.camera);
  const setCamera = useStore((s) => s.setCamera);
  return (
    <div className="camera-buttons">
      {CAMERA_LABELS.map((c) => (
        <button
          key={c.id}
          className={camera === c.id ? 'active' : ''}
          onClick={() => setCamera(c.id)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
