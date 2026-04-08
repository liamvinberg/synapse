import { useEffect, useMemo, type ReactElement } from 'react';
import { Cloud, Clouds, Sparkles, Stars } from '@react-three/drei';
import { BackSide, Color, MeshBasicMaterial, Quaternion, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { CameraRig } from '@/game/render/CameraRig';
import { PlanetBody } from '@/game/render/PlanetBody';
import { ShipMesh } from '@/game/render/ShipMesh';
import { useInterpolatedShipState } from '@/game/render/useInterpolatedShipState';
import { combatTuning } from '@/game/config/tuning';
import { useGameStore } from '@/game/state/gameStore';

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
uniform float uDensity;
uniform float uSeed;

varying vec3 vWorldPosition;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash31(i + vec3(0.0, 0.0, 0.0)), hash31(i + vec3(1.0, 0.0, 0.0)), u.x),
      mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), u.x),
      u.y
    ),
    mix(
      mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), u.x),
      mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), u.x),
      u.y
    ),
    u.z
  );
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int index = 0; index < 4; index += 1) {
    value += noise3(p * frequency) * amplitude;
    frequency *= 2.0;
    amplitude *= 0.55;
  }

  return value;
}

void main() {
  vec3 direction = normalize(vWorldPosition);
  float horizon = smoothstep(-0.4, 0.95, direction.y * 0.5 + 0.5);
  vec3 color = mix(uBackground * 0.94, uBackground * 1.08, horizon);

  float washAxis = dot(direction, normalize(vec3(-0.46, 0.18, 0.86)));
  float accentAxis = dot(direction, normalize(vec3(0.58, -0.02, 0.82)));
  float broadWash = exp(-pow((1.0 - washAxis) * 3.2, 2.0));
  float accentWash = exp(-pow((1.0 - accentAxis) * 4.8, 2.0));

  vec3 samplePoint = direction * (2.6 + uDensity * 1.4) + vec3(uSeed * 0.000013, uSeed * 0.000011, uSeed * 0.000017);
  float cloudNoise = fbm(samplePoint + vec3(2.0, 0.0, 0.0));
  float accentNoise = fbm(samplePoint * 1.5 - vec3(1.4, 0.8, 0.0));

  color += uWash * broadWash * smoothstep(0.32, 0.86, cloudNoise) * (0.1 + uDensity * 0.05);
  color += uAccent * accentWash * smoothstep(0.46, 0.92, accentNoise) * 0.04;

  gl_FragColor = vec4(color, 1.0);
}
`;

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

function SkyBackdrop(): ReactElement {
  const density = useGameStore((state) => state.snapshot.activeSectorDescriptor.density);
  const seed = useGameStore((state) => state.snapshot.activeSectorDescriptor.seed);
  const starColor = useGameStore((state) => state.snapshot.activeSectorDescriptor.starColor);
  const shipState = useInterpolatedShipState();
  const palette = useMemo(() => createSectorPalette(starColor, density), [density, starColor]);
  const material = useMemo(
    () => new ShaderMaterial({
      depthWrite: false,
      fragmentShader: backdropFragmentShader,
      side: BackSide,
      uniforms: {
        uAccent: { value: new Color(palette.accent) },
        uBackground: { value: new Color(palette.background) },
        uDensity: { value: density },
        uSeed: { value: seed },
        uWash: { value: new Color(palette.wash) },
      },
      vertexShader: backdropVertexShader,
    }),
    [density, palette.accent, palette.background, palette.wash, seed],
  );

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <mesh
      geometry={backdropGeometry}
      material={material}
      position={[
        -shipState.position.x * 0.01,
        -shipState.position.y * 0.008,
        -shipState.position.z * 0.01,
      ]}
    />
  );
}

function SectorBackdrop({ starfieldSpeed }: { starfieldSpeed: number }): ReactElement {
  const starColor = useGameStore((state) => state.snapshot.activeSectorDescriptor.starColor);
  const density = useGameStore((state) => state.snapshot.activeSectorDescriptor.density);
  const shipState = useInterpolatedShipState();
  const palette = useMemo(() => createSectorPalette(starColor, density), [density, starColor]);
  const densityRatio = Math.min(1, Math.max(0, density));
  const nebulaShift: [number, number, number] = [
    -shipState.position.x * 0.055,
    -shipState.position.y * 0.03,
    -shipState.position.z * 0.055,
  ];
  const dustShift: [number, number, number] = [
    -shipState.position.x * 0.09,
    -shipState.position.y * 0.05,
    -shipState.position.z * 0.09,
  ];

  return (
    <>
      <SkyBackdrop />

      <group position={nebulaShift}>
        <Clouds material={MeshBasicMaterial} limit={8} range={1600}>
          <Cloud
            bounds={[360, 108, 78]}
            color={palette.nebulaPrimary}
            fade={600}
            opacity={0.08 + densityRatio * 0.03}
            position={[-560, 170, -1200]}
            seed={11}
            segments={28}
            speed={0.03}
            volume={7}
          />
          <Cloud
            bounds={[280, 84, 68]}
            color={palette.nebulaSecondary}
            fade={520}
            opacity={0.07 + densityRatio * 0.025}
            position={[460, -70, -1080]}
            seed={29}
            segments={24}
            speed={0.025}
            volume={5}
          />
          <Cloud
            bounds={[180, 56, 42]}
            color={palette.nebulaTertiary}
            fade={420}
            opacity={0.05 + densityRatio * 0.02}
            position={[90, 220, -900]}
            seed={47}
            segments={18}
            speed={0.02}
            volume={4}
          />
        </Clouds>
      </group>

      <group position={dustShift}>
        <Sparkles
          color={palette.dust}
          count={70}
          noise={0.9}
          opacity={0.08 + densityRatio * 0.02}
          scale={[1200, 520, 1200]}
          size={10}
          speed={0.08}
        />
      </group>

      <Stars
        count={4200}
        depth={2200}
        factor={3.1}
        fade
        radius={1000}
        saturation={palette.starfieldSaturation}
        speed={Math.max(0.04, starfieldSpeed * 0.2)}
      />
      <Stars
        count={1700}
        depth={1200}
        factor={4.8}
        fade
        radius={720}
        saturation={Math.min(1, palette.starfieldSaturation + 0.08)}
        speed={Math.max(0.08, starfieldSpeed * 0.4)}
      />
      <Stars
        count={650}
        depth={620}
        factor={6.4}
        fade
        radius={420}
        saturation={Math.min(1, palette.starfieldSaturation + 0.16)}
        speed={Math.max(0.14, starfieldSpeed * 0.7)}
      />
    </>
  );
}

export function SpaceScene(): ReactElement {
  const starColor = useGameStore((state) => state.snapshot.activeSectorDescriptor.starColor);
  const density = useGameStore((state) => state.snapshot.activeSectorDescriptor.density);
  const shipVelocity = useGameStore((state) => state.snapshot.ship.velocity);
  const shipSpeed = Math.hypot(shipVelocity.x, shipVelocity.y, shipVelocity.z);
  const palette = useMemo(() => createSectorPalette(starColor, density), [density, starColor]);
  const starfieldSpeed = 0.22 + Math.min(shipSpeed * 0.032, 0.92);

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, 340, 3000]} />
      <ambientLight intensity={0.14} />
      <hemisphereLight args={[palette.haze, palette.background, 0.18]} />
      <pointLight color={palette.fillLight} intensity={12} distance={1400} position={[340, 220, -520]} />
      <pointLight color={starColor} intensity={260} distance={0} position={[0, 0, 0]} />

      <SectorBackdrop starfieldSpeed={starfieldSpeed} />

      <LocalSystem />
      <ShipMesh />
      <CameraRig />
    </>
  );
}
