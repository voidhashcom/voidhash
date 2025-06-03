"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { extend, type ReactThreeFiber } from "@react-three/fiber";
import * as THREE from "three";

// Create the screen effect shader material
const ScreenMaterial = shaderMaterial(
	{
		tDiffuse: null,
		time: 0,
		dotSize: 8.0,
		intensity: 0.8,
		resolution: new THREE.Vector2(1024, 1024),
	},
	// Vertex shader
	`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
	// Fragment shader
	`
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float dotSize;
    uniform float intensity;
    uniform vec2 resolution;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      
      // Calculate screen coordinates
      vec2 screenPos = vUv * resolution;
      
      // Create halftone pattern
      vec2 dotPos = mod(screenPos, dotSize);
      vec2 dotCenter = vec2(dotSize * 0.5);
      float dist = distance(dotPos, dotCenter);
      
      // Calculate brightness of the original pixel
      float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      
      // Create dot pattern based on brightness
      float dotRadius = dotSize * 0.4 * (1.0 - brightness);
      float dotMask = smoothstep(dotRadius - 1.0, dotRadius + 1.0, dist);
      
      // Add some animation
      float pulse = 0.95 + 0.05 * sin(time * 2.0);
      dotMask *= pulse;
      
      // Mix original color with dot pattern
      vec3 finalColor = mix(vec3(0.0), color.rgb, 1.0 - dotMask * intensity);
      
      gl_FragColor = vec4(finalColor, color.a);
    }
  `
);

// Extend Three.js with our custom material
extend({ ScreenMaterial });

// Add TypeScript support
declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace JSX {
		interface IntrinsicElements {
			// @ts-expect-error - custom material
			screenMaterial: ReactThreeFiber.Object3DNode<
				THREE.ShaderMaterial,
				typeof THREE.ShaderMaterial
			>;
		}
	}
}

interface ScreenEffectProps {
	dotSize: number;
	intensity: number;
	enabled: boolean;
}

export function ScreenEffect({
	dotSize,
	intensity,
	enabled,
}: ScreenEffectProps) {
	const materialRef = useRef<THREE.ShaderMaterial>(null);
	const { gl, scene, camera, size } = useThree();

	// Create render targets
	const renderTarget = useMemo(() => {
		return new THREE.WebGLRenderTarget(size.width, size.height, {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat,
		});
	}, [size.width, size.height]);

	// Create a scene for the screen effect
	const screenScene = useMemo(() => new THREE.Scene(), []);
	const screenCamera = useMemo(
		() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
		[]
	);

	// Create fullscreen quad
	const screenQuad = useMemo(() => {
		const geometry = new THREE.PlaneGeometry(2, 2);
		return geometry;
	}, []);

	useFrame(() => {
		if (!enabled || !materialRef.current) return;

		// Render the main scene to the render target
		const originalRenderTarget = gl.getRenderTarget();
		gl.setRenderTarget(renderTarget);
		gl.render(scene, camera);
		gl.setRenderTarget(originalRenderTarget);

		// Update material uniforms
		materialRef.current.uniforms.tDiffuse!.value = renderTarget.texture;
		materialRef.current.uniforms.time!.value = performance.now() * 0.001;
		materialRef.current.uniforms.dotSize!.value = dotSize;
		materialRef.current.uniforms.intensity!.value = intensity;
		materialRef.current.uniforms.resolution!.value.set(size.width, size.height);

		// Render the screen effect
		gl.render(screenScene, screenCamera);
	}, 1); // Render after the main scene

	return (
		<primitive object={screenScene}>
			<mesh geometry={screenQuad}>
				{/* @ts-expect-error - custom material */}
				<screenMaterial
					ref={materialRef}
					tDiffuse={renderTarget.texture}
					time={0}
					dotSize={dotSize}
					intensity={intensity}
					resolution={[size.width, size.height]}
				/>
			</mesh>
		</primitive>
	);
}
