import { chaseCameraTuning } from '@/game/config/tuning';
import { normalizeVec3, subtractVec3 } from '@/game/sim/math';
import type { Vec3 } from '@/game/sim/types';

interface ForwardFacingState {
  pitchRadians: number;
  yawRadians: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function interpolate(start: number, end: number, mix: number): number {
  return start + (end - start) * mix;
}

function getRightVector(yawRadians: number): Vec3 {
  return {
    x: Math.cos(yawRadians),
    y: 0,
    z: -Math.sin(yawRadians),
  };
}

export function getForwardVector(yawRadians: number, pitchRadians: number): Vec3 {
  const cosPitch = Math.cos(pitchRadians);

  return {
    x: Math.sin(yawRadians) * cosPitch,
    y: -Math.sin(pitchRadians),
    z: Math.cos(yawRadians) * cosPitch,
  };
}

export function getChaseCameraPose(
  ship: ForwardFacingState,
  speed: number,
  adsBlend = 0,
): {
  forward: Vec3;
  lookTarget: Vec3;
  position: Vec3;
} {
  const shipForward = getForwardVector(ship.yawRadians, ship.pitchRadians);
  const shipRight = getRightVector(ship.yawRadians);
  const normalizedBlend = clamp(adsBlend, 0, 1);
  const hipDistance =
    chaseCameraTuning.distanceBase +
    Math.min(speed * chaseCameraTuning.distanceSpeedScale, chaseCameraTuning.distanceSpeedMax);
  const distance = interpolate(hipDistance, chaseCameraTuning.adsDistance, normalizedBlend);
  const height = interpolate(chaseCameraTuning.height, chaseCameraTuning.adsHeight, normalizedBlend);
  const pitchLift = interpolate(chaseCameraTuning.pitchLift, chaseCameraTuning.adsPitchLift, normalizedBlend);
  const shoulderOffset = interpolate(
    chaseCameraTuning.hipShoulderOffset,
    chaseCameraTuning.adsShoulderOffset,
    normalizedBlend,
  );
  const lookAheadDistance = interpolate(
    chaseCameraTuning.lookAheadDistance,
    chaseCameraTuning.adsLookAheadDistance,
    normalizedBlend,
  );
  const lookAheadHeight = interpolate(
    chaseCameraTuning.lookAheadHeight,
    chaseCameraTuning.adsLookAheadHeight,
    normalizedBlend,
  );
  const position = {
    x: -shipForward.x * distance - shipRight.x * shoulderOffset,
    y: height - shipForward.y * pitchLift,
    z: -shipForward.z * distance - shipRight.z * shoulderOffset,
  };
  const lookTarget = {
    x: shipForward.x * lookAheadDistance,
    y: lookAheadHeight + shipForward.y * lookAheadDistance,
    z: shipForward.z * lookAheadDistance,
  };

  return {
    forward: normalizeVec3(subtractVec3(lookTarget, position)),
    lookTarget,
    position,
  };
}
