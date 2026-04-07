import { describe, expect, it } from 'vitest';
import { combatTuning } from '@/game/config/tuning';
import { createInitialSnapshot } from '@/game/sim/createInitialSnapshot';
import { stepSimulation } from '@/game/sim/stepSimulation';
import type { GameSnapshot } from '@/game/sim/types';

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
          boost: false,
          brake: false,
          fire: true,
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
        boost: false,
        brake: false,
        fire: false,
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
        boost: false,
        brake: false,
        fire: false,
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

  it('aims projectiles toward the camera reticle target instead of drifting above it', () => {
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
        boost: false,
        brake: false,
        fire: true,
        strafeLeft: false,
        strafeRight: false,
        thrustBackward: false,
        thrustForward: false,
      },
      1 / 60,
    );

    expect(nextSnapshot.projectiles).toHaveLength(1);
    expect(nextSnapshot.projectiles[0].velocity.y).toBeLessThan(0);
  });
});
