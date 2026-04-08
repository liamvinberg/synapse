import { Color, DataTexture, LinearFilter, RepeatWrapping, SRGBColorSpace, ClampToEdgeWrapping } from 'three';
import { createNoise3D } from 'simplex-noise';
import type { PlanetSurfaceStyle } from '@/game/sim/types';
import { createSeededRandom } from '@/game/worldgen/random';

const MAP_WIDTH = 256;
const MAP_HEIGHT = 128;

export interface PlanetMaps {
  albedo: DataTexture;
  bump: DataTexture;
  cloudAlpha: DataTexture | null;
  emissive: DataTexture;
  roughness: DataTexture;
  dispose: () => void;
}

type SurfaceSample = {
  albedo: Color;
  bump: number;
  cloudAlpha: number;
  emissive: number;
  roughness: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function createTexture(data: Uint8Array, srgb: boolean): DataTexture {
  const texture = new DataTexture(data, MAP_WIDTH, MAP_HEIGHT);
  if (srgb) {
    texture.colorSpace = SRGBColorSpace;
  }
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function writeColor(data: Uint8Array, index: number, color: Color): void {
  data[index] = Math.round(clamp01(color.r) * 255);
  data[index + 1] = Math.round(clamp01(color.g) * 255);
  data[index + 2] = Math.round(clamp01(color.b) * 255);
  data[index + 3] = 255;
}

function writeGray(data: Uint8Array, index: number, value: number): void {
  const channel = Math.round(clamp01(value) * 255);
  data[index] = channel;
  data[index + 1] = channel;
  data[index + 2] = channel;
  data[index + 3] = 255;
}

function fbm(
  noise: ReturnType<typeof createNoise3D>,
  point: { x: number; y: number; z: number },
  octaves: number,
  persistence: number,
  lacunarity: number,
): number {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let normalization = 0;

  for (let index = 0; index < octaves; index += 1) {
    total += noise(point.x * frequency, point.y * frequency, point.z * frequency) * amplitude;
    normalization += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return total / normalization * 0.5 + 0.5;
}

function ridge(
  noise: ReturnType<typeof createNoise3D>,
  point: { x: number; y: number; z: number },
  octaves: number,
): number {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let normalization = 0;

  for (let index = 0; index < octaves; index += 1) {
    const sample = 1 - Math.abs(noise(point.x * frequency, point.y * frequency, point.z * frequency));
    total += sample * sample * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / normalization;
}

function turbulence(
  noise: ReturnType<typeof createNoise3D>,
  point: { x: number; y: number; z: number },
  octaves: number,
): number {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let normalization = 0;

  for (let index = 0; index < octaves; index += 1) {
    total += Math.abs(noise(point.x * frequency, point.y * frequency, point.z * frequency)) * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / normalization;
}

function getSphereDirection(u: number, v: number): { x: number; y: number; z: number } {
  const theta = u * Math.PI * 2;
  const phi = v * Math.PI;
  const sinPhi = Math.sin(phi);

  return {
    x: Math.cos(theta) * sinPhi,
    y: Math.cos(phi),
    z: Math.sin(theta) * sinPhi,
  };
}

function offsetPoint(
  point: { x: number; y: number; z: number },
  dx: number,
  dy: number,
  dz: number,
): { x: number; y: number; z: number } {
  return { x: point.x + dx, y: point.y + dy, z: point.z + dz };
}

function samplePlanetSurface(
  surface: PlanetSurfaceStyle,
  noise: ReturnType<typeof createNoise3D>,
  direction: { x: number; y: number; z: number },
): SurfaceSample {
  const seedOffset = {
    x: surface.seed * 0.0000017,
    y: surface.seed * 0.0000011,
    z: surface.seed * 0.0000013,
  };
  const basePoint = {
    x: direction.x * surface.textureScale + seedOffset.x,
    y: direction.y * surface.textureScale + seedOffset.y,
    z: direction.z * surface.textureScale + seedOffset.z,
  };
  const warp = {
    x: (fbm(noise, offsetPoint(basePoint, 3.7, 0, 0), 3, 0.5, 2) - 0.5) * surface.warpAmount,
    y: (fbm(noise, offsetPoint(basePoint, 0, 7.1, 0), 3, 0.5, 2) - 0.5) * surface.warpAmount,
    z: (fbm(noise, offsetPoint(basePoint, 0, 0, 11.4), 3, 0.5, 2) - 0.5) * surface.warpAmount,
  };
  const warpedPoint = offsetPoint(basePoint, warp.x, warp.y, warp.z);
  const macro = fbm(noise, offsetPoint(warpedPoint, 0.3, 0, 0), 5, 0.5, 2);
  const detail = fbm(noise, offsetPoint(warpedPoint, 3.7, 0, 0), 4, 0.5, 2.1);
  const humidity = fbm(noise, offsetPoint(warpedPoint, -6.3, 0, 0), 4, 0.5, 2);
  const ridges = ridge(noise, offsetPoint(warpedPoint, 9.1, 0, 0), 4);
  const turbulent = turbulence(noise, offsetPoint(warpedPoint, -4.2, 0, 0), 4);
  const craterMask =
    surface.craterDensity <= 0
      ? 0
      : smoothstep(1 - surface.craterDensity * 0.45, 1, fbm(noise, offsetPoint(basePoint, 12.5, 0, 0), 3, 0.5, 2.4));
  const latitude = Math.abs(direction.y);

  const primary = new Color(surface.primaryColor);
  const secondary = new Color(surface.secondaryColor);
  const detailColor = new Color(surface.detailColor);
  const albedo = new Color();
  let roughness = surface.roughness;
  let bump = 0.42;
  let emissive = 0;
  let cloudAlpha = 0;

  switch (surface.biome) {
    case 'lush': {
      const oceanMask = smoothstep(surface.oceanLevel - 0.08, surface.oceanLevel + 0.05, macro);
      const coastMask = smoothstep(surface.oceanLevel - 0.01, surface.oceanLevel + 0.03, macro) - smoothstep(surface.oceanLevel + 0.03, surface.oceanLevel + 0.09, macro);
      const mountainMask = smoothstep(0.62 - surface.terrainSharpness * 0.08, 0.9, ridges);
      const ocean = primary.clone().multiplyScalar(0.82);
      const land = secondary.clone().lerp(detailColor, smoothstep(0.38, 0.82, humidity));
      albedo.copy(ocean).lerp(land, oceanMask);
      albedo.lerp(new Color('#d9c28f'), coastMask * 0.55);
      albedo.lerp(new Color('#7f837f'), mountainMask * 0.28);
      roughness = 0.24 * (1 - oceanMask) + surface.roughness * oceanMask;
      bump = 0.22 + oceanMask * 0.08 + mountainMask * 0.34;
      break;
    }

    case 'desert': {
      const dunes = 0.5 + Math.sin(direction.y * (5 + surface.banding * 9) + detail * 3.8) * 0.5;
      const plateauMask = smoothstep(0.72 - surface.terrainSharpness * 0.08, 0.96, ridges);
      albedo.copy(primary).lerp(secondary, smoothstep(0.2, 0.84, dunes + macro * 0.18));
      albedo.lerp(detailColor, plateauMask * 0.28);
      albedo.lerp(new Color('#e1d0a6'), smoothstep(0.78, 0.95, latitude) * 0.08);
      roughness = surface.roughness;
      bump = 0.34 + dunes * 0.08 + plateauMask * 0.18;
      cloudAlpha = surface.cloudColor === null ? 0 : smoothstep(0.72, 0.9, humidity) * surface.cloudDensity * 0.32;
      break;
    }

    case 'ice': {
      const fractureMask = smoothstep(0.7, 0.94, ridges + turbulent * 0.18);
      const polarMask = smoothstep(1 - surface.polarCapAmount, 1, latitude);
      albedo.copy(primary).lerp(secondary, smoothstep(0.28, 0.82, macro + turbulent * 0.1));
      albedo.lerp(new Color('#f7fbff'), polarMask * 0.85 + fractureMask * 0.16);
      roughness = 0.36 + fractureMask * 0.08;
      bump = 0.36 + fractureMask * 0.16;
      cloudAlpha = surface.cloudColor === null ? 0 : smoothstep(0.76, 0.93, humidity) * surface.cloudDensity * 0.25;
      break;
    }

    case 'lava': {
      const basaltMask = smoothstep(0.36, 0.82, macro);
      const warmRockMask = smoothstep(0.44, 0.78, macro + detail * 0.08);
      const fissureField = ridges * 0.82 + turbulent * 0.28 + (1 - macro) * 0.16;
      const fissureMask = smoothstep(0.9, 0.975, fissureField) * smoothstep(0.58, 0.84, detail + ridges * 0.1);
      albedo.copy(new Color('#120f10')).lerp(primary.clone().multiplyScalar(0.82), basaltMask);
      albedo.lerp(secondary.clone().multiplyScalar(0.74), warmRockMask * 0.18);
      albedo.lerp(detailColor.clone().multiplyScalar(0.86), fissureMask * 0.82);
      roughness = surface.roughness - fissureMask * 0.28;
      bump = 0.28 + basaltMask * 0.12;
      emissive = fissureMask;
      break;
    }

    case 'gas': {
      const broadBand = 0.5 + Math.sin(direction.y * (4.5 + surface.banding * 8.5) + detail * 2.2) * 0.5;
      const fineBand = 0.5 + Math.sin(direction.y * (11 + surface.banding * 14 + surface.variant) + detail * 3.6) * 0.5;
      const stormMask = smoothstep(0.84, 0.95, turbulent);
      albedo.copy(primary).lerp(secondary, smoothstep(0.18, 0.84, broadBand));
      albedo.lerp(detailColor, smoothstep(0.42, 0.92, fineBand) * 0.18 + stormMask * 0.08);
      roughness = 0.48 + broadBand * 0.1;
      bump = 0.18 + fineBand * 0.05;
      break;
    }

    case 'rocky':
    default: {
      const highlands = smoothstep(0.24, 0.8, macro);
      const ridgeMask = smoothstep(0.66 - surface.terrainSharpness * 0.08, 0.96, ridges);
      albedo.copy(primary.clone().multiplyScalar(0.85)).lerp(secondary, highlands);
      albedo.lerp(detailColor, ridgeMask * 0.32);
      albedo.lerp(albedo.clone().multiplyScalar(0.82), craterMask * 0.22);
      roughness = surface.roughness;
      bump = 0.34 + ridgeMask * 0.22 - craterMask * 0.06;
      break;
    }
  }

  return {
    albedo,
    bump,
    cloudAlpha,
    emissive,
    roughness,
  };
}

export function createPlanetMaps(surface: PlanetSurfaceStyle): PlanetMaps {
  const noise = createNoise3D(createSeededRandom(surface.seed));
  const albedoData = new Uint8Array(MAP_WIDTH * MAP_HEIGHT * 4);
  const bumpData = new Uint8Array(MAP_WIDTH * MAP_HEIGHT * 4);
  const roughnessData = new Uint8Array(MAP_WIDTH * MAP_HEIGHT * 4);
  const emissiveData = new Uint8Array(MAP_WIDTH * MAP_HEIGHT * 4);
  const cloudData = surface.cloudColor === null || surface.cloudDensity <= 0 ? null : new Uint8Array(MAP_WIDTH * MAP_HEIGHT * 4);

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const index = (y * MAP_WIDTH + x) * 4;
      const direction = getSphereDirection(x / (MAP_WIDTH - 1), y / (MAP_HEIGHT - 1));
      const sample = samplePlanetSurface(surface, noise, direction);
      writeColor(albedoData, index, sample.albedo);
      writeGray(bumpData, index, sample.bump);
      writeGray(roughnessData, index, sample.roughness);
      writeGray(emissiveData, index, sample.emissive);
      if (cloudData !== null) {
        writeGray(cloudData, index, sample.cloudAlpha);
      }
    }
  }

  const albedo = createTexture(albedoData, true);
  const bump = createTexture(bumpData, false);
  const roughness = createTexture(roughnessData, false);
  const emissive = createTexture(emissiveData, false);
  const cloudAlpha = cloudData === null ? null : createTexture(cloudData, false);

  return {
    albedo,
    bump,
    cloudAlpha,
    emissive,
    roughness,
    dispose() {
      albedo.dispose();
      bump.dispose();
      roughness.dispose();
      emissive.dispose();
      cloudAlpha?.dispose();
    },
  };
}
