import { createNoise3D } from 'simplex-noise';
import { worldScaleTuning } from '@/game/config/tuning';
import type {
  PlanetBiome,
  PlanetDescriptor,
  PlanetSurfaceStyle,
  SectorCoordinate,
  SectorDescriptor,
} from '@/game/sim/types';
import { createSeededRandom, hashSectorCoordinate, hashStringToSeed } from '@/game/worldgen/random';

const starPalette = ['#f7d7a8', '#f8f1ff', '#ffd6a5', '#ffe29a', '#cad8ff'] as const;

const biomePalettes: Record<PlanetBiome, readonly [string, string, string][]> = {
  desert: [
    ['#7d5238', '#c88b55', '#f0cf8f'],
    ['#8b603f', '#c89d63', '#f1d5a0'],
    ['#6d4833', '#b7854e', '#e7b86f'],
  ],
  gas: [
    ['#5f7287', '#b9c8d2', '#e5d4b1'],
    ['#6d5a7d', '#bca9d2', '#f1d8a9'],
    ['#82624b', '#d0a97e', '#f2dec0'],
  ],
  ice: [
    ['#7a94b7', '#b6d7f1', '#eff8ff'],
    ['#6f8aa6', '#a7c4df', '#eef6ff'],
    ['#6d89b5', '#c6e2f7', '#ffffff'],
  ],
  lava: [
    ['#1f1c24', '#60302b', '#ff7b2f'],
    ['#1b1520', '#572a1d', '#ff8f43'],
    ['#231b1a', '#4f2d22', '#ff6b2c'],
  ],
  lush: [
    ['#204a7a', '#5a9a65', '#d2e7a4'],
    ['#1f4d67', '#4f9a5d', '#b8d98a'],
    ['#225478', '#4e8d58', '#d6f0bc'],
  ],
  rocky: [
    ['#3c4858', '#7d8d9f', '#cbbf9d'],
    ['#4a3f3f', '#87746a', '#d0c0a1'],
    ['#323a46', '#6c7787', '#bdb29d'],
  ],
};

const emissivePaletteByBiome: Record<PlanetBiome, readonly string[]> = {
  desert: [],
  gas: ['#8fb6ff', '#f7d19a'],
  ice: ['#7ab8ff'],
  lava: ['#ff6a21', '#ff9d52'],
  lush: ['#7dc8ff'],
  rocky: [],
};

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pickBiome(orbitRatio: number, randomValue: number): PlanetBiome {
  if (orbitRatio < 0.2) {
    if (randomValue < 0.35) {
      return 'lava';
    }

    if (randomValue < 0.7) {
      return 'desert';
    }

    return 'rocky';
  }

  if (orbitRatio < 0.52) {
    if (randomValue < 0.28) {
      return 'lush';
    }

    if (randomValue < 0.68) {
      return 'rocky';
    }

    return 'desert';
  }

  if (orbitRatio < 0.8) {
    if (randomValue < 0.34) {
      return 'gas';
    }

    if (randomValue < 0.68) {
      return 'rocky';
    }

    return 'ice';
  }

  if (randomValue < 0.5) {
    return 'ice';
  }

  if (randomValue < 0.82) {
    return 'gas';
  }

  return 'rocky';
}

function createPlanetSurfaceStyle(
  sectorSeed: number,
  index: number,
  orbitRatio: number,
  planetRandom: () => number,
): PlanetSurfaceStyle {
  const biome = pickBiome(orbitRatio, planetRandom());
  const paletteSet = biomePalettes[biome];
  const [primaryColor, secondaryColor, detailColor] =
    paletteSet[Math.floor(planetRandom() * paletteSet.length)] ?? paletteSet[0];
  const emissiveOptions = emissivePaletteByBiome[biome];
  const emissiveColor =
    emissiveOptions.length > 0 && planetRandom() > 0.45
      ? emissiveOptions[Math.floor(planetRandom() * emissiveOptions.length)]
      : null;

  return {
    banding:
      biome === 'gas'
        ? 0.55 + planetRandom() * 0.35
        : biome === 'desert'
          ? 0.16 + planetRandom() * 0.18
          : 0.04 + planetRandom() * 0.14,
    biome,
    detailColor,
    emissiveColor,
    polarCapAmount:
      biome === 'ice'
        ? 0.42 + planetRandom() * 0.18
        : biome === 'lush' && orbitRatio > 0.44
          ? 0.1 + planetRandom() * 0.08
          : 0,
    primaryColor,
    roughness:
      biome === 'gas'
        ? 0.78 + planetRandom() * 0.12
        : biome === 'lava'
          ? 0.82 + planetRandom() * 0.1
          : 0.88 + planetRandom() * 0.1,
    secondaryColor,
    seed: (sectorSeed ^ ((index + 1) * 0x45d9f3b)) >>> 0,
    textureScale:
      biome === 'gas'
        ? 1.8 + planetRandom() * 1.8
        : biome === 'lava'
          ? 2.6 + planetRandom() * 1.8
          : 2.2 + planetRandom() * 2.4,
  };
}

function createPlanetDescriptors(
  sectorSeed: number,
  density: number,
): PlanetDescriptor[] {
  const planetRandom = createSeededRandom(sectorSeed ^ 0x9e3779b9);
  const planetCount = clamp(
    Math.round(
      worldScaleTuning.planetCountMin - 1 +
        density * (worldScaleTuning.planetCountMax - worldScaleTuning.planetCountMin + 1),
    ),
    worldScaleTuning.planetCountMin,
    worldScaleTuning.planetCountMax,
  );
  const planets: PlanetDescriptor[] = [];

  for (let index = 0; index < planetCount; index += 1) {
    const radius =
      worldScaleTuning.planetRadiusMin +
      planetRandom() * (worldScaleTuning.planetRadiusMax - worldScaleTuning.planetRadiusMin);
    const orbitalDistance =
      worldScaleTuning.planetOrbitBaseDistance +
      index * worldScaleTuning.planetOrbitSpacing +
      planetRandom() * worldScaleTuning.planetOrbitVariance;
    const orbitalAngle = planetRandom() * Math.PI * 2;
    const orbitRatio = planetCount > 1 ? index / (planetCount - 1) : 0.5;
    const surface = createPlanetSurfaceStyle(sectorSeed, index, orbitRatio, planetRandom);

    planets.push({
      color: surface.primaryColor,
      id: `planet-${sectorSeed.toString(36)}-${index}`,
      position: {
        x: Math.cos(orbitalAngle) * orbitalDistance,
        y: (planetRandom() - 0.5) * worldScaleTuning.planetOrbitHeightRange,
        z: Math.sin(orbitalAngle) * orbitalDistance,
      },
      radius,
      surface,
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
