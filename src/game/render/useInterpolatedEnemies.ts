import { useMemo } from 'react';
import { useGameStore } from '@/game/state/gameStore';
import type { EnemyState } from '@/game/sim/types';

export function useInterpolatedEnemies(): EnemyState[] {
  const frameAlpha = useGameStore((state) => state.frameAlpha);
  const previousEnemies = useGameStore((state) => state.previousSnapshot.enemies);
  const currentEnemies = useGameStore((state) => state.snapshot.enemies);

  return useMemo(() => {
    const previousById = new Map(previousEnemies.map((enemy) => [enemy.id, enemy]));

    return currentEnemies.map((enemy) => {
      const previousEnemy = previousById.get(enemy.id) ?? enemy;
      const interpolate = (previous: number, current: number): number =>
        previous + (current - previous) * frameAlpha;

      return {
        ...enemy,
        pitchRadians: interpolate(previousEnemy.pitchRadians, enemy.pitchRadians),
        position: {
          x: interpolate(previousEnemy.position.x, enemy.position.x),
          y: interpolate(previousEnemy.position.y, enemy.position.y),
          z: interpolate(previousEnemy.position.z, enemy.position.z),
        },
        yawRadians: interpolate(previousEnemy.yawRadians, enemy.yawRadians),
      };
    });
  }, [currentEnemies, frameAlpha, previousEnemies]);
}
