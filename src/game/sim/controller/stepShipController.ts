import { addVec3, scaleVec3 } from '@/game/sim/math';
import type { InputState, ShipState, Vec3 } from '@/game/sim/types';
import {
  actionChaseControllerProfile,
  type ControllerProfile,
} from '@/game/sim/controller/controllerProfile';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dotVec3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
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
  const forwardInput = Number(input.thrustForward);
  const reverseInput = Number(input.thrustBackward);
  const strafeInput = Number(input.strafeRight) - Number(input.strafeLeft);
  const strafePower = strafeInput * profile.strafeThrust;
  const yawRadians = ship.yawRadians + input.aim.x * profile.cursorYawRate * deltaSeconds;
  const pitchRadians = clamp(
    ship.pitchRadians + input.aim.y * profile.cursorPitchRate * deltaSeconds,
    -profile.maxPitchRadians,
    profile.maxPitchRadians,
  );
  const pitchBlend = Math.abs(pitchRadians) / profile.maxPitchRadians;
  const turnBankScale = 1 - pitchBlend * profile.bankPitchSuppression;
  const targetBankRadians = clamp(
    -input.aim.x * profile.maxBankRadians * turnBankScale,
    -profile.maxBankRadians,
    profile.maxBankRadians,
  );
  const bankSmoothing = 1 - Math.exp(-profile.bankResponse * deltaSeconds);
  const bankRadians = approach(ship.bankRadians, targetBankRadians, bankSmoothing);
  const forwardVector = getForwardVector(yawRadians, pitchRadians);
  const rightVector = getRightVector(yawRadians);
  const boostMultiplier = boostActive ? profile.boostMultiplier : 1;
  const forwardThrust = forwardInput * profile.thrustForward * boostMultiplier;
  const reverseThrust = reverseInput * profile.reverseThrust;
  const strafeThrust = strafePower * (boostActive ? profile.boostStrafeFactor : 1);
  let velocity = addVec3(
    applyLinearDamping(ship.velocity, deltaSeconds, profile.linearDamping),
    addVec3(
      scaleVec3(forwardVector, (forwardThrust - reverseThrust) * deltaSeconds),
      scaleVec3(rightVector, strafeThrust * deltaSeconds),
    ),
  );

  if (boostActive) {
    const forwardSpeed = dotVec3(velocity, forwardVector);
    const rightSpeed = dotVec3(velocity, rightVector);
    const forwardComponent = scaleVec3(forwardVector, forwardSpeed);
    const rightComponent = scaleVec3(rightVector, rightSpeed);
    const residualVelocity = {
      x: velocity.x - forwardComponent.x - rightComponent.x,
      y: velocity.y - forwardComponent.y - rightComponent.y,
      z: velocity.z - forwardComponent.z - rightComponent.z,
    };
    const reverseDamping = Math.exp(-profile.boostReverseDamping * deltaSeconds);
    const strafeDamping = Math.exp(-profile.boostStrafeDamping * deltaSeconds);
    const boostedForwardSpeed = forwardSpeed >= 0 ? forwardSpeed : forwardSpeed * reverseDamping;
    const boostedRightSpeed = rightSpeed * strafeDamping;

    velocity = addVec3(
      residualVelocity,
      addVec3(
        scaleVec3(forwardVector, boostedForwardSpeed),
        scaleVec3(rightVector, boostedRightSpeed),
      ),
    );
  }

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
