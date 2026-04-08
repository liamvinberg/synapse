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
  const elapsedSeconds = useGameStore((state) => state.snapshot.elapsedSeconds);
  const shipSnapshot = useGameStore((state) => state.snapshot.ship);
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
    const shakeFade = Math.min(1, shipSnapshot.cameraShakeSeconds * 8);
    const shakeAmount = shipSnapshot.cameraShakeStrength * shakeFade;
    const shakeX = Math.sin(elapsedSeconds * 88) * shakeAmount * 0.085;
    const shakeY = Math.cos(elapsedSeconds * 64) * shakeAmount * 0.06;
    const shakeZ = Math.sin(elapsedSeconds * 113) * shakeAmount * 0.045;
    const shakenPosition = {
      x: cameraPose.position.x + shakeX,
      y: cameraPose.position.y + shakeY,
      z: cameraPose.position.z + shakeZ,
    };
    const shakenLookTarget = {
      x: cameraPose.lookTarget.x + shakeX * 0.45,
      y: cameraPose.lookTarget.y + shakeY * 0.65,
      z: cameraPose.lookTarget.z,
    };

    camera.position.x += (shakenPosition.x - camera.position.x) * easing;
    camera.position.y += (shakenPosition.y - camera.position.y) * easing;
    camera.position.z += (shakenPosition.z - camera.position.z) * easing;
    camera.lookAt(
      shakenLookTarget.x,
      shakenLookTarget.y,
      shakenLookTarget.z,
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
