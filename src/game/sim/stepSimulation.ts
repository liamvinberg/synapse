import type {
  CombatEventState,
  DamagePacket,
  EnemyState,
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
import { combatTuning, enemyTuning, worldScaleTuning } from '@/game/config/tuning';
import { applyDamage } from '@/game/sim/combat/damage';
import { actionChaseControllerProfile } from '@/game/sim/controller/controllerProfile';
import { stepEnemies } from '@/game/sim/enemies';
import { addVec3, dotVec3, lengthVec3, normalizeVec3, scaleVec3, subtractVec3 } from '@/game/sim/math';
import {
  applySolarPush,
  getPlanetGravityAcceleration,
  getPlanetOrbitalPosition,
  getPlanetOrbitalVelocity,
  getSolarExposure,
} from '@/game/sim/solarSystem';
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

function resolveImpactPosition(impact: ImpactState, planets: PlanetDescriptor[]): Vec3 {
  if (impact.anchorPlanetId === undefined || impact.anchorLocalOffset === undefined) {
    return impact.position;
  }

  const anchorPlanet = planets.find((planet) => planet.id === impact.anchorPlanetId);

  if (anchorPlanet === undefined) {
    return impact.position;
  }

  return addVec3(anchorPlanet.position, impact.anchorLocalOffset);
}

function stepImpacts(
  impacts: ImpactState[],
  planets: PlanetDescriptor[],
  deltaSeconds: number,
): ImpactState[] {
  return impacts
    .map((impact) => ({
      ...impact,
      position: resolveImpactPosition(impact, planets),
      ttlSeconds: impact.ttlSeconds - deltaSeconds,
    }))
    .filter((impact) => impact.ttlSeconds > 0);
}

function stepCombatEvents(events: CombatEventState[], deltaSeconds: number): CombatEventState[] {
  return events
    .map((event) => ({
      ...event,
      ttlSeconds: event.ttlSeconds - deltaSeconds,
    }))
    .filter((event) => event.ttlSeconds > 0);
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
  const startOffset = subtractVec3(start, center);

  if (lengthVec3(startOffset) <= radius) {
    return {
      normal: normalizeVec3(startOffset),
      point: start,
    };
  }

  const segment = subtractVec3(end, start);
  const segmentLength = lengthVec3(segment);

  if (segmentLength === 0) {
    const offset = startOffset;

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

function createImpact(
  position: Vec3,
  impactId: number,
  color: string,
  radius: number,
  anchorPlanet?: PlanetDescriptor,
): ImpactState {
  return {
    ...(anchorPlanet === undefined
      ? {}
      : {
          anchorLocalOffset: subtractVec3(position, anchorPlanet.position),
          anchorPlanetId: anchorPlanet.id,
        }),
    color,
    id: `impact-${impactId}`,
    maxTtlSeconds: combatTuning.impactTtlSeconds,
    position,
    radius,
    ttlSeconds: combatTuning.impactTtlSeconds,
  };
}

function createCombatEvent(
  kind: CombatEventState['kind'],
  position: Vec3,
  targetId: string,
  combatEventId: number,
): CombatEventState {
  switch (kind) {
    case 'death':
      return {
        color: enemyTuning.fighterColor,
        id: `combat-event-${combatEventId}`,
        kind,
        maxTtlSeconds: enemyTuning.fighterDeathEventTtlSeconds,
        position,
        radius: enemyTuning.fighterDeathEventRadius,
        targetId,
        ttlSeconds: enemyTuning.fighterDeathEventTtlSeconds,
      };
    case 'shield-break':
      return {
        color: enemyTuning.fighterShieldGlowColor,
        id: `combat-event-${combatEventId}`,
        kind,
        maxTtlSeconds: enemyTuning.fighterShieldBreakEventTtlSeconds,
        position,
        radius: enemyTuning.fighterEventRadius * 1.4,
        targetId,
        ttlSeconds: enemyTuning.fighterShieldBreakEventTtlSeconds,
      };
    case 'stagger':
      return {
        color: '#ffe08a',
        id: `combat-event-${combatEventId}`,
        kind,
        maxTtlSeconds: enemyTuning.fighterStaggerEventTtlSeconds,
        position,
        radius: enemyTuning.fighterEventRadius * 1.6,
        targetId,
        ttlSeconds: enemyTuning.fighterStaggerEventTtlSeconds,
      };
    case 'telegraph':
      return {
        color: enemyTuning.fighterColor,
        id: `combat-event-${combatEventId}`,
        kind,
        maxTtlSeconds: enemyTuning.fighterTelegraphEventTtlSeconds,
        position,
        radius: enemyTuning.fighterEventRadius * enemyTuning.fighterTelegraphScale,
        targetId,
        ttlSeconds: enemyTuning.fighterTelegraphEventTtlSeconds,
      };
    case 'hit':
    default:
      return {
        color: combatTuning.impactColor,
        id: `combat-event-${combatEventId}`,
        kind: 'hit',
        maxTtlSeconds: enemyTuning.fighterHitEventTtlSeconds,
        position,
        radius: enemyTuning.fighterEventRadius,
        targetId,
        ttlSeconds: enemyTuning.fighterHitEventTtlSeconds,
      };
  }
}

function triggerShipHitFeedback(ship: ShipState): ShipState {
  return {
    ...ship,
    cameraShakeSeconds: Math.max(ship.cameraShakeSeconds, enemyTuning.playerHitCameraShakeSeconds),
    cameraShakeStrength: Math.max(ship.cameraShakeStrength, enemyTuning.playerHitCameraShakeStrength),
  };
}

function applyProjectileHitToEnemy(enemy: EnemyState, projectile: ProjectileState, hitPoint: Vec3): {
  combatEvents: CombatEventState[];
  destroyed: boolean;
  enemy: EnemyState;
  impactColor: string;
} {
  const resolution = applyDamage(enemy.resources, projectile.damage);
  const combatEvents: CombatEventState[] = [];
  const shieldWasBroken = enemy.resources.shield > 0 && resolution.nextResources.shield <= 0;
  const staggered =
    !resolution.destroyed &&
    enemy.ai.phase !== 'staggered' &&
    resolution.nextResources.stagger >= resolution.nextResources.staggerMax;

  combatEvents.push({
    ...createCombatEvent('hit', hitPoint, enemy.id, 0),
  });

  if (shieldWasBroken) {
    combatEvents.push({
      ...createCombatEvent('shield-break', hitPoint, enemy.id, 0),
    });
  }

  if (staggered) {
    combatEvents.push({
      ...createCombatEvent('stagger', hitPoint, enemy.id, 0),
    });
  }

  if (resolution.destroyed) {
    combatEvents.push({
      ...createCombatEvent('death', hitPoint, enemy.id, 0),
    });
  }

  return {
    combatEvents,
    destroyed: resolution.destroyed,
    enemy: {
      ...enemy,
      ai: resolution.destroyed
        ? {
            ...enemy.ai,
            phase: 'dead',
            phaseSecondsRemaining: 0,
            weaponCooldownSeconds: 0,
          }
        : staggered
          ? {
              ...enemy.ai,
              phase: 'staggered',
              phaseSecondsRemaining: enemyTuning.fighterStaggerSeconds,
            }
          : enemy.ai,
      feedback: {
        deathFadeSeconds: resolution.destroyed ? enemyTuning.fighterDeathFadeSeconds : enemy.feedback.deathFadeSeconds,
        hitFlashSeconds: enemyTuning.fighterHitFlashSeconds,
        shieldFlashSeconds:
          resolution.appliedShieldDamage > 0 ? enemyTuning.fighterShieldFlashSeconds : enemy.feedback.shieldFlashSeconds,
      },
      resources: resolution.nextResources,
      velocity: resolution.destroyed ? { x: 0, y: 0, z: 0 } : enemy.velocity,
    },
    impactColor:
      resolution.appliedShieldDamage > 0 && resolution.appliedHullDamage === 0
        ? enemyTuning.fighterShieldGlowColor
        : projectile.kind === 'secondary'
          ? combatTuning.secondaryProjectileGlowColor
          : combatTuning.impactColor,
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
    owner: 'player',
    position: projectileOrigin,
    radius: combatTuning.projectileRadius,
    ttlSeconds: combatTuning.projectileTtlSeconds,
    velocity: addVec3(
      scaleVec3(projectileDirection, combatTuning.projectileSpeed),
      ship.velocity,
    ),
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
    owner: 'player',
    position: projectileOrigin,
    radius: combatTuning.secondaryProjectileRadius,
    ttlSeconds: combatTuning.secondaryProjectileTtlSeconds,
    velocity: addVec3(
      scaleVec3(projectileDirection, combatTuning.secondaryProjectileSpeed),
      ship.velocity,
    ),
  };
}

type ProjectileHit =
  | { enemyId: string; point: Vec3; type: 'enemy' }
  | { planet: PlanetDescriptor; point: Vec3; type: 'planet' }
  | { point: Vec3; type: 'ship' };

function stepProjectiles(
  projectiles: ProjectileState[],
  nextImpactId: number,
  nextCombatEventId: number,
  planets: PlanetDescriptor[],
  ship: ShipState,
  enemies: EnemyState[],
  deltaSeconds: number,
): {
  combatEvents: CombatEventState[];
  enemies: EnemyState[];
  impacts: ImpactState[];
  nextCombatEventId: number;
  nextImpactId: number;
  projectiles: ProjectileState[];
  ship: ShipState;
} {
  const halfSector = SECTOR_SPAN / 2;
  const nextProjectiles: ProjectileState[] = [];
  const impacts: ImpactState[] = [];
  const combatEvents: CombatEventState[] = [];
  let nextShip = ship;
  let nextEnemies = enemies;
  let impactId = nextImpactId;
  let combatEventId = nextCombatEventId;

  for (const projectile of projectiles) {
    const nextPosition = addVec3(projectile.position, scaleVec3(projectile.velocity, deltaSeconds));
    const nextTtlSeconds = projectile.ttlSeconds - deltaSeconds;

    if (nextTtlSeconds <= 0) {
      continue;
    }

    let hit: ProjectileHit | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const planet of planets) {
      const planetHit = findSegmentSphereHit(
        projectile.position,
        nextPosition,
        planet.position,
        planet.radius + projectile.radius,
      );

      if (planetHit !== null) {
        const distance = lengthVec3(subtractVec3(planetHit.point, projectile.position));

        if (distance < bestDistance) {
          bestDistance = distance;
          hit = { planet, point: planetHit.point, type: 'planet' };
        }
      }
    }

    if (projectile.owner === 'enemy') {
      const shipHit = findSegmentSphereHit(
        projectile.position,
        nextPosition,
        nextShip.position,
        combatTuning.shipCollisionRadius + projectile.radius,
      );

      if (shipHit !== null) {
        const distance = lengthVec3(subtractVec3(shipHit.point, projectile.position));

        if (distance < bestDistance) {
          bestDistance = distance;
          hit = { point: shipHit.point, type: 'ship' };
        }
      }
    }

    if (projectile.owner === 'player') {
      for (const enemy of nextEnemies) {
        if (enemy.ai.phase === 'dead') {
          continue;
        }

        const enemyHit = findSegmentSphereHit(
          projectile.position,
          nextPosition,
          enemy.position,
          enemy.radius + projectile.radius,
        );

        if (enemyHit === null) {
          continue;
        }

        const distance = lengthVec3(subtractVec3(enemyHit.point, projectile.position));

        if (distance < bestDistance) {
          bestDistance = distance;
          hit = { enemyId: enemy.id, point: enemyHit.point, type: 'enemy' };
        }
      }
    }

    if (hit !== null) {
      if (hit.type === 'planet') {
        impacts.push(
          createImpact(
            hit.point,
            impactId,
            projectile.kind === 'secondary' ? combatTuning.secondaryProjectileGlowColor : combatTuning.impactColor,
            projectile.impactRadius,
            hit.planet,
          ),
        );
        impactId += 1;
        continue;
      }

      if (hit.type === 'ship') {
        const previousShield = nextShip.resources.shield;
        const resolution = applyDamage(nextShip.resources, projectile.damage);
        nextShip = triggerShipHitFeedback({
          ...nextShip,
          resources: resolution.nextResources,
        });
        impacts.push(createImpact(hit.point, impactId, enemyTuning.fighterColor, projectile.impactRadius));
        impactId += 1;
        combatEvents.push(createCombatEvent('hit', hit.point, 'player-ship', combatEventId));
        combatEventId += 1;

        if (previousShield > 0 && resolution.nextResources.shield <= 0) {
          combatEvents.push(createCombatEvent('shield-break', hit.point, 'player-ship', combatEventId));
          combatEventId += 1;
        }

        continue;
      }

      const enemyIndex = nextEnemies.findIndex((enemy) => enemy.id === hit.enemyId);

      if (enemyIndex >= 0) {
        const enemyResolution = applyProjectileHitToEnemy(nextEnemies[enemyIndex], projectile, hit.point);
        nextEnemies = nextEnemies.map((enemy, index) =>
          index === enemyIndex ? enemyResolution.enemy : enemy,
        );
        impacts.push(createImpact(hit.point, impactId, enemyResolution.impactColor, projectile.impactRadius));
        impactId += 1;

        for (const event of enemyResolution.combatEvents) {
          combatEvents.push({ ...event, id: `combat-event-${combatEventId}` });
          combatEventId += 1;
        }

        if (enemyResolution.destroyed) {
          impacts.push(
            createImpact(
              hit.point,
              impactId,
              enemyTuning.fighterColor,
              enemyTuning.fighterDeathEventRadius,
            ),
          );
          impactId += 1;
        }
      }

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
    combatEvents,
    enemies: nextEnemies,
    impacts,
    nextCombatEventId: combatEventId,
    nextImpactId: impactId,
    projectiles: nextProjectiles,
    ship: nextShip,
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

function resolvePlanetPositions(planets: PlanetDescriptor[], elapsedSeconds: number): PlanetDescriptor[] {
  return planets.map((planet) => ({
    ...planet,
    position: getPlanetOrbitalPosition(planet, elapsedSeconds),
    velocity: getPlanetOrbitalVelocity(planet, elapsedSeconds),
  }));
}

function resolveShipSolarHazard(ship: ShipState, deltaSeconds: number): ShipState {
  const exposure = getSolarExposure(ship.position);

  if (exposure <= 0) {
    return ship;
  }

  const damagePacket: DamagePacket = {
    amount:
      (combatTuning.solarHazardDamagePerSecondMin +
        (combatTuning.solarHazardDamagePerSecondMax - combatTuning.solarHazardDamagePerSecondMin) * exposure * exposure) *
      deltaSeconds,
    shieldMultiplier: 1.15,
    stagger: combatTuning.collisionDamageStagger * (0.2 + exposure * 0.5) * deltaSeconds,
  };

  return {
    ...ship,
    cameraShakeSeconds: Math.max(ship.cameraShakeSeconds, combatTuning.solarHeatShakeSeconds),
    cameraShakeStrength: Math.max(
      ship.cameraShakeStrength,
      combatTuning.solarHeatShakeStrength * (0.45 + exposure * 0.85),
    ),
    position: applySolarPush(ship.position, deltaSeconds),
    resources: applyDamage(ship.resources, damagePacket).nextResources,
  };
}

function applyPlanetGravity(ship: ShipState, planets: PlanetDescriptor[], deltaSeconds: number): ShipState {
  const gravityAcceleration = getPlanetGravityAcceleration(ship.position, planets);

  if (
    gravityAcceleration.x === 0 &&
    gravityAcceleration.y === 0 &&
    gravityAcceleration.z === 0
  ) {
    return ship;
  }

  const gravityVelocity = scaleVec3(gravityAcceleration, deltaSeconds);

  return {
    ...ship,
    position: addVec3(ship.position, scaleVec3(gravityVelocity, deltaSeconds)),
    velocity: addVec3(ship.velocity, gravityVelocity),
  };
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
  const nextElapsedSeconds = snapshot.elapsedSeconds + deltaSeconds;
  const steppedCombatEvents = stepCombatEvents(snapshot.combatEvents, deltaSeconds);
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
  const activeSectorDescriptorBase = wrapped.didWrap
    ? generateSectorDescriptor(snapshot.universeSeed, wrapped.sector)
    : snapshot.activeSectorDescriptor;
  const activeSectorDescriptor = {
    ...activeSectorDescriptorBase,
    planets: resolvePlanetPositions(activeSectorDescriptorBase.planets, nextElapsedSeconds),
  };
  const steppedImpacts = stepImpacts(
    snapshot.impacts,
    activeSectorDescriptor.planets,
    deltaSeconds,
  );
  const shipAfterMovement: ShipState = {
    ...shipAfterTravel,
    position: wrapped.position,
  };
  const shipAfterGravity = applyPlanetGravity(
    shipAfterMovement,
    activeSectorDescriptor.planets,
    deltaSeconds,
  );
  const enemyStep = stepEnemies(
    snapshot.enemies,
    shipAfterGravity,
    snapshot.nextProjectileId,
    snapshot.nextCombatEventId,
    deltaSeconds,
  );
  const adsBlend = input.aimDownSights ? 1 : 0;
  const aimTarget = getAimTargetPoint(shipAfterGravity, activeSectorDescriptor.planets, adsBlend);
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
    shipAfterGravity.weaponCooldownSeconds <= 0;
  const projectileStep = stepProjectiles(
    snapshot.projectiles,
    snapshot.nextImpactId,
    enemyStep.nextCombatEventId,
    activeSectorDescriptor.planets,
    shipAfterGravity,
    enemyStep.enemies,
    deltaSeconds,
  );
  const primaryProjectile = shouldFirePrimary
    ? createProjectile(shipAfterGravity, aimTarget, enemyStep.nextProjectileId)
    : null;
  const secondaryProjectile = shouldFireSecondary
    ? createSecondaryProjectile(
        shipAfterGravity,
        aimTarget,
        enemyStep.nextProjectileId + (primaryProjectile === null ? 0 : 1),
        secondaryChargeTier,
      )
    : null;
  const projectilesWithSpawn = [
    ...projectileStep.projectiles,
    ...enemyStep.projectiles,
    ...(primaryProjectile === null ? [] : [primaryProjectile]),
    ...(secondaryProjectile === null ? [] : [secondaryProjectile]),
  ];
  let shipWithWeaponFeedback = projectileStep.ship;

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

  const collidedShip = resolveShipPlanetCollisions(
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
  const resolvedShip = resolveShipSolarHazard(collidedShip, deltaSeconds);
  const resolvedAimTarget = getAimTargetPoint(resolvedShip, activeSectorDescriptor.planets, adsBlend);

  return {
    ...snapshot,
    elapsedSeconds: nextElapsedSeconds,
    activeSector: wrapped.sector,
    activeSectorDescriptor,
    activeSystem: destinationSystem,
    aimTarget: resolvedAimTarget,
    combatEvents: [...steppedCombatEvents, ...enemyStep.combatEvents, ...projectileStep.combatEvents],
    enemies: projectileStep.enemies,
    impacts: [...steppedImpacts, ...projectileStep.impacts],
    nextCombatEventId: projectileStep.nextCombatEventId,
    nextImpactId: projectileStep.nextImpactId,
    nextProjectileId:
      enemyStep.nextProjectileId +
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
