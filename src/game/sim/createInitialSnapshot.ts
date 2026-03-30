import type { GameSnapshot } from '@/game/sim/types';
import { generateSectorDescriptor } from '@/game/worldgen/galaxy';

export function createInitialSnapshot(universeSeed: string): GameSnapshot {
  const activeSector = { x: 0, y: 0, z: 0 };

  return {
    universeSeed,
    elapsedSeconds: 0,
    activeSector,
    activeSectorDescriptor: generateSectorDescriptor(universeSeed, activeSector),
    ship: {
      position: { x: 0, y: 0, z: 220 },
      velocity: { x: 0, y: 0, z: 0 },
      yawRadians: Math.PI,
    },
  };
}
