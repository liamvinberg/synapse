import type { ReactElement } from 'react';
import { enemyTuning } from '@/game/config/tuning';
import type { EnemyState } from '@/game/sim/types';

interface EnemyMeshProps {
  enemy: EnemyState;
}

export function EnemyMesh({ enemy }: EnemyMeshProps): ReactElement {
  const hitFlashRatio = Math.min(1, enemy.feedback.hitFlashSeconds / enemyTuning.fighterHitFlashSeconds);
  const shieldFlashRatio = Math.min(1, enemy.feedback.shieldFlashSeconds / enemyTuning.fighterShieldFlashSeconds);
  const telegraphRatio =
    enemy.ai.phase === 'telegraph'
      ? Math.min(1, enemy.ai.phaseSecondsRemaining / enemyTuning.fighterTelegraphSeconds)
      : 0;
  const deathRatio =
    enemy.ai.phase === 'dead'
      ? Math.min(1, enemy.feedback.deathFadeSeconds / enemyTuning.fighterDeathFadeSeconds)
      : 0;
  const bodyOpacity = enemy.ai.phase === 'dead' ? Math.max(0.08, deathRatio * 0.75) : 1;
  const bodyColor = hitFlashRatio > 0 ? '#fff0da' : enemyTuning.fighterColor;
  const emissiveIntensity = 0.24 + hitFlashRatio * 1.1 + telegraphRatio * 0.5;
  const deathBurstScale = 1.2 + (1 - deathRatio) * 2.2;
  const deathBurstOpacity = enemy.ai.phase === 'dead' ? Math.max(0, deathRatio * 0.45) : 0;
  const coreScale = enemy.ai.phase === 'dead' ? Math.max(0.2, deathRatio * 0.9) : 1;

  return (
    <group
      position={[enemy.position.x, enemy.position.y, enemy.position.z]}
      rotation={[0, enemy.yawRadians, 0]}
    >
      <group rotation={[enemy.pitchRadians, 0, 0]}>
        {enemy.ai.phase === 'dead' ? (
          <mesh scale={[deathBurstScale, deathBurstScale, deathBurstScale]}>
            <sphereGeometry args={[enemy.radius * 0.95, 18, 18]} />
            <meshBasicMaterial color="#ffd3b6" opacity={deathBurstOpacity} transparent />
          </mesh>
        ) : null}
        {shieldFlashRatio > 0 ? (
          <mesh scale={[1.35, 1.35, 1.35]}>
            <sphereGeometry args={[enemy.radius, 14, 14]} />
            <meshBasicMaterial
              color={enemyTuning.fighterShieldGlowColor}
              opacity={shieldFlashRatio * 0.24}
              transparent
            />
          </mesh>
        ) : null}
        {enemy.ai.phase === 'telegraph' ? (
          <mesh scale={[1.5 + telegraphRatio * 0.35, 1.5 + telegraphRatio * 0.35, 1.5 + telegraphRatio * 0.35]}>
            <sphereGeometry args={[enemy.radius * 0.9, 14, 14]} />
            <meshBasicMaterial color={enemyTuning.fighterColor} opacity={0.08 + telegraphRatio * 0.12} transparent />
          </mesh>
        ) : null}
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[coreScale, coreScale, coreScale]}>
          <coneGeometry args={[enemy.radius * 0.7, enemy.radius * 2.3, 12]} />
          <meshStandardMaterial
            color={bodyColor}
            emissive={bodyColor}
            emissiveIntensity={emissiveIntensity + (enemy.ai.phase === 'dead' ? (1 - deathRatio) * 1.4 : 0)}
            opacity={bodyOpacity}
            transparent={bodyOpacity < 1}
          />
        </mesh>
        <mesh position={[0, 0, -enemy.radius * 0.9]} scale={[coreScale, coreScale, coreScale]}>
          <sphereGeometry args={[enemy.radius * 0.28, 12, 12]} />
          <meshBasicMaterial color="#ffe2c8" opacity={0.5 + telegraphRatio * 0.3} transparent />
        </mesh>
        <mesh position={[0, 0, enemy.radius * 0.68]} scale={[coreScale, coreScale, coreScale]}>
          <sphereGeometry args={[enemy.radius * 0.18, 10, 10]} />
          <meshBasicMaterial color="#ffd6c0" opacity={0.45 + hitFlashRatio * 0.2} transparent />
        </mesh>
      </group>
    </group>
  );
}
