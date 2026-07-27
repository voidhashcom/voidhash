"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { VoidhashGradientSettings } from "./voidhash-gradient-settings";

const vertexShader = `
uniform float uTime;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uMidFrequency;
uniform float uHighFrequency;
uniform float uLift;
uniform float uSeed;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying float vWave;

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x * 34.0) + 10.0) * x);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
  const vec2 c = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 d = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, c.yyy));
  vec3 x0 = v - i + dot(i, c.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + c.xxx;
  vec3 x2 = x0 - i2 + c.yyy;
  vec3 x3 = x0 - d.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * d.wyz - d.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(
    dot(p0, p0),
    dot(p1, p1),
    dot(p2, p2),
    dot(p3, p3)
  ));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(
    dot(x0, x0),
    dot(x1, x1),
    dot(x2, x2),
    dot(x3, x3)
  ), 0.0);
  m = m * m;

  return 42.0 * dot(m * m, vec4(
    dot(p0, x0),
    dot(p1, x1),
    dot(p2, x2),
    dot(p3, x3)
  ));
}

float surfaceHeight(vec2 p, float time) {
  vec2 seedOffset = vec2(uSeed * 1.37, uSeed * -0.73);
  vec2 q = vec2(p.x * uFrequency, p.y * uFrequency * 2.55) + seedOffset;
  float seedTime = time + uSeed * 0.11;
  float low = snoise(vec3(q, seedTime));
  float mid = snoise(vec3(q * uMidFrequency + vec2(7.4, -3.2) + seedOffset * 0.43, seedTime * 1.65));
  float high = snoise(vec3(q * uHighFrequency + vec2(-2.0, 5.7) - seedOffset * 0.26, seedTime * 2.4));

  return (low * 0.62 + mid * 0.28 + high * 0.1) * uAmplitude;
}

void main() {
  vUv = uv;

  float lift = smoothstep(0.02, 0.92, uv.y);
  float height = surfaceHeight(position.xy, uTime) * (0.72 + lift * 0.62);
  float epsilon = 0.08;
  float heightX = surfaceHeight(position.xy + vec2(epsilon, 0.0), uTime);
  float heightY = surfaceHeight(position.xy + vec2(0.0, epsilon), uTime);

  vec3 displaced = position;
  displaced.y += lift * uLift;
  displaced.z += height;

  vec3 displacedNormal = normalize(vec3(
    (height - heightX) / epsilon,
    (height - heightY) / epsilon,
    1.0
  ));

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);

  vNormal = normalize(normalMatrix * displacedNormal);
  vViewPosition = -mvPosition.xyz;
  vWave = height;

  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
uniform vec3 uBaseColor;
uniform vec3 uFresnelColor;
uniform float uFresnelPower;
uniform float uFresnelStrength;
uniform float uHorizonStrength;
uniform float uLateralStrength;
uniform float uIntensity;
uniform float uBaseGlow;
uniform float uOpacity;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying float vWave;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(vViewPosition);
  float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), uFresnelPower);
  float horizon = smoothstep(0.18, 0.94, vUv.y);
  float lateralFresnel = smoothstep(0.18, 1.0, vUv.x);
  float blue = clamp(
    fresnel * uFresnelStrength
      + horizon * uHorizonStrength
      + lateralFresnel * uLateralStrength
      + vWave * 0.08,
    0.0,
    1.0
  );
  float alpha = smoothstep(0.0, 0.1, vUv.y) * (1.0 - smoothstep(0.8, 1.0, vUv.y));
  float intensity = clamp(uIntensity + fresnel * 0.28 + horizon * 0.12, 0.0, 1.0);
  float purpleBalance = clamp(uBaseGlow, 0.0, 1.5);
  vec3 color = mix(uBaseColor, uFresnelColor, blue) * intensity;
  color = mix(color, uBaseColor * intensity, min(purpleBalance, 1.0));
  color = min(color, max(uBaseColor, uFresnelColor));

  gl_FragColor = vec4(color, alpha * uOpacity);
}
`;

function setUniformColor(color: THREE.Color, hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);

  color.r = ((value >> 16) & 255) / 255;
  color.g = ((value >> 8) & 255) / 255;
  color.b = (value & 255) / 255;
}

function AnimatedPlane({
  inverted,
  onReady,
  seed,
  settings,
}: {
  inverted: boolean;
  onReady?: () => void;
  seed: number;
  settings: VoidhashGradientSettings;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const didReportReadyRef = useRef(false);
  const isMountedRef = useRef(true);
  const uniforms = useMemo(() => {
    const baseColor = new THREE.Color();
    const fresnelColor = new THREE.Color();

    setUniformColor(baseColor, settings.baseColor);
    setUniformColor(fresnelColor, settings.fresnelColor);

    return {
      uBaseColor: { value: baseColor },
      uFresnelColor: { value: fresnelColor },
      uAmplitude: { value: settings.amplitude },
      uBaseGlow: { value: settings.baseGlow },
      uFresnelPower: { value: settings.fresnelPower },
      uFresnelStrength: { value: settings.fresnelStrength },
      uFrequency: { value: settings.frequency },
      uHighFrequency: { value: settings.highFrequency },
      uHorizonStrength: { value: settings.horizonStrength },
      uIntensity: { value: settings.intensity },
      uLateralStrength: { value: settings.lateralStrength },
      uLift: { value: settings.lift },
      uMidFrequency: { value: settings.midFrequency },
      uOpacity: { value: settings.opacity },
      uSeed: { value: seed },
      uTime: { value: 0 },
    };
  }, [seed, settings]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    uniforms.uAmplitude.value = settings.amplitude;
    setUniformColor(uniforms.uBaseColor.value, settings.baseColor);
    uniforms.uBaseGlow.value = settings.baseGlow;
    setUniformColor(uniforms.uFresnelColor.value, settings.fresnelColor);
    uniforms.uFresnelPower.value = settings.fresnelPower;
    uniforms.uFresnelStrength.value = settings.fresnelStrength;
    uniforms.uFrequency.value = settings.frequency;
    uniforms.uHighFrequency.value = settings.highFrequency;
    uniforms.uHorizonStrength.value = settings.horizonStrength;
    uniforms.uIntensity.value = settings.intensity;
    uniforms.uLateralStrength.value = settings.lateralStrength;
    uniforms.uLift.value = settings.lift;
    uniforms.uMidFrequency.value = settings.midFrequency;
    uniforms.uOpacity.value = settings.opacity;
    uniforms.uSeed.value = seed;
  }, [seed, settings, uniforms]);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime * settings.speed;
    }

    if (!didReportReadyRef.current) {
      didReportReadyRef.current = true;
      requestAnimationFrame(() => {
        if (isMountedRef.current) {
          onReady?.();
        }
      });
    }
  });

  return (
    <group scale={[1, inverted ? -1 : 1, 1]}>
      <mesh position={[0, settings.planeY, 0]} rotation={[settings.rotationX, 0, 0]} scale={[settings.scaleX, settings.scaleY, 1]}>
        <planeGeometry args={[14, 6.4, 180, 90]} />
        <shaderMaterial
          ref={materialRef}
          blending={THREE.NormalBlending}
          depthWrite={false}
          fragmentShader={fragmentShader}
          side={THREE.DoubleSide}
          transparent
          uniforms={uniforms}
          vertexShader={vertexShader}
        />
      </mesh>
    </group>
  );
}

/** Renders the WebGL plane used by reusable Voidhash gradient backgrounds. */
export function VoidhashGradientCanvas({
  inverted = false,
  onReady,
  seed,
  settings,
}: {
  inverted?: boolean;
  onReady?: () => void;
  seed: number;
  settings: VoidhashGradientSettings;
}) {
  return (
    <Canvas
      camera={{ fov: 34, position: [0, 0, 6] }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <AnimatedPlane inverted={inverted} onReady={onReady} seed={seed} settings={settings} />
    </Canvas>
  );
}
