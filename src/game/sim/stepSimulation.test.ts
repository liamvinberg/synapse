import { describe, expect, it } from 'vitest';
import { combatTuning, flightTuning } from '@/game/config/tuning';
import { getForwardVector } from '@/game/shared/chaseCamera';
import { createInitialSnapshot } from '@/game/sim/createInitialSnapshot';
import { getPlanetGravityAcceleration } from '@/game/sim/solarSystem';
import { stepSimulation } from '@/game/sim/stepSimulation';
import type { GameSnapshot, InputState } from '@/game/sim/types';

const testPlanetSurface = {
  atmosphereColor: null,
  atmosphereOpacity: 0,
  atmosphereScale: 1.04,
  banding: 0.15,
  biome: 'rocky' as const,
  cloudColor: null,
  cloudDensity: 0,
  craterDensity: 0.4,
  detailColor: '#d1c6b1',
  emissiveColor: null,
  oceanLevel: 0,
  polarCapAmount: 0,
  primaryColor: '#7d8d9f',
  roughness: 0.92,
  secondaryColor: '#495566',
  seed: 1234,
  specularStrength: 0.08,
  terrainSharpness: 0.55,
  textureScale: 2.5,
  variant: 1,
  warpAmount: 0.18,
};

function createSnapshotWithPlanet(): GameSnapshot {
  const snapshot = createInitialSnapshot('combat-test', { includeInitialEnemies: false });

  return {
    ...snapshot,
    activeSectorDescriptor: {
      ...snapshot.activeSectorDescriptor,
      planets: [
        {
          color: '#ffffff',
          id: 'planet-test',
          orbitAngularSpeed: 0,
          orbitDistance: 160,
          orbitEccentricity: 0,
          orbitPhaseRadians: Math.PI / 2,
          orbitTiltRadians: 0,
          position: { x: 0, y: 0, z: 160 },
          radius: 18,
          spinSpeed: 0.04,
          surface: testPlanetSurface,
          velocity: { x: 0, y: 0, z: 0 },
        },
      ],
    },
  };
}

function createEnemy(overrides: Partial<GameSnapshot['enemies'][number]> = {}): GameSnapshot['enemies'][number] {
  return {
    ai: {
      phase: 'pursuit',
      phaseSecondsRemaining: 0,
      weaponCooldownSeconds: 0,
      ...overrides.ai,
    },
    feedback: {
      deathFadeSeconds: 0,
      hitFlashSeconds: 0,
      shieldFlashSeconds: 0,
      ...overrides.feedback,
    },
    id: 'enemy-test',
    kind: 'fighter',
    pitchRadians: 0,
    position: { x: 0, y: 0, z: 170 },
    radius: 1.35,
    resources: {
      hull: 24,
      hullMax: 24,
      shield: 10,
      shieldMax: 10,
      shieldRegenDelaySeconds: 1.8,
      shieldRegenRate: 5,
      shieldRegenTimeoutSeconds: 0,
      stagger: 0,
      staggerMax: 40,
      staggerRecoveryPerSecond: 18,
      ...overrides.resources,
    },
    velocity: { x: 0, y: 0, z: 0 },
    yawRadians: Math.PI,
    ...overrides,
  };
}

function inputState(overrides: Partial<InputState>): InputState {
  return {
    aim: { x: 0, y: 0 },
    aimDownSights: false,
    boost: false,
    brake: false,
    fire: false,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false,
    ...overrides,
  };
}

describe('stepSimulation combat and collision', () => {
  it('spawns a projectile when fire is pressed and weapon cooldown is ready', () => {
    const snapshot = createInitialSnapshot('fire-test', { includeInitialEnemies: false });

    const nextSnapshot = stepSimulation(snapshot, inputState({ ...{
      aim: { x: 0, y: 0 },
      aimDownSights: false,
      boost: false,
      brake: false,
      fire: true,
      hyperCommit: false,
      strafeLeft: false,
      strafeRight: false,
      thrustBackward: false,
      thrustForward: false,
      thrustDown: false,
      thrustUp: false,
    }, }), 1 / 60);

    expect(nextSnapshot.projectiles).toHaveLength(1);
    expect(nextSnapshot.ship.weaponCooldownSeconds).toBe(combatTuning.fireCooldownSeconds);
    const shipForward = getForwardVector(snapshot.ship.yawRadians, snapshot.ship.pitchRadians);
    expect(nextSnapshot.projectiles[0].position.x).toBeCloseTo(
      snapshot.ship.position.x + shipForward.x * combatTuning.projectileSpawnOffset,
      5,
    );
    expect(nextSnapshot.projectiles[0].position.y).toBeCloseTo(
      snapshot.ship.position.y + shipForward.y * combatTuning.projectileSpawnOffset,
      5,
    );
    expect(nextSnapshot.projectiles[0].position.z).toBeCloseTo(
      snapshot.ship.position.z + shipForward.z * combatTuning.projectileSpawnOffset,
      5,
    );
  });

  it('starts gameplay with a small enemy formation by default', () => {
    const snapshot = createInitialSnapshot('enemy-default-formation');

    expect(snapshot.enemies.length).toBeGreaterThanOrEqual(2);
  });

  it('removes projectiles that hit planets', () => {
    const snapshot = createSnapshotWithPlanet();
    const projectileSnapshot: GameSnapshot = {
      ...snapshot,
      projectiles: [
        {
          color: combatTuning.projectileColor,
          damage: combatTuning.projectileDamage,
          id: 'projectile-hit',
          impactRadius: combatTuning.impactRadius,
          kind: 'primary',
          length: combatTuning.projectileLength,
          owner: 'player',
          position: { x: 0, y: 0, z: 160 },
          radius: combatTuning.projectileRadius,
          ttlSeconds: 1,
          velocity: { x: 0, y: 0, z: 0 },
        },
      ],
    };

    const nextSnapshot = stepSimulation(projectileSnapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: false,
    boost: false,
    brake: false,
    fire: false,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false, }), 1 / 60);

    expect(nextSnapshot.projectiles).toHaveLength(0);
    expect(nextSnapshot.impacts).toHaveLength(1);
  });

  it('keeps a planet-hit impact attached to the planet as it moves', () => {
    const snapshot = createSnapshotWithPlanet();
    const movingPlanetSnapshot: GameSnapshot = {
      ...snapshot,
      activeSectorDescriptor: {
        ...snapshot.activeSectorDescriptor,
        planets: [
          {
            ...snapshot.activeSectorDescriptor.planets[0],
            orbitAngularSpeed: 1,
            position: { x: 0, y: 0, z: 160 },
          },
        ],
      },
      impacts: [
        {
          anchorLocalOffset: { x: 0, y: 0, z: 18 },
          anchorPlanetId: 'planet-test',
          color: combatTuning.impactColor,
          id: 'impact-anchored',
          maxTtlSeconds: 2,
          position: { x: 0, y: 0, z: 178 },
          radius: combatTuning.impactRadius,
          ttlSeconds: 2,
        },
      ],
    };

    const nextSnapshot = stepSimulation(movingPlanetSnapshot, inputState({}), 1);
    const movedPlanet = nextSnapshot.activeSectorDescriptor.planets[0];

    expect(nextSnapshot.impacts).toHaveLength(1);
    expect(nextSnapshot.impacts[0].position.x).toBeCloseTo(movedPlanet.position.x, 5);
    expect(nextSnapshot.impacts[0].position.y).toBeCloseTo(movedPlanet.position.y, 5);
    expect(nextSnapshot.impacts[0].position.z).toBeCloseTo(movedPlanet.position.z + 18, 5);
  });

  it('pushes the ship out of planets and applies collision damage at speed', () => {
    const snapshot = createSnapshotWithPlanet();
    const collisionSnapshot: GameSnapshot = {
      ...snapshot,
      ship: {
        ...snapshot.ship,
        position: { x: 0, y: 0, z: 160 },
        resources: {
          ...snapshot.ship.resources,
          shield: 60,
        },
        velocity: { x: 0, y: 0, z: -40 },
      },
    };

    const nextSnapshot = stepSimulation(collisionSnapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: false,
    boost: false,
    brake: false,
    fire: false,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false, }), 1 / 60);

    const planet = nextSnapshot.activeSectorDescriptor.planets[0];
    const dx = nextSnapshot.ship.position.x - planet.position.x;
    const dy = nextSnapshot.ship.position.y - planet.position.y;
    const dz = nextSnapshot.ship.position.z - planet.position.z;
    const distance = Math.hypot(dx, dy, dz);

    expect(distance).toBeGreaterThanOrEqual(planet.radius + combatTuning.shipCollisionRadius - 0.001);
    expect(nextSnapshot.ship.resources.shield).toBeLessThan(60);
    expect(nextSnapshot.ship.collisionCooldownSeconds).toBe(combatTuning.collisionCooldownSeconds);
  });

  it('does not re-collide when the ship is already leaving the planet surface', () => {
    const snapshot = createSnapshotWithPlanet();
    const surfaceDistance =
      snapshot.activeSectorDescriptor.planets[0].radius + combatTuning.shipCollisionRadius;
    const departingSnapshot: GameSnapshot = {
      ...snapshot,
      ship: {
        ...snapshot.ship,
        position: { x: 0, y: 0, z: 160 + surfaceDistance },
        velocity: { x: 0, y: 0, z: 8 },
      },
    };

    const nextSnapshot = stepSimulation(departingSnapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: false,
    boost: false,
    brake: false,
    fire: false,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false, }), 1 / 60);
    const dampedDepartureSpeed = 8 * Math.pow(flightTuning.linearDamping, 1);

    expect(nextSnapshot.ship.position.z).toBeGreaterThan(departingSnapshot.ship.position.z);
    expect(nextSnapshot.ship.velocity.z).toBeGreaterThan(0);
    expect(nextSnapshot.ship.velocity.z).toBeLessThan(dampedDepartureSpeed);
    expect(nextSnapshot.ship.velocity.z).toBeGreaterThan(dampedDepartureSpeed - 0.2);
    expect(nextSnapshot.ship.collisionCooldownSeconds).toBe(0);
  });

  it('adds a small gravity pull when the ship is close to a planet', () => {
    const snapshot = createSnapshotWithPlanet();
    const gravitySnapshot: GameSnapshot = {
      ...snapshot,
      ship: {
        ...snapshot.ship,
        position: { x: 0, y: 0, z: 190 },
        velocity: { x: 0, y: 0, z: 0 },
      },
    };

    const nextSnapshot = stepSimulation(gravitySnapshot, inputState({}), 1);

    expect(nextSnapshot.ship.velocity.z).toBeLessThan(0);
    expect(nextSnapshot.ship.position.z).toBeLessThan(gravitySnapshot.ship.position.z);
    expect(nextSnapshot.ship.position.z).toBeGreaterThan(
      snapshot.activeSectorDescriptor.planets[0].position.z + snapshot.activeSectorDescriptor.planets[0].radius,
    );
  });

  it('does not pull the ship when it is outside the local planet gravity envelope', () => {
    const snapshot = createSnapshotWithPlanet();
    const distantSnapshot: GameSnapshot = {
      ...snapshot,
      ship: {
        ...snapshot.ship,
        position: { x: 0, y: 0, z: 232 },
        velocity: { x: 0, y: 0, z: 0 },
      },
    };

    const nextSnapshot = stepSimulation(distantSnapshot, inputState({}), 1);

    expect(nextSnapshot.ship.velocity.z).toBeCloseTo(0, 6);
    expect(nextSnapshot.ship.position.z).toBeCloseTo(distantSnapshot.ship.position.z, 6);
  });

  it('still lets the ship thrust away from a nearby planet', () => {
    const snapshot = createSnapshotWithPlanet();
    const escapeSnapshot: GameSnapshot = {
      ...snapshot,
      ship: {
        ...snapshot.ship,
        position: { x: 0, y: 0, z: 190 },
        velocity: { x: 0, y: 0, z: 0 },
        yawRadians: 0,
      },
    };

    const nextSnapshot = stepSimulation(escapeSnapshot, inputState({ thrustForward: true }), 1);

    expect(nextSnapshot.ship.velocity.z).toBeGreaterThan(0);
    expect(nextSnapshot.ship.position.z).toBeGreaterThan(escapeSnapshot.ship.position.z);
  });

  it('leads gravity toward a planet movement vector instead of only its current center', () => {
    const gravityAcceleration = getPlanetGravityAcceleration(
      { x: 0, y: 0, z: 190 },
      [
        {
          ...createSnapshotWithPlanet().activeSectorDescriptor.planets[0],
          position: { x: 0, y: 0, z: 160 },
          velocity: { x: 12, y: 0, z: 0 },
        },
      ],
    );

    expect(gravityAcceleration.x).toBeGreaterThan(0.45);
    expect(gravityAcceleration.z).toBeLessThan(0);
  });

  it('aims ship-origin projectiles toward the camera-defined aim target', () => {
    const snapshot = createSnapshotWithPlanet();
    const aimedSnapshot: GameSnapshot = {
      ...snapshot,
      ship: {
        ...snapshot.ship,
        pitchRadians: 0,
        position: { x: 0, y: 0, z: 220 },
        velocity: { x: 0, y: 0, z: 0 },
        yawRadians: Math.PI,
      },
    };

    const nextSnapshot = stepSimulation(aimedSnapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: false,
    boost: false,
    brake: false,
    fire: true,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false, }), 1 / 60);

    expect(nextSnapshot.projectiles).toHaveLength(1);
    const projectile = nextSnapshot.projectiles[0];
    const aimDirectionMagnitude = Math.hypot(
      nextSnapshot.aimTarget.x - projectile.position.x,
      nextSnapshot.aimTarget.y - projectile.position.y,
      nextSnapshot.aimTarget.z - projectile.position.z,
    );
    const aimAlignment =
      (projectile.velocity.x / combatTuning.projectileSpeed) *
        ((nextSnapshot.aimTarget.x - projectile.position.x) / aimDirectionMagnitude) +
      (projectile.velocity.y / combatTuning.projectileSpeed) *
        ((nextSnapshot.aimTarget.y - projectile.position.y) / aimDirectionMagnitude) +
      (projectile.velocity.z / combatTuning.projectileSpeed) *
        ((nextSnapshot.aimTarget.z - projectile.position.z) / aimDirectionMagnitude);

    expect(aimAlignment).toBeGreaterThan(0.999);
    expect(nextSnapshot.projectiles[0].position.z).toBeLessThan(aimedSnapshot.ship.position.z);
  });

  it('inherits ship strafe velocity when firing without losing forward shot speed', () => {
    const snapshot = createSnapshotWithPlanet();
    const stationarySnapshot: GameSnapshot = {
      ...snapshot,
      ship: {
        ...snapshot.ship,
        pitchRadians: 0,
        position: { x: 0, y: 0, z: 220 },
        velocity: { x: 0, y: 0, z: 0 },
        yawRadians: Math.PI,
      },
    };
    const movingSnapshot: GameSnapshot = {
      ...snapshot,
      ship: {
        ...snapshot.ship,
        pitchRadians: 0,
        position: { x: 0, y: 0, z: 220 },
        velocity: { x: 25, y: 0, z: 0 },
        yawRadians: Math.PI,
      },
    };
    const stationaryProjectileSnapshot = stepSimulation(stationarySnapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: false,
    boost: false,
    brake: false,
    fire: true,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false, }), 1 / 60);

    const nextSnapshot = stepSimulation(movingSnapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: false,
    boost: false,
    brake: false,
    fire: true,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false, }), 1 / 60);

    const stationaryProjectile = stationaryProjectileSnapshot.projectiles[0];
    const movingProjectile = nextSnapshot.projectiles[0];

    expect(stationaryProjectileSnapshot.projectiles).toHaveLength(1);
    expect(nextSnapshot.projectiles).toHaveLength(1);
    expect(movingProjectile.velocity.x - stationaryProjectile.velocity.x).toBeGreaterThan(24.9);
    expect(movingProjectile.velocity.x - stationaryProjectile.velocity.x).toBeLessThan(25.1);
    expect(movingProjectile.velocity.z - stationaryProjectile.velocity.z).toBeGreaterThan(-0.2);
    expect(movingProjectile.velocity.z - stationaryProjectile.velocity.z).toBeLessThan(0.2);
    expect(movingProjectile.velocity.z).toBeLessThan(-combatTuning.projectileSpeed * 0.99);
    expect(Math.hypot(
      movingProjectile.velocity.x - stationaryProjectile.velocity.x,
      movingProjectile.velocity.y - stationaryProjectile.velocity.y,
      movingProjectile.velocity.z - stationaryProjectile.velocity.z,
    )).toBeGreaterThan(24.9);
  });

  it('keeps the cursor as intent while letting nearby blockers win from ship origin', () => {
    const snapshot = createSnapshotWithPlanet();
    const blockedSnapshot: GameSnapshot = {
      ...snapshot,
      activeSectorDescriptor: {
        ...snapshot.activeSectorDescriptor,
        planets: [
          {
            color: '#ffffff',
            id: 'planet-near-blocker',
            orbitAngularSpeed: 0,
            orbitDistance: 217.5,
            orbitEccentricity: 0,
            orbitPhaseRadians: Math.PI / 2,
            orbitTiltRadians: 0,
            position: { x: 0, y: 0, z: 217.5 },
            radius: 0.8,
            spinSpeed: 0.04,
            surface: testPlanetSurface,
            velocity: { x: 0, y: 0, z: 0 },
          },
        ],
      },
      ship: {
        ...snapshot.ship,
        pitchRadians: 0,
        position: { x: 0, y: 0, z: 220 },
        velocity: { x: 0, y: 0, z: 0 },
        yawRadians: Math.PI,
      },
    };

    const firedSnapshot = stepSimulation(blockedSnapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: false,
    boost: false,
    brake: false,
    fire: true,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false, }), 1 / 60);

    const resolvedSnapshot = stepSimulation(firedSnapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: false,
    boost: false,
    brake: false,
    fire: false,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false, }), 1 / 60);

    expect(resolvedSnapshot.impacts).toHaveLength(1);
    expect(resolvedSnapshot.projectiles).toHaveLength(0);
    expect(resolvedSnapshot.impacts[0].position.z).toBeGreaterThan(blockedSnapshot.aimTarget.z);
  });
  it('updates the shared aim target while aiming down sights', () => {
    const snapshot = createSnapshotWithPlanet();

    const nextSnapshot = stepSimulation(snapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: true,
    boost: false,
    brake: false,
    fire: false,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false, }), 1 / 60);

    expect(nextSnapshot.aimTarget.z).toBeLessThan(snapshot.ship.position.z);
  });

  it('charges and fires the secondary weapon while aiming down sights', () => {
    const snapshot = createInitialSnapshot('secondary-fire-test', { includeInitialEnemies: false });

    const chargedSnapshot = stepSimulation(snapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: true,
    boost: false,
    brake: false,
    fire: true,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false, }), 0.9);

    expect(chargedSnapshot.projectiles).toHaveLength(0);
    expect(chargedSnapshot.ship.secondaryChargeSeconds).toBeCloseTo(0.9, 4);

    const firedSnapshot = stepSimulation(chargedSnapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: true,
    boost: false,
    brake: false,
    fire: false,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false, }), 1 / 60);

    expect(firedSnapshot.projectiles).toHaveLength(1);
    expect(firedSnapshot.projectiles[0].kind).toBe('secondary');
    expect(firedSnapshot.ship.secondaryChargeSeconds).toBe(0);
    expect(firedSnapshot.ship.secondaryCooldownSeconds).toBe(combatTuning.secondaryCooldownSeconds);
    expect(firedSnapshot.ship.cameraShakeSeconds).toBe(combatTuning.secondaryCameraShakeSeconds);
    expect(firedSnapshot.ship.velocity.z).toBeGreaterThan(0);
  });

  it('fires a weak secondary shot on a quick ADS click', () => {
    const snapshot = createInitialSnapshot('secondary-quick-click-test', { includeInitialEnemies: false });

    const tappedSnapshot = stepSimulation(
      snapshot,
      inputState({
        aimDownSights: true,
        fire: true,
      }),
      0.06,
    );

    const firedSnapshot = stepSimulation(
      tappedSnapshot,
      inputState({
        aimDownSights: true,
        fire: false,
      }),
      1 / 60,
    );

    expect(firedSnapshot.projectiles).toHaveLength(1);
    expect(firedSnapshot.projectiles[0].kind).toBe('secondary');
  });

  it('cancels the secondary charge when leaving aim mode without firing a primary shot', () => {
    const snapshot = createInitialSnapshot('secondary-cancel-test', { includeInitialEnemies: false });

    const chargedSnapshot = stepSimulation(snapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: true,
    boost: false,
    brake: false,
    fire: true,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false, }), 0.4);

    const cancelledSnapshot = stepSimulation(chargedSnapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: false,
    boost: false,
    brake: false,
    fire: true,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: false, }), 1 / 60);

    expect(cancelledSnapshot.projectiles).toHaveLength(0);
    expect(cancelledSnapshot.ship.secondaryChargeSeconds).toBe(0);
    expect(cancelledSnapshot.ship.weaponCooldownSeconds).toBe(0);
  });

  it('completes a hyperspace jump to the selected neighboring system', () => {
    const snapshot = createInitialSnapshot('travel-test', { includeInitialEnemies: false });
    const targetSystem = { x: 1, y: 0, z: 0 };
    const armedSnapshot: GameSnapshot = {
      ...snapshot,
      travel: {
        mode: 'local',
        progress: 0,
        targetSystem,
      },
    };

    const jumpedSnapshot = stepSimulation(armedSnapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: false,
    boost: false,
    brake: false,
    fire: false,
    hyperCommit: true,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false, }), 1.2);

    expect(jumpedSnapshot.activeSystem).toEqual(targetSystem);
    expect(jumpedSnapshot.activeSector).toEqual(targetSystem);
    expect(jumpedSnapshot.travel.mode).toBe('local');
    expect(jumpedSnapshot.travel.targetSystem).toBeNull();
    expect(jumpedSnapshot.ship.position.z).toBe(220);
  });

  it('moves the ship upward when vertical thrust is applied', () => {
    const snapshot = createInitialSnapshot('vertical-thrust', { includeInitialEnemies: false });

    const nextSnapshot = stepSimulation(snapshot, inputState({ aim: { x: 0, y: 0 },
    aimDownSights: false,
    boost: false,
    brake: false,
    fire: false,
    hyperCommit: false,
    strafeLeft: false,
    strafeRight: false,
    thrustBackward: false,
    thrustForward: false,
    thrustDown: false,
    thrustUp: true, }), 1 / 60);

    expect(nextSnapshot.ship.position.y).toBeGreaterThan(snapshot.ship.position.y);
    expect(nextSnapshot.ship.velocity.y).toBeGreaterThan(0);
  });

  it('updates planet positions over time using orbital motion', () => {
    const snapshot = createInitialSnapshot('orbit-test', { includeInitialEnemies: false });

    const nextSnapshot = stepSimulation(snapshot, inputState({}), 1);

    const firstPlanet = snapshot.activeSectorDescriptor.planets[0];
    const movedPlanet = nextSnapshot.activeSectorDescriptor.planets[0];

    expect(movedPlanet.position.x).not.toBeCloseTo(firstPlanet.position.x, 5);
    expect(movedPlanet.position.z).not.toBeCloseTo(firstPlanet.position.z, 5);
  });

  it('applies projectile damage to enemies and emits combat feedback', () => {
    const snapshot = createInitialSnapshot('enemy-hit-test', { includeInitialEnemies: false });
    const enemy = createEnemy();
    const projectileSnapshot: GameSnapshot = {
      ...snapshot,
      activeSectorDescriptor: {
        ...snapshot.activeSectorDescriptor,
        planets: [],
      },
      enemies: [enemy],
      projectiles: [
        {
          color: combatTuning.projectileColor,
          damage: combatTuning.projectileDamage,
          id: 'projectile-enemy-hit',
          impactRadius: combatTuning.impactRadius,
          kind: 'primary',
          length: combatTuning.projectileLength,
          owner: 'player',
          position: { x: 0, y: 0, z: 171.4 },
          radius: combatTuning.projectileRadius,
          ttlSeconds: 1,
          velocity: { x: 0, y: 0, z: -10 },
        },
      ],
    };

    const nextSnapshot = stepSimulation(projectileSnapshot, inputState({}), 1 / 60);

    expect(nextSnapshot.enemies).toHaveLength(1);
    expect(nextSnapshot.enemies[0].resources.shield).toBeLessThan(enemy.resources.shield);
    expect(nextSnapshot.enemies[0].feedback.hitFlashSeconds).toBeGreaterThan(0);
    expect(nextSnapshot.combatEvents.some((event) => event.kind === 'hit')).toBe(true);
  });

  it('lets enemies telegraph and fire hostile projectiles at the player', () => {
    const snapshot = createInitialSnapshot('enemy-fire-test', { includeInitialEnemies: false });
    const telegraphingEnemy = createEnemy({
      ai: {
        phase: 'telegraph',
        phaseSecondsRemaining: 0.01,
        weaponCooldownSeconds: 0,
      },
      position: { x: 0, y: 0, z: 150 },
    });
    const telegraphSnapshot: GameSnapshot = {
      ...snapshot,
      activeSectorDescriptor: {
        ...snapshot.activeSectorDescriptor,
        planets: [],
      },
      enemies: [telegraphingEnemy],
    };

    const nextSnapshot = stepSimulation(telegraphSnapshot, inputState({}), 1 / 60);

    expect(nextSnapshot.projectiles.some((projectile) => projectile.owner === 'enemy')).toBe(true);
    expect(nextSnapshot.enemies[0].ai.weaponCooldownSeconds).toBeGreaterThan(0);
  });

  it('moves pursuing enemies laterally instead of parking in front of the player', () => {
    const snapshot = createInitialSnapshot('enemy-pressure-move-test', { includeInitialEnemies: false });
    const pursuingEnemy = createEnemy({
      position: { x: 0, y: 0, z: 110 },
      velocity: { x: 0, y: 0, z: 0 },
    });
    const enemySnapshot: GameSnapshot = {
      ...snapshot,
      activeSectorDescriptor: {
        ...snapshot.activeSectorDescriptor,
        planets: [],
      },
      enemies: [pursuingEnemy],
    };

    const nextSnapshot = stepSimulation(enemySnapshot, inputState({}), 1 / 10);

    expect(Math.abs(nextSnapshot.enemies[0].velocity.x)).toBeGreaterThan(0.1);
  });

  it('marks enemies dead and starts a death fade on lethal hits', () => {
    const snapshot = createInitialSnapshot('enemy-death-test', { includeInitialEnemies: false });
    const fragileEnemy = createEnemy({
      resources: {
        hull: 8,
        hullMax: 8,
        shield: 0,
        shieldMax: 0,
        shieldRegenDelaySeconds: 1.8,
        shieldRegenRate: 0,
        shieldRegenTimeoutSeconds: 0,
        stagger: 0,
        staggerMax: 40,
        staggerRecoveryPerSecond: 18,
      },
    });
    const projectileSnapshot: GameSnapshot = {
      ...snapshot,
      activeSectorDescriptor: {
        ...snapshot.activeSectorDescriptor,
        planets: [],
      },
      enemies: [fragileEnemy],
      projectiles: [
        {
          color: combatTuning.projectileColor,
          damage: combatTuning.projectileDamage,
          id: 'projectile-enemy-kill',
          impactRadius: combatTuning.impactRadius,
          kind: 'primary',
          length: combatTuning.projectileLength,
          owner: 'player',
          position: { x: 0, y: 0, z: 171.4 },
          radius: combatTuning.projectileRadius,
          ttlSeconds: 1,
          velocity: { x: 0, y: 0, z: -10 },
        },
      ],
    };

    const nextSnapshot = stepSimulation(projectileSnapshot, inputState({}), 1 / 60);

    expect(nextSnapshot.enemies[0].ai.phase).toBe('dead');
    expect(nextSnapshot.enemies[0].feedback.deathFadeSeconds).toBeGreaterThan(0);
    expect(nextSnapshot.combatEvents.some((event) => event.kind === 'death')).toBe(true);
  });

  it('applies solar hazard damage and shake when the ship gets too close to the sun', () => {
    const snapshot = createInitialSnapshot('solar-hazard-test', { includeInitialEnemies: false });
    const hazardSnapshot: GameSnapshot = {
      ...snapshot,
      ship: {
        ...snapshot.ship,
        position: { x: 0, y: 0, z: 70 },
        resources: {
          ...snapshot.ship.resources,
          shield: 60,
        },
      },
    };

    const nextSnapshot = stepSimulation(hazardSnapshot, inputState({}), 1 / 10);

    expect(nextSnapshot.ship.resources.shield).toBeLessThan(hazardSnapshot.ship.resources.shield);
    expect(nextSnapshot.ship.cameraShakeSeconds).toBeGreaterThan(0);
    expect(nextSnapshot.ship.position.z).toBeGreaterThan(hazardSnapshot.ship.position.z);
  });
});
