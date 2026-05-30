import { useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, type Vec3 } from '../store';

/** Wczytany aktor — auto-fit + center, materiały. Transformu NIE edytujemy tutaj. */
function Actor({ url }: { url: string }) {
  const envMapIntensity = useStore((s) => s.config.material.envMapIntensity);
  const setModelSize = useStore((s) => s.setModelSize);
  const setSelected = useStore((s) => s.setSelected);

  const { scene } = useGLTF(url);
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
          const tex = (mat as any)[key] as THREE.Texture | null | undefined;
          if (tex) tex.anisotropy = 16;
        }
      }
    });
    return c;
  }, [scene]);

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
    const box2 = new THREE.Box3().setFromObject(cloned);
    const center2 = box2.getCenter(new THREE.Vector3());
    group.position.x = -center2.x;
    group.position.z = -center2.z;
    group.position.y = -box2.min.y + 0.005;
    const s = box2.getSize(new THREE.Vector3());
    setModelSize([s.x, s.y, s.z]);
  }, [cloned, setModelSize]);

  return (
    <group
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        setSelected('actor');
      }}
    >
      <primitive object={cloned} />
    </group>
  );
}

const d2r = THREE.MathUtils.degToRad;
const r2d = THREE.MathUtils.radToDeg;

/**
 * HERO NULL — zawsze obecny pusty obiekt zawierający aktora. Jego transform
 * (pos/rot/scale) jest edytowalny: suwakami w inspektorze i gizmem (gdy zaznaczony
 * i `interactive`). Aktor jest jego dzieckiem i nie ma własnego transformu.
 */
export function Product({ interactive = false }: { interactive?: boolean }) {
  const loadedModel = useStore((s) => s.loadedModel);
  const hero = useStore((s) => s.config.hero);
  const selected = useStore((s) => s.selected);
  const mode = useStore((s) => s.gizmoMode);
  const setHero = useStore((s) => s.setHero);
  const setSelected = useStore((s) => s.setSelected);

  const [group, setGroup] = useState<THREE.Group | null>(null);
  const dragging = useRef(false);

  // Store → HERO (poza przeciąganiem).
  useEffect(() => {
    if (!group || dragging.current) return;
    group.position.fromArray(hero.position);
    group.rotation.set(d2r(hero.rotation[0]), d2r(hero.rotation[1]), d2r(hero.rotation[2]));
    group.scale.fromArray(hero.scale);
  }, [group, hero]);

  const writeBack = () => {
    if (!group) return;
    setHero({
      position: group.position.toArray() as Vec3,
      rotation: [r2d(group.rotation.x), r2d(group.rotation.y), r2d(group.rotation.z)] as Vec3,
      scale: group.scale.toArray() as Vec3,
    });
  };

  return (
    <>
      <group
        ref={setGroup}
        name="HERO"
        onClick={(e) => {
          e.stopPropagation();
          setSelected('hero');
        }}
      >
        {loadedModel && <Actor key={loadedModel.objectUrl} url={loadedModel.objectUrl} />}
      </group>

      {interactive && selected === 'hero' && group && (
        <TransformControls
          object={group}
          mode={mode}
          size={0.8}
          onMouseDown={() => (dragging.current = true)}
          onMouseUp={() => {
            dragging.current = false;
            writeBack();
          }}
          onObjectChange={writeBack}
        />
      )}
    </>
  );
}
