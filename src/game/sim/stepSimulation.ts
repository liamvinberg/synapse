import type {
  DamagePacket,
  GameSnapshot,
  InputState,
  PlanetDescriptor,
  ProjectileState,
  SectorCoordinate,
  ShipResources,
  ShipState,
  Vec3,
} from '@/game/sim/types';
import { combatTuning } from '@/game/config/tuning';
import { applyDamage } from '@/game/sim/combat/damage';
import { actionChaseControllerProfile } from '@/game/sim/controller/controllerProfile';
import { addVec3, lengthVec3, normalizeVec3, scaleVec3, subtractVec3 } from '@/game/sim/math';
import { stepShipController } from '@/game/sim/controller/stepShipController';
import { generateSectorDescriptor } from '@/game/worldgen/galaxy';

const SECTOR_SPAN = 2400;

function getForwardVector(yawRadians: number, pitchRadians: number): Vec3 {
  const cosPitch = Math.cos(pitchRadians);

  return {
    x: Math.sin(yawRadians) * cosPitch,
    y: -Math.sin(pitchRadians),
    z: Math.cos(yawRadians) * cosPitch,
  };
}

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

function stepShipTimers(ship: ShipState, deltaSeconds: number): ShipState {
  return {
    ...ship,
    collisionCooldownSeconds: Math.max(0, ship.collisionCooldownSeconds - deltaSeconds),
    weaponCooldownSeconds: Math.max(0, ship.weaponCooldownSeconds - deltaSeconds),
  };
}

function createProjectile(ship: ShipState, projectileId: number): ProjectileState {
  const forward = getForwardVector(ship.yawRadians, ship.pitchRadians);

  return {
    damage: combatTuning.projectileDamage,
    id: `projectile-${projectileId}`,
    position: addVec3(ship.position, scaleVec3(forward, combatTuning.projectileSpawnOffset)),
    radius: combatTuning.projectileRadius,
    ttlSeconds: combatTuning.projectileTtlSeconds,
    velocity: addVec3(ship.velocity, scaleVec3(forward, combatTuning.projectileSpeed)),
  };
}

function stepProjectiles(
  projectiles: ProjectileState[],
  deltaSeconds: number,
): ProjectileState[] {
  const halfSector = SECTOR_SPAN / 2;

  return projectiles
    .map((projectile) => ({
      ...projectile,
      position: addVec3(projectile.position, scaleVec3(projectile.velocity, deltaSeconds)),
      ttlSeconds: projectile.ttlSeconds - deltaSeconds,
    }))
    .filter((projectile) => {
      if (projectile.ttlSeconds <= 0) {
        return false;
      }

      return (
        Math.abs(projectile.position.x) <= halfSector &&
        Math.abs(projectile.position.y) <= halfSector &&
        Math.abs(projectile.position.z) <= halfSector
      );
    });
}

function collidesWithPlanet(
  position: Vec3,
  radius: number,
  planet: PlanetDescriptor,
): boolean {
  const offset = subtractVec3(position, planet.position);
  return lengthVec3(offset) <= planet.radius + radius;
}

function resolveProjectilePlanetHits(
  projectiles: ProjectileState[],
  planets: PlanetDescriptor[],
): ProjectileState[] {
  return projectiles.filter(
    (projectile) =>
      !planets.some((planet) => collidesWithPlanet(projectile.position, projectile.radius, planet)),
  );
}

function getCollisionDamagePacket(speed: number): DamagePacket | null {
  if (speed < combatTuning.collisionDamageSpeedThreshold) {
    return null;
  }

  return {
    amount: (speed - combatTuning.collisionDamageSpeedThreshold) * combatTuning.collisionDamageStep,
    shieldMultiplier: combatTuning.collisionDamageShieldMultiplier,
    stagger: combatTuning.collisionDamageStagger,
  };
}

function resolveShipPlanetCollisions(
  ship: ShipState,
  planets: PlanetDescriptor[],
): ShipState {
  let nextShip = ship;

  for (const planet of planets) {
    const offset = subtractVec3(nextShip.position, planet.position);
    const distance = lengthVec3(offset);
    const collisionDistance = planet.radius + combatTuning.shipCollisionRadius;

    if (distance >= collisionDistance) {
      continue;
    }

    const normal = normalizeVec3(offset);
    const speed = lengthVec3(nextShip.velocity);
    const damagePacket =
      nextShip.collisionCooldownSeconds <= 0 ? getCollisionDamagePacket(speed) : null;
    const nextResources =
      damagePacket === null
        ? nextShip.resources
        : applyDamage(nextShip.resources, damagePacket).nextResources;

    nextShip = {
      ...nextShip,
      collisionCooldownSeconds:
        damagePacket === null ? nextShip.collisionCooldownSeconds : combatTuning.collisionCooldownSeconds,
      position: addVec3(planet.position, scaleVec3(normal, collisionDistance)),
      resources: nextResources,
      velocity: scaleVec3(normal, Math.min(combatTuning.collisionBounceSpeed, speed * 0.25)),
    };
  }

  return nextShip;
}

export function stepSimulation(
  snapshot: GameSnapshot,
  input: InputState,
  deltaSeconds: number,
): GameSnapshot {
  const nextShip = stepShipTimers(
    stepShipController(snapshot.ship, input, deltaSeconds),
    deltaSeconds,
  );
  const nextShipResources = stepShipResources(
    snapshot.ship.resources,
    input,
    deltaSeconds,
  );
  const wrapped = wrapPositionToSector(nextShip.position, snapshot.activeSector);
  const activeSectorDescriptor = wrapped.didWrap
    ? generateSectorDescriptor(snapshot.universeSeed, wrapped.sector)
    : snapshot.activeSectorDescriptor;
  const shipAfterMovement: ShipState = {
    ...nextShip,
    position: wrapped.position,
    resources: nextShipResources,
  };
  const shouldFire = input.fire && shipAfterMovement.weaponCooldownSeconds <= 0;
  const steppedProjectiles = stepProjectiles(snapshot.projectiles, deltaSeconds);
  const projectilesWithSpawn = shouldFire
    ? [...steppedProjectiles, createProjectile(shipAfterMovement, snapshot.nextProjectileId)]
    : steppedProjectiles;
  const survivingProjectiles = resolveProjectilePlanetHits(
    projectilesWithSpawn,
    activeSectorDescriptor.planets,
  );
  const resolvedShip = resolveShipPlanetCollisions(
    {
      ...shipAfterMovement,
      weaponCooldownSeconds: shouldFire
        ? combatTuning.fireCooldownSeconds
        : shipAfterMovement.weaponCooldownSeconds,
    },
    activeSectorDescriptor.planets,
  );

  return {
    ...snapshot,
    elapsedSeconds: snapshot.elapsedSeconds + deltaSeconds,
    activeSector: wrapped.sector,
    activeSectorDescriptor,
    nextProjectileId: shouldFire ? snapshot.nextProjectileId + 1 : snapshot.nextProjectileId,
    projectiles: survivingProjectiles,
    ship: {
      ...resolvedShip,
    },
  };
}
