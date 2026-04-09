import { createNoise3D } from 'simplex-noise';
import { worldScaleTuning } from '@/game/config/tuning';
import { getPlanetOrbitalPosition, getPlanetOrbitalVelocity } from '@/game/sim/solarSystem';
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
    ['#7b5a3d', '#b98a58', '#d6c096'],
    ['#8a6542', '#c49561', '#ddc393'],
    ['#705236', '#ae7f4f', '#ccb287'],
    ['#8c6f47', '#c7a06a', '#e0cd9f'],
    ['#7a6146', '#b68c66', '#d4b48f'],
  ],
  gas: [
    ['#7f7364', '#c8b79d', '#ece1c8'],
    ['#796a58', '#c9b192', '#f0dfc2'],
    ['#5e6f89', '#9db6d5', '#dbe8f2'],
    ['#74727c', '#bbb4c7', '#e3dced'],
    ['#6d7f69', '#a5b497', '#dbe2cd'],
  ],
  ice: [
    ['#7e91a7', '#bfd4e3', '#eef5fb'],
    ['#6c7f97', '#adc5da', '#edf6ff'],
    ['#8199b6', '#d3e4f1', '#f7fbff'],
    ['#7c8da4', '#c7d7e6', '#eef4f8'],
    ['#8aa3be', '#dbeaf4', '#ffffff'],
  ],
  lava: [
    ['#1a1718', '#352622', '#b84d20'],
    ['#171416', '#3a2824', '#c35b27'],
    ['#1c1818', '#40302a', '#d06a32'],
    ['#201b1a', '#47342d', '#bb5423'],
    ['#151314', '#30221f', '#a84720'],
  ],
  lush: [
    ['#27557f', '#5e8f4e', '#c3b285'],
    ['#2e5f8b', '#689b59', '#cfbf98'],
    ['#234d70', '#4f8147', '#b9a67a'],
    ['#37648f', '#739961', '#d3c48f'],
    ['#2b5977', '#5c8b4d', '#bea676'],
  ],
  rocky: [
    ['#4a443f', '#837568', '#c4b6a1'],
    ['#534841', '#8e7e70', '#cdbba4'],
    ['#454b53', '#798391', '#c0b6a1'],
    ['#5c5148', '#97816d', '#d0bea8'],
    ['#40464d', '#727d86', '#c7bca7'],
  ],
};

const emissivePaletteByBiome: Record<PlanetBiome, readonly string[]> = {
  desert: [],
  gas: [],
  ice: [],
  lava: ['#ff6b2a', '#ff8a47'],
  lush: [],
  rocky: [],
};

const atmospherePaletteByBiome: Record<PlanetBiome, readonly string[]> = {
  desert: ['#d7b487'],
  gas: ['#cfd7e6', '#d9ceb4', '#b4c6dc'],
  ice: ['#d9eef6'],
  lava: ['#5a2a1d'],
  lush: ['#91b9df'],
  rocky: [],
};

const cloudPaletteByBiome: Record<PlanetBiome, readonly string[]> = {
  desert: ['#f5deb1'],
  gas: ['#f5ead0', '#e7f0ff'],
  ice: ['#ffffff'],
  lava: [],
  lush: ['#f8fbff'],
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
  const atmosphereOptions = atmospherePaletteByBiome[biome];
  const cloudOptions = cloudPaletteByBiome[biome];
  const emissiveColor =
    emissiveOptions.length > 0 && planetRandom() > 0.45
      ? emissiveOptions[Math.floor(planetRandom() * emissiveOptions.length)]
      : null;
  const atmosphereColor =
    atmosphereOptions.length > 0 && planetRandom() > 0.25
      ? atmosphereOptions[Math.floor(planetRandom() * atmosphereOptions.length)]
      : null;
  const cloudColor =
    cloudOptions.length > 0 && planetRandom() > 0.3
      ? cloudOptions[Math.floor(planetRandom() * cloudOptions.length)]
      : null;
  const variant = Math.floor(planetRandom() * 3);
  const commonTextureScale =
    biome === 'gas'
      ? 1.4 + planetRandom() * 2.2
      : biome === 'lava'
        ? 2 + planetRandom() * 3
        : 1.6 + planetRandom() * 3.4;

  return {
    atmosphereColor,
    atmosphereOpacity:
      atmosphereColor === null
        ? 0
        : biome === 'gas'
          ? 0.32 + planetRandom() * 0.12
          : 0.14 + planetRandom() * 0.12,
    atmosphereScale:
      atmosphereColor === null
        ? 1.02
        : biome === 'gas'
          ? 1.05 + planetRandom() * 0.035
          : 1.025 + planetRandom() * 0.025,
    banding:
      biome === 'gas'
        ? 0.55 + planetRandom() * 0.35
        : biome === 'desert'
          ? 0.16 + planetRandom() * 0.18
          : 0.04 + planetRandom() * 0.14,
    biome,
    cloudColor,
    cloudDensity:
      cloudColor === null
        ? 0
        : biome === 'gas'
          ? 0.52 + planetRandom() * 0.22
          : 0.22 + planetRandom() * 0.28,
    craterDensity:
      biome === 'rocky'
        ? 0.32 + planetRandom() * 0.48
        : biome === 'desert'
          ? 0.08 + planetRandom() * 0.22
          : biome === 'ice'
            ? 0.06 + planetRandom() * 0.12
            : biome === 'lava'
              ? 0.04 + planetRandom() * 0.1
              : 0,
    detailColor,
    emissiveColor,
    oceanLevel:
      biome === 'lush'
        ? 0.44 + planetRandom() * 0.12
        : biome === 'ice'
          ? 0.1 + planetRandom() * 0.08
          : 0,
    polarCapAmount:
      biome === 'ice'
        ? 0.42 + planetRandom() * 0.18
        : biome === 'lush' && orbitRatio > 0.44
          ? 0.1 + planetRandom() * 0.08
          : 0,
    primaryColor,
    roughness:
      biome === 'gas'
        ? 0.6 + planetRandom() * 0.2
        : biome === 'lava'
          ? 0.72 + planetRandom() * 0.18
          : biome === 'ice'
            ? 0.38 + planetRandom() * 0.22
            : biome === 'lush'
              ? 0.62 + planetRandom() * 0.2
              : 0.76 + planetRandom() * 0.18,
    secondaryColor,
    seed: (sectorSeed ^ ((index + 1) * 0x45d9f3b)) >>> 0,
    specularStrength:
      biome === 'lush'
        ? 0.2 + planetRandom() * 0.28
        : biome === 'ice'
          ? 0.34 + planetRandom() * 0.26
          : biome === 'gas'
            ? 0.1 + planetRandom() * 0.16
            : biome === 'lava'
              ? 0.04 + planetRandom() * 0.08
              : 0.03 + planetRandom() * 0.08,
    terrainSharpness:
      biome === 'rocky'
        ? 0.5 + planetRandom() * 0.4
        : biome === 'desert'
          ? 0.28 + planetRandom() * 0.22
          : biome === 'ice'
            ? 0.22 + planetRandom() * 0.18
            : biome === 'lava'
              ? 0.42 + planetRandom() * 0.24
              : biome === 'gas'
                ? 0.08 + planetRandom() * 0.12
                : 0.24 + planetRandom() * 0.2,
    textureScale:
      commonTextureScale,
    variant,
    warpAmount:
      biome === 'gas'
        ? 0.3 + planetRandom() * 0.45
        : biome === 'desert'
          ? 0.08 + planetRandom() * 0.18
          : biome === 'lush'
            ? 0.16 + planetRandom() * 0.2
            : biome === 'lava'
              ? 0.18 + planetRandom() * 0.26
              : 0.1 + planetRandom() * 0.18,
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
    const orbitTiltRadians = (planetRandom() - 0.5) * 0.18;
    const orbitAngularSpeed =
      (0.16 + planetRandom() * 0.08) /
      Math.max(1, Math.sqrt(orbitalDistance / worldScaleTuning.planetOrbitBaseDistance) * 28);
    const orbitEccentricity = planetRandom() * 0.14;
    const orbitRatio = planetCount > 1 ? index / (planetCount - 1) : 0.5;
    const surface = createPlanetSurfaceStyle(sectorSeed, index, orbitRatio, planetRandom);
    const planetBase: PlanetDescriptor = {
      color: surface.primaryColor,
      id: `planet-${sectorSeed.toString(36)}-${index}`,
      orbitAngularSpeed,
      orbitDistance: orbitalDistance,
      orbitEccentricity,
      orbitPhaseRadians: orbitalAngle,
      orbitTiltRadians,
      position: { x: 0, y: 0, z: 0 },
      radius,
      spinSpeed: 0.04 + planetRandom() * 0.08,
      surface,
      velocity: { x: 0, y: 0, z: 0 },
    };

    planets.push({
      ...planetBase,
      position: getPlanetOrbitalPosition(planetBase, 0),
      velocity: getPlanetOrbitalVelocity(planetBase, 0),
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
