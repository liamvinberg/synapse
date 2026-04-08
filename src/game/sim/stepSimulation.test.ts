import { describe, expect, it } from 'vitest';
import { combatTuning, flightTuning } from '@/game/config/tuning';
import { getForwardVector } from '@/game/shared/chaseCamera';
import { createInitialSnapshot } from '@/game/sim/createInitialSnapshot';
import { stepSimulation } from '@/game/sim/stepSimulation';
import type { GameSnapshot } from '@/game/sim/types';

const testPlanetSurface = {
  banding: 0.15,
  biome: 'rocky' as const,
  detailColor: '#d1c6b1',
  emissiveColor: null,
  polarCapAmount: 0,
  primaryColor: '#7d8d9f',
  roughness: 0.92,
  secondaryColor: '#495566',
  seed: 1234,
  textureScale: 2.5,
};

function createSnapshotWithPlanet(): GameSnapshot {
  const snapshot = createInitialSnapshot('combat-test');

  return {
    ...snapshot,
    activeSectorDescriptor: {
      ...snapshot.activeSectorDescriptor,
      planets: [
        {
          color: '#ffffff',
          id: 'planet-test',
          position: { x: 0, y: 0, z: 160 },
          radius: 18,
          surface: testPlanetSurface,
        },
      ],
    },
  };
}

describe('stepSimulation combat and collision', () => {
  it('spawns a projectile when fire is pressed and weapon cooldown is ready', () => {
    const snapshot = createInitialSnapshot('fire-test');

    const nextSnapshot = stepSimulation(
      snapshot,
      {
        ...{
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
        },
      },
      1 / 60,
    );

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

  it('removes projectiles that hit planets', () => {
    const snapshot = createSnapshotWithPlanet();
    const projectileSnapshot: GameSnapshot = {
      ...snapshot,
      projectiles: [
        {
          damage: combatTuning.projectileDamage,
          id: 'projectile-hit',
          position: { x: 0, y: 0, z: 160 },
          radius: combatTuning.projectileRadius,
          ttlSeconds: 1,
          velocity: { x: 0, y: 0, z: 0 },
        },
      ],
    };

    const nextSnapshot = stepSimulation(
      projectileSnapshot,
      {
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
      },
      1 / 60,
    );

    expect(nextSnapshot.projectiles).toHaveLength(0);
    expect(nextSnapshot.impacts).toHaveLength(1);
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

    const nextSnapshot = stepSimulation(
      collisionSnapshot,
      {
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
      },
      1 / 60,
    );

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

    const nextSnapshot = stepSimulation(
      departingSnapshot,
      {
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
      },
      1 / 60,
    );

    expect(nextSnapshot.ship.position.z).toBeGreaterThan(departingSnapshot.ship.position.z);
    expect(nextSnapshot.ship.velocity.z).toBeCloseTo(8 * Math.pow(flightTuning.linearDamping, 1), 4);
    expect(nextSnapshot.ship.collisionCooldownSeconds).toBe(0);
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

    const nextSnapshot = stepSimulation(
      aimedSnapshot,
      {
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
      },
      1 / 60,
    );

    expect(nextSnapshot.projectiles).toHaveLength(1);
    const projectile = nextSnapshot.projectiles[0];
    const aimDirectionMagnitude = Math.hypot(
      nextSnapshot.aimTarget.x - projectile.position.x,
      nextSnapshot.aimTarget.y - projectile.position.y,
      nextSnapshot.aimTarget.z - projectile.position.z,
    );
    expect(projectile.velocity.x / combatTuning.projectileSpeed).toBeCloseTo(
      (nextSnapshot.aimTarget.x - projectile.position.x) / aimDirectionMagnitude,
      5,
    );
    expect(projectile.velocity.y / combatTuning.projectileSpeed).toBeCloseTo(
      (nextSnapshot.aimTarget.y - projectile.position.y) / aimDirectionMagnitude,
      5,
    );
    expect(projectile.velocity.z / combatTuning.projectileSpeed).toBeCloseTo(
      (nextSnapshot.aimTarget.z - projectile.position.z) / aimDirectionMagnitude,
      5,
    );
    expect(nextSnapshot.projectiles[0].position.z).toBeLessThan(aimedSnapshot.ship.position.z);
  });

  it('does not bend projectile travel with inherited ship strafe velocity', () => {
    const snapshot = createSnapshotWithPlanet();
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

    const nextSnapshot = stepSimulation(
      movingSnapshot,
      {
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
      },
      1 / 60,
    );

    expect(nextSnapshot.projectiles).toHaveLength(1);
    expect(Math.hypot(
      nextSnapshot.projectiles[0].velocity.x,
      nextSnapshot.projectiles[0].velocity.y,
      nextSnapshot.projectiles[0].velocity.z,
    )).toBeCloseTo(combatTuning.projectileSpeed, 4);
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
            position: { x: 0, y: 0, z: 217.5 },
            radius: 0.8,
            surface: testPlanetSurface,
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

    const firedSnapshot = stepSimulation(
      blockedSnapshot,
      {
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
      },
      1 / 60,
    );

    const resolvedSnapshot = stepSimulation(
      firedSnapshot,
      {
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
      },
      1 / 60,
    );

    expect(resolvedSnapshot.impacts).toHaveLength(1);
    expect(resolvedSnapshot.projectiles).toHaveLength(0);
    expect(resolvedSnapshot.impacts[0].position.z).toBeGreaterThan(blockedSnapshot.aimTarget.z);
  });
  it('updates the shared aim target while aiming down sights', () => {
    const snapshot = createSnapshotWithPlanet();

    const nextSnapshot = stepSimulation(
      snapshot,
      {
        aim: { x: 0, y: 0 },
        aimDownSights: true,
        boost: false,
        brake: false,
        fire: false,
        hyperCommit: false,
        strafeLeft: false,
        strafeRight: false,
        thrustBackward: false,
        thrustForward: false,
      },
      1 / 60,
    );

    expect(nextSnapshot.aimTarget.z).toBeLessThan(snapshot.ship.position.z);
  });

  it('completes a hyperspace jump to the selected neighboring system', () => {
    const snapshot = createInitialSnapshot('travel-test');
    const targetSystem = { x: 1, y: 0, z: 0 };
    const armedSnapshot: GameSnapshot = {
      ...snapshot,
      travel: {
        mode: 'local',
        progress: 0,
        targetSystem,
      },
    };

    const jumpedSnapshot = stepSimulation(
      armedSnapshot,
      {
        aim: { x: 0, y: 0 },
        aimDownSights: false,
        boost: false,
        brake: false,
        fire: false,
        hyperCommit: true,
        strafeLeft: false,
        strafeRight: false,
        thrustBackward: false,
        thrustForward: false,
      },
      1.2,
    );

    expect(jumpedSnapshot.activeSystem).toEqual(targetSystem);
    expect(jumpedSnapshot.activeSector).toEqual(targetSystem);
    expect(jumpedSnapshot.travel.mode).toBe('local');
    expect(jumpedSnapshot.travel.targetSystem).toBeNull();
    expect(jumpedSnapshot.ship.position.z).toBe(220);
  });
});
