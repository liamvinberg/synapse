import { describe, expect, it } from 'vitest';
import { worldScaleTuning } from '@/game/config/tuning';
import { generateSectorDescriptor } from '@/game/worldgen/galaxy';

describe('generateSectorDescriptor', () => {
  it('generates deterministic planet appearance from the same seed and sector', () => {
    const sectorCoordinate = { x: 4, y: -2, z: 7 };

    const first = generateSectorDescriptor('planet-style-test', sectorCoordinate);
    const second = generateSectorDescriptor('planet-style-test', sectorCoordinate);

    expect(second).toEqual(first);
  });

  it('spawns denser sectors with the expanded planet count bounds', () => {
    const descriptor = generateSectorDescriptor('planet-count-test', { x: 0, y: 0, z: 0 });

    expect(descriptor.planets.length).toBeGreaterThanOrEqual(worldScaleTuning.planetCountMin);
    expect(descriptor.planets.length).toBeLessThanOrEqual(worldScaleTuning.planetCountMax);
  });

  it('attaches procedural surface metadata to every generated planet', () => {
    const descriptor = generateSectorDescriptor('planet-surface-test', { x: 1, y: 2, z: 3 });

    for (const planet of descriptor.planets) {
      expect(planet.surface.seed).toBeTypeOf('number');
      expect(planet.surface.primaryColor).toMatch(/^#/);
      expect(planet.surface.secondaryColor).toMatch(/^#/);
      expect(planet.surface.detailColor).toMatch(/^#/);
      expect(planet.surface.biome).toMatch(/rocky|desert|lush|ice|lava|gas/);
      expect(planet.surface.textureScale).toBeGreaterThan(0);
    }
  });
});
