import { addVec3, normalizeYawVector, scaleVec3 } from '@/game/sim/math';
import type {
  GameSnapshot,
  InputState,
  SectorCoordinate,
  ShipState,
  Vec3,
} from '@/game/sim/types';
import { generateSectorDescriptor } from '@/game/worldgen/galaxy';

const BASE_THRUST = 18;
const BOOST_MULTIPLIER = 2.4;
const LINEAR_DAMPING = 0.96;
const SECTOR_SPAN = 2400;
const TURN_SPEED = 1.6;

function applyLinearDamping(velocity: Vec3, deltaSeconds: number): Vec3 {
  const dampingFactor = Math.pow(LINEAR_DAMPING, deltaSeconds * 60);
  return scaleVec3(velocity, dampingFactor);
}

function updateShipState(
  ship: ShipState,
  input: InputState,
  deltaSeconds: number,
): ShipState {
  const yawDirection = Number(input.yawLeft) - Number(input.yawRight);
  const thrustDirection = Number(input.thrustForward) - Number(input.thrustBackward);
  const yawRadians = ship.yawRadians + yawDirection * TURN_SPEED * deltaSeconds;
  const forwardVector = normalizeYawVector(yawRadians);
  const thrustMultiplier = input.boost ? BOOST_MULTIPLIER : 1;
  const acceleration = scaleVec3(
    forwardVector,
    thrustDirection * BASE_THRUST * thrustMultiplier * deltaSeconds,
  );
  const velocity = applyLinearDamping(addVec3(ship.velocity, acceleration), deltaSeconds);

  return {
    ...ship,
    yawRadians,
    velocity,
    position: addVec3(ship.position, scaleVec3(velocity, deltaSeconds)),
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

  return { position: nextPosition, sector: nextSector, didWrap };
}

export function stepSimulation(
  snapshot: GameSnapshot,
  input: InputState,
  deltaSeconds: number,
): GameSnapshot {
  const nextShip = updateShipState(snapshot.ship, input, deltaSeconds);
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
    },
  };
}
