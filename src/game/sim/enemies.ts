import { enemyTuning } from '@/game/config/tuning';
import { addVec3, lengthVec3, normalizeVec3, scaleVec3, subtractVec3 } from '@/game/sim/math';
import type {
  CombatEventState,
  EnemyFeedbackState,
  EnemyPhase,
  EnemyResources,
  EnemyState,
  PlanetDescriptor,
  ProjectileState,
  ShipState,
  Vec3,
} from '@/game/sim/types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shortestAngleDelta(current: number, target: number): number {
  const fullTurn = Math.PI * 2;
  return ((target - current + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

function stepAngle(current: number, target: number, maxStep: number): number {
  const delta = shortestAngleDelta(current, target);

  if (Math.abs(delta) <= maxStep) {
    return target;
  }

  return current + Math.sign(delta) * maxStep;
}

function createEnemyResources(): EnemyResources {
  return {
    hull: 62,
    hullMax: 62,
    shield: 34,
    shieldMax: 34,
    shieldRegenDelaySeconds: 1.8,
    shieldRegenRate: 5,
    shieldRegenTimeoutSeconds: 0,
    stagger: 0,
    staggerMax: 56,
    staggerRecoveryPerSecond: 18,
  };
}

function createEnemyFeedback(): EnemyFeedbackState {
  return {
    deathFadeSeconds: 0,
    hitFlashSeconds: 0,
    shieldFlashSeconds: 0,
  };
}

function isSafeSpawn(position: Vec3, planets: PlanetDescriptor[]): boolean {
  return planets.every((planet) => {
    const offset = subtractVec3(position, planet.position);
    const minimumDistance = planet.radius + 10;
    return lengthVec3(offset) > minimumDistance;
  });
}

function getEnemyFormationPositions(ship: ShipState): Vec3[] {
  return [
    {
      x: ship.position.x + enemyTuning.fighterSpawnLateralOffset,
      y: ship.position.y + 4,
      z: ship.position.z - enemyTuning.fighterSpawnDistance,
    },
    {
      x: ship.position.x - enemyTuning.fighterSpawnLateralOffset,
      y: ship.position.y - 6,
      z: ship.position.z - enemyTuning.fighterSpawnDistance - 18,
    },
    {
      x: ship.position.x,
      y: ship.position.y + enemyTuning.fighterSpawnVerticalOffset,
      z: ship.position.z - (enemyTuning.fighterSpawnDistance + 36),
    },
  ];
}

export function createInitialEnemies(ship: ShipState, planets: PlanetDescriptor[]): EnemyState[] {
  return getEnemyFormationPositions(ship)
    .filter((candidate) => isSafeSpawn(candidate, planets))
    .map((position, index) => ({
      ai: {
        phase: 'pursuit',
        phaseSecondsRemaining: 0,
        weaponCooldownSeconds: 0.55 + index * 0.18,
      },
      feedback: createEnemyFeedback(),
      id: `enemy-fighter-${index}`,
      kind: 'fighter',
      pitchRadians: 0,
      position,
      radius: 1.35,
      resources: createEnemyResources(),
      velocity: { x: 0, y: 0, z: 0 },
      yawRadians: Math.PI,
    }));
}

function stepEnemyResources(resources: EnemyResources, deltaSeconds: number): EnemyResources {
  const nextShieldRegenTimeoutSeconds = Math.max(
    0,
    resources.shieldRegenTimeoutSeconds - deltaSeconds,
  );
  const nextShield =
    nextShieldRegenTimeoutSeconds > 0
      ? resources.shield
      : Math.min(resources.shieldMax, resources.shield + resources.shieldRegenRate * deltaSeconds);

  return {
    ...resources,
    shield: nextShield,
    shieldRegenTimeoutSeconds: nextShieldRegenTimeoutSeconds,
    stagger: Math.max(0, resources.stagger - resources.staggerRecoveryPerSecond * deltaSeconds),
  };
}

function stepEnemyFeedback(feedback: EnemyFeedbackState, deltaSeconds: number): EnemyFeedbackState {
  return {
    deathFadeSeconds: Math.max(0, feedback.deathFadeSeconds - deltaSeconds),
    hitFlashSeconds: Math.max(0, feedback.hitFlashSeconds - deltaSeconds),
    shieldFlashSeconds: Math.max(0, feedback.shieldFlashSeconds - deltaSeconds),
  };
}

function getEnemyProjectileDirection(enemy: EnemyState, ship: ShipState): Vec3 {
  return normalizeVec3(subtractVec3(ship.position, enemy.position));
}

function createEnemyProjectile(enemy: EnemyState, ship: ShipState, projectileId: number): ProjectileState {
  const direction = getEnemyProjectileDirection(enemy, ship);
  const origin = addVec3(enemy.position, scaleVec3(direction, enemy.radius + 0.9));

  return {
    color: enemyTuning.fighterProjectileColor,
    damage: enemyTuning.fighterProjectileDamage,
    id: `enemy-projectile-${projectileId}`,
    impactRadius: enemyTuning.fighterProjectileImpactRadius,
    kind: 'enemy',
    length: enemyTuning.fighterProjectileLength,
    owner: 'enemy',
    position: origin,
    radius: enemyTuning.fighterProjectileRadius,
    ttlSeconds: enemyTuning.fighterProjectileTtlSeconds,
    velocity: scaleVec3(direction, enemyTuning.fighterProjectileSpeed),
  };
}

function createTelegraphEvent(enemy: EnemyState, eventId: number): CombatEventState {
  return {
    color: enemyTuning.fighterColor,
    id: `combat-event-${eventId}`,
    kind: 'telegraph',
    maxTtlSeconds: enemyTuning.fighterTelegraphEventTtlSeconds,
    position: enemy.position,
    radius: enemy.radius * enemyTuning.fighterTelegraphScale,
    targetId: enemy.id,
    ttlSeconds: enemyTuning.fighterTelegraphEventTtlSeconds,
  };
}

export interface StepEnemiesResult {
  combatEvents: CombatEventState[];
  enemies: EnemyState[];
  nextCombatEventId: number;
  nextProjectileId: number;
  projectiles: ProjectileState[];
}

export function stepEnemies(
  enemies: EnemyState[],
  ship: ShipState,
  nextProjectileId: number,
  nextCombatEventId: number,
  deltaSeconds: number,
): StepEnemiesResult {
  const combatEvents: CombatEventState[] = [];
  const projectiles: ProjectileState[] = [];
  let projectileId = nextProjectileId;
  let combatEventId = nextCombatEventId;

  const nextEnemies: EnemyState[] = enemies
    .map<EnemyState>((enemy) => {
      const feedback = stepEnemyFeedback(enemy.feedback, deltaSeconds);
      const resources = stepEnemyResources(enemy.resources, deltaSeconds);
      const toShip = subtractVec3(ship.position, enemy.position);
      const distanceToShip = lengthVec3(toShip);
      const horizontalDistance = Math.hypot(toShip.x, toShip.z);
      const desiredYaw = Math.atan2(toShip.x, toShip.z);
      const desiredPitch = clamp(
        -Math.atan2(toShip.y, Math.max(horizontalDistance, 0.001)),
        -Math.PI / 4,
        Math.PI / 4,
      );
      const yawRadians = stepAngle(enemy.yawRadians, desiredYaw, enemyTuning.fighterTurnRate * deltaSeconds);
      const pitchRadians = stepAngle(enemy.pitchRadians, desiredPitch, enemyTuning.fighterPitchRate * deltaSeconds);
      const aimDirection = normalizeVec3({
        x: Math.sin(yawRadians) * Math.cos(pitchRadians),
        y: -Math.sin(pitchRadians),
        z: Math.cos(yawRadians) * Math.cos(pitchRadians),
      });
      const weaponCooldownSeconds = Math.max(0, enemy.ai.weaponCooldownSeconds - deltaSeconds);

      if (enemy.ai.phase === 'dead') {
        return {
          ...enemy,
          ai: {
            ...enemy.ai,
            weaponCooldownSeconds,
          },
          feedback,
          pitchRadians,
          resources,
          velocity: { x: 0, y: 0, z: 0 },
          yawRadians,
        };
      }

      if (enemy.ai.phase === 'staggered') {
        const phaseSecondsRemaining = Math.max(0, enemy.ai.phaseSecondsRemaining - deltaSeconds);
        return {
          ...enemy,
          ai: {
            phase: phaseSecondsRemaining > 0 ? 'staggered' : 'recovery',
            phaseSecondsRemaining:
              phaseSecondsRemaining > 0 ? phaseSecondsRemaining : enemyTuning.fighterRecoverySeconds * 0.5,
            weaponCooldownSeconds,
          },
          feedback,
          pitchRadians,
          resources,
          velocity: { x: 0, y: 0, z: 0 },
          yawRadians,
        };
      }

      let phase: EnemyPhase = enemy.ai.phase;
      let phaseSecondsRemaining = Math.max(0, enemy.ai.phaseSecondsRemaining - deltaSeconds);
      let nextVelocity = enemy.velocity;
      let nextPosition = enemy.position;
      let firedProjectile: ProjectileState | null = null;

      if (phase === 'telegraph' && phaseSecondsRemaining <= 0) {
        phase = 'attack';
        phaseSecondsRemaining = enemyTuning.fighterAttackHoldSeconds;
        firedProjectile = createEnemyProjectile(enemy, ship, projectileId);
        projectileId += 1;
      }

      if (phase === 'attack' && phaseSecondsRemaining <= 0) {
        phase = 'recovery';
        phaseSecondsRemaining = enemyTuning.fighterRecoverySeconds;
      }

      if (phase === 'recovery' && phaseSecondsRemaining <= 0) {
        phase = 'pursuit';
      }

      if (phase === 'pursuit') {
        const forwardSpeed =
          distanceToShip > enemyTuning.fighterPreferredRange + 8
            ? enemyTuning.fighterForwardSpeed
            : distanceToShip < enemyTuning.fighterPreferredRange - 12
              ? -enemyTuning.fighterReverseSpeed
              : 0;
        nextVelocity = scaleVec3(aimDirection, forwardSpeed);
        nextPosition = addVec3(enemy.position, scaleVec3(nextVelocity, deltaSeconds));

        const aimAlignment =
          distanceToShip > 0 ? (aimDirection.x * toShip.x + aimDirection.y * toShip.y + aimDirection.z * toShip.z) / distanceToShip : 1;

        if (
          weaponCooldownSeconds <= 0 &&
          distanceToShip <= enemyTuning.fighterAttackRange &&
          aimAlignment >= 0.96
        ) {
          phase = 'telegraph';
          phaseSecondsRemaining = enemyTuning.fighterTelegraphSeconds;
          combatEvents.push(createTelegraphEvent(enemy, combatEventId));
          combatEventId += 1;
        }
      } else {
        nextVelocity = { x: 0, y: 0, z: 0 };
        nextPosition = enemy.position;
      }

      if (firedProjectile !== null) {
        projectiles.push(firedProjectile);
      }

      return {
        ...enemy,
        ai: {
          phase,
          phaseSecondsRemaining,
          weaponCooldownSeconds:
            firedProjectile === null ? weaponCooldownSeconds : enemyTuning.fighterWeaponCooldownSeconds,
        },
        feedback,
        pitchRadians,
        position: nextPosition,
        resources,
        velocity: nextVelocity,
        yawRadians,
      };
    })
    .filter((enemy) => enemy.ai.phase !== 'dead' || enemy.feedback.deathFadeSeconds > 0);

  return {
    combatEvents,
    enemies: nextEnemies,
    nextCombatEventId: combatEventId,
    nextProjectileId: projectileId,
    projectiles,
  };
}
