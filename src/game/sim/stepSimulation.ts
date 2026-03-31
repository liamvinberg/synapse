import type {
  GameSnapshot,
  InputState,
  SectorCoordinate,
  ShipResources,
  Vec3,
} from '@/game/sim/types';
import { actionChaseControllerProfile } from '@/game/sim/controller/controllerProfile';
import { stepShipController } from '@/game/sim/controller/stepShipController';
import { generateSectorDescriptor } from '@/game/worldgen/galaxy';

const SECTOR_SPAN = 2400;

function stepShipResources(
  resources: ShipResources,
  input: InputState,
  deltaSeconds: number,
): ShipResources {
  const nextShieldRegenTimeoutSeconds = Math.max(
    0,
    resources.shieldRegenTimeoutSeconds - deltaSeconds,
  );
  const nextShield =
    nextShieldRegenTimeoutSeconds > 0
      ? resources.shield
      : Math.min(
          resources.shieldMax,
          resources.shield + resources.shieldRegenRate * deltaSeconds,
        );
  const boostDrain = input.boost
    ? actionChaseControllerProfile.boostDrainPerSecond * deltaSeconds
    : 0;
  const boostRecharge = input.boost
    ? 0
    : actionChaseControllerProfile.boostRechargePerSecond * deltaSeconds;

  return {
    ...resources,
    boostEnergy: Math.max(
      0,
      Math.min(resources.boostEnergyMax, resources.boostEnergy - boostDrain + boostRecharge),
    ),
    shield: nextShield,
    shieldRegenTimeoutSeconds: nextShieldRegenTimeoutSeconds,
    stagger: Math.max(0, resources.stagger - resources.staggerRecoveryPerSecond * deltaSeconds),
  };
}

function wrapPositionToSector(
  position: Vec3,
  sector: SectorCoordinate,
): { position: Vec3; sector: SectorCoordinate; didWrap: boolean } {
  const nextPosition = { ...position };
  const nextSector = { ...sector };
  let didWrap = false;
  const halfSector = SECTOR_SPAN / 2;

  while (nextPosition.x > halfSector) {
    nextPosition.x -= SECTOR_SPAN;
    nextSector.x += 1;
    didWrap = true;
  }

  while (nextPosition.x < -halfSector) {
    nextPosition.x += SECTOR_SPAN;
    nextSector.x -= 1;
    didWrap = true;
  }

  while (nextPosition.z > halfSector) {
    nextPosition.z -= SECTOR_SPAN;
    nextSector.z += 1;
    didWrap = true;
  }

  while (nextPosition.z < -halfSector) {
    nextPosition.z += SECTOR_SPAN;
    nextSector.z -= 1;
    didWrap = true;
  }

  while (nextPosition.y > halfSector) {
    nextPosition.y -= SECTOR_SPAN;
    nextSector.y += 1;
    didWrap = true;
  }

  while (nextPosition.y < -halfSector) {
    nextPosition.y += SECTOR_SPAN;
    nextSector.y -= 1;
    didWrap = true;
  }

  return { position: nextPosition, sector: nextSector, didWrap };
}

export function stepSimulation(
  snapshot: GameSnapshot,
  input: InputState,
  deltaSeconds: number,
): GameSnapshot {
  const nextShip = stepShipController(snapshot.ship, input, deltaSeconds);
  const nextShipResources = stepShipResources(
    snapshot.ship.resources,
    input,
    deltaSeconds,
  );
  const wrapped = wrapPositionToSector(nextShip.position, snapshot.activeSector);
  const activeSectorDescriptor = wrapped.didWrap
    ? generateSectorDescriptor(snapshot.universeSeed, wrapped.sector)
    : snapshot.activeSectorDescriptor;

  return {
    ...snapshot,
    elapsedSeconds: snapshot.elapsedSeconds + deltaSeconds,
    activeSector: wrapped.sector,
    activeSectorDescriptor,
    ship: {
      ...nextShip,
      position: wrapped.position,
      resources: nextShipResources,
    },
  };
}
