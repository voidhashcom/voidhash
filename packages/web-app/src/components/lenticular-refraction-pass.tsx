"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { EffectComposer as ThreeEffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const DEFAULT_ANGLE_DEGREES = 45.08;
const DEFAULT_CENTER_X = 0.5;
const DEFAULT_CENTER_Y = 0.6386;
const DEFAULT_PERIOD_RATIO = 0.0394;
const DEFAULT_STRENGTH = -100;

const fragmentShader = `
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uAngle;
uniform vec2 uCenter;
uniform float uPeriodRatio;
uniform float uStrength;

varying vec2 vUv;

void main() {
  vec2 resolution = max(uResolution, vec2(1.0));
  vec2 screenUv = vec2(vUv.x, 1.0 - vUv.y);
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
  vec2 leftTextureUv = vec2(leftUv.x, 1.0 - leftUv.y);
  vec2 rightTextureUv = vec2(rightUv.x, 1.0 - rightUv.y);
  float sideMix = smoothstep(uCenter.x - 0.1, uCenter.x + 0.1, screenUv.x);

  gl_FragColor = mix(
    texture2D(tDiffuse, leftTextureUv),
    texture2D(tDiffuse, rightTextureUv),
    sideMix
  );
}
`;

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export type LenticularRefractionSettings = {
  angleDegrees?: number;
  centerX?: number;
  centerY?: number;
  periodRatio?: number;
  strength?: number;
};

/** Applies the lenticular refraction transform to the current Three.js scene. */
export function LenticularRefractionPass({
  settings = {},
}: {
  settings?: LenticularRefractionSettings;
}) {
  const { camera, gl, scene, size } = useThree();
  const angleDegrees = settings.angleDegrees ?? DEFAULT_ANGLE_DEGREES;
  const centerX = settings.centerX ?? DEFAULT_CENTER_X;
  const centerY = settings.centerY ?? DEFAULT_CENTER_Y;
  const periodRatio = settings.periodRatio ?? DEFAULT_PERIOD_RATIO;
  const strength = settings.strength ?? DEFAULT_STRENGTH;
  const { composer, shaderPass } = useMemo(() => {
    const nextComposer = new ThreeEffectComposer(gl);
    const nextShaderPass = new ShaderPass({
      fragmentShader,
      uniforms: {
        tDiffuse: { value: null },
        uAngle: { value: THREE.MathUtils.degToRad(angleDegrees) },
        uCenter: { value: new THREE.Vector2(centerX, centerY) },
        uPeriodRatio: { value: periodRatio },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uStrength: { value: strength },
      },
      vertexShader,
    });

    nextComposer.addPass(new RenderPass(scene, camera));
    nextComposer.addPass(nextShaderPass);

    return {
      composer: nextComposer,
      shaderPass: nextShaderPass,
    };
  }, [angleDegrees, camera, centerX, centerY, gl, periodRatio, scene, strength]);

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
    gl.getDrawingBufferSize(shaderPass.uniforms.uResolution.value);
  }, [composer, gl, shaderPass, size.height, size.width]);

  useEffect(() => {
    shaderPass.uniforms.uAngle.value = THREE.MathUtils.degToRad(angleDegrees);
    shaderPass.uniforms.uCenter.value.set(centerX, centerY);
    shaderPass.uniforms.uPeriodRatio.value = periodRatio;
    shaderPass.uniforms.uStrength.value = strength;
  }, [angleDegrees, centerX, centerY, periodRatio, shaderPass, strength]);

  useEffect(
    () => () => {
      shaderPass.dispose();
      composer.dispose();
    },
    [composer, shaderPass],
  );

  useFrame((_, delta) => {
    composer.render(delta);
  }, 1);

  return null;
}
