import type { ReactElement } from 'react';
import { useInterpolatedShipState } from '@/game/render/useInterpolatedShipState';

export function ShipMesh(): ReactElement {
  const shipState = useInterpolatedShipState();

  return (
    <group rotation={[shipState.pitchRadians, shipState.yawRadians, shipState.bankRadians]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.42, 1.6, 12]} />
        <meshStandardMaterial color="#e4ebff" emissive="#5074ff" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.72]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshBasicMaterial color="#6ad7ff" />
      </mesh>
    </group>
  );
}
