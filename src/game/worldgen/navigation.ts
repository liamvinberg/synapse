import type { SectorCoordinate, SectorDescriptor } from '@/game/sim/types';
import { generateSectorDescriptor } from '@/game/worldgen/galaxy';
import { createSeededRandom, hashSectorCoordinate } from '@/game/worldgen/random';

const systemNamePrefixes = ['Astra', 'Cygn', 'Draco', 'Eid', 'Helio', 'Kepl', 'Lyra', 'Nyx', 'Orio', 'Vela'] as const;
const systemNameSuffixes = ['aris', 'eron', 'ion', 'ora', 'os', 'ara', 'eon', 'axis', 'um', 'is'] as const;

export interface SystemSummary {
  coordinate: SectorCoordinate;
  descriptor: SectorDescriptor;
  distance: number;
  label: string;
}

export function getSystemLabel(universeSeed: string, coordinate: SectorCoordinate): string {
  const random = createSeededRandom(hashSectorCoordinate(universeSeed, coordinate));
  const prefix = systemNamePrefixes[Math.floor(random() * systemNamePrefixes.length)];
  const suffix = systemNameSuffixes[Math.floor(random() * systemNameSuffixes.length)];
  const mark = 100 + Math.floor(random() * 900);
  return `${prefix}${suffix}-${mark}`;
}

export function generateNearbySystems(
  universeSeed: string,
  origin: SectorCoordinate,
): SystemSummary[] {
  const systems: SystemSummary[] = [];

  for (let z = -1; z <= 1; z += 1) {
    for (let x = -1; x <= 1; x += 1) {
      const coordinate = {
        x: origin.x + x,
        y: origin.y,
        z: origin.z + z,
      };
      const descriptor = generateSectorDescriptor(universeSeed, coordinate);
      systems.push({
        coordinate,
        descriptor,
        distance: Math.hypot(coordinate.x - origin.x, coordinate.z - origin.z),
        label: getSystemLabel(universeSeed, coordinate),
      });
    }
  }

  return systems.sort((left, right) => left.distance - right.distance || left.label.localeCompare(right.label));
}

export function generateGalaxyWindow(
  universeSeed: string,
  center: SectorCoordinate,
  radius: number,
): SystemSummary[] {
  const systems: SystemSummary[] = [];

  for (let z = -radius; z <= radius; z += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      const coordinate = {
        x: center.x + x,
        y: center.y,
        z: center.z + z,
      };
      const descriptor = generateSectorDescriptor(universeSeed, coordinate);
      const random = createSeededRandom(hashSectorCoordinate(universeSeed, coordinate) ^ 0x85ebca6b);
      const shouldExist = random() < descriptor.density * 0.92;

      if (!shouldExist) {
        continue;
      }

      systems.push({
        coordinate,
        descriptor,
        distance: Math.hypot(coordinate.x - center.x, coordinate.z - center.z),
        label: getSystemLabel(universeSeed, coordinate),
      });
    }
  }

  return systems.sort((left, right) => left.distance - right.distance || left.label.localeCompare(right.label));
}
