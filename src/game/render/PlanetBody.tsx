import { memo, useEffect, useMemo, useRef, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, Color, Group, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import type { PlanetDescriptor, PlanetSurfaceStyle } from '@/game/sim/types';
import { createPlanetMaps } from '@/game/render/createPlanetMaps';

const geometryCache = new Map<number, SphereGeometry>();

const atmosphereVertexShader = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const atmosphereFragmentShader = /* glsl */ `
uniform vec3 uAtmosphereColor;
uniform float uOpacity;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 lightDir = normalize(-vWorldPosition);
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.6);
  float lightMix = 0.4 + max(dot(normal, lightDir), 0.0) * 0.6;
  float alpha = rim * uOpacity * lightMix;
  gl_FragColor = vec4(uAtmosphereColor, alpha);
}
`;

function getPlanetGeometry(radius: number): SphereGeometry {
  const segments = radius >= 46 ? 42 : radius >= 28 ? 34 : 28;
  const cached = geometryCache.get(segments);

  if (cached !== undefined) {
    return cached;
  }

  const geometry = new SphereGeometry(1, segments, segments);
  geometryCache.set(segments, geometry);
  return geometry;
}

function createAtmosphereMaterial(surface: PlanetSurfaceStyle): ShaderMaterial | null {
  if (surface.atmosphereColor === null || surface.atmosphereOpacity <= 0) {
    return null;
  }

  return new ShaderMaterial({
    blending: AdditiveBlending,
    fragmentShader: atmosphereFragmentShader,
    side: BackSide,
    transparent: true,
    uniforms: {
      uAtmosphereColor: { value: new Color(surface.atmosphereColor) },
      uOpacity: { value: surface.atmosphereOpacity * 0.82 },
    },
    vertexShader: atmosphereVertexShader,
  });
}

function getSpinSpeed(seed: number): number {
  const direction = seed % 2 === 0 ? 1 : -1;
  return direction * (0.015 + (seed % 7) * 0.0025);
}

interface PlanetBodyProps {
  planet: PlanetDescriptor;
}

export const PlanetBody = memo(function PlanetBody({ planet }: PlanetBodyProps): ReactElement {
  const geometry = useMemo(() => getPlanetGeometry(planet.radius), [planet.radius]);
  const maps = useMemo(() => createPlanetMaps(planet.surface), [planet.surface]);
  const atmosphereMaterial = useMemo(() => createAtmosphereMaterial(planet.surface), [planet.surface]);
  const surfaceGroupRef = useRef<Group>(null);
  const cloudMeshRef = useRef<Mesh>(null);
  const spinSpeed = useMemo(() => getSpinSpeed(planet.surface.seed), [planet.surface.seed]);

  useFrame((_, delta) => {
    if (surfaceGroupRef.current !== null) {
      surfaceGroupRef.current.rotation.y += spinSpeed * delta;
    }

    if (cloudMeshRef.current !== null) {
      cloudMeshRef.current.rotation.y += spinSpeed * 1.25 * delta;
    }
  });

  useEffect(() => {
    return () => {
      maps.dispose();
      atmosphereMaterial?.dispose();
    };
  }, [atmosphereMaterial, maps]);

  return (
    <group position={[planet.position.x, planet.position.y, planet.position.z]}>
      <group ref={surfaceGroupRef}>
        <mesh geometry={geometry} scale={planet.radius}>
          <meshStandardMaterial
            bumpMap={maps.bump}
            bumpScale={planet.surface.biome === 'gas' ? 0.02 : planet.surface.biome === 'lava' ? 0.05 : 0.11}
            emissive={planet.surface.emissiveColor ?? '#000000'}
            emissiveIntensity={planet.surface.emissiveColor === null ? 0 : planet.surface.biome === 'lava' ? 0.6 : 0.12}
            emissiveMap={maps.emissive}
            map={maps.albedo}
            metalness={0.02}
            roughness={planet.surface.roughness}
            roughnessMap={maps.roughness}
          />
        </mesh>

        {maps.cloudAlpha !== null && planet.surface.cloudColor !== null ? (
          <mesh ref={cloudMeshRef} geometry={geometry} scale={planet.radius * 1.015}>
            <meshStandardMaterial
              alphaMap={maps.cloudAlpha}
              color={planet.surface.cloudColor}
              depthWrite={false}
              opacity={0.55 + planet.surface.cloudDensity * 0.18}
              roughness={1}
              transparent
            />
          </mesh>
        ) : null}
      </group>

      {atmosphereMaterial !== null ? (
        <mesh geometry={geometry} material={atmosphereMaterial} scale={planet.radius * planet.surface.atmosphereScale} />
      ) : null}
    </group>
  );
});
