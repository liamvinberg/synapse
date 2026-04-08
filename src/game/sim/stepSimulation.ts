import type {
  DamagePacket,
  GameSnapshot,
  ImpactState,
  InputState,
  PlanetDescriptor,
  ProjectileState,
  SectorCoordinate,
  ShipResources,
  ShipState,
  Vec3,
} from '@/game/sim/types';
import { combatTuning, worldScaleTuning } from '@/game/config/tuning';
import { applyDamage } from '@/game/sim/combat/damage';
import { actionChaseControllerProfile } from '@/game/sim/controller/controllerProfile';
import { addVec3, dotVec3, lengthVec3, normalizeVec3, scaleVec3, subtractVec3 } from '@/game/sim/math';
import { getChaseCameraPose, getForwardVector } from '@/game/shared/chaseCamera';
import { stepShipController } from '@/game/sim/controller/stepShipController';
import { generateSectorDescriptor } from '@/game/worldgen/galaxy';

const SECTOR_SPAN = worldScaleTuning.sectorSpan;
const HYPER_SPOOL_SECONDS = 1.1;
const HYPER_EXIT_POSITION = { x: 0, y: 0, z: 220 };

function areSectorCoordinatesEqual(left: SectorCoordinate, right: SectorCoordinate): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function getPostJumpShipState(ship: ShipState): ShipState {
  return {
    ...ship,
    bankRadians: 0,
    collisionCooldownSeconds: 0,
    pitchRadians: 0,
    position: HYPER_EXIT_POSITION,
    velocity: { x: 0, y: 0, z: 0 },
    weaponCooldownSeconds: 0,
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
    cameraShakeSeconds: Math.max(0, ship.cameraShakeSeconds - deltaSeconds),
    cameraShakeStrength:
      ship.cameraShakeSeconds - deltaSeconds > 0 ? ship.cameraShakeStrength : 0,
    collisionCooldownSeconds: Math.max(0, ship.collisionCooldownSeconds - deltaSeconds),
    secondaryCooldownSeconds: Math.max(0, ship.secondaryCooldownSeconds - deltaSeconds),
    weaponCooldownSeconds: Math.max(0, ship.weaponCooldownSeconds - deltaSeconds),
  };
}

function stepImpacts(impacts: ImpactState[], deltaSeconds: number): ImpactState[] {
  return impacts
    .map((impact) => ({
      ...impact,
      ttlSeconds: impact.ttlSeconds - deltaSeconds,
    }))
    .filter((impact) => impact.ttlSeconds > 0);
}

function findRaySphereHitDistance(
  origin: Vec3,
  direction: Vec3,
  center: Vec3,
  radius: number,
  maxDistance: number,
): number | null {
  const toCenter = subtractVec3(origin, center);
  const a = dotVec3(direction, direction);
  const b = 2 * dotVec3(toCenter, direction);
  const c = dotVec3(toCenter, toCenter) - radius * radius;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return null;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const near = (-b - sqrtDiscriminant) / (2 * a);
  const far = (-b + sqrtDiscriminant) / (2 * a);
  const candidates = [near, far].filter((value) => value >= 0 && value <= maxDistance);

  if (candidates.length === 0) {
    return null;
  }

  return Math.min(...candidates);
}

function findSegmentSphereHit(
  start: Vec3,
  end: Vec3,
  center: Vec3,
  radius: number,
): { normal: Vec3; point: Vec3 } | null {
  const segment = subtractVec3(end, start);
  const segmentLength = lengthVec3(segment);

  if (segmentLength === 0) {
    const offset = subtractVec3(start, center);

    if (lengthVec3(offset) > radius) {
      return null;
    }

    const normal = normalizeVec3(offset);
    return {
      normal,
      point: addVec3(center, scaleVec3(normal, radius)),
    };
  }

  const direction = scaleVec3(segment, 1 / segmentLength);
  const hitDistance = findRaySphereHitDistance(start, direction, center, radius, segmentLength);

  if (hitDistance === null) {
    return null;
  }

  const point = addVec3(start, scaleVec3(direction, hitDistance));
  return {
    normal: normalizeVec3(subtractVec3(point, center)),
    point,
  };
}

function getAimTargetPoint(
  ship: ShipState,
  planets: PlanetDescriptor[],
  adsBlend = 0,
): Vec3 {
  const speed = lengthVec3(ship.velocity);
  const cameraPose = getChaseCameraPose(ship, speed, adsBlend);
  const cameraOrigin = addVec3(ship.position, cameraPose.position);
  let bestDistance: number = combatTuning.maxAimDistance;

  for (const planet of planets) {
    const hitDistance = findRaySphereHitDistance(
      cameraOrigin,
      cameraPose.forward,
      planet.position,
      planet.radius,
      bestDistance,
    );

    if (hitDistance !== null) {
      bestDistance = hitDistance;
    }
  }

  return addVec3(cameraOrigin, scaleVec3(cameraPose.forward, bestDistance));
}

function createImpact(position: Vec3, impactId: number, color: string, radius: number): ImpactState {
  return {
    color,
    id: `impact-${impactId}`,
    maxTtlSeconds: combatTuning.impactTtlSeconds,
    position,
    radius,
    ttlSeconds: combatTuning.impactTtlSeconds,
  };
}

function applyWeaponFeedback(
  ship: ShipState,
  direction: Vec3,
  recoilImpulse: number,
  shakeStrength: number,
  shakeSeconds: number,
): ShipState {
  return {
    ...ship,
    cameraShakeSeconds: Math.max(ship.cameraShakeSeconds, shakeSeconds),
    cameraShakeStrength: Math.max(ship.cameraShakeStrength, shakeStrength),
    velocity: addVec3(ship.velocity, scaleVec3(direction, -recoilImpulse)),
  };
}

type SecondaryChargeTier = 'partial' | 'mid' | 'full';

function getSecondaryChargeTier(chargeSeconds: number): SecondaryChargeTier {
  if (chargeSeconds >= combatTuning.secondaryChargeFullSeconds) {
    return 'full';
  }

  if (chargeSeconds >= combatTuning.secondaryChargeMidSeconds) {
    return 'mid';
  }

  return 'partial';
}

function createProjectile(
  ship: ShipState,
  aimTarget: Vec3,
  projectileId: number,
): ProjectileState {
  const shipForward = getForwardVector(ship.yawRadians, ship.pitchRadians);
  const projectileOrigin = addVec3(
    ship.position,
    scaleVec3(shipForward, combatTuning.projectileSpawnOffset),
  );
  const projectileDirection = normalizeVec3(subtractVec3(aimTarget, projectileOrigin));

  return {
    color: combatTuning.projectileColor,
    damage: combatTuning.projectileDamage,
    id: `projectile-${projectileId}`,
    impactRadius: combatTuning.impactRadius,
    kind: 'primary',
    length: combatTuning.projectileLength,
    position: projectileOrigin,
    radius: combatTuning.projectileRadius,
    ttlSeconds: combatTuning.projectileTtlSeconds,
    velocity: scaleVec3(projectileDirection, combatTuning.projectileSpeed),
  };
}

function createSecondaryProjectile(
  ship: ShipState,
  aimTarget: Vec3,
  projectileId: number,
  chargeTier: SecondaryChargeTier,
): ProjectileState {
  const shipForward = getForwardVector(ship.yawRadians, ship.pitchRadians);
  const projectileOrigin = addVec3(
    ship.position,
    scaleVec3(shipForward, combatTuning.projectileSpawnOffset + 0.4),
  );
  const projectileDirection = normalizeVec3(subtractVec3(aimTarget, projectileOrigin));
  const hullMultiplier = combatTuning.secondaryProjectileHullMultiplier[chargeTier];
  const shieldMultiplier = combatTuning.secondaryProjectileShieldMultiplier[chargeTier];
  const stagger = combatTuning.secondaryProjectileStagger[chargeTier];

  return {
    color: combatTuning.secondaryProjectileColor,
    damage: {
      amount: combatTuning.projectileDamage.amount * hullMultiplier,
      shieldMultiplier,
      stagger,
    },
    id: `secondary-projectile-${projectileId}`,
    impactRadius: combatTuning.secondaryProjectileImpactRadius[chargeTier],
    kind: 'secondary',
    length: combatTuning.secondaryProjectileLengths[chargeTier],
    position: projectileOrigin,
    radius: combatTuning.secondaryProjectileRadius,
    ttlSeconds: combatTuning.secondaryProjectileTtlSeconds,
    velocity: scaleVec3(projectileDirection, combatTuning.secondaryProjectileSpeed),
  };
}

function stepProjectiles(
  projectiles: ProjectileState[],
  nextImpactId: number,
  planets: PlanetDescriptor[],
  deltaSeconds: number,
): { impacts: ImpactState[]; nextImpactId: number; projectiles: ProjectileState[] } {
  const halfSector = SECTOR_SPAN / 2;
  const nextProjectiles: ProjectileState[] = [];
  const impacts: ImpactState[] = [];
  let impactId = nextImpactId;

  for (const projectile of projectiles) {
    const nextPosition = addVec3(projectile.position, scaleVec3(projectile.velocity, deltaSeconds));
    const nextTtlSeconds = projectile.ttlSeconds - deltaSeconds;

    if (nextTtlSeconds <= 0) {
      continue;
    }

    let hitPoint: Vec3 | null = null;

    for (const planet of planets) {
      const hit = findSegmentSphereHit(
        projectile.position,
        nextPosition,
        planet.position,
        planet.radius + projectile.radius,
      );

      if (hit !== null) {
        hitPoint = hit.point;
        break;
      }
    }

    if (hitPoint !== null) {
      impacts.push(
        createImpact(
          hitPoint,
          impactId,
          projectile.kind === 'secondary' ? combatTuning.secondaryProjectileGlowColor : combatTuning.impactColor,
          projectile.impactRadius,
        ),
      );
      impactId += 1;
      continue;
    }

    if (
      Math.abs(nextPosition.x) > halfSector ||
      Math.abs(nextPosition.y) > halfSector ||
      Math.abs(nextPosition.z) > halfSector
    ) {
      continue;
    }

    nextProjectiles.push({
      ...projectile,
      position: nextPosition,
      ttlSeconds: nextTtlSeconds,
    });
  }

  return {
    impacts,
    nextImpactId: impactId,
    projectiles: nextProjectiles,
  };
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
  previousPosition: Vec3,
  ship: ShipState,
  planets: PlanetDescriptor[],
): ShipState {
  let nextShip = ship;

  for (const planet of planets) {
    const collisionDistance = planet.radius + combatTuning.shipCollisionRadius;
    const currentOffset = subtractVec3(nextShip.position, planet.position);
    const currentDistance = lengthVec3(currentOffset);
    const sweptHit = findSegmentSphereHit(previousPosition, nextShip.position, planet.position, collisionDistance);
    const isOverlapping = currentDistance < collisionDistance;

    if (!isOverlapping && sweptHit === null) {
      continue;
    }

    if (!isOverlapping && sweptHit !== null && dotVec3(nextShip.velocity, sweptHit.normal) >= 0) {
      continue;
    }

    const collisionNormal =
      isOverlapping
        ? normalizeVec3(
            currentDistance === 0 ? scaleVec3(normalizeVec3(nextShip.velocity), -1) : currentOffset,
          )
        : sweptHit!.normal;

    const speed = lengthVec3(nextShip.velocity);
    const normalSpeed = dotVec3(nextShip.velocity, collisionNormal);
    const tangentialVelocity = subtractVec3(nextShip.velocity, scaleVec3(collisionNormal, normalSpeed));
    const bounceSpeed =
      normalSpeed < 0
        ? Math.max(combatTuning.collisionBounceSpeed, -normalSpeed * 0.35)
        : Math.max(normalSpeed, 0);
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
      position: addVec3(planet.position, scaleVec3(collisionNormal, collisionDistance)),
      resources: nextResources,
      velocity: addVec3(tangentialVelocity, scaleVec3(collisionNormal, bounceSpeed)),
    };
  }

  return nextShip;
}

export function stepSimulation(
  snapshot: GameSnapshot,
  input: InputState,
  deltaSeconds: number,
): GameSnapshot {
  const targetSystem = snapshot.travel.targetSystem;
  const shouldSpoolHyper =
    input.hyperCommit &&
    targetSystem !== null &&
    !areSectorCoordinatesEqual(snapshot.activeSystem, targetSystem);
  const nextTravelProgress = shouldSpoolHyper
    ? Math.min(1, snapshot.travel.progress + deltaSeconds / HYPER_SPOOL_SECONDS)
    : 0;
  const willCompleteJump = shouldSpoolHyper && nextTravelProgress >= 1;
  const destinationSystem = willCompleteJump ? targetSystem! : snapshot.activeSystem;
  const steppedImpacts = stepImpacts(snapshot.impacts, deltaSeconds);
  const nextShip = stepShipTimers(
    stepShipController(snapshot.ship, input, deltaSeconds),
    deltaSeconds,
  );
  const nextShipResources = stepShipResources(
    snapshot.ship.resources,
    input,
    deltaSeconds,
  );
  const shipAfterTravel = willCompleteJump
    ? getPostJumpShipState({
        ...nextShip,
        resources: nextShipResources,
      })
    : {
        ...nextShip,
        resources: nextShipResources,
      };
  const wrapped = willCompleteJump
    ? {
        didWrap: true,
        position: shipAfterTravel.position,
        sector: destinationSystem,
      }
    : wrapPositionToSector(shipAfterTravel.position, snapshot.activeSector);
  const activeSectorDescriptor = wrapped.didWrap
    ? generateSectorDescriptor(snapshot.universeSeed, wrapped.sector)
    : snapshot.activeSectorDescriptor;
  const shipAfterMovement: ShipState = {
    ...shipAfterTravel,
    position: wrapped.position,
  };
  const adsBlend = input.aimDownSights ? 1 : 0;
  const aimTarget = getAimTargetPoint(shipAfterMovement, activeSectorDescriptor.planets, adsBlend);
  const isChargingSecondary =
    input.aimDownSights &&
    !input.boost &&
    input.fire &&
    shipAfterMovement.secondaryCooldownSeconds <= 0;
  const nextSecondaryChargeSeconds = isChargingSecondary
    ? snapshot.ship.secondaryChargeSeconds + deltaSeconds
    : 0;
  const didReleaseSecondaryTrigger =
    snapshot.ship.secondaryChargeSeconds > 0 &&
    !input.fire &&
    input.aimDownSights &&
    shipAfterMovement.secondaryCooldownSeconds <= 0;
  const didCancelSecondaryMode =
    snapshot.ship.secondaryChargeSeconds > 0 &&
    !input.aimDownSights;
  const shouldFireSecondary =
    didReleaseSecondaryTrigger &&
    snapshot.ship.secondaryChargeSeconds >= combatTuning.secondaryChargeMinSeconds;
  const secondaryChargeTier = getSecondaryChargeTier(snapshot.ship.secondaryChargeSeconds);
  const shouldFirePrimary =
    input.fire &&
    !input.aimDownSights &&
    !didCancelSecondaryMode &&
    shipAfterMovement.weaponCooldownSeconds <= 0;
  const projectileStep = stepProjectiles(
    snapshot.projectiles,
    snapshot.nextImpactId,
    activeSectorDescriptor.planets,
    deltaSeconds,
  );
  const primaryProjectile = shouldFirePrimary
    ? createProjectile(shipAfterMovement, aimTarget, snapshot.nextProjectileId)
    : null;
  const secondaryProjectile = shouldFireSecondary
    ? createSecondaryProjectile(
        shipAfterMovement,
        aimTarget,
        snapshot.nextProjectileId + (primaryProjectile === null ? 0 : 1),
        secondaryChargeTier,
      )
    : null;
  const projectilesWithSpawn = [
    ...projectileStep.projectiles,
    ...(primaryProjectile === null ? [] : [primaryProjectile]),
    ...(secondaryProjectile === null ? [] : [secondaryProjectile]),
  ];
  let shipWithWeaponFeedback = shipAfterMovement;

  if (primaryProjectile !== null) {
    shipWithWeaponFeedback = applyWeaponFeedback(
      shipWithWeaponFeedback,
      normalizeVec3(primaryProjectile.velocity),
      combatTuning.projectileRecoilImpulse,
      combatTuning.primaryCameraShakeStrength,
      combatTuning.primaryCameraShakeSeconds,
    );
  }

  if (secondaryProjectile !== null) {
    shipWithWeaponFeedback = applyWeaponFeedback(
      shipWithWeaponFeedback,
      normalizeVec3(secondaryProjectile.velocity),
      combatTuning.secondaryProjectileRecoilImpulse,
      combatTuning.secondaryCameraShakeStrength,
      combatTuning.secondaryCameraShakeSeconds,
    );
  }

  const resolvedShip = resolveShipPlanetCollisions(
    snapshot.ship.position,
    {
      ...shipWithWeaponFeedback,
      secondaryChargeSeconds: isChargingSecondary ? nextSecondaryChargeSeconds : 0,
      secondaryCooldownSeconds: shouldFireSecondary
        ? combatTuning.secondaryCooldownSeconds
        : shipWithWeaponFeedback.secondaryCooldownSeconds,
      weaponCooldownSeconds: shouldFirePrimary
        ? combatTuning.fireCooldownSeconds
        : shipWithWeaponFeedback.weaponCooldownSeconds,
    },
    activeSectorDescriptor.planets,
  );
  const resolvedAimTarget = getAimTargetPoint(resolvedShip, activeSectorDescriptor.planets, adsBlend);

  return {
    ...snapshot,
    elapsedSeconds: snapshot.elapsedSeconds + deltaSeconds,
    activeSector: wrapped.sector,
    activeSectorDescriptor,
    activeSystem: destinationSystem,
    aimTarget: resolvedAimTarget,
    impacts: [...steppedImpacts, ...projectileStep.impacts],
    nextImpactId: projectileStep.nextImpactId,
    nextProjectileId:
      snapshot.nextProjectileId +
      (primaryProjectile === null ? 0 : 1) +
      (secondaryProjectile === null ? 0 : 1),
    projectiles: projectilesWithSpawn,
    ship: {
      ...resolvedShip,
    },
    travel: {
      mode: willCompleteJump ? 'local' : shouldSpoolHyper ? 'spooling' : 'local',
      progress: willCompleteJump ? 0 : nextTravelProgress,
      targetSystem: willCompleteJump ? null : targetSystem,
    },
  };
}
