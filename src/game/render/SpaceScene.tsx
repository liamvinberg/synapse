import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BackSide, CanvasTexture, Color, LinearFilter, Quaternion, ShaderMaterial, SphereGeometry, SRGBColorSpace, Vector3, type Group } from 'three';
import { CameraRig } from '@/game/render/CameraRig';
import { EnemyMesh } from '@/game/render/EnemyMesh';
import { PlanetBody } from '@/game/render/PlanetBody';
import { ShipMesh } from '@/game/render/ShipMesh';
import { SunBody } from '@/game/render/SunBody';
import { useInterpolatedEnemies } from '@/game/render/useInterpolatedEnemies';
import { useInterpolatedShipState } from '@/game/render/useInterpolatedShipState';
import { combatTuning, enemyTuning } from '@/game/config/tuning';
import { useGameStore } from '@/game/state/gameStore';
import { createSeededRandom } from '@/game/worldgen/random';

const UP_AXIS = new Vector3(0, 1, 0);

interface SectorPalette {
  accent: string;
  background: string;
  dust: string;
  fillLight: string;
  fog: string;
  haze: string;
  nebulaPrimary: string;
  nebulaSecondary: string;
  nebulaTertiary: string;
  wash: string;
  starfieldSaturation: number;
}

function toHex(color: Color): string {
  return `#${color.getHexString()}`;
}

function createSectorPalette(starColor: string, density: number): SectorPalette {
  const sectorDepth = Math.min(1, Math.max(0, density));
  const star = new Color(starColor);
  const baseVoid = new Color('#070912');
  const coolFill = new Color('#7d8fd0');
  const warmAccent = new Color('#cf9b77');
  const background = baseVoid.clone().lerp(star.clone().multiplyScalar(0.04), 0.08 + sectorDepth * 0.02);
  const fog = background.clone().lerp(star.clone().multiplyScalar(0.14), 0.12 + sectorDepth * 0.04);
  const haze = background.clone().lerp(coolFill, 0.1 + sectorDepth * 0.04);
  const wash = coolFill.clone().lerp(star, 0.16).offsetHSL(0.03, 0.01, -0.05);
  const accent = warmAccent.clone().lerp(star, 0.24).offsetHSL(-0.02, 0.02, -0.08);
  const nebulaPrimary = wash.clone().offsetHSL(-0.04, 0.03, -0.03);
  const nebulaSecondary = coolFill.clone().lerp(star, 0.22).offsetHSL(0.05, 0.01, -0.08);
  const nebulaTertiary = accent.clone().offsetHSL(0.02, 0.01, -0.12);
  const dust = coolFill.clone().lerp(warmAccent, 0.08);
  const fillLight = coolFill.clone().lerp(star, 0.14);

  return {
    accent: toHex(accent),
    background: toHex(background),
    dust: toHex(dust),
    fillLight: toHex(fillLight),
    fog: toHex(fog),
    haze: toHex(haze),
    nebulaPrimary: toHex(nebulaPrimary),
    nebulaSecondary: toHex(nebulaSecondary),
    nebulaTertiary: toHex(nebulaTertiary),
    wash: toHex(wash),
    starfieldSaturation: 0.14 + sectorDepth * 0.05,
  };
}

const backdropGeometry = new SphereGeometry(3200, 40, 20);
const starDomeGeometry = new SphereGeometry(3180, 40, 20);

const backdropVertexShader = /* glsl */ `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const backdropFragmentShader = /* glsl */ `
uniform vec3 uBackground;
uniform vec3 uWash;
uniform vec3 uAccent;

varying vec3 vWorldPosition;

void main() {
  vec3 direction = normalize(vWorldPosition);
  float vertical = direction.y * 0.5 + 0.5;
  vec3 color = mix(uBackground * 0.99, uWash, smoothstep(0.18, 0.92, vertical) * 0.1);
  color = mix(color, uAccent, smoothstep(0.0, 1.0, vertical) * 0.02);

  gl_FragColor = vec4(color, 1.0);
}
`;

const starPalette = {
  bright: ['#ffffff', '#f5f7ff', '#fff5e8'] as const,
  cool: ['#cfe0ff', '#a9c8ff', '#b8e5ff'] as const,
  warm: ['#ffd6a6', '#ffc58f', '#ffe3bd'] as const,
} as const;

function pickStarColor(random: () => number): string {
  const roll = random();

  if (roll < 0.52) {
    return starPalette.bright[Math.floor(random() * starPalette.bright.length)] ?? '#ffffff';
  }

  if (roll < 0.78) {
    return starPalette.cool[Math.floor(random() * starPalette.cool.length)] ?? '#cfe0ff';
  }

  return starPalette.warm[Math.floor(random() * starPalette.warm.length)] ?? '#ffd6a6';
}

function createStarfieldTexture(seed: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d');

  if (context === null) {
    throw new Error('Failed to create starfield canvas context');
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  const random = createSeededRandom(seed ^ 0x51f15e3d);
  const starCount = 2600;

  for (let index = 0; index < starCount; index += 1) {
    const u = random();
    const v = Math.acos(1 - 2 * random()) / Math.PI;
    const x = u * canvas.width;
    const y = v * canvas.height;
    const brightness = random();

    let radius = 0.22 + random() * 0.36;
    if (brightness > 0.982) {
      radius = 1.15 + random() * 0.7;
    } else if (brightness > 0.86) {
      radius = 0.6 + random() * 0.5;
    }

    const color = pickStarColor(random);
    const alpha = brightness > 0.982 ? 1 : brightness > 0.86 ? 0.88 : 0.48 + random() * 0.18;

    context.beginPath();
    context.fillStyle = color;
    context.globalAlpha = alpha;
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();

    if (radius > 0.95) {
      const glow = context.createRadialGradient(x, y, 0, x, y, radius * 3.8);
      glow.addColorStop(0, color);
      glow.addColorStop(0.22, color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      context.beginPath();
      context.fillStyle = glow;
      context.globalAlpha = 0.16;
      context.arc(x, y, radius * 3.8, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.globalAlpha = 1;

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

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
  const center = new Vector3(...position).addScaledVector(direction, length * 0.5);

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
            projectile.kind === 'enemy'
              ? enemyTuning.fighterProjectileGlowColor
              : projectile.kind === 'secondary'
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

function EnemyBodies(): ReactElement {
  const enemies = useInterpolatedEnemies();

  return (
    <>
      {enemies.map((enemy) => (
        <EnemyMesh key={enemy.id} enemy={enemy} />
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

function CombatEventBodies(): ReactElement {
  const combatEvents = useGameStore((state) => state.snapshot.combatEvents);

  return (
    <>
      {combatEvents.map((event) => {
        const opacity = event.ttlSeconds / event.maxTtlSeconds;
        const scaleMultiplier =
          event.kind === 'death'
            ? 2.8
            : event.kind === 'shield-break'
              ? 1.8
              : event.kind === 'stagger'
                ? 2.1
                : event.kind === 'telegraph'
                  ? 1.4
                  : 1.25;
        const materialOpacity =
          event.kind === 'death'
            ? opacity * 0.75
            : event.kind === 'telegraph'
              ? opacity * 0.22
              : opacity * 0.45;
        const scale = 1 + (1 - opacity) * scaleMultiplier;

        return (
          <mesh
            key={event.id}
            position={[event.position.x, event.position.y, event.position.z]}
            scale={[scale, scale, scale]}
          >
            <sphereGeometry args={[event.radius, 14, 14]} />
            <meshBasicMaterial color={event.color} opacity={materialOpacity} transparent />
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
      <SunBody starColor={starColor} />
      <PlanetBodies />
      <EnemyBodies />
      <ProjectileBodies />
      <ImpactBodies />
      <CombatEventBodies />
    </group>
  );
}

function SkyBackdrop(): ReactElement {
  const seed = useGameStore((state) => state.snapshot.activeSectorDescriptor.seed);
  const starColor = useGameStore((state) => state.snapshot.activeSectorDescriptor.starColor);
  const camera = useThree((state) => state.camera);
  const groupRef = useRef<Group>(null);
  const density = useGameStore((state) => state.snapshot.activeSectorDescriptor.density);
  const palette = useMemo(() => createSectorPalette(starColor, density), [density, starColor]);
  const material = useMemo(
    () => new ShaderMaterial({
      depthWrite: false,
      fragmentShader: backdropFragmentShader,
      side: BackSide,
      uniforms: {
        uAccent: { value: new Color(palette.accent) },
        uBackground: { value: new Color(palette.background) },
        uWash: { value: new Color(palette.wash) },
      },
      vertexShader: backdropVertexShader,
    }),
    [palette.accent, palette.background, palette.wash],
  );
  const starTexture = useMemo(() => createStarfieldTexture(seed), [seed]);

  useEffect(() => {
    return () => {
      material.dispose();
      starTexture.dispose();
    };
  }, [material, starTexture]);

  useFrame(() => {
    if (groupRef.current === null) {
      return;
    }

    groupRef.current.position.copy(camera.position);
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={backdropGeometry} material={material} />
      <mesh geometry={starDomeGeometry}>
        <meshBasicMaterial
          alphaMap={starTexture}
          color="#ffffff"
          depthWrite={false}
          map={starTexture}
          side={BackSide}
          transparent
        />
      </mesh>
    </group>
  );
}

function SectorBackdrop(): ReactElement {
  return (
    <>
      <SkyBackdrop />
    </>
  );
}

export function SpaceScene(): ReactElement {
  const starColor = useGameStore((state) => state.snapshot.activeSectorDescriptor.starColor);
  const density = useGameStore((state) => state.snapshot.activeSectorDescriptor.density);
  const palette = useMemo(() => createSectorPalette(starColor, density), [density, starColor]);

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, 340, 3000]} />
      <ambientLight intensity={0.2} />
      <hemisphereLight args={[palette.haze, palette.background, 0.24]} />
      <pointLight color={palette.fillLight} intensity={12} distance={1400} position={[340, 220, -520]} />

      <SectorBackdrop />

      <LocalSystem />
      <ShipMesh />
      <CameraRig />
    </>
  );
}
