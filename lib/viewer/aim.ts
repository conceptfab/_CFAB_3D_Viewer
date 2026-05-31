import type { Vec3 } from '@/components/store';

const MIN_DIST = 1e-4;

/**
 * New look target after an object has been rotated by `quaternion`.
 *
 * The object is assumed to be oriented so its local +Z axis points toward the
 * target — this is how three.js `Object3D.lookAt` orients a *non-camera* object
 * (the camera icon group and the light handle are both non-cameras). The look
 * distance is preserved; a minimum distance is clamped so position == target
 * never yields NaN.
 *
 * @param quaternion the object's world quaternion as [x, y, z, w].
 */
export function reaimAfterRotation(
  position: Vec3,
  target: Vec3,
  quaternion: [number, number, number, number]
): Vec3 {
  const dx = target[0] - position[0];
  const dy = target[1] - position[1];
  const dz = target[2] - position[2];
  const dist = Math.max(Math.hypot(dx, dy, dz), MIN_DIST);

  const [x, y, z, w] = quaternion;
  // Image of local +Z (0,0,1) under the quaternion = 3rd column of the rotation matrix.
  const fx = 2 * (x * z + w * y);
  const fy = 2 * (y * z - w * x);
  const fz = 1 - 2 * (x * x + y * y);

  return [position[0] + fx * dist, position[1] + fy * dist, position[2] + fz * dist];
}
