import * as THREE from 'three';

export type MaterialId =
  | 'jade'
  | 'walnut'
  | 'marble'
  | 'brass'
  | 'leather'
  | 'fabric';

export interface MaterialDef {
  id: MaterialId;
  name: string;
  swatch: string; // CSS color for swatch chip
  build: () => THREE.Material;
}

// Procedural noise — fakes surface variation when there are no real PBR textures.
// In production each material gets albedo/normal/roughness/AO maps from /public/textures/.
function noiseTexture(opts: {
  size?: number;
  scale?: number;
  contrast?: number;
  base?: number;
  channels?: 'rgb' | 'gray';
}): THREE.DataTexture {
  const size = opts.size ?? 256;
  const scale = opts.scale ?? 1;
  const contrast = opts.contrast ?? 1;
  const base = opts.base ?? 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // multi-octave value noise
      let v = 0;
      let amp = 1;
      let freq = scale;
      let norm = 0;
      for (let o = 0; o < 4; o++) {
        const nx = (x / size) * freq;
        const ny = (y / size) * freq;
        v += amp * pseudoNoise(nx, ny);
        norm += amp;
        amp *= 0.5;
        freq *= 2;
      }
      v = v / norm;
      const g = Math.max(0, Math.min(255, base + (v - 0.5) * 255 * contrast));
      const i = (y * size + x) * 4;
      data[i + 0] = g;
      data[i + 1] = g;
      data[i + 2] = g;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function pseudoNoise(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function makeNormalFromHeight(height: THREE.DataTexture, strength = 1): THREE.DataTexture {
  // central-difference normal map from a grayscale height texture
  const size = height.image.width;
  const src = height.image.data as Uint8Array;
  const dst = new Uint8Array(size * size * 4);
  const sample = (x: number, y: number) => {
    const xx = (x + size) % size;
    const yy = (y + size) % size;
    return src[(yy * size + xx) * 4] / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * strength;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * strength;
      // n = normalize(-dx, -dy, 1)
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      dst[i + 0] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      dst[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      dst[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      dst[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(dst, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// shared procedural maps
const microRoughness = noiseTexture({ scale: 6, contrast: 0.6, base: 180 });
const microHeight = noiseTexture({ scale: 8, contrast: 1, base: 128 });
const microNormal = makeNormalFromHeight(microHeight, 0.6);
const woodGrain = noiseTexture({ scale: 32, contrast: 1.2, base: 128 });
const woodGrainNormal = makeNormalFromHeight(woodGrain, 0.8);
const marbleVein = noiseTexture({ scale: 3, contrast: 1.4, base: 200 });

export const MATERIALS: MaterialDef[] = [
  {
    id: 'jade',
    name: 'Jadeit',
    swatch: '#1f7a55',
    build: () => {
      const m = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#1f7a55'),
        roughness: 0.45,
        metalness: 0,
        clearcoat: 0.4,
        clearcoatRoughness: 0.25,
        envMapIntensity: 0.8,
        normalMap: microNormal,
        normalScale: new THREE.Vector2(0.4, 0.4),
        roughnessMap: microRoughness,
      });
      return m;
    },
  },
  {
    id: 'walnut',
    name: 'Orzech',
    swatch: '#5a3a24',
    build: () => {
      const m = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#5a3a24'),
        roughness: 0.6,
        metalness: 0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.35,
        envMapIntensity: 0.7,
        normalMap: woodGrainNormal,
        normalScale: new THREE.Vector2(0.8, 0.8),
      });
      return m;
    },
  },
  {
    id: 'marble',
    name: 'Marmur',
    swatch: '#e8e6e1',
    build: () => {
      const m = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#f0eee8'),
        roughness: 0.18,
        metalness: 0,
        clearcoat: 0.9,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.2,
        roughnessMap: marbleVein,
      });
      return m;
    },
  },
  {
    id: 'brass',
    name: 'Mosiądz',
    swatch: '#c79443',
    build: () => {
      const m = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#b0823a'),
        roughness: 0.28,
        metalness: 1.0,
        envMapIntensity: 1.4,
        normalMap: microNormal,
        normalScale: new THREE.Vector2(0.15, 0.15),
      });
      return m;
    },
  },
  {
    id: 'leather',
    name: 'Skóra',
    swatch: '#3a2418',
    build: () => {
      const m = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#3a2418'),
        roughness: 0.75,
        metalness: 0,
        sheen: 0.3,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color('#8a5a3a'),
        envMapIntensity: 0.6,
        normalMap: microNormal,
        normalScale: new THREE.Vector2(1.2, 1.2),
      });
      return m;
    },
  },
  {
    id: 'fabric',
    name: 'Tkanina',
    swatch: '#9aa3ab',
    build: () => {
      const m = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#7a838a'),
        roughness: 1.0,
        metalness: 0,
        sheen: 1.0,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color('#cdd5da'),
        envMapIntensity: 0.5,
        normalMap: microNormal,
        normalScale: new THREE.Vector2(0.6, 0.6),
      });
      return m;
    },
  },
];

const cache = new Map<MaterialId, THREE.Material>();
export function getMaterial(id: MaterialId): THREE.Material {
  let m = cache.get(id);
  if (!m) {
    const def = MATERIALS.find((d) => d.id === id);
    if (!def) throw new Error(`Unknown material: ${id}`);
    m = def.build();
    cache.set(id, m);
  }
  return m;
}
