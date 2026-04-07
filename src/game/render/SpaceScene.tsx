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

function ProjectileBodies(): ReactElement {
  const projectiles = useGameStore((state) => state.snapshot.projectiles);

  return (
    <>
      {projectiles.map((projectile) => (
        <mesh
          key={projectile.id}
          position={[projectile.position.x, projectile.position.y, projectile.position.z]}
        >
          <sphereGeometry args={[projectile.radius, 12, 12]} />
          <meshBasicMaterial color="#b8d7ff" />
        </mesh>
      ))}
    </>
  );
}

function ImpactBodies(): ReactElement {
  const impacts = useGameStore((state) => state.snapshot.impacts);

  return (
    <>
      {impacts.map((impact) => {
        const opacity = impact.ttlSeconds / impact.maxTtlSeconds;
        const scale = 1 + (1 - opacity) * 0.8;

        return (
          <mesh
            key={impact.id}
            position={[impact.position.x, impact.position.y, impact.position.z]}
            scale={[scale, scale, scale]}
          >
            <sphereGeometry args={[impact.radius, 14, 14]} />
            <meshBasicMaterial color={impact.color} transparent opacity={opacity * 0.9} />
          </mesh>
        );
      })}
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
      <ProjectileBodies />
      <ImpactBodies />
    </group>
  );
}

export function SpaceScene(): ReactElement {
  const starColor = useGameStore((state) => state.snapshot.activeSectorDescriptor.starColor);
  const shipVelocity = useGameStore((state) => state.snapshot.ship.velocity);
  const shipSpeed = Math.hypot(shipVelocity.x, shipVelocity.y, shipVelocity.z);
  const starfieldSpeed = 0.25 + Math.min(shipSpeed * 0.045, 1.75);

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
        speed={starfieldSpeed}
      />

      <LocalSystem />
      <ShipMesh />
      <CameraRig />
    </>
  );
}
