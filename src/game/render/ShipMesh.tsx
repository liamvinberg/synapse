import type { ReactElement } from 'react';
import { motionFeedbackTuning } from '@/game/config/tuning';
import { useGameStore } from '@/game/state/gameStore';
import { useInterpolatedShipState } from '@/game/render/useInterpolatedShipState';

export function ShipMesh(): ReactElement {
  const boostActive = useGameStore((state) => state.input.boost);
  const shipVelocity = useGameStore((state) => state.snapshot.ship.velocity);
  const shipState = useInterpolatedShipState();
  const speed = Math.hypot(shipVelocity.x, shipVelocity.y, shipVelocity.z);
  const engineLength =
    motionFeedbackTuning.engineLengthBase +
    speed * motionFeedbackTuning.engineLengthSpeedScale +
    (boostActive ? motionFeedbackTuning.engineLengthBoost : 0);
  const engineGlow = Math.min(
    1.6,
    motionFeedbackTuning.engineGlowBase +
      speed * motionFeedbackTuning.engineGlowSpeedScale +
      (boostActive ? motionFeedbackTuning.engineGlowBoost : 0),
  );

  return (
    <group rotation={[0, shipState.yawRadians, 0]}>
      <group rotation={[shipState.pitchRadians, 0, shipState.bankRadians]}>
        <mesh position={[0, 0, -0.95]} rotation={[-Math.PI / 2, 0, 0]}>
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
