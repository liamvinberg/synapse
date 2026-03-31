import { addVec3, scaleVec3 } from '@/game/sim/math';
import type { InputState, ShipState, Vec3 } from '@/game/sim/types';
import {
  actionChaseControllerProfile,
  type ControllerProfile,
} from '@/game/sim/controller/controllerProfile';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getForwardVector(yawRadians: number, pitchRadians: number): Vec3 {
  const cosPitch = Math.cos(pitchRadians);
  return {
    x: Math.sin(yawRadians) * cosPitch,
    y: -Math.sin(pitchRadians),
    z: Math.cos(yawRadians) * cosPitch,
  };
}

function getRightVector(yawRadians: number): Vec3 {
  return {
    x: Math.cos(yawRadians),
    y: 0,
    z: -Math.sin(yawRadians),
  };
}

function applyLinearDamping(
  velocity: Vec3,
  deltaSeconds: number,
  linearDamping: number,
): Vec3 {
  const dampingFactor = Math.pow(linearDamping, deltaSeconds * 60);
  return scaleVec3(velocity, dampingFactor);
}

function approach(current: number, target: number, smoothing: number): number {
  return current + (target - current) * smoothing;
}

export function stepShipController(
  ship: ShipState,
  input: InputState,
  deltaSeconds: number,
  profile: ControllerProfile = actionChaseControllerProfile,
): ShipState {
  const boostActive = input.boost && ship.resources.boostEnergy > 0;
  const thrustPower =
    Number(input.thrustForward) * profile.thrustForward -
    Number(input.thrustBackward) * profile.reverseThrust;
  const strafePower =
    Number(input.strafeRight) * profile.strafeThrust -
    Number(input.strafeLeft) * profile.strafeThrust;
  const yawRadians = ship.yawRadians + input.aim.x * profile.cursorYawRate * deltaSeconds;
  const pitchRadians = clamp(
    ship.pitchRadians + input.aim.y * profile.cursorPitchRate * deltaSeconds,
    -profile.maxPitchRadians,
    profile.maxPitchRadians,
  );
  const targetBankRadians = clamp(
    -input.aim.x * profile.maxBankRadians - (strafePower / profile.strafeThrust) * 0.12,
    -profile.maxBankRadians,
    profile.maxBankRadians,
  );
  const bankSmoothing = 1 - Math.exp(-profile.bankResponse * deltaSeconds);
  const bankRadians = approach(ship.bankRadians, targetBankRadians, bankSmoothing);
  const forwardVector = getForwardVector(yawRadians, pitchRadians);
  const rightVector = getRightVector(yawRadians);
  const boostMultiplier = boostActive ? profile.boostMultiplier : 1;
  let velocity = addVec3(
    applyLinearDamping(ship.velocity, deltaSeconds, profile.linearDamping),
    addVec3(
      scaleVec3(forwardVector, thrustPower * boostMultiplier * deltaSeconds),
      scaleVec3(rightVector, strafePower * deltaSeconds),
    ),
  );

  if (input.brake) {
    velocity = scaleVec3(velocity, profile.brakeFactor);
  }

  return {
    ...ship,
    bankRadians,
    pitchRadians,
    position: addVec3(ship.position, scaleVec3(velocity, deltaSeconds)),
    yawRadians,
    velocity,
  };
}
