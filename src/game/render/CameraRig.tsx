import { useFrame, useThree } from '@react-three/fiber';
import type { ReactElement } from 'react';
import { useGameStore } from '@/game/state/gameStore';
import { useInterpolatedShipState } from '@/game/render/useInterpolatedShipState';

export function CameraRig(): ReactElement | null {
  const camera = useThree((state) => state.camera);
  const shipVelocity = useGameStore((state) => state.snapshot.ship.velocity);
  const shipState = useInterpolatedShipState();

  useFrame((_, deltaSeconds) => {
    const speed = Math.hypot(shipVelocity.x, shipVelocity.y, shipVelocity.z);
    const distance = 16 + Math.min(speed * 0.14, 8);
    const targetX = Math.sin(shipState.yawRadians) * distance;
    const targetZ = Math.cos(shipState.yawRadians) * distance;
    const targetY = 6 + shipState.pitchRadians * 6;
    const easing = 1 - Math.exp(-deltaSeconds * 5);

    camera.position.x += (targetX - camera.position.x) * easing;
    camera.position.y += (targetY - camera.position.y) * easing;
    camera.position.z += (targetZ - camera.position.z) * easing;
    camera.lookAt(0, shipState.pitchRadians * 8, 0);
  });

  return null;
}
