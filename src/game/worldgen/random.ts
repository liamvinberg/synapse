import type { SectorCoordinate } from '@/game/sim/types';

export function hashStringToSeed(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let current = seed >>> 0;

  return () => {
    current += 0x6d2b79f5;
    let next = Math.imul(current ^ (current >>> 15), current | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSectorCoordinate(
  universeSeed: string,
  sectorCoordinate: SectorCoordinate,
): number {
  const sectorKey = `${universeSeed}:${sectorCoordinate.x}:${sectorCoordinate.y}:${sectorCoordinate.z}`;
  return hashStringToSeed(sectorKey);
}
