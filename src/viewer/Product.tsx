import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';

function LoadedModel({ url }: { url: string }) {
  const envMapIntensity = useStore((s) => s.config.material.envMapIntensity);
  const setModelSize = useStore((s) => s.setModelSize);

  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      if (m.geometry && !m.geometry.attributes.normal) {
        m.geometry.computeVertexNormals();
      }
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
      }
    });
    return c;
  }, [scene]);

  // Globalny envMapIntensity ze storu (live).
  useEffect(() => {
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const raw of mats) {
        const mat = raw as THREE.MeshStandardMaterial;
        if (mat && 'envMapIntensity' in mat) mat.envMapIntensity = envMapIntensity;
      }
    });
  }, [cloned, envMapIntensity]);

  // Auto-fit & center do wysokości docelowej.
  useEffect(() => {
    if (!ref.current) return;
    const group = ref.current;
    group.position.set(0, 0, 0);
    group.scale.setScalar(1);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const targetHeight = 1.4;
    const scale = size.y > 0 ? targetHeight / size.y : 1;
    group.scale.setScalar(scale);

    const box2 = new THREE.Box3().setFromObject(cloned);
    const center2 = box2.getCenter(new THREE.Vector3());
    group.position.x = -center2.x;
    group.position.z = -center2.z;
    group.position.y = -box2.min.y + 0.005;

    const s = box2.getSize(new THREE.Vector3());
    setModelSize([s.x, s.y, s.z]);
  }, [cloned, setModelSize]);

  return <primitive ref={ref} object={cloned} />;
}

export function Product() {
  const loadedModel = useStore((s) => s.loadedModel);
  if (!loadedModel) return null;
  // key=objectUrl → pełny remount loadera przy zmianie pliku.
  return <LoadedModel key={loadedModel.objectUrl} url={loadedModel.objectUrl} />;
}
