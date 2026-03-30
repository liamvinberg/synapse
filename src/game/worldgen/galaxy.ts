import { createNoise3D } from 'simplex-noise';
import type { PlanetDescriptor, SectorCoordinate, SectorDescriptor } from '@/game/sim/types';
import { createSeededRandom, hashSectorCoordinate, hashStringToSeed } from '@/game/worldgen/random';

const starPalette = ['#f7d7a8', '#f8f1ff', '#ffd6a5', '#ffe29a', '#cad8ff'] as const;
const planetPalette = ['#5ba4ff', '#ec8d62', '#7bdfbe', '#d6ca7b', '#b78dff'] as const;

const densityNoiseCache = new Map<string, ReturnType<typeof createNoise3D>>();

function getDensityNoise(seed: string): ReturnType<typeof createNoise3D> {
  const cached = densityNoiseCache.get(seed);

  if (cached !== undefined) {
    return cached;
  }

  const seedRandom = createSeededRandom(hashStringToSeed(seed));
  const densityNoise = createNoise3D(seedRandom);
  densityNoiseCache.set(seed, densityNoise);
  return densityNoise;
}

function createPlanetDescriptors(
  sectorSeed: number,
  density: number,
): PlanetDescriptor[] {
  const planetRandom = createSeededRandom(sectorSeed ^ 0x9e3779b9);
  const planetCount = Math.max(2, Math.min(6, Math.round(density * 5)));
  const planets: PlanetDescriptor[] = [];

  for (let index = 0; index < planetCount; index += 1) {
    const radius = 20 + planetRandom() * 110;
    const orbitalDistance = 280 + index * 240 + planetRandom() * 120;
    const orbitalAngle = planetRandom() * Math.PI * 2;

    planets.push({
      color: planetPalette[index % planetPalette.length],
      id: `planet-${sectorSeed.toString(36)}-${index}`,
      position: {
        x: Math.cos(orbitalAngle) * orbitalDistance,
        y: (planetRandom() - 0.5) * 40,
        z: Math.sin(orbitalAngle) * orbitalDistance,
      },
      radius,
    });
  }

  return planets;
}

export function generateSectorDescriptor(
  universeSeed: string,
  sectorCoordinate: SectorCoordinate,
): SectorDescriptor {
  const sectorSeed = hashSectorCoordinate(universeSeed, sectorCoordinate);
  const densityNoise = getDensityNoise(universeSeed);
  const densitySample = densityNoise(
    sectorCoordinate.x * 0.16,
    sectorCoordinate.y * 0.16,
    sectorCoordinate.z * 0.16,
  );
  const density = Math.min(1, Math.max(0.2, Math.abs(densitySample)));

  return {
    density,
    key: `${sectorCoordinate.x}:${sectorCoordinate.y}:${sectorCoordinate.z}`,
    planets: createPlanetDescriptors(sectorSeed, density),
    seed: sectorSeed,
    starColor: starPalette[Math.abs(sectorSeed) % starPalette.length],
  };
}
