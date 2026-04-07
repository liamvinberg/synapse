import type { GameSnapshot } from '@/game/sim/types';
import { generateSectorDescriptor } from '@/game/worldgen/galaxy';

export function createInitialSnapshot(universeSeed: string): GameSnapshot {
  const activeSector = { x: 0, y: 0, z: 0 };

  return {
    universeSeed,
    elapsedSeconds: 0,
    activeSector,
    activeSectorDescriptor: generateSectorDescriptor(universeSeed, activeSector),
    impacts: [],
    nextImpactId: 0,
    nextProjectileId: 0,
    projectiles: [],
    ship: {
      bankRadians: 0,
      collisionCooldownSeconds: 0,
      controlMode: 'action-chase',
      pitchRadians: 0,
      position: { x: 0, y: 0, z: 220 },
      resources: {
        boostEnergy: 100,
        boostEnergyMax: 100,
        hull: 100,
        hullMax: 100,
        shield: 60,
        shieldMax: 60,
        shieldRegenDelaySeconds: 3,
        shieldRegenRate: 8,
        shieldRegenTimeoutSeconds: 0,
        stagger: 0,
        staggerMax: 100,
        staggerRecoveryPerSecond: 18,
      },
      velocity: { x: 0, y: 0, z: 0 },
      weaponCooldownSeconds: 0,
      yawRadians: Math.PI,
    },
  };
}
