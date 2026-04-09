import { combatTuning } from '@/game/config/tuning';
import { getChaseCameraPose } from '@/game/shared/chaseCamera';
import { createInitialEnemies } from '@/game/sim/enemies';
import type { GameSnapshot } from '@/game/sim/types';
import { generateSectorDescriptor } from '@/game/worldgen/galaxy';

interface CreateInitialSnapshotOptions {
  includeInitialEnemies?: boolean;
}

export function createInitialSnapshot(
  universeSeed: string,
  options: CreateInitialSnapshotOptions = {},
): GameSnapshot {
  const activeSector = { x: 0, y: 0, z: 0 };
  const initialYawRadians = Math.PI;
  const initialPitchRadians = 0;
  const initialPosition = { x: 0, y: 0, z: 220 };
  const activeSectorDescriptor = generateSectorDescriptor(universeSeed, activeSector);
  const initialCameraPose = getChaseCameraPose(
    {
      yawRadians: initialYawRadians,
      pitchRadians: initialPitchRadians,
    },
    0,
    0,
  );
  const initialShip = {
    bankRadians: 0,
    cameraShakeSeconds: 0,
    cameraShakeStrength: 0,
    collisionCooldownSeconds: 0,
    controlMode: 'action-chase' as const,
    pitchRadians: initialPitchRadians,
    position: initialPosition,
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
    secondaryChargeSeconds: 0,
    secondaryCooldownSeconds: 0,
    velocity: { x: 0, y: 0, z: 0 },
    weaponCooldownSeconds: 0,
    yawRadians: initialYawRadians,
  };
  const enemies = options.includeInitialEnemies === false
    ? []
    : createInitialEnemies(initialShip, activeSectorDescriptor.planets);

  return {
    universeSeed,
    elapsedSeconds: 0,
    activeSector,
    activeSectorDescriptor,
    activeSystem: activeSector,
    aimTarget: {
      x: initialPosition.x + initialCameraPose.position.x + initialCameraPose.forward.x * combatTuning.maxAimDistance,
      y: initialPosition.y + initialCameraPose.position.y + initialCameraPose.forward.y * combatTuning.maxAimDistance,
      z: initialPosition.z + initialCameraPose.position.z + initialCameraPose.forward.z * combatTuning.maxAimDistance,
    },
    combatEvents: [],
    enemies,
    impacts: [],
    nextCombatEventId: 0,
    nextImpactId: 0,
    nextProjectileId: 0,
    projectiles: [],
    ship: initialShip,
    travel: {
      mode: 'local',
      progress: 0,
      targetSystem: null,
    },
  };
}
