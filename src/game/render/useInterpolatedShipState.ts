import { useMemo } from 'react';
import { useGameStore } from '@/game/state/gameStore';

interface InterpolatedShipState {
  bankRadians: number;
  pitchRadians: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  yawRadians: number;
}

export function useInterpolatedShipState(): InterpolatedShipState {
  const frameAlpha = useGameStore((state) => state.frameAlpha);
  const previousShip = useGameStore((state) => state.previousSnapshot.ship);
  const currentShip = useGameStore((state) => state.snapshot.ship);

  return useMemo(() => {
    const interpolate = (previous: number, current: number): number =>
      previous + (current - previous) * frameAlpha;

    return {
      bankRadians: interpolate(previousShip.bankRadians, currentShip.bankRadians),
      pitchRadians: interpolate(previousShip.pitchRadians, currentShip.pitchRadians),
      position: {
        x: interpolate(previousShip.position.x, currentShip.position.x),
        y: interpolate(previousShip.position.y, currentShip.position.y),
        z: interpolate(previousShip.position.z, currentShip.position.z),
      },
      yawRadians: interpolate(previousShip.yawRadians, currentShip.yawRadians),
    };
  }, [currentShip, frameAlpha, previousShip]);
}
