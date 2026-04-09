import { describe, expect, it } from 'vitest';
import type { PlanetSurfaceStyle } from '@/game/sim/types';

function createSurface(overrides: Partial<PlanetSurfaceStyle> = {}): PlanetSurfaceStyle {
  return {
    atmosphereColor: '#91b9df',
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

describe('planet surface style contract', () => {
  it('supports stylized smooth planets without baked texture artifacts', () => {
    const rocky = createSurface();
    const lush = createSurface({ biome: 'lush', oceanLevel: 0.48, cloudDensity: 0.4, cloudColor: '#f2f5ff' });
    const gas = createSurface({ biome: 'gas', banding: 0.74, cloudDensity: 0.58, atmosphereScale: 1.08 });

    for (const surface of [rocky, lush, gas]) {
      expect(surface.textureScale).toBeGreaterThan(0);
      expect(surface.warpAmount).toBeGreaterThanOrEqual(0);
      expect(surface.atmosphereScale).toBeGreaterThan(1);
      expect(surface.primaryColor).toMatch(/^#/);
      expect(surface.secondaryColor).toMatch(/^#/);
      expect(surface.detailColor).toMatch(/^#/);
    }
  });
});
