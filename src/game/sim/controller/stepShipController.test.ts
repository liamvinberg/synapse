import { describe, expect, it } from 'vitest';
import { flightTuning } from '@/game/config/tuning';
import { createInitialSnapshot } from '@/game/sim/createInitialSnapshot';
import { stepShipController } from '@/game/sim/controller/stepShipController';

const neutralInput = {
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
};

describe('stepShipController', () => {
  it('clamps pitch to the readable action-flight range', () => {
    const ship = createInitialSnapshot('controller-test', { includeInitialEnemies: false }).ship;

    const nextShip = stepShipController(
      ship,
      {
        ...neutralInput,
        aim: { x: 0, y: -500 },
      },
      1,
    );

    expect(nextShip.pitchRadians).toBeGreaterThanOrEqual(-flightTuning.maxPitchRadians);
    expect(nextShip.pitchRadians).toBeLessThanOrEqual(flightTuning.maxPitchRadians);
    expect(Math.abs(nextShip.pitchRadians)).toBeCloseTo(flightTuning.maxPitchRadians, 5);
  });

  it('reduces banking when steering while pitched upward or downward', () => {
    const ship = createInitialSnapshot('controller-bank', { includeInitialEnemies: false }).ship;

    const flatTurn = stepShipController(
      ship,
      {
        ...neutralInput,
        aim: { x: 1, y: 0 },
      },
      1 / 60,
    );
    const diagonalTurn = stepShipController(
      ship,
      {
        ...neutralInput,
        aim: { x: 1, y: -25 },
      },
      1 / 60,
    );

    expect(Math.abs(diagonalTurn.bankRadians)).toBeLessThan(Math.abs(flatTurn.bankRadians));
  });

  it('keeps boost focused on forward thrust while damping lateral and reverse motion', () => {
    const ship = createInitialSnapshot('controller-boost', { includeInitialEnemies: false }).ship;

    const forwardBoost = stepShipController(
      ship,
      {
        ...neutralInput,
        boost: true,
        thrustForward: true,
      },
      1,
    );
    const strafeBoost = stepShipController(
      ship,
      {
        ...neutralInput,
        boost: true,
        strafeRight: true,
      },
      1,
    );
    const reverseBoost = stepShipController(
      {
        ...ship,
        velocity: { x: 0, y: 0, z: 0 },
      },
      {
        ...neutralInput,
        boost: true,
        thrustBackward: true,
      },
      1,
    );

    expect(Math.abs(forwardBoost.velocity.z)).toBeGreaterThan(Math.abs(strafeBoost.velocity.x));
    expect(Math.abs(strafeBoost.velocity.x)).toBeLessThan(flightTuning.strafeThrust);
    expect(Math.abs(reverseBoost.velocity.z)).toBeLessThan(flightTuning.reverseThrust);
  });

  it('supports vertical thrust with the same lighter boost treatment as other lateral axes', () => {
    const ship = createInitialSnapshot('controller-vertical', { includeInitialEnemies: false }).ship;

    const upward = stepShipController(
      ship,
      {
        ...neutralInput,
        thrustUp: true,
      },
      1,
    );
    const boostedUpward = stepShipController(
      ship,
      {
        ...neutralInput,
        boost: true,
        thrustUp: true,
      },
      1,
    );

    expect(upward.velocity.y).toBeGreaterThan(0);
    expect(boostedUpward.velocity.y).toBeGreaterThan(0);
    expect(boostedUpward.velocity.y).toBeLessThan(flightTuning.verticalThrust);
  });
});
