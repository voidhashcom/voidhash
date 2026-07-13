"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

const SVG_WIDTH = 1654;
const SVG_HEIGHT = 1053;
const DEFAULT_ANGLE_DEGREES = 45.08;
const DEFAULT_CENTER_X = 0.5;
const DEFAULT_CENTER_Y = 0.6386;
const DEFAULT_PERIOD_RATIO = 0.0394;
const DEFAULT_STRENGTH = -100;

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

const vec2 SVG_SIZE = vec2(${SVG_WIDTH.toFixed(1)}, ${SVG_HEIGHT.toFixed(1)});
const float SVG_BLUR = 83.45;

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

vec3 sampleGradient(vec2 screenUv, vec2 resolution) {
  float canvasAspect = resolution.x / resolution.y;
  float svgAspect = SVG_SIZE.x / SVG_SIZE.y;
  vec2 viewSize = canvasAspect > svgAspect
    ? vec2(SVG_SIZE.x, SVG_SIZE.x / canvasAspect)
    : vec2(SVG_SIZE.y * canvasAspect, SVG_SIZE.y);
  vec2 svgPoint = (screenUv - 0.5) * viewSize + SVG_SIZE * 0.5;

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
    vec3(0.0),
    ellipseMask(svgPoint, vec2(820.5, -380.0), vec2(1374.5, 1375.0))
  );

  return color * insideView(screenUv);
}

void main() {
  vec2 resolution = max(uResolution, vec2(1.0));
  vec2 screenUv = vec2(
    gl_FragCoord.x / resolution.x,
    1.0 - gl_FragCoord.y / resolution.y
  );
  vec2 px = screenUv * resolution;
  vec2 centerPx = uCenter * resolution;
  vec2 normal = normalize(vec2(sin(uAngle), cos(uAngle)));
  float period = max(resolution.x * uPeriodRatio, 1.0);
  float signedStrength = clamp(uStrength, -100.0, 100.0) / 100.0;
  float strength = abs(signedStrength);
  float stripeAxis = dot(px - centerPx, normal);
  float cell = fract(stripeAxis / period + 0.115);
  float opticalPhase = mix(cell, 1.0 - cell, step(0.0, signedStrength));

  float edgePosition = opticalPhase * 2.0 - 1.0;
  float edgeProximity = pow(abs(edgePosition), 1.3);
  float refractionAmount = strength * edgeProximity * 0.7;
  float targetY = 1.0 - step(0.0, edgePosition);
  vec2 leftUv = mix(screenUv, vec2(0.0, targetY), refractionAmount);
  vec2 rightUv = mix(screenUv, vec2(1.0, targetY), refractionAmount);
  float sideMix = smoothstep(uCenter.x - 0.1, uCenter.x + 0.1, screenUv.x);
  vec3 color = mix(
    sampleGradient(leftUv, resolution),
    sampleGradient(rightUv, resolution),
    sideMix
  );

  gl_FragColor = vec4(color, 1.0);
}
`;

export type LenticularShaderSettings = {
  angleDegrees?: number;
  centerX?: number;
  centerY?: number;
  periodRatio?: number;
  strength?: number;
};

function HeroShaderPlane({ settings }: { settings: Required<LenticularShaderSettings> }) {
  const { gl, size } = useThree();
  const uniforms = useMemo(
    () => ({
      uAngle: { value: THREE.MathUtils.degToRad(settings.angleDegrees) },
      uCenter: { value: new THREE.Vector2(settings.centerX, settings.centerY) },
      uPeriodRatio: { value: settings.periodRatio },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uStrength: { value: settings.strength },
    }),
    [
      settings.angleDegrees,
      settings.centerX,
      settings.centerY,
      settings.periodRatio,
      settings.strength,
    ],
  );

  useEffect(() => {
    gl.getDrawingBufferSize(uniforms.uResolution.value);
  }, [gl, size.height, size.width, uniforms]);

  useEffect(() => {
    uniforms.uAngle.value = THREE.MathUtils.degToRad(settings.angleDegrees);
    uniforms.uCenter.value.set(settings.centerX, settings.centerY);
    uniforms.uPeriodRatio.value = settings.periodRatio;
    uniforms.uStrength.value = settings.strength;
  }, [settings, uniforms]);

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        vertexShader={vertexShader}
      />
    </mesh>
  );
}

/** Renders the landing hero's SVG gradient through the lenticular refraction shader. */
export function HeroShader({ settings = {} }: { settings?: LenticularShaderSettings }) {
  const resolvedSettings = {
    angleDegrees: settings.angleDegrees ?? DEFAULT_ANGLE_DEGREES,
    centerX: settings.centerX ?? DEFAULT_CENTER_X,
    centerY: settings.centerY ?? DEFAULT_CENTER_Y,
    periodRatio: settings.periodRatio ?? DEFAULT_PERIOD_RATIO,
    strength: settings.strength ?? DEFAULT_STRENGTH,
  };

  return (
    <div aria-hidden className="pointer-events-none h-full w-full overflow-hidden bg-black">
      <Canvas
        className="h-full w-full"
        dpr={[1, 2]}
        gl={{ alpha: false, antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.setClearColor(0x000000, 1);
        }}
      >
        <HeroShaderPlane settings={resolvedSettings} />
      </Canvas>
    </div>
  );
}
