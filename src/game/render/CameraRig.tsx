import { useFrame, useThree } from '@react-three/fiber';
import { useRef, type ReactElement } from 'react';
import { chaseCameraTuning, motionFeedbackTuning } from '@/game/config/tuning';
import { getChaseCameraPose } from '@/game/shared/chaseCamera';
import { useGameStore } from '@/game/state/gameStore';
import { useInterpolatedShipState } from '@/game/render/useInterpolatedShipState';

export function CameraRig(): ReactElement | null {
  const camera = useThree((state) => state.camera);
  const aimDownSights = useGameStore((state) => state.input.aimDownSights);
  const boostActive = useGameStore((state) => state.input.boost);
  const shipVelocity = useGameStore((state) => state.snapshot.ship.velocity);
  const shipState = useInterpolatedShipState();
  const adsBlendRef = useRef(0);

  useFrame((_, deltaSeconds) => {
    const speed = Math.hypot(shipVelocity.x, shipVelocity.y, shipVelocity.z);
    const adsTarget = aimDownSights ? 1 : 0;
    const adsEasing = 1 - Math.exp(-deltaSeconds * chaseCameraTuning.shoulderOffsetSharpness);
    adsBlendRef.current += (adsTarget - adsBlendRef.current) * adsEasing;
    const cameraPose = getChaseCameraPose(shipState, speed, adsBlendRef.current);
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
    const baseFov =
      chaseCameraTuning.hipFov +
      (chaseCameraTuning.adsFov - chaseCameraTuning.hipFov) * adsBlendRef.current;
    const targetFov =
      baseFov + speedRatio * motionFeedbackTuning.maxFovBoost + (boostActive ? motionFeedbackTuning.boostFovBonus : 0);

    if ('fov' in camera && typeof camera.fov === 'number') {
      camera.fov += (targetFov - camera.fov) * easing;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
