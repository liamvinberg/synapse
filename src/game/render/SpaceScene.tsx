import type { ReactElement } from 'react';
import { Stars } from '@react-three/drei';
import { CameraRig } from '@/game/render/CameraRig';
import { ShipMesh } from '@/game/render/ShipMesh';
import { useInterpolatedShipState } from '@/game/render/useInterpolatedShipState';
import { useGameStore } from '@/game/state/gameStore';

function PlanetBodies(): ReactElement {
  const planets = useGameStore((state) => state.snapshot.activeSectorDescriptor.planets);

  return (
    <>
      {planets.map((planet) => (
        <mesh
          key={planet.id}
          position={[planet.position.x, planet.position.y, planet.position.z]}
        >
          <sphereGeometry args={[planet.radius, 48, 48]} />
          <meshStandardMaterial color={planet.color} roughness={0.92} metalness={0.08} />
        </mesh>
      ))}
    </>
  );
}

function LocalSystem(): ReactElement {
  const starColor = useGameStore((state) => state.snapshot.activeSectorDescriptor.starColor);
  const shipState = useInterpolatedShipState();

  return (
    <group
      position={[
        -shipState.position.x,
        -shipState.position.y,
        -shipState.position.z,
      ]}
    >
      <mesh>
        <sphereGeometry args={[2.4, 48, 48]} />
        <meshBasicMaterial color={starColor} />
      </mesh>
      <PlanetBodies />
    </group>
  );
}

export function SpaceScene(): ReactElement {
  const starColor = useGameStore((state) => state.snapshot.activeSectorDescriptor.starColor);

  return (
    <>
      <color attach="background" args={['#030714']} />
      <fog attach="fog" args={['#030714', 180, 2200]} />
      <ambientLight intensity={0.18} />
      <pointLight color={starColor} intensity={260} distance={0} position={[0, 0, 0]} />

      <Stars
        count={4500}
        depth={1600}
        factor={6}
        fade
        radius={800}
        saturation={0}
        speed={0.25}
      />

      <LocalSystem />
      <ShipMesh />
      <CameraRig />
    </>
  );
}
