import { memo, useEffect, useMemo, useRef, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, Color, Group, ShaderMaterial, SphereGeometry } from 'three';
import type { PlanetDescriptor, PlanetSurfaceStyle } from '@/game/sim/types';

const geometryCache = new Map<number, SphereGeometry>();

const planetVertexShader = /* glsl */ `
uniform float uSeed;
uniform float uDisplacementStrength;
uniform float uTextureScale;
uniform float uWarpAmount;

varying vec3 vLocalPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vHeight;

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

float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int index = 0; index < 5; index += 1) {
    if (index >= octaves) {
      break;
    }

    value += noise3(p * frequency) * amplitude;
    frequency *= 2.0;
    amplitude *= 0.5;
  }

  return value;
}

void main() {
  vec3 unit = normalize(position);
  vec3 seedOffset = vec3(uSeed * 0.0000017, uSeed * 0.0000011, uSeed * 0.0000013);
  vec3 samplePoint = unit * uTextureScale + seedOffset;
  vec3 warp = vec3(
    fbm(samplePoint + vec3(3.7, 0.0, 0.0), 3),
    fbm(samplePoint + vec3(0.0, 7.1, 0.0), 3),
    fbm(samplePoint + vec3(0.0, 0.0, 11.4), 3)
  ) * uWarpAmount;
  vec3 warped = samplePoint + warp;
  float height = fbm(warped * 0.72, 3) * 0.5 + 0.5;
  float displacement = (height - 0.5) * 2.0 * uDisplacementStrength;
  vec3 displacedPosition = position + normal * displacement;
  vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);

  vLocalPosition = normalize(displacedPosition);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(normalMatrix * normal);
  vHeight = height;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
`;

const planetFragmentShader = /* glsl */ `
uniform vec3 uAtmosphereColor;
uniform vec3 uPrimaryColor;
uniform vec3 uSecondaryColor;
uniform vec3 uDetailColor;
uniform vec3 uEmissiveColor;
uniform vec3 uLightDirection;
uniform float uBanding;
uniform float uBiome;
uniform float uCloudDensity;
uniform float uHasEmissive;
uniform float uOceanLevel;
uniform float uPolarCapAmount;
uniform float uSpecularStrength;
uniform float uTerrainSharpness;
uniform float uTextureScale;
uniform float uVariant;
uniform float uWarpAmount;
uniform float uSeed;

varying vec3 vLocalPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vHeight;

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

float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int index = 0; index < 5; index += 1) {
    if (index >= octaves) {
      break;
    }

    value += noise3(p * frequency) * amplitude;
    frequency *= 2.0;
    amplitude *= 0.5;
  }

  return value;
}

float ridge(vec3 p) {
  float ridgeSample = 1.0 - abs(noise3(p) * 2.0 - 1.0);
  return ridgeSample * ridgeSample;
}

float smoothBand(float value, float start, float end) {
  return smoothstep(start, end, value);
}

void main() {
  vec3 unit = normalize(vLocalPosition);
  vec3 seedOffset = vec3(uSeed * 0.0000017, uSeed * 0.0000011, uSeed * 0.0000013);
  vec3 samplePoint = unit * uTextureScale + seedOffset;
  vec3 warp = vec3(
    fbm(samplePoint + vec3(3.7, 0.0, 0.0), 3),
    fbm(samplePoint + vec3(0.0, 7.1, 0.0), 3),
    fbm(samplePoint + vec3(0.0, 0.0, 11.4), 3)
  ) * uWarpAmount;
  vec3 warped = samplePoint + warp;
  float macro = vHeight;
  float detail = fbm((warped + 3.7) * (1.25 + uVariant * 0.18), 3) * 0.5 + 0.5;
  float humidity = fbm((warped - 6.3) * 1.2, 3) * 0.5 + 0.5;
  float ridges = ridge((warped + 9.1) * (1.8 + uTerrainSharpness * 1.1));
  float latitude = abs(unit.y);
  vec3 baseColor;
  float emissiveMask = 0.0;
  float cloudMask = 0.0;
  float gloss = 0.0;

  if (uBiome < 0.5) {
    float ridgeMask = smoothBand(ridges, 0.7 - uTerrainSharpness * 0.08, 0.95);
    baseColor = mix(uPrimaryColor, uSecondaryColor, smoothBand(macro, 0.24, 0.78));
    baseColor = mix(baseColor, uDetailColor, ridgeMask * 0.24);
  } else if (uBiome < 1.5) {
    float dunes = 0.5 + sin(unit.y * (4.5 + uBanding * 7.0) + detail * 2.8) * 0.5;
    float plateauMask = smoothBand(ridges, 0.74 - uTerrainSharpness * 0.06, 0.96);
    baseColor = mix(uPrimaryColor, uSecondaryColor, smoothBand(dunes + macro * 0.16, 0.26, 0.84));
    baseColor = mix(baseColor, uDetailColor, plateauMask * 0.18);
  } else if (uBiome < 2.5) {
    float oceanMask = smoothBand(macro, uOceanLevel - 0.08, uOceanLevel + 0.05);
    float coastMask = smoothBand(macro, uOceanLevel - 0.02, uOceanLevel + 0.02) - smoothBand(macro, uOceanLevel + 0.04, uOceanLevel + 0.08);
    float mountainMask = smoothBand(ridges, 0.66 - uTerrainSharpness * 0.08, 0.9);
    vec3 ocean = mix(uPrimaryColor * 0.72, uPrimaryColor, 0.28);
    vec3 land = mix(uSecondaryColor, uDetailColor, smoothBand(humidity + uVariant * 0.03, 0.38, 0.82));
    baseColor = mix(ocean, land, oceanMask);
    baseColor = mix(baseColor, vec3(0.84, 0.78, 0.62), coastMask * 0.32);
    baseColor = mix(baseColor, vec3(0.78, 0.8, 0.8), mountainMask * 0.14);
    cloudMask = smoothBand(humidity, 0.66, 0.92) * uCloudDensity;
    gloss = 0.24 * (1.0 - oceanMask);
  } else if (uBiome < 3.5) {
    float fractureMask = smoothBand(ridges + detail * 0.14, 0.76, 0.96);
    float polarMask = smoothBand(latitude, 1.0 - uPolarCapAmount, 1.0);
    baseColor = mix(uPrimaryColor, uSecondaryColor, smoothBand(macro + detail * 0.08, 0.28, 0.8));
    baseColor = mix(baseColor, vec3(0.96, 0.98, 1.0), polarMask * 0.82 + fractureMask * 0.08);
    cloudMask = smoothBand(humidity, 0.76, 0.92) * uCloudDensity * 0.3;
    gloss = 0.18;
  } else if (uBiome < 4.5) {
    float warmRockMask = smoothBand(macro + detail * 0.05, 0.48, 0.78);
    float fissureField = ridges * 0.82 + detail * 0.16 + (1.0 - macro) * 0.12;
    emissiveMask = smoothBand(fissureField, 0.93, 0.985);
    baseColor = mix(vec3(0.08, 0.07, 0.07), uPrimaryColor * 0.58, smoothBand(macro, 0.4, 0.82));
    baseColor = mix(baseColor, uSecondaryColor * 0.7, warmRockMask * 0.16);
    baseColor = mix(baseColor, mix(uSecondaryColor, uDetailColor, 0.24), emissiveMask * 0.7);
    gloss = 0.06;
  } else {
    float broadBand = 0.5 + sin(unit.y * (4.0 + uBanding * 6.5) + detail * 1.6) * 0.5;
    float fineBand = 0.5 + sin(unit.y * (8.5 + uBanding * 10.0 + uVariant) + detail * 2.8) * 0.5;
    float stormMask = smoothBand(detail, 0.82, 0.95);
    baseColor = mix(uPrimaryColor, uSecondaryColor, smoothBand(broadBand, 0.18, 0.84));
    baseColor = mix(baseColor, uDetailColor, smoothBand(fineBand, 0.42, 0.9) * 0.12 + stormMask * 0.05);
    gloss = 0.08;
  }

  vec3 normal = normalize(vWorldNormal);
  vec3 lightDir = normalize(uLightDirection);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float lambert = dot(normal, lightDir);
  float wrappedDiffuse = clamp((lambert + 0.72) / 1.72, 0.0, 1.0);
  float ambient = 0.34;
  float nightFill = 0.3;
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.8) * 0.04;
  float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 14.0) * (uSpecularStrength + gloss);

  vec3 shadowColor = mix(baseColor * 0.7, baseColor * 0.94 + uAtmosphereColor * 0.16, 0.62);
  vec3 surfaceColor = mix(shadowColor, baseColor, wrappedDiffuse);
  vec3 litColor = surfaceColor * (ambient + nightFill + wrappedDiffuse * 0.42) + vec3(specular + rim);

  if (uHasEmissive > 0.5) {
    litColor += uEmissiveColor * emissiveMask * 0.28;
  }

  if (cloudMask > 0.0) {
    vec3 cloudColor = mix(vec3(1.0), uAtmosphereColor, 0.18);
    litColor = mix(litColor, cloudColor, cloudMask * 0.28);
  }

  gl_FragColor = vec4(litColor, 1.0);
}
`;

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
uniform vec3 uLightDirection;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 lightDir = normalize(uLightDirection);
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.6);
  float lightMix = 0.4 + max(dot(normal, lightDir), 0.0) * 0.6;
  float alpha = rim * uOpacity * lightMix;
  gl_FragColor = vec4(uAtmosphereColor, alpha);
}
`;

function getPlanetGeometry(radius: number): SphereGeometry {
  const segments = radius >= 46 ? 72 : radius >= 28 ? 56 : 44;
  const cached = geometryCache.get(segments);

  if (cached !== undefined) {
    return cached;
  }

  const geometry = new SphereGeometry(1, segments, segments);
  geometryCache.set(segments, geometry);
  return geometry;
}

function createAtmosphereMaterial(surface: PlanetSurfaceStyle, lightDirection: [number, number, number]): ShaderMaterial | null {
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
      uLightDirection: { value: lightDirection },
      uOpacity: { value: surface.atmosphereOpacity * 0.82 },
    },
    vertexShader: atmosphereVertexShader,
  });
}

function biomeToNumber(surface: PlanetSurfaceStyle): number {
  switch (surface.biome) {
    case 'desert':
      return 1;
    case 'lush':
      return 2;
    case 'ice':
      return 3;
    case 'lava':
      return 4;
    case 'gas':
      return 5;
    case 'rocky':
    default:
      return 0;
  }
}

function getDisplacementStrength(surface: PlanetSurfaceStyle): number {
  switch (surface.biome) {
    case 'gas':
      return 0.02;
    case 'lava':
      return 0.04;
    case 'ice':
      return 0.045;
    case 'desert':
      return 0.04;
    case 'lush':
      return 0.048;
    case 'rocky':
    default:
      return 0.055;
  }
}

function createPlanetMaterial(surface: PlanetSurfaceStyle, lightDirection: [number, number, number]): ShaderMaterial {
  return new ShaderMaterial({
    fragmentShader: planetFragmentShader,
    uniforms: {
      uAtmosphereColor: { value: new Color(surface.atmosphereColor ?? '#a8c5ff') },
      uBanding: { value: surface.banding },
      uBiome: { value: biomeToNumber(surface) },
      uCloudDensity: { value: surface.cloudDensity },
      uDetailColor: { value: new Color(surface.detailColor) },
      uDisplacementStrength: { value: getDisplacementStrength(surface) },
      uEmissiveColor: { value: new Color(surface.emissiveColor ?? '#000000') },
      uHasEmissive: { value: surface.emissiveColor === null ? 0 : 1 },
      uOceanLevel: { value: surface.oceanLevel },
      uPolarCapAmount: { value: surface.polarCapAmount },
      uPrimaryColor: { value: new Color(surface.primaryColor) },
      uLightDirection: { value: lightDirection },
      uSecondaryColor: { value: new Color(surface.secondaryColor) },
      uSeed: { value: surface.seed },
      uSpecularStrength: { value: surface.specularStrength },
      uTerrainSharpness: { value: surface.terrainSharpness },
      uTextureScale: { value: surface.textureScale },
      uVariant: { value: surface.variant },
      uWarpAmount: { value: surface.warpAmount },
    },
    vertexShader: planetVertexShader,
  });
}

function getSpinSpeed(seed: number): number {
  const direction = seed % 2 === 0 ? 1 : -1;
  return direction * (0.015 + (seed % 7) * 0.0025);
}

interface PlanetBodyProps {
  planet: PlanetDescriptor;
}

function getLocalLightDirection(planet: PlanetDescriptor): [number, number, number] {
  const x = -planet.position.x;
  const y = -planet.position.y;
  const z = -planet.position.z;
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

export const PlanetBody = memo(function PlanetBody({ planet }: PlanetBodyProps): ReactElement {
  const geometry = useMemo(() => getPlanetGeometry(planet.radius), [planet.radius]);
  const lightDirection = useMemo(() => getLocalLightDirection(planet), [planet]);
  const material = useMemo(() => createPlanetMaterial(planet.surface, lightDirection), [lightDirection, planet.surface]);
  const atmosphereMaterial = useMemo(() => createAtmosphereMaterial(planet.surface, lightDirection), [lightDirection, planet.surface]);
  const surfaceGroupRef = useRef<Group>(null);
  const spinSpeed = useMemo(() => getSpinSpeed(planet.surface.seed), [planet.surface.seed]);

  useFrame((_, delta) => {
    if (surfaceGroupRef.current !== null) {
      surfaceGroupRef.current.rotation.y += spinSpeed * delta;
    }
  });

  useEffect(() => {
    return () => {
      material.dispose();
      atmosphereMaterial?.dispose();
    };
  }, [atmosphereMaterial, material]);

  return (
    <group position={[planet.position.x, planet.position.y, planet.position.z]}>
      <group ref={surfaceGroupRef}>
        <mesh geometry={geometry} material={material} scale={planet.radius} />
      </group>

      {atmosphereMaterial !== null ? (
        <mesh geometry={geometry} material={atmosphereMaterial} scale={planet.radius * planet.surface.atmosphereScale} />
      ) : null}
    </group>
  );
});
