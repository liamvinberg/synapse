import { memo, useEffect, useMemo, type ReactElement } from 'react';
import { AdditiveBlending, BackSide, Color, ShaderMaterial, SphereGeometry } from 'three';
import type { PlanetDescriptor, PlanetSurfaceStyle } from '@/game/sim/types';

const geometryCache = new Map<number, SphereGeometry>();

const planetVertexShader = /* glsl */ `
varying vec3 vLocalPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vLocalPosition = normalize(position);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const planetFragmentShader = /* glsl */ `
uniform vec3 uPrimaryColor;
uniform vec3 uSecondaryColor;
uniform vec3 uDetailColor;
uniform vec3 uEmissiveColor;
uniform float uBanding;
uniform float uBiome;
uniform float uCraterDensity;
uniform float uHasEmissive;
uniform float uOceanLevel;
uniform float uPolarCapAmount;
uniform float uSeed;
uniform float uSpecularStrength;
uniform float uTerrainSharpness;
uniform float uTextureScale;
uniform float uVariant;
uniform float uWarpAmount;

varying vec3 vLocalPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

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

  for (int index = 0; index < 5; index += 1) {
    value += noise3(p * frequency) * amplitude;
    frequency *= 2.0;
    amplitude *= 0.5;
  }

  return value;
}

float turbulence(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int index = 0; index < 4; index += 1) {
    value += abs(noise3(p * frequency) * 2.0 - 1.0) * amplitude;
    frequency *= 2.0;
    amplitude *= 0.5;
  }

  return value;
}

float ridge(vec3 p) {
  float value = 1.0 - abs(noise3(p) * 2.0 - 1.0);
  return value * value;
}

vec3 getRockyColor(float plains, float detailNoise, float ridges, float craterMask, float latitude) {
  vec3 base = mix(uPrimaryColor * 0.72, uSecondaryColor, smoothstep(0.24, 0.78, plains));
  base = mix(base, uDetailColor, smoothstep(0.64 - uTerrainSharpness * 0.1, 0.94, ridges) * 0.42);
  base = mix(base, base * 0.84, craterMask * (0.16 + uCraterDensity * 0.14));
  if (uVariant > 1.5) {
    base = mix(base, vec3(0.82, 0.78, 0.72), smoothstep(0.7, 0.92, latitude) * 0.1);
  }
  return base;
}

vec3 getDesertColor(vec3 sphere, float plains, float detailNoise, float ridges, float latitude) {
  float dunes = 0.5 + sin(sphere.y * (5.5 + uBanding * 10.0 + uVariant * 0.9) + detailNoise * 3.6) * 0.5;
  vec3 base = mix(uPrimaryColor, uSecondaryColor, smoothstep(0.24, 0.82, dunes + plains * 0.18));
  base = mix(base, uDetailColor, smoothstep(0.7 - uTerrainSharpness * 0.08, 0.96, ridges) * 0.34);
  return mix(base, vec3(0.87, 0.8, 0.64), smoothstep(0.74, 0.94, latitude) * 0.08);
}

vec3 getLushColor(float continents, float humidity, float ridges) {
  float oceanMask = smoothstep(uOceanLevel - 0.08, uOceanLevel + 0.06, continents);
  vec3 ocean = mix(uPrimaryColor * 0.64, uPrimaryColor, 0.35);
  vec3 land = mix(uSecondaryColor, uDetailColor, smoothstep(0.38, 0.8, humidity + uVariant * 0.03));
  vec3 color = mix(ocean, land, oceanMask);
  float coastMask = smoothstep(uOceanLevel - 0.02, uOceanLevel + 0.03, continents) - smoothstep(uOceanLevel + 0.03, uOceanLevel + 0.08, continents);
  color = mix(color, vec3(0.84, 0.78, 0.6), coastMask * 0.36);
  float mountainMask = smoothstep(0.64 - uTerrainSharpness * 0.08, 0.9, ridges);
  return mix(color, vec3(0.74, 0.76, 0.74), mountainMask * 0.24);
}

vec3 getIceColor(float continents, float detailNoise, float ridges, float latitude) {
  vec3 base = mix(uPrimaryColor, uSecondaryColor, smoothstep(0.28, 0.78, continents + detailNoise * 0.12));
  base = mix(base, vec3(0.95, 0.98, 1.0), smoothstep(0.68, 0.95, ridges + latitude * 0.18) * 0.2);
  return base;
}

vec3 getLavaColor(float plains, float detailNoise, float ridges, float turbulenceNoise, out float fissureMask) {
  vec3 basalt = mix(vec3(0.06, 0.05, 0.05), uPrimaryColor * 0.42, smoothstep(0.38, 0.8, plains));
  float warmRockMask = smoothstep(0.48, 0.78, plains + detailNoise * 0.08);
  basalt = mix(basalt, uSecondaryColor * 0.7, warmRockMask * 0.22);

  float fissureField = ridges * 0.82 + turbulenceNoise * 0.28 + (1.0 - plains) * 0.16;
  float primaryFissures = smoothstep(0.9, 0.965, fissureField);
  float secondaryFissures = smoothstep(0.945, 0.985, ridges + turbulenceNoise * 0.18);
  fissureMask = clamp(primaryFissures * 0.7 + secondaryFissures * 0.85, 0.0, 1.0);

  vec3 molten = mix(uSecondaryColor, uDetailColor, 0.35);
  return mix(basalt, molten, fissureMask);
}

vec3 getGasColor(vec3 sphere, float detailNoise, float stormNoise) {
  float broadBand = 0.5 + sin(sphere.y * (5.0 + uBanding * 10.0) + detailNoise * 2.0) * 0.5;
  float fineBand = 0.5 + sin(sphere.y * (13.0 + uBanding * 18.0 + uVariant) + detailNoise * 4.0) * 0.5;
  vec3 base = mix(uPrimaryColor, uSecondaryColor, smoothstep(0.18, 0.82, broadBand));
  base = mix(base, uDetailColor, smoothstep(0.38, 0.92, fineBand) * 0.22);
  float storm = smoothstep(0.82, 0.95, stormNoise);
  return mix(base, mix(uSecondaryColor, uDetailColor, 0.35), storm * 0.24);
}

void main() {
  vec3 sphere = normalize(vLocalPosition);
  vec3 seedOffset = vec3(uSeed * 0.0000017, uSeed * 0.0000011, uSeed * 0.0000013);
  vec3 samplePoint = sphere * uTextureScale + seedOffset;
  vec3 warpedPoint = samplePoint + vec3(
    fbm(samplePoint + 3.7),
    fbm(samplePoint + 7.1),
    fbm(samplePoint + 11.4)
  ) * uWarpAmount;
  float continents = fbm(warpedPoint * 0.72);
  float detailNoise = fbm((warpedPoint + 3.7) * (1.3 + uVariant * 0.22));
  float humidity = fbm((warpedPoint - 6.3) * 1.4);
  float ridges = ridge((warpedPoint + 9.1) * (2.2 + uTerrainSharpness * 1.6));
  float turbulenceNoise = turbulence((warpedPoint - 4.2) * (1.8 + uVariant * 0.25));
  float craterMask = smoothstep(1.0 - uCraterDensity * 0.55, 1.0, fbm((samplePoint + 12.5) * 4.5));
  float latitude = abs(sphere.y);
  float emissiveMask = 0.0;

  vec3 surfaceColor;
  if (uBiome < 0.5) {
    surfaceColor = getRockyColor(continents, detailNoise, ridges, craterMask, latitude);
  } else if (uBiome < 1.5) {
    surfaceColor = getDesertColor(sphere, continents, detailNoise, ridges, latitude);
  } else if (uBiome < 2.5) {
    surfaceColor = getLushColor(continents, humidity, ridges);
  } else if (uBiome < 3.5) {
    surfaceColor = getIceColor(continents, turbulenceNoise, ridges, latitude);
  } else if (uBiome < 4.5) {
    surfaceColor = getLavaColor(continents, detailNoise, ridges, turbulenceNoise, emissiveMask);
  } else {
    surfaceColor = getGasColor(sphere, detailNoise, turbulenceNoise);
  }

  if (uPolarCapAmount > 0.0) {
    float capMask = smoothstep(1.0 - uPolarCapAmount, 1.0, abs(sphere.y));
    surfaceColor = mix(surfaceColor, vec3(0.94, 0.97, 1.0), capMask * 0.8);
  }

  vec3 normal = normalize(vWorldNormal);
  vec3 lightDir = normalize(-vWorldPosition);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float diffuse = max(dot(normal, lightDir), 0.0);
  float ambient = 0.24;
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.8) * 0.04;
  float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 14.0) * uSpecularStrength;

  vec3 litColor = surfaceColor * (ambient + diffuse * 0.82) + vec3(specular + rim);
  litColor += uEmissiveColor * uHasEmissive * emissiveMask * 0.24;

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

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 lightDir = normalize(-vWorldPosition);
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.6);
  float lightMix = 0.35 + max(dot(normal, lightDir), 0.0) * 0.65;
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

function createPlanetMaterial(planet: PlanetDescriptor): ShaderMaterial {
  const surface = planet.surface;
  const emissiveColor = new Color(surface.emissiveColor ?? '#000000');

  return new ShaderMaterial({
    fragmentShader: planetFragmentShader,
    uniforms: {
      uBanding: { value: surface.banding },
      uBiome: { value: biomeToNumber(surface) },
      uCraterDensity: { value: surface.craterDensity },
      uDetailColor: { value: new Color(surface.detailColor) },
      uEmissiveColor: { value: emissiveColor },
      uHasEmissive: { value: surface.emissiveColor === null ? 0 : 1 },
      uOceanLevel: { value: surface.oceanLevel },
      uPolarCapAmount: { value: surface.polarCapAmount },
      uPrimaryColor: { value: new Color(surface.primaryColor) },
      uSeed: { value: surface.seed },
      uSecondaryColor: { value: new Color(surface.secondaryColor) },
      uSpecularStrength: { value: surface.specularStrength },
      uTerrainSharpness: { value: surface.terrainSharpness },
      uTextureScale: { value: surface.textureScale },
      uVariant: { value: surface.variant },
      uWarpAmount: { value: surface.warpAmount },
    },
    vertexShader: planetVertexShader,
  });
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
      uOpacity: { value: surface.atmosphereOpacity * 0.8 },
    },
    vertexShader: atmosphereVertexShader,
  });
}

interface PlanetBodyProps {
  planet: PlanetDescriptor;
}

export const PlanetBody = memo(function PlanetBody({ planet }: PlanetBodyProps): ReactElement {
  const geometry = useMemo(() => getPlanetGeometry(planet.radius), [planet.radius]);
  const material = useMemo(() => createPlanetMaterial(planet), [planet]);
  const atmosphereMaterial = useMemo(() => createAtmosphereMaterial(planet.surface), [planet.surface]);

  useEffect(() => {
    return () => {
      material.dispose();
      atmosphereMaterial?.dispose();
    };
  }, [atmosphereMaterial, material]);

  return (
    <group position={[planet.position.x, planet.position.y, planet.position.z]}>
      <mesh geometry={geometry} material={material} scale={planet.radius} />
      {atmosphereMaterial !== null ? (
        <mesh geometry={geometry} material={atmosphereMaterial} scale={planet.radius * planet.surface.atmosphereScale} />
      ) : null}
    </group>
  );
});
