import type { ReactElement } from 'react';
import { Stars } from '@react-three/drei';
import { Quaternion, Vector3 } from 'three';
import { CameraRig } from '@/game/render/CameraRig';
import { PlanetBody } from '@/game/render/PlanetBody';
import { ShipMesh } from '@/game/render/ShipMesh';
import { useInterpolatedShipState } from '@/game/render/useInterpolatedShipState';
import { combatTuning } from '@/game/config/tuning';
import { useGameStore } from '@/game/state/gameStore';

const UP_AXIS = new Vector3(0, 1, 0);

function ProjectileTrace({
  color,
  glowColor,
  length,
  position,
  radius,
  velocity,
}: {
  color: string;
  glowColor: string;
  length: number;
  position: [number, number, number];
  radius: number;
  velocity: [number, number, number];
}): ReactElement {
  const direction = new Vector3(...velocity).normalize();
  const quaternion = new Quaternion().setFromUnitVectors(UP_AXIS, direction);
  const center = new Vector3(...position).addScaledVector(direction, -length * 0.45);

  return (
    <group position={center.toArray()} quaternion={quaternion}>
      <mesh>
        <cylinderGeometry args={[radius * 1.8, radius * 1.8, length, 10]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.16} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[radius, radius, length, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function PlanetBodies(): ReactElement {
  const planets = useGameStore((state) => state.snapshot.activeSectorDescriptor.planets);

  return (
    <>
      {planets.map((planet) => (
        <PlanetBody key={planet.id} planet={planet} />
      ))}
    </>
  );
}

function ProjectileBodies(): ReactElement {
  const projectiles = useGameStore((state) => state.snapshot.projectiles);

  return (
    <>
      {projectiles.map((projectile) => (
        <ProjectileTrace
          key={projectile.id}
          color={projectile.color}
          glowColor={
            projectile.kind === 'secondary'
              ? combatTuning.secondaryProjectileGlowColor
              : combatTuning.projectileGlowColor
          }
          length={projectile.length}
          position={[projectile.position.x, projectile.position.y, projectile.position.z]}
          radius={projectile.radius}
          velocity={[projectile.velocity.x, projectile.velocity.y, projectile.velocity.z]}
        />
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
