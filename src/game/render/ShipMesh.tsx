import type { ReactElement } from 'react';
import { motionFeedbackTuning } from '@/game/config/tuning';
import type { Vec3 } from '@/game/sim/types';
import { useGameStore } from '@/game/state/gameStore';
import { useInterpolatedShipState } from '@/game/render/useInterpolatedShipState';

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

export function ShipMesh(): ReactElement {
  const boostActive = useGameStore((state) => state.input.boost && state.snapshot.ship.resources.boostEnergy > 0);
  const strafeLeft = useGameStore((state) => state.input.strafeLeft);
  const strafeRight = useGameStore((state) => state.input.strafeRight);
  const thrustBackward = useGameStore((state) => state.input.thrustBackward);
  const shipVelocity = useGameStore((state) => state.snapshot.ship.velocity);
  const shipState = useInterpolatedShipState();
  const forwardVector = getForwardVector(shipState.yawRadians, shipState.pitchRadians);
  const rightVector = getRightVector(shipState.yawRadians);
  const forwardSpeed = dotVec3(shipVelocity, forwardVector);
  const lateralSpeed = dotVec3(shipVelocity, rightVector);
  const forwardEngineSpeed = Math.max(0, forwardSpeed);
  const sideThrusterPower = Math.min(
    1,
    Math.abs(lateralSpeed) * 0.08 +
      (strafeLeft || strafeRight ? 0.45 : 0),
  );
  const reverseThrusterPower = Math.min(
    1,
    Math.max(0, -forwardSpeed) * 0.06 + (thrustBackward ? 0.35 : 0),
  );
  const engineLength =
    motionFeedbackTuning.engineLengthBase +
    forwardEngineSpeed * motionFeedbackTuning.engineLengthSpeedScale +
    (boostActive ? motionFeedbackTuning.engineLengthBoost : 0);
  const engineGlow = Math.min(
    1.6,
    motionFeedbackTuning.engineGlowBase +
      forwardEngineSpeed * motionFeedbackTuning.engineGlowSpeedScale +
      (boostActive ? motionFeedbackTuning.engineGlowBoost : 0),
  );
  const leftThrusterActive = strafeRight || lateralSpeed > 0.75;
  const rightThrusterActive = strafeLeft || lateralSpeed < -0.75;
  const reverseThrustersActive = thrustBackward || forwardSpeed < -0.75;
  const engineExhaustAnchorZ = -0.95;
  const engineExhaustPositionZ = engineExhaustAnchorZ - engineLength / 2;

  return (
    <group rotation={[0, shipState.yawRadians, 0]}>
      <group rotation={[shipState.pitchRadians, 0, shipState.bankRadians]}>
        {leftThrusterActive ? (
          <mesh position={[-0.42 - motionFeedbackTuning.sideThrusterLength / 2, 0.02, -0.08]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry
              args={[
                motionFeedbackTuning.sideThrusterRadius + sideThrusterPower * 0.035,
                motionFeedbackTuning.sideThrusterLength + sideThrusterPower * 0.18,
                12,
                1,
                true,
              ]}
            />
            <meshBasicMaterial
              color="#9ad1ff"
              transparent
              opacity={Math.min(0.9, motionFeedbackTuning.sideThrusterGlowBase + sideThrusterPower * motionFeedbackTuning.sideThrusterGlowScale)}
            />
          </mesh>
        ) : null}
        {rightThrusterActive ? (
          <mesh position={[0.42 + motionFeedbackTuning.sideThrusterLength / 2, 0.02, -0.08]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry
              args={[
                motionFeedbackTuning.sideThrusterRadius + sideThrusterPower * 0.035,
                motionFeedbackTuning.sideThrusterLength + sideThrusterPower * 0.18,
                12,
                1,
                true,
              ]}
            />
            <meshBasicMaterial
              color="#9ad1ff"
              transparent
              opacity={Math.min(0.9, motionFeedbackTuning.sideThrusterGlowBase + sideThrusterPower * motionFeedbackTuning.sideThrusterGlowScale)}
            />
          </mesh>
        ) : null}
        {reverseThrustersActive ? (
          <>
            <mesh position={[-0.16, 0.02, 0.76 + motionFeedbackTuning.reverseThrusterLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry
                args={[
                  motionFeedbackTuning.reverseThrusterRadius + reverseThrusterPower * 0.025,
                  motionFeedbackTuning.reverseThrusterLength + reverseThrusterPower * 0.12,
                  12,
                  1,
                  true,
                ]}
              />
              <meshBasicMaterial
                color="#8fc8ff"
                transparent
                opacity={Math.min(0.85, motionFeedbackTuning.reverseThrusterGlowBase + reverseThrusterPower * motionFeedbackTuning.reverseThrusterGlowScale)}
              />
            </mesh>
            <mesh position={[0.16, 0.02, 0.76 + motionFeedbackTuning.reverseThrusterLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry
                args={[
                  motionFeedbackTuning.reverseThrusterRadius + reverseThrusterPower * 0.025,
                  motionFeedbackTuning.reverseThrusterLength + reverseThrusterPower * 0.12,
                  12,
                  1,
                  true,
                ]}
              />
              <meshBasicMaterial
                color="#8fc8ff"
                transparent
                opacity={Math.min(0.85, motionFeedbackTuning.reverseThrusterGlowBase + reverseThrusterPower * motionFeedbackTuning.reverseThrusterGlowScale)}
              />
            </mesh>
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
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshBasicMaterial color="#6ad7ff" />
        </mesh>
        <mesh position={[0, 0, -0.88]}>
          <sphereGeometry args={[0.12 + engineGlow * 0.03, 14, 14]} />
          <meshBasicMaterial color="#b6d8ff" transparent opacity={Math.min(1, 0.4 + engineGlow * 0.2)} />
        </mesh>
      </group>
    </group>
  );
}
