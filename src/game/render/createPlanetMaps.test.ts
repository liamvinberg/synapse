import { describe, expect, it } from 'vitest';
import type { PlanetSurfaceStyle } from '@/game/sim/types';
import { createPlanetMaps } from '@/game/render/createPlanetMaps';

function createSurface(overrides: Partial<PlanetSurfaceStyle> = {}): PlanetSurfaceStyle {
  return {
    atmosphereColor: '#9bc3ff',
    atmosphereOpacity: 0.22,
    atmosphereScale: 1.04,
    banding: 0.2,
    biome: 'rocky',
    cloudColor: null,
    cloudDensity: 0,
    craterDensity: 0.42,
    detailColor: '#d9ccb0',
    emissiveColor: null,
    oceanLevel: 0,
    polarCapAmount: 0,
    primaryColor: '#6d6258',
    roughness: 0.82,
    secondaryColor: '#9e8b74',
    seed: 12345,
    specularStrength: 0.08,
    terrainSharpness: 0.52,
    textureScale: 2.4,
    variant: 1,
    warpAmount: 0.18,
    ...overrides,
  };
}

describe('createPlanetMaps', () => {
  it('creates deterministic map data for the same surface seed', () => {
    const surface = createSurface();

    const first = createPlanetMaps(surface);
    const second = createPlanetMaps(surface);

    expect(Array.from(first.albedo.image.data.slice(0, 64))).toEqual(Array.from(second.albedo.image.data.slice(0, 64)));
    expect(Array.from(first.roughness.image.data.slice(0, 64))).toEqual(Array.from(second.roughness.image.data.slice(0, 64)));
    expect(Array.from(first.bump.image.data.slice(0, 64))).toEqual(Array.from(second.bump.image.data.slice(0, 64)));

    first.dispose();
    second.dispose();
  });

  it('creates class-specific maps with emissive output for lava and cloud alpha for lush worlds', () => {
    const lava = createPlanetMaps(
      createSurface({
        biome: 'lava',
        emissiveColor: '#ff7d38',
        primaryColor: '#241a18',
        secondaryColor: '#46312a',
        detailColor: '#d86a2e',
      }),
    );
    const lush = createPlanetMaps(
      createSurface({
        biome: 'lush',
        cloudColor: '#f2f5ff',
        cloudDensity: 0.44,
        oceanLevel: 0.48,
        primaryColor: '#2c5f87',
        secondaryColor: '#618f54',
        detailColor: '#c7b68f',
      }),
    );

    const lavaEmissiveSum = Array.from(lava.emissive.image.data).reduce((sum, value) => sum + value, 0);
    const lushCloudAlphaSum = lush.cloudAlpha === null ? 0 : Array.from(lush.cloudAlpha.image.data).reduce((sum, value, index) => sum + (index % 4 === 3 ? value : 0), 0);

    expect(lavaEmissiveSum).toBeGreaterThan(0);
    expect(lushCloudAlphaSum).toBeGreaterThan(0);

    lava.dispose();
    lush.dispose();
  });
});
