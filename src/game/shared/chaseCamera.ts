import { chaseCameraTuning } from '@/game/config/tuning';
import { normalizeVec3, subtractVec3 } from '@/game/sim/math';
import type { Vec3 } from '@/game/sim/types';

interface ForwardFacingState {
  pitchRadians: number;
  yawRadians: number;
}

export function getForwardVector(yawRadians: number, pitchRadians: number): Vec3 {
  const cosPitch = Math.cos(pitchRadians);

  return {
    x: Math.sin(yawRadians) * cosPitch,
    y: -Math.sin(pitchRadians),
    z: Math.cos(yawRadians) * cosPitch,
  };
}

export function getChaseCameraPose(ship: ForwardFacingState, speed: number): {
  forward: Vec3;
  lookTarget: Vec3;
  position: Vec3;
} {
  const shipForward = getForwardVector(ship.yawRadians, ship.pitchRadians);
  const distance =
    chaseCameraTuning.distanceBase +
    Math.min(speed * chaseCameraTuning.distanceSpeedScale, chaseCameraTuning.distanceSpeedMax);
  const position = {
    x: -shipForward.x * distance,
    y: chaseCameraTuning.height - shipForward.y * chaseCameraTuning.pitchLift,
    z: -shipForward.z * distance,
  };
  const lookTarget = {
    x: shipForward.x * chaseCameraTuning.lookAheadDistance,
    y: chaseCameraTuning.lookAheadHeight + shipForward.y * chaseCameraTuning.lookAheadDistance,
    z: shipForward.z * chaseCameraTuning.lookAheadDistance,
  };

  return {
    forward: normalizeVec3(subtractVec3(lookTarget, position)),
    lookTarget,
    position,
  };
}
