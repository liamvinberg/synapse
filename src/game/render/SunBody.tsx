import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, ShaderMaterial, type Mesh } from 'three';
import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { worldScaleTuning } from '@/game/config/tuning';
import { useInterpolatedShipState } from '@/game/render/useInterpolatedShipState';
import { getSolarExposure } from '@/game/sim/solarSystem';

const sunVertexShader = /* glsl */ `
varying vec3 vLocalPosition;

void main() {
  vLocalPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const sunFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uCoreColor;
uniform vec3 uEdgeColor;

varying vec3 vLocalPosition;

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

  for (int i = 0; i < 5; i += 1) {
    value += noise3(p * frequency) * amplitude;
    frequency *= 2.0;
    amplitude *= 0.5;
  }

  return value;
}

void main() {
  vec3 sphere = normalize(vLocalPosition);
  float plasma = fbm(sphere * 2.6 + vec3(uTime * 0.18, -uTime * 0.08, uTime * 0.14));
  float turbulence = fbm(sphere * 5.2 + vec3(-uTime * 0.27, uTime * 0.12, uTime * 0.21));
  float edge = pow(1.0 - max(dot(sphere, vec3(0.0, 0.0, 1.0)), 0.0), 1.7);
  vec3 color = mix(uEdgeColor, uCoreColor, smoothstep(0.18, 0.86, plasma + turbulence * 0.18));
  color += uCoreColor * edge * 0.18;
  gl_FragColor = vec4(color, 1.0);
}
`;

const coronaFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;

varying vec3 vLocalPosition;

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

void main() {
  vec3 sphere = normalize(vLocalPosition);
  float pulse = 0.88 + sin(uTime * 0.8) * 0.04;
  float rim = pow(1.0 - abs(sphere.z), 3.6);
  float breakup = noise3(sphere * 4.2 + vec3(uTime * 0.15, -uTime * 0.09, uTime * 0.11));
  float alpha = rim * smoothstep(0.22, 0.88, breakup + 0.28) * uOpacity * pulse;
  gl_FragColor = vec4(uColor, alpha);
}
`;

function createSunMaterial(coreColor: string, edgeColor: string): ShaderMaterial {
  return new ShaderMaterial({
    fragmentShader: sunFragmentShader,
    toneMapped: false,
    uniforms: {
      uCoreColor: { value: new Color(coreColor) },
      uEdgeColor: { value: new Color(edgeColor) },
      uTime: { value: 0 },
    },
    vertexShader: sunVertexShader,
  });
}

function createCoronaMaterial(color: string, opacity: number): ShaderMaterial {
  return new ShaderMaterial({
    blending: AdditiveBlending,
    fragmentShader: coronaFragmentShader,
    toneMapped: false,
    transparent: true,
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
    },
    vertexShader: sunVertexShader,
  });
}

export function SunBody({ starColor }: { starColor: string }): ReactElement {
  const shipState = useInterpolatedShipState();
  const exposure = getSolarExposure(shipState.position);
  const innerCoronaScale = 1.28 + exposure * 0.08;
  const outerCoronaScale = 1.7 + exposure * 0.2;
  const coreMaterial = useMemo(() => createSunMaterial('#fff8dc', starColor), [starColor]);
  const innerCoronaMaterial = useMemo(() => createCoronaMaterial('#ffd89b', 0.38), []);
  const outerCoronaMaterial = useMemo(() => createCoronaMaterial(starColor, 0.18), [starColor]);
  const coreRef = useRef<Mesh>(null);
  const innerCoronaRef = useRef<Mesh>(null);
  const outerCoronaRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    const timeAdvance = delta;
    coreMaterial.uniforms.uTime.value += timeAdvance;
    innerCoronaMaterial.uniforms.uTime.value += timeAdvance;
    outerCoronaMaterial.uniforms.uTime.value += timeAdvance;
    outerCoronaMaterial.uniforms.uOpacity.value = 0.18 + exposure * 0.18;

    if (coreRef.current !== null) {
      coreRef.current.rotation.y += 0.03 * delta;
      coreRef.current.rotation.x += 0.01 * delta;
    }
    if (innerCoronaRef.current !== null) {
      innerCoronaRef.current.rotation.y -= 0.02 * delta;
    }
    if (outerCoronaRef.current !== null) {
      outerCoronaRef.current.rotation.y += 0.014 * delta;
    }
  });

  useEffect(() => {
    return () => {
      coreMaterial.dispose();
      innerCoronaMaterial.dispose();
      outerCoronaMaterial.dispose();
    };
  }, [coreMaterial, innerCoronaMaterial, outerCoronaMaterial]);

  return (
    <group>
      <pointLight color={starColor} decay={1} distance={3200} intensity={5200} />
      <mesh ref={outerCoronaRef} scale={worldScaleTuning.starRadius * outerCoronaScale} material={outerCoronaMaterial}>
        <sphereGeometry args={[1, 36, 36]} />
      </mesh>
      <mesh ref={innerCoronaRef} scale={worldScaleTuning.starRadius * innerCoronaScale} material={innerCoronaMaterial}>
        <sphereGeometry args={[1, 40, 40]} />
      </mesh>
      <mesh ref={coreRef} scale={worldScaleTuning.starRadius} material={coreMaterial}>
        <sphereGeometry args={[1, 56, 56]} />
      </mesh>
      <mesh scale={worldScaleTuning.starRadius * 1.08}>
        <sphereGeometry args={[1, 44, 44]} />
        <meshBasicMaterial color={starColor} opacity={0.16 + exposure * 0.12} toneMapped={false} transparent />
      </mesh>
    </group>
  );
}
