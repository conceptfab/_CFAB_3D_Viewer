// components/studio/StudioActor.tsx
'use client';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';
import { collectMaterials, buildMaterialInfos, applyOverride, restoreMaterial } from '@/lib/studio/materials';

/** Wczytany model Studio (gotowy THREE.Group z loadFromFiles): klon + auto-fit/center
 *  + envMapIntensity + anizotropia + cienie. Publikuje modelSize. */
export function StudioActor({ scene }: { scene: THREE.Group }) {
  const envMapIntensity = useStore((s) => s.config.material.envMapIntensity);
  const setModelSize = useStore((s) => s.setModelSize);
  const setSelected = useStore((s) => s.setSelected);
  const materialOverrides = useStore((s) => s.config.materialOverrides);
  const setStudioMaterials = useStore((s) => s.setStudioMaterials);
  const ref = useRef<THREE.Group>(null);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      if (m.geometry && !m.geometry.attributes.normal) m.geometry.computeVertexNormals();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const raw of mats) {
        const mat = raw as THREE.MeshStandardMaterial;
        if (!mat) continue;
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const) {
          const tex = (mat as unknown as Record<string, THREE.Texture | undefined>)[key];
          if (tex) tex.anisotropy = 16;
        }
      }
    });
    return c;
  }, [scene]);

  const mats = useMemo(() => collectMaterials(cloned as unknown as { traverse: (cb: (o: unknown) => void) => void }), [cloned]);
  const infos = useMemo(() => buildMaterialInfos(mats), [mats]);

  useEffect(() => {
    setStudioMaterials(infos);
    return () => setStudioMaterials([]);
  }, [infos, setStudioMaterials]);

  useEffect(() => {
    mats.forEach((m, i) => {
      restoreMaterial(m, infos[i].base);
      applyOverride(m, materialOverrides[String(i)]);
    });
  }, [mats, infos, materialOverrides]);

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

  useEffect(() => {
    if (!ref.current) return;
    const group = ref.current;
    group.position.set(0, 0, 0);
    group.scale.setScalar(1);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const scale = size.y > 0 ? 1.4 / size.y : 1;
    group.scale.setScalar(scale);
    group.updateWorldMatrix(true, true);
    const box2 = new THREE.Box3().setFromObject(cloned);
    const center2 = box2.getCenter(new THREE.Vector3());
    group.position.x = -center2.x;
    group.position.z = -center2.z;
    group.position.y = -box2.min.y + 0.005;
    const s = box2.getSize(new THREE.Vector3());
    setModelSize([s.x, s.y, s.z]);
  }, [cloned, setModelSize]);

  return (
    <group ref={ref} onClick={(e) => { e.stopPropagation(); setSelected('actor'); }}>
      <primitive object={cloned} />
    </group>
  );
}
