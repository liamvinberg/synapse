import { useFrame, useThree } from '@react-three/fiber';
import type { ReactElement } from 'react';
import { chaseCameraTuning, motionFeedbackTuning } from '@/game/config/tuning';
import { useGameStore } from '@/game/state/gameStore';
import { useInterpolatedShipState } from '@/game/render/useInterpolatedShipState';

function getForwardVector(yawRadians: number, pitchRadians: number) {
  const cosPitch = Math.cos(pitchRadians);

  return {
    x: Math.sin(yawRadians) * cosPitch,
    y: -Math.sin(pitchRadians),
    z: Math.cos(yawRadians) * cosPitch,
  };
}

export function CameraRig(): ReactElement | null {
  const camera = useThree((state) => state.camera);
  const boostActive = useGameStore((state) => state.input.boost);
  const shipVelocity = useGameStore((state) => state.snapshot.ship.velocity);
  const shipState = useInterpolatedShipState();

  useFrame((_, deltaSeconds) => {
    const speed = Math.hypot(shipVelocity.x, shipVelocity.y, shipVelocity.z);
    const forward = getForwardVector(shipState.yawRadians, shipState.pitchRadians);
    const distance =
      chaseCameraTuning.distanceBase +
      Math.min(speed * chaseCameraTuning.distanceSpeedScale, chaseCameraTuning.distanceSpeedMax);
    const chaseHeight = chaseCameraTuning.height;
    const targetX = -forward.x * distance;
    const targetY = chaseHeight - forward.y * chaseCameraTuning.pitchLift;
    const targetZ = -forward.z * distance;
    const easing = 1 - Math.exp(-deltaSeconds * chaseCameraTuning.followSharpness);

    camera.position.x += (targetX - camera.position.x) * easing;
    camera.position.y += (targetY - camera.position.y) * easing;
    camera.position.z += (targetZ - camera.position.z) * easing;
    camera.lookAt(
      forward.x * chaseCameraTuning.lookAheadDistance,
      chaseCameraTuning.lookAheadHeight + forward.y * chaseCameraTuning.lookAheadDistance,
      forward.z * chaseCameraTuning.lookAheadDistance,
    );

    const speedRatio = Math.min(1, speed / motionFeedbackTuning.speedForMaxFov);
    const targetFov =
      55 + speedRatio * motionFeedbackTuning.maxFovBoost + (boostActive ? motionFeedbackTuning.boostFovBonus : 0);

    if ('fov' in camera && typeof camera.fov === 'number') {
      camera.fov += (targetFov - camera.fov) * easing;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
