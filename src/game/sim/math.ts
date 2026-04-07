import type { Vec3 } from '@/game/sim/types';

export function addVec3(left: Vec3, right: Vec3): Vec3 {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  };
}

export function scaleVec3(vector: Vec3, scalar: number): Vec3 {
  return {
    x: vector.x * scalar,
    y: vector.y * scalar,
    z: vector.z * scalar,
  };
}

export function subtractVec3(left: Vec3, right: Vec3): Vec3 {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z,
  };
}

export function lengthVec3(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function dotVec3(left: Vec3, right: Vec3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

export function normalizeVec3(vector: Vec3): Vec3 {
  const length = lengthVec3(vector);

  if (length === 0) {
    return { x: 0, y: 0, z: 1 };
  }

  return scaleVec3(vector, 1 / length);
}

export function normalizeYawVector(yawRadians: number): Vec3 {
  return {
    x: Math.sin(yawRadians),
    y: 0,
    z: Math.cos(yawRadians),
  };
}
