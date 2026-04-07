import { useFrame, useThree } from '@react-three/fiber';
import type { ReactElement } from 'react';
import { motionFeedbackTuning } from '@/game/config/tuning';
import { getChaseCameraPose } from '@/game/shared/chaseCamera';
import { useGameStore } from '@/game/state/gameStore';
import { useInterpolatedShipState } from '@/game/render/useInterpolatedShipState';

export function CameraRig(): ReactElement | null {
  const camera = useThree((state) => state.camera);
  const boostActive = useGameStore((state) => state.input.boost);
  const shipVelocity = useGameStore((state) => state.snapshot.ship.velocity);
  const shipState = useInterpolatedShipState();

  useFrame((_, deltaSeconds) => {
    const speed = Math.hypot(shipVelocity.x, shipVelocity.y, shipVelocity.z);
    const cameraPose = getChaseCameraPose(shipState, speed);
    const easing = 1 - Math.exp(-deltaSeconds * 10);

    camera.position.x += (cameraPose.position.x - camera.position.x) * easing;
    camera.position.y += (cameraPose.position.y - camera.position.y) * easing;
    camera.position.z += (cameraPose.position.z - camera.position.z) * easing;
    camera.lookAt(
      cameraPose.lookTarget.x,
      cameraPose.lookTarget.y,
      cameraPose.lookTarget.z,
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
