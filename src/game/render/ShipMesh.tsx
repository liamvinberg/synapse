import type { ReactElement } from 'react';
import { combatTuning, motionFeedbackTuning } from '@/game/config/tuning';
import type { Vec3 } from '@/game/sim/types';
import { useGameStore } from '@/game/state/gameStore';
import { useInterpolatedShipState } from '@/game/render/useInterpolatedShipState';

function dotVec3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function shortestAngleDelta(previous: number, current: number): number {
  const fullTurn = Math.PI * 2;
  return ((current - previous + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
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

function getUpVector(forwardVector: Vec3, rightVector: Vec3): Vec3 {
  return {
    x: forwardVector.y * rightVector.z - forwardVector.z * rightVector.y,
    y: forwardVector.z * rightVector.x - forwardVector.x * rightVector.z,
    z: forwardVector.x * rightVector.y - forwardVector.y * rightVector.x,
  };
}

interface ThrusterPlumeProps {
  color: string;
  length: number;
  opacity: number;
  position: [number, number, number];
  radius: number;
  rotation: [number, number, number];
}

function ThrusterPlume({ color, length, opacity, position, radius, rotation }: ThrusterPlumeProps): ReactElement {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, -0.02, 0]}>
        <sphereGeometry args={[radius * 0.55, 10, 10]} />
        <meshBasicMaterial color="#d7ecff" transparent opacity={Math.min(0.95, opacity + 0.18)} />
      </mesh>
      <mesh position={[0, length / 2, 0]}>
        <coneGeometry args={[radius, length, 14, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

export function ShipMesh(): ReactElement {
  const aimDownSights = useGameStore((state) => state.input.aimDownSights);
  const boostActive = useGameStore((state) => state.input.boost && state.snapshot.ship.resources.boostEnergy > 0);
  const previousPitchRadians = useGameStore((state) => state.previousSnapshot.ship.pitchRadians);
  const previousYawRadians = useGameStore((state) => state.previousSnapshot.ship.yawRadians);
  const currentPitchRadians = useGameStore((state) => state.snapshot.ship.pitchRadians);
  const currentYawRadians = useGameStore((state) => state.snapshot.ship.yawRadians);
  const previousShipVelocity = useGameStore((state) => state.previousSnapshot.ship.velocity);
  const secondaryChargeSeconds = useGameStore((state) => state.snapshot.ship.secondaryChargeSeconds);
  const shipVelocity = useGameStore((state) => state.snapshot.ship.velocity);
  const shipState = useInterpolatedShipState();
  const forwardVector = getForwardVector(shipState.yawRadians, shipState.pitchRadians);
  const rightVector = getRightVector(shipState.yawRadians);
  const upVector = getUpVector(forwardVector, rightVector);
  const frameAcceleration = {
    x: shipVelocity.x - previousShipVelocity.x,
    y: shipVelocity.y - previousShipVelocity.y,
    z: shipVelocity.z - previousShipVelocity.z,
  };
  const localForwardAcceleration = dotVec3(frameAcceleration, forwardVector);
  const localRightAcceleration = dotVec3(frameAcceleration, rightVector);
  const localUpAcceleration = dotVec3(frameAcceleration, upVector);
  const yawVelocityIntent = Math.tanh(shortestAngleDelta(previousYawRadians, currentYawRadians) * 18);
  const pitchVelocityIntent = Math.tanh((currentPitchRadians - previousPitchRadians) * 24);
  const forwardEngineForce = clamp01(Math.max(0, localForwardAcceleration * 0.12));
  const rightTranslationThrusterPower = clamp01(Math.max(0, -localRightAcceleration * 0.12));
  const leftTranslationThrusterPower = clamp01(Math.max(0, localRightAcceleration * 0.12));
  const rightSteeringThrusterPower = clamp01(yawVelocityIntent);
  const leftSteeringThrusterPower = clamp01(-yawVelocityIntent);
  const upperPitchSteeringThrusterPower = clamp01(pitchVelocityIntent);
  const lowerPitchSteeringThrusterPower = clamp01(-pitchVelocityIntent);
  const upperTranslationThrusterPower = clamp01(Math.max(0, -localUpAcceleration * 0.16));
  const lowerTranslationThrusterPower = clamp01(Math.max(0, localUpAcceleration * 0.16));
  const reverseThrusterPower = clamp01(Math.max(0, -localForwardAcceleration * 0.18));
  const engineLength =
    motionFeedbackTuning.engineLengthBase +
    forwardEngineForce * 1.2 +
    (boostActive ? motionFeedbackTuning.engineLengthBoost : 0);
  const engineGlow = Math.min(
    1.6,
    motionFeedbackTuning.engineGlowBase +
      forwardEngineForce * 0.95 +
      (boostActive ? motionFeedbackTuning.engineGlowBoost : 0),
  );
  const reverseThrustersActive = reverseThrusterPower > 0.06;
  const engineExhaustAnchorZ = -0.95;
  const engineExhaustPositionZ = engineExhaustAnchorZ - engineLength / 2;
  const lanceModeGlow = aimDownSights ? 1 : 0;
  const lanceChargeRatio = Math.min(
    secondaryChargeSeconds / combatTuning.secondaryChargeFullSeconds,
    1,
  );
  const noseCoreRadius = 0.12 + lanceModeGlow * 0.035 + lanceChargeRatio * 0.035;
  const noseHaloRadius = 0.18 + lanceModeGlow * 0.05 + lanceChargeRatio * 0.08;
  const translationThrusterOpacity = (power: number) =>
    Math.min(0.88, motionFeedbackTuning.sideThrusterGlowBase + power * motionFeedbackTuning.sideThrusterGlowScale);
  const steeringThrusterOpacity = (power: number) => Math.min(0.78, 0.18 + power * 0.42);

  return (
    <group rotation={[0, shipState.yawRadians, 0]}>
      <group rotation={[shipState.pitchRadians, 0, shipState.bankRadians]}>
        {leftTranslationThrusterPower > 0.08 ? (
          <ThrusterPlume
            color="#8fcfff"
            length={motionFeedbackTuning.sideThrusterLength + leftTranslationThrusterPower * 0.16}
            opacity={translationThrusterOpacity(leftTranslationThrusterPower)}
            position={[-0.22, 0.02, -0.08]}
            radius={motionFeedbackTuning.sideThrusterRadius + leftTranslationThrusterPower * 0.025}
            rotation={[0, 0, Math.PI / 2]}
          />
        ) : null}
        {rightTranslationThrusterPower > 0.08 ? (
          <ThrusterPlume
            color="#8fcfff"
            length={motionFeedbackTuning.sideThrusterLength + rightTranslationThrusterPower * 0.16}
            opacity={translationThrusterOpacity(rightTranslationThrusterPower)}
            position={[0.22, 0.02, -0.08]}
            radius={motionFeedbackTuning.sideThrusterRadius + rightTranslationThrusterPower * 0.025}
            rotation={[0, 0, -Math.PI / 2]}
          />
        ) : null}
        {leftSteeringThrusterPower > 0.08 ? (
          <ThrusterPlume
            color="#c2e6ff"
            length={0.26 + leftSteeringThrusterPower * 0.12}
            opacity={steeringThrusterOpacity(leftSteeringThrusterPower)}
            position={[0.18, 0.02, 0.44]}
            radius={0.05 + leftSteeringThrusterPower * 0.018}
            rotation={[0, 0, Math.PI / 2]}
          />
        ) : null}
        {rightSteeringThrusterPower > 0.08 ? (
          <ThrusterPlume
            color="#c2e6ff"
            length={0.26 + rightSteeringThrusterPower * 0.12}
            opacity={steeringThrusterOpacity(rightSteeringThrusterPower)}
            position={[-0.18, 0.02, 0.44]}
            radius={0.05 + rightSteeringThrusterPower * 0.018}
            rotation={[0, 0, -Math.PI / 2]}
          />
        ) : null}
        {upperPitchSteeringThrusterPower > 0.08 ? (
          <>
            <ThrusterPlume
              color="#c2e6ff"
              length={0.24 + upperPitchSteeringThrusterPower * 0.12}
              opacity={steeringThrusterOpacity(upperPitchSteeringThrusterPower)}
              position={[-0.12, 0.14, 0.46]}
              radius={0.045 + upperPitchSteeringThrusterPower * 0.016}
              rotation={[0, 0, 0]}
            />
            <ThrusterPlume
              color="#c2e6ff"
              length={0.24 + upperPitchSteeringThrusterPower * 0.12}
              opacity={steeringThrusterOpacity(upperPitchSteeringThrusterPower)}
              position={[0.12, 0.14, 0.46]}
              radius={0.045 + upperPitchSteeringThrusterPower * 0.016}
              rotation={[0, 0, 0]}
            />
          </>
        ) : null}
        {lowerPitchSteeringThrusterPower > 0.08 ? (
          <>
            <ThrusterPlume
              color="#c2e6ff"
              length={0.24 + lowerPitchSteeringThrusterPower * 0.12}
              opacity={steeringThrusterOpacity(lowerPitchSteeringThrusterPower)}
              position={[-0.12, -0.14, 0.46]}
              radius={0.045 + lowerPitchSteeringThrusterPower * 0.016}
              rotation={[0, 0, Math.PI]}
            />
            <ThrusterPlume
              color="#c2e6ff"
              length={0.24 + lowerPitchSteeringThrusterPower * 0.12}
              opacity={steeringThrusterOpacity(lowerPitchSteeringThrusterPower)}
              position={[0.12, -0.14, 0.46]}
              radius={0.045 + lowerPitchSteeringThrusterPower * 0.016}
              rotation={[0, 0, Math.PI]}
            />
          </>
        ) : null}
        {upperTranslationThrusterPower > 0.08 ? (
          <>
            <ThrusterPlume
              color="#8fcfff"
              length={motionFeedbackTuning.sideThrusterLength + upperTranslationThrusterPower * 0.14}
              opacity={translationThrusterOpacity(upperTranslationThrusterPower)}
              position={[-0.16, 0.18, -0.04]}
              radius={motionFeedbackTuning.sideThrusterRadius + upperTranslationThrusterPower * 0.022}
              rotation={[0, 0, 0]}
            />
            <ThrusterPlume
              color="#8fcfff"
              length={motionFeedbackTuning.sideThrusterLength + upperTranslationThrusterPower * 0.14}
              opacity={translationThrusterOpacity(upperTranslationThrusterPower)}
              position={[0.16, 0.18, -0.04]}
              radius={motionFeedbackTuning.sideThrusterRadius + upperTranslationThrusterPower * 0.022}
              rotation={[0, 0, 0]}
            />
          </>
        ) : null}
        {lowerTranslationThrusterPower > 0.08 ? (
          <>
            <ThrusterPlume
              color="#8fcfff"
              length={motionFeedbackTuning.sideThrusterLength + lowerTranslationThrusterPower * 0.14}
              opacity={translationThrusterOpacity(lowerTranslationThrusterPower)}
              position={[-0.16, -0.18, -0.04]}
              radius={motionFeedbackTuning.sideThrusterRadius + lowerTranslationThrusterPower * 0.022}
              rotation={[0, 0, Math.PI]}
            />
            <ThrusterPlume
              color="#8fcfff"
              length={motionFeedbackTuning.sideThrusterLength + lowerTranslationThrusterPower * 0.14}
              opacity={translationThrusterOpacity(lowerTranslationThrusterPower)}
              position={[0.16, -0.18, -0.04]}
              radius={motionFeedbackTuning.sideThrusterRadius + lowerTranslationThrusterPower * 0.022}
              rotation={[0, 0, Math.PI]}
            />
          </>
        ) : null}
        {reverseThrustersActive ? (
          <>
            <ThrusterPlume
              color="#8fc8ff"
              length={motionFeedbackTuning.reverseThrusterLength + reverseThrusterPower * 0.12}
              opacity={Math.min(0.85, motionFeedbackTuning.reverseThrusterGlowBase + reverseThrusterPower * motionFeedbackTuning.reverseThrusterGlowScale)}
              position={[-0.16, 0.02, 0.74]}
              radius={motionFeedbackTuning.reverseThrusterRadius + reverseThrusterPower * 0.025}
              rotation={[Math.PI / 2, 0, 0]}
            />
            <ThrusterPlume
              color="#8fc8ff"
              length={motionFeedbackTuning.reverseThrusterLength + reverseThrusterPower * 0.12}
              opacity={Math.min(0.85, motionFeedbackTuning.reverseThrusterGlowBase + reverseThrusterPower * motionFeedbackTuning.reverseThrusterGlowScale)}
              position={[0.16, 0.02, 0.74]}
              radius={motionFeedbackTuning.reverseThrusterRadius + reverseThrusterPower * 0.025}
              rotation={[Math.PI / 2, 0, 0]}
            />
          </>
        ) : null}
        <mesh position={[0, 0, engineExhaustPositionZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18 + engineGlow * 0.03, engineLength, 18, 1, true]} />
          <meshBasicMaterial
            color="#73a3ff"
            transparent
            opacity={Math.min(0.9, 0.3 + engineGlow * 0.22)}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.42, 1.6, 12]} />
          <meshStandardMaterial color="#e4ebff" emissive="#5074ff" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.72]}>
          <sphereGeometry args={[noseCoreRadius, 12, 12]} />
          <meshBasicMaterial
            color={aimDownSights ? '#cae4ff' : '#6ad7ff'}
            transparent
            opacity={0.86 + lanceChargeRatio * 0.14}
          />
        </mesh>
        {aimDownSights ? (
          <mesh position={[0, 0, 0.72]}>
            <sphereGeometry args={[noseHaloRadius, 14, 14]} />
            <meshBasicMaterial
              color="#7fb7ff"
              transparent
              opacity={0.08 + lanceChargeRatio * 0.2}
            />
          </mesh>
        ) : null}
        {secondaryChargeSeconds > 0 ? (
          <mesh position={[0, 0, 0.94]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.024, 0.34 + lanceChargeRatio * 0.22, 10]} />
            <meshBasicMaterial
              color="#e1f2ff"
              transparent
              opacity={0.34 + lanceChargeRatio * 0.42}
            />
          </mesh>
        ) : null}
        <mesh position={[0, 0, -0.88]}>
          <sphereGeometry args={[0.12 + engineGlow * 0.03, 14, 14]} />
          <meshBasicMaterial color="#b6d8ff" transparent opacity={Math.min(1, 0.4 + engineGlow * 0.2)} />
        </mesh>
      </group>
    </group>
  );
}
