import { combatTuning, gravityTuning, worldScaleTuning } from '@/game/config/tuning';
import { addVec3, lengthVec3, normalizeVec3, scaleVec3 } from '@/game/sim/math';
import type { PlanetDescriptor, Vec3 } from '@/game/sim/types';

export const STAR_POSITION: Vec3 = { x: 0, y: 0, z: 0 };

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

const ORBITAL_VELOCITY_SAMPLE_SECONDS = 1 / 60;

export function getPlanetOrbitalPosition(planet: PlanetDescriptor, elapsedSeconds: number): Vec3 {
  const angle = planet.orbitPhaseRadians + elapsedSeconds * planet.orbitAngularSpeed;
  const eccentricity = planet.orbitEccentricity;
  const radius =
    planet.orbitDistance * ((1 - eccentricity * eccentricity) / Math.max(0.45, 1 + eccentricity * Math.cos(angle)));
  const x = Math.cos(angle) * radius;
  const orbitPlaneZ = Math.sin(angle) * radius;

  return {
    x,
    y: orbitPlaneZ * Math.sin(planet.orbitTiltRadians),
    z: orbitPlaneZ * Math.cos(planet.orbitTiltRadians),
  };
}

export function getPlanetOrbitalVelocity(planet: PlanetDescriptor, elapsedSeconds: number): Vec3 {
  const currentPosition = getPlanetOrbitalPosition(planet, elapsedSeconds);
  const nextPosition = getPlanetOrbitalPosition(
    planet,
    elapsedSeconds + ORBITAL_VELOCITY_SAMPLE_SECONDS,
  );

  return scaleVec3(
    {
      x: nextPosition.x - currentPosition.x,
      y: nextPosition.y - currentPosition.y,
      z: nextPosition.z - currentPosition.z,
    },
    1 / ORBITAL_VELOCITY_SAMPLE_SECONDS,
  );
}

export function getSolarExposure(position: Vec3): number {
  const distance = lengthVec3(position);

  if (distance >= combatTuning.solarHazardRadius) {
    return 0;
  }

  if (distance <= worldScaleTuning.starRadius) {
    return 1;
  }

  return clamp01(
    (combatTuning.solarHazardRadius - distance) /
      (combatTuning.solarHazardRadius - worldScaleTuning.starRadius),
  );
}

export function getSolarDirection(position: Vec3): Vec3 {
  return normalizeVec3(scaleVec3(position, -1));
}

export function getPlanetGravityAcceleration(position: Vec3, planets: PlanetDescriptor[]): Vec3 {
  let acceleration = { x: 0, y: 0, z: 0 };
  const radiusSpan = Math.max(1, worldScaleTuning.planetRadiusMax - worldScaleTuning.planetRadiusMin);

  for (const planet of planets) {
    const predictedPlanetPosition = addVec3(
      planet.position,
      scaleVec3(planet.velocity, gravityTuning.leadSeconds),
    );
    const offset = {
      x: predictedPlanetPosition.x - position.x,
      y: predictedPlanetPosition.y - position.y,
      z: predictedPlanetPosition.z - position.z,
    };
    const distance = lengthVec3(offset);
    const gravityRadius =
      planet.radius + gravityTuning.baseRangePadding + planet.radius * gravityTuning.radiusRangeFactor;

    if (distance >= gravityRadius) {
      continue;
    }

    const surfaceDistance = Math.max(0, distance - planet.radius);
    const pullRange = Math.max(0.0001, gravityRadius - planet.radius);
    const proximity = 1 - clamp01(surfaceDistance / pullRange);
    const radiusFactor = clamp01((planet.radius - worldScaleTuning.planetRadiusMin) / radiusSpan);
    const surfaceAcceleration = lerp(
      gravityTuning.minAcceleration,
      gravityTuning.maxAcceleration,
      radiusFactor,
    );
    const safeDistance = Math.max(distance, planet.radius + gravityTuning.surfaceBuffer);
    const distanceScale = (planet.radius + gravityTuning.surfaceBuffer) / safeDistance;
    const pullAcceleration =
      surfaceAcceleration * Math.pow(proximity, gravityTuning.falloffExponent) * distanceScale;

    acceleration = addVec3(
      acceleration,
      scaleVec3(normalizeVec3(offset), pullAcceleration),
    );
  }

  return acceleration;
}

export function applySolarPush(position: Vec3, deltaSeconds: number): Vec3 {
  const exposure = getSolarExposure(position);

  if (exposure <= 0) {
    return position;
  }

  const safeDistance = Math.max(lengthVec3(position), worldScaleTuning.starRadius + combatTuning.shipCollisionRadius);
  const normal = lengthVec3(position) === 0 ? { x: 0, y: 0, z: 1 } : normalizeVec3(position);
  const pushDistance = combatTuning.solarPushPerSecond * exposure * deltaSeconds;

  return addVec3(scaleVec3(normal, safeDistance), scaleVec3(normal, pushDistance));
}
