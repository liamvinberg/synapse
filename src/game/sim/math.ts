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

export function normalizeYawVector(yawRadians: number): Vec3 {
  return {
    x: Math.sin(yawRadians),
    y: 0,
    z: Math.cos(yawRadians),
  };
}
