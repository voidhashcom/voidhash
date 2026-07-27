"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const SVG_WIDTH = 1654;
const SVG_HEIGHT = 1053;
const DEFAULT_ANGLE_DEGREES = 45.08;
const DEFAULT_CENTER_X = 0.5;
const DEFAULT_CENTER_Y = 0.6386;
const DEFAULT_PERIOD_RATIO = 0.0394;
const DEFAULT_STRENGTH = -100;

/** Seconds the gradient takes to fade up from the page background once the first frame is drawn. */
const REVEAL_SECONDS = 1.5;

/** How far the slats are magnified at the start of the reveal before settling back to 1. */
const REVEAL_SETTLE = 0.045;

/** The landing page's own background, so the hero reads as part of the page rather than a black box. */
const BACKGROUND_HEX = 0x09090b;

const vertexShader = `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = `
uniform vec2 uResolution;
uniform float uAngle;
uniform vec2 uCenter;
uniform float uPeriodRatio;
uniform float uStrength;
uniform float uTime;
uniform float uReveal;
uniform float uSettle;
uniform float uUsePerlinSource;

const vec2 SVG_SIZE = vec2(${SVG_WIDTH.toFixed(1)}, ${SVG_HEIGHT.toFixed(1)});
const float SVG_BLUR = 83.45;

// Written straight out as sRGB — this material bypasses three's colour-space conversion, which is
// why the gradient's own stops are authored as plain sRGB fractions too.
const vec3 BACKGROUND = vec3(
  ${(((BACKGROUND_HEX >> 16) & 0xff) / 255).toFixed(4)},
  ${(((BACKGROUND_HEX >> 8) & 0xff) / 255).toFixed(4)},
  ${((BACKGROUND_HEX & 0xff) / 255).toFixed(4)}
);

float ellipseMask(vec2 point, vec2 center, vec2 radius) {
  float normalizedDistance = length((point - center) / radius);
  float signedDistance = (normalizedDistance - 1.0) * min(radius.x, radius.y);

  return 1.0 - smoothstep(0.0, SVG_BLUR * 2.0, signedDistance);
}

vec3 composite(vec3 base, vec3 layer, float alpha) {
  return layer * alpha + base * (1.0 - alpha);
}

float insideView(vec2 uv) {
  return step(0.0, uv.x) * step(0.0, uv.y) * step(uv.x, 1.0) * step(uv.y, 1.0);
}

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
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;

  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float perlinSurface(vec2 uv, float time) {
  vec2 p = (uv - 0.5) * vec2(3.4, 5.2);
  float low = snoise(vec3(p * 0.19, time * 0.072));
  float mid = snoise(vec3(p * 0.8 + vec2(7.4, -3.2), time * 0.1188));
  float high = snoise(vec3(p * 1.5 + vec2(-2.0, 5.7), time * 0.1728));

  return (low * 0.62 + mid * 0.28 + high * 0.1) * 1.42;
}

vec3 sampleGradient(vec2 screenUv, vec2 resolution, vec2 drift) {
  vec2 perlinWarp = vec2(0.0);

  if (uUsePerlinSource > 0.5) {
    float epsilon = 0.012;
    float height = perlinSurface(screenUv, uTime);
    vec2 slope = vec2(
      perlinSurface(screenUv + vec2(epsilon, 0.0), uTime) - height,
      perlinSurface(screenUv + vec2(0.0, epsilon), uTime) - height
    ) / epsilon;
    perlinWarp = slope * vec2(0.012, 0.008) + height * vec2(0.006, -0.004);
  }

  float canvasAspect = resolution.x / resolution.y;
  float svgAspect = SVG_SIZE.x / SVG_SIZE.y;
  vec2 viewSize = canvasAspect > svgAspect
    ? vec2(SVG_SIZE.x, SVG_SIZE.x / canvasAspect)
    : vec2(SVG_SIZE.y * canvasAspect, SVG_SIZE.y);
  // Drift is applied here, in the gradient's own coordinate space, so it moves the image behind
  // the slats without touching insideView() below — offsetting screenUv instead would push samples
  // outside [0,1] and paint a black sliver along the edges.
  vec2 svgPoint = (screenUv - 0.5 + perlinWarp) * viewSize + SVG_SIZE * 0.5 + drift;

  vec3 color = vec3(0.035, 0.451, 1.0);

  color = composite(
    color,
    vec3(0.118, 0.576, 1.0),
    ellipseMask(svgPoint, vec2(827.0, 200.5), vec2(1674.0, 1674.5))
  );
  color = composite(
    color,
    vec3(0.024, 0.451, 1.0),
    ellipseMask(svgPoint, vec2(827.0, 200.5), vec2(1271.0, 1270.5))
  );
  color = composite(
    color,
    vec3(0.439, 0.0, 0.941),
    ellipseMask(svgPoint, vec2(739.5, -116.499), vec2(1248.5, 1248.5))
  );
  color = composite(
    color,
    BACKGROUND,
    ellipseMask(svgPoint, vec2(820.5, -380.0), vec2(1374.5, 1375.0))
  );

  return mix(BACKGROUND, color, insideView(screenUv));
}

void main() {
  vec2 resolution = max(uResolution, vec2(1.0));
  vec2 screenUv = vec2(
    gl_FragCoord.x / resolution.x,
    1.0 - gl_FragCoord.y / resolution.y
  );

  // The slats pull back into place over the reveal and are then pinned for good: past uReveal = 1
  // this collapses to a no-op, so the lattice never drifts while the page is just sitting there.
  float settle = 1.0 + uSettle * (1.0 - uReveal);
  screenUv = (screenUv - 0.5) / settle + 0.5;

  vec2 px = screenUv * resolution;
  vec2 centerPx = uCenter * resolution;
  vec2 normal = normalize(vec2(sin(uAngle), cos(uAngle)));
  float period = max(resolution.x * uPeriodRatio, 1.0);
  float signedStrength = clamp(uStrength, -100.0, 100.0) / 100.0;
  float strength = abs(signedStrength);
  float stripeAxis = dot(px - centerPx, normal);
  float cell = fract(stripeAxis / period + 0.115);
  float opticalPhase = mix(cell, 1.0 - cell, step(0.0, signedStrength));

  // Two mismatched periods keep the wander from visibly looping.
  vec2 drift = vec2(sin(uTime * 0.27) * 104.0, cos(uTime * 0.19) * 76.0);

  float edgePosition = opticalPhase * 2.0 - 1.0;
  float edgeProximity = pow(abs(edgePosition), 1.3);
  float refractionAmount = strength * edgeProximity * 0.7;
  float targetY = 1.0 - step(0.0, edgePosition);
  vec2 leftUv = mix(screenUv, vec2(0.0, targetY), refractionAmount);
  vec2 rightUv = mix(screenUv, vec2(1.0, targetY), refractionAmount);
  float sideMix = smoothstep(uCenter.x - 0.1, uCenter.x + 0.1, screenUv.x);
  vec3 color = mix(
    sampleGradient(leftUv, resolution, drift),
    sampleGradient(rightUv, resolution, drift),
    sideMix
  );

  gl_FragColor = vec4(mix(BACKGROUND, color, uReveal), 1.0);
}
`;

export type LenticularShaderSettings = {
  angleDegrees?: number;
  centerX?: number;
  centerY?: number;
  periodRatio?: number;
  strength?: number;
};

function HeroShaderPlane({
  animateIdle,
  settings,
  usePerlinSource,
}: {
  animateIdle: boolean;
  settings: Required<LenticularShaderSettings>;
  usePerlinSource: boolean;
}) {
  const { gl, size } = useThree();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const elapsedRef = useRef(0);

  // Seed values only. R3F clones the `uniforms` prop onto the material, so writing back to this
  // object would be a no-op for scalars — every runtime update below goes through the material.
  const initialUniforms = useMemo(
    () => ({
      uAngle: { value: 0 },
      uCenter: { value: new THREE.Vector2() },
      uPeriodRatio: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uReveal: { value: 0 },
      uSettle: { value: 0 },
      uStrength: { value: 0 },
      uTime: { value: 0 },
      uUsePerlinSource: { value: 0 },
    }),
    [],
  );

  useEffect(() => {
    const material = materialRef.current;
    if (material) {
      gl.getDrawingBufferSize(material.uniforms.uResolution.value);
    }
  }, [gl, size.height, size.width]);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) {
      return;
    }
    material.uniforms.uAngle.value = THREE.MathUtils.degToRad(settings.angleDegrees);
    material.uniforms.uCenter.value.set(settings.centerX, settings.centerY);
    material.uniforms.uPeriodRatio.value = settings.periodRatio;
    material.uniforms.uStrength.value = settings.strength;
    material.uniforms.uSettle.value = animateIdle ? REVEAL_SETTLE : 0;
    material.uniforms.uUsePerlinSource.value = usePerlinSource ? 1 : 0;
  }, [
    animateIdle,
    settings.angleDegrees,
    settings.centerX,
    settings.centerY,
    settings.periodRatio,
    settings.strength,
    usePerlinSource,
  ]);

  // Driving the reveal from the render loop rather than React guarantees the first painted frame is
  // the bare background — a CSS transition would race the canvas' first draw and flash the gradient.
  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) {
      return;
    }
    elapsedRef.current += delta;
    const progress = Math.min(1, elapsedRef.current / REVEAL_SECONDS);
    material.uniforms.uReveal.value = 1 - (1 - progress) ** 3;
    if (animateIdle) {
      material.uniforms.uTime.value = elapsedRef.current;
    }
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        fragmentShader={fragmentShader}
        ref={materialRef}
        uniforms={initialUniforms}
        vertexShader={vertexShader}
      />
    </mesh>
  );
}

export type HeroShaderSource = "landing" | "perlin";

/** Renders a gradient source through the landing page's lenticular shader. */
export function HeroShader({
  settings = {},
  source = "landing",
}: {
  settings?: LenticularShaderSettings;
  source?: HeroShaderSource;
}) {
  const prefersReducedMotion = useReducedMotion();
  const resolvedSettings = {
    angleDegrees: settings.angleDegrees ?? DEFAULT_ANGLE_DEGREES,
    centerX: settings.centerX ?? DEFAULT_CENTER_X,
    centerY: settings.centerY ?? DEFAULT_CENTER_Y,
    periodRatio: settings.periodRatio ?? DEFAULT_PERIOD_RATIO,
    strength: settings.strength ?? DEFAULT_STRENGTH,
  };

  return (
    <div aria-hidden className="pointer-events-none h-full w-full overflow-hidden bg-zinc-950">
      <Canvas
        className="h-full w-full"
        dpr={[1, 2]}
        gl={{ alpha: false, antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.setClearColor(BACKGROUND_HEX, 1);
        }}
      >
        <HeroShaderPlane
          animateIdle={!prefersReducedMotion}
          settings={resolvedSettings}
          usePerlinSource={source === "perlin"}
        />
      </Canvas>
    </div>
  );
}
