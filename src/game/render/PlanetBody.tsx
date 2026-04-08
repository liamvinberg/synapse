import { memo, useEffect, useMemo, type ReactElement } from 'react';
import { createNoise3D } from 'simplex-noise';
import {
  Color,
  DataTexture,
  LinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
} from 'three';
import type { PlanetDescriptor, PlanetSurfaceStyle } from '@/game/sim/types';
import { createSeededRandom } from '@/game/worldgen/random';

const TEXTURE_WIDTH = 128;
const TEXTURE_HEIGHT = 64;
const geometryCache = new Map<number, SphereGeometry>();

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function sampleFbm(
  noise: ReturnType<typeof createNoise3D>,
  x: number,
  y: number,
  z: number,
  scale: number,
  octaves: number,
): number {
  let amplitude = 1;
  let amplitudeSum = 0;
  let frequency = scale;
  let value = 0;

  for (let index = 0; index < octaves; index += 1) {
    value += noise(x * frequency, y * frequency, z * frequency) * amplitude;
    amplitudeSum += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / amplitudeSum * 0.5 + 0.5;
}

function getPlanetGeometry(segments: number): SphereGeometry {
  const cached = geometryCache.get(segments);

  if (cached !== undefined) {
    return cached;
  }

  const geometry = new SphereGeometry(1, segments, segments);
  geometryCache.set(segments, geometry);
  return geometry;
}

function createPlanetTexture(surface: PlanetSurfaceStyle): DataTexture {
  const noise = createNoise3D(createSeededRandom(surface.seed));
  const data = new Uint8Array(TEXTURE_WIDTH * TEXTURE_HEIGHT * 4);
  const primary = new Color(surface.primaryColor);
  const secondary = new Color(surface.secondaryColor);
  const detail = new Color(surface.detailColor);
  const darkPrimary = primary.clone().multiplyScalar(0.45);
  const deepShadow = new Color('#090c12');
  const polarCap = new Color('#f7fbff');
  const warmHighlight = detail.clone().lerp(new Color('#ffffff'), 0.3);

  for (let y = 0; y < TEXTURE_HEIGHT; y += 1) {
    const v = y / (TEXTURE_HEIGHT - 1);
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    const dirY = Math.cos(phi);

    for (let x = 0; x < TEXTURE_WIDTH; x += 1) {
      const u = x / (TEXTURE_WIDTH - 1);
      const theta = u * Math.PI * 2;
      const dirX = Math.cos(theta) * sinPhi;
      const dirZ = Math.sin(theta) * sinPhi;
      const baseNoise = sampleFbm(noise, dirX, dirY, dirZ, surface.textureScale, 4);
      const detailNoise = sampleFbm(noise, dirX, dirY, dirZ, surface.textureScale * 2.1, 3);
      const ridgeNoise = 1 - Math.abs(noise(dirX * surface.textureScale * 4.6, dirY * surface.textureScale * 4.6, dirZ * surface.textureScale * 4.6));
      const stormNoise = noise(dirX * surface.textureScale * 1.3 + 17.3, dirY * surface.textureScale * 1.3 - 9.1, dirZ * surface.textureScale * 1.3 + 4.7);
      const latitude = 1 - Math.abs(dirY);
      const color = new Color();

      switch (surface.biome) {
        case 'gas': {
          const band = Math.sin(dirY * Math.PI * (4 + surface.banding * 8) + stormNoise * 2.8);
          const bandMix = clamp01(0.5 + band * 0.28 + detailNoise * 0.2);
          color.copy(primary).lerp(secondary, bandMix);
          color.lerp(detail, smoothstep(0.45, 0.92, ridgeNoise) * 0.45);
          break;
        }

        case 'lava': {
          const crust = clamp01(baseNoise * 0.85 + detailNoise * 0.2);
          const fissureMask = smoothstep(0.7, 0.94, ridgeNoise * 0.8 + (1 - crust) * 0.55 + detailNoise * 0.2);
          color.copy(deepShadow).lerp(darkPrimary, crust * 0.7);
          color.lerp(primary, clamp01(crust * 0.35));
          color.lerp(warmHighlight, fissureMask);
          break;
        }

        case 'lush': {
          const landMask = smoothstep(0.38, 0.58, baseNoise + detailNoise * 0.12);
          const forestMask = smoothstep(0.46, 0.78, detailNoise + ridgeNoise * 0.12);
          const oceanColor = primary.clone().multiplyScalar(0.82 + ridgeNoise * 0.08);
          const landColor = secondary.clone().lerp(detail, forestMask * 0.75);
          color.copy(oceanColor).lerp(landColor, landMask);
          break;
        }

        case 'ice': {
          const frozenMix = clamp01(0.52 + baseNoise * 0.28 + detailNoise * 0.2);
          color.copy(primary).lerp(secondary, frozenMix);
          color.lerp(polarCap, smoothstep(0.62, 0.96, ridgeNoise) * 0.25);
          break;
        }

        case 'desert': {
          const duneBand = Math.sin(dirY * Math.PI * (2.6 + surface.banding * 3.4) + detailNoise * 2.4);
          const duneMix = clamp01(0.45 + duneBand * 0.12 + baseNoise * 0.28 + ridgeNoise * 0.14);
          color.copy(primary).lerp(secondary, duneMix);
          color.lerp(detail, smoothstep(0.64, 0.94, ridgeNoise) * 0.5);
          break;
        }

        case 'rocky':
        default: {
          const rockyMix = clamp01(baseNoise * 0.6 + detailNoise * 0.22 + ridgeNoise * 0.22);
          color.copy(darkPrimary).lerp(primary, rockyMix * 0.55);
          color.lerp(secondary, rockyMix * 0.7);
          color.lerp(detail, smoothstep(0.65, 0.95, ridgeNoise) * 0.4);
          break;
        }
      }

      if (surface.polarCapAmount > 0) {
        const polarMask = smoothstep(1 - surface.polarCapAmount, 1, Math.abs(dirY));
        color.lerp(polarCap, polarMask * 0.85);
      }

      const terminatorDarkness = 0.92 - latitude * 0.12;
      color.multiplyScalar(terminatorDarkness);

      const offset = (y * TEXTURE_WIDTH + x) * 4;
      data[offset] = Math.round(clamp01(color.r) * 255);
      data[offset + 1] = Math.round(clamp01(color.g) * 255);
      data[offset + 2] = Math.round(clamp01(color.b) * 255);
      data[offset + 3] = 255;
    }
  }

  const texture = new DataTexture(data, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function getPlanetSegments(radius: number): number {
  if (radius >= 46) {
    return 36;
  }

  if (radius >= 28) {
    return 30;
  }

  return 24;
}

interface PlanetBodyProps {
  planet: PlanetDescriptor;
}

export const PlanetBody = memo(function PlanetBody({ planet }: PlanetBodyProps): ReactElement {
  const surface = planet.surface;
  const texture = useMemo(
    () => createPlanetTexture(surface),
    [surface],
  );
  const segments = getPlanetSegments(planet.radius);
  const geometry = useMemo(() => getPlanetGeometry(segments), [segments]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  return (
    <mesh
      geometry={geometry}
      position={[planet.position.x, planet.position.y, planet.position.z]}
      scale={planet.radius}
    >
      <meshStandardMaterial
        color={planet.color}
        emissive={surface.emissiveColor ?? '#000000'}
        emissiveIntensity={surface.emissiveColor === null ? 0 : surface.biome === 'lava' ? 0.2 : 0.08}
        map={texture}
        metalness={0.06}
        roughness={surface.roughness}
      />
    </mesh>
  );
});
