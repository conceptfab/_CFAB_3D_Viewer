import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, MODELS } from '../store';
import { getMaterial } from './materials/library';

export function Product() {
  const modelId = useStore((s) => s.modelId);
  const materialId = useStore((s) => s.material);
  const setModelSize = useStore((s) => s.setModelSize);

  const def = useMemo(
    () => MODELS.find((m) => m.id === modelId) ?? MODELS[0],
    [modelId]
  );

  const { scene } = useGLTF(def.url);
  const ref = useRef<THREE.Group>(null);

  // Clone AND set shadow flags at render time — must be sync so AccumulativeShadows
  // sees castShadow=true on the very first frame it accumulates.
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        if (m.geometry && !m.geometry.attributes.normal) {
          m.geometry.computeVertexNormals();
        }
        // Bump texture anisotropy + env reflection strength for crisper PBR look
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const raw of mats) {
          const mat = raw as THREE.MeshStandardMaterial;
          if (!mat) continue;
          for (const key of [
            'map',
            'normalMap',
            'roughnessMap',
            'metalnessMap',
            'aoMap',
            'emissiveMap',
          ] as const) {
            const tex = (mat as any)[key] as THREE.Texture | null | undefined;
            if (tex) tex.anisotropy = 16;
          }
          if ('envMapIntensity' in mat) {
            mat.envMapIntensity = 1.0;
          }
        }
      }
    });
    return c;
  }, [scene]);

  // Material override applies in effect (safe — doesn't affect shadow shape)
  useEffect(() => {
    if (!def.overrideMaterial) return;
    const override = getMaterial(materialId);
    cloned.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).material = override;
      }
    });
  }, [cloned, materialId, def.overrideMaterial]);

  // Auto-fit & center
  useEffect(() => {
    if (!ref.current) return;
    const group = ref.current;
    group.position.set(0, 0, 0);
    group.scale.setScalar(1);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const scale = def.targetHeight / size.y;
    group.scale.setScalar(scale);

    const box2 = new THREE.Box3().setFromObject(cloned);
    const center2 = box2.getCenter(new THREE.Vector3());
    group.position.x = -center2.x;
    group.position.z = -center2.z;
    // Lift very slightly above the floor disc so the receiver plane sits cleanly
    // below all model geometry — prevents the shadow "hole" at the contact tangent.
    group.position.y = -box2.min.y + 0.005;

    // Publish world-space size so the studio (shadows/frustum) adapts to any
    // dynamically swapped object.
    const s = box2.getSize(new THREE.Vector3());
    setModelSize([s.x, s.y, s.z]);
  }, [cloned, def.targetHeight, setModelSize]);

  return <primitive ref={ref} object={cloned} />;
}

MODELS.forEach((m) => useGLTF.preload(m.url));
