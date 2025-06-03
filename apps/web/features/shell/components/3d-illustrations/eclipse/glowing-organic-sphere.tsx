"use client";

import { useRef } from "react";
import { Canvas, useFrame, extend } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { OrbitControls, shaderMaterial } from "@react-three/drei";
import { type ShaderMaterial, Color, AdditiveBlending, BackSide } from "three";
import { ScreenEffect } from "./screen-effect";

// Custom shader material for the glowing organic sphere with enhanced fresnel effect
const OrganicSphereMaterial = shaderMaterial(
	{
		time: 0,
		outerColor: new Color(0.98, 0.53, 0.0), // Bright orange-yellow
		innerColor: new Color(0.42, 0.24, 0.01), // Darker orange-brown
		noiseScale: 0.2,
		noiseIntensity: 0.29,
		pulseSpeed: 1.7,
		glowIntensity: 2.7,
		fresnelPower: 3.0, // Control the power of the fresnel effect
		fresnelIntensity: 1.5, // Control the intensity of the fresnel effect
	},
	// Vertex shader
	`
    uniform float time;
    uniform float noiseScale;
    uniform float noiseIntensity;
    uniform float pulseSpeed;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewDirection;
    
    // Simplex 3D noise function
    vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      
      // First corner
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      
      // Other corners
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      
      // Permutations
      i = mod(i, 289.0);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
              
      // Gradients
      float n_ = 1.0/7.0; // N=7
      vec3 ns = n_ * D.wyz - D.xzx;
      
      vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
      
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      
      // Normalise gradients
      vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      
      // Mix final noise value
      vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }
    
    // FBM (Fractal Brownian Motion) for more complex noise
    float fbm(vec3 p) {
      float value = 0.0;
      float amplitude = 0.5;
      float frequency = 1.0;
      
      // Add multiple layers of noise
      for (int i = 0; i < 5; i++) {
        value += amplitude * snoise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
      }
      
      return value;
    }
    
    void main() {
      vUv = uv;
      vNormal = normal;
      vPosition = position;
      
      // Calculate view direction for fresnel in vertex shader
      vViewDirection = normalize(cameraPosition - position);
      
      // Create organic distortion based on noise
      float noise = fbm(position * noiseScale + vec3(0.0, 0.0, time * 0.1));
      
      // Pulsating effect
      float pulse = 0.05 * sin(time * pulseSpeed * 0.5);
      
      // Apply distortion to the vertex position
      vec3 newPosition = position;
      float distortion = noise * noiseIntensity + pulse;
      
      // For non-spherical shapes, apply distortion more carefully
      // Use the normal direction but scale based on distance from center
      float distanceFromCenter = length(position);
      vec3 normalizedPos = normalize(position);
      
      // Apply distortion along the normal direction, scaled by distance
      newPosition += normal * distortion * (0.5 + 0.5 * distanceFromCenter);
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
	// Fragment shader
	`
    uniform float time;
    uniform vec3 outerColor;
    uniform vec3 innerColor;
    uniform float glowIntensity;
    uniform float pulseSpeed;
    uniform float fresnelPower;
    uniform float fresnelIntensity;
    
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewDirection;
    
    // Simplex 3D noise function (same as in vertex shader)
    vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      
      // First corner
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      
      // Other corners
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      
      // Permutations
      i = mod(i, 289.0);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
              
      // Gradients
      float n_ = 1.0/7.0; // N=7
      vec3 ns = n_ * D.wyz - D.xzx;
      
      vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
      
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      
      // Normalise gradients
      vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      
      // Mix final noise value
      vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }
    
    float fbm(vec3 p) {
      float value = 0.0;
      float amplitude = 0.5;
      float frequency = 1.0;
      
      // Add multiple layers of noise
      for (int i = 0; i < 5; i++) {
        value += amplitude * snoise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
      }
      
      return value;
    }
    
    void main() {
      // Enhanced fresnel effect for edge glow
      float fresnel = pow(1.0 - max(0.0, dot(vViewDirection, normalize(vNormal))), fresnelPower) * fresnelIntensity;
      
      // Create pulsating effect
      float pulse = 0.5 + 0.5 * sin(time * pulseSpeed * 0.5);
      
      // Mix colors based on fresnel and pulse
      vec3 color = mix(innerColor, outerColor, fresnel * (0.8 + 0.2 * pulse));
      
      // Apply glow intensity with enhanced fresnel
      float intensity = (fresnel * 0.8 + 0.2) * glowIntensity;
      
      // Set final color with glow
      gl_FragColor = vec4(color, intensity);
    }
  `
);

// Extend Three.js with our custom material
extend({ OrganicSphereMaterial });

// Function to render the appropriate geometry
function renderGeometry(geometry: string, segments = 64) {
	switch (geometry) {
		case "cube":
			return <boxGeometry args={[2, 2, 2, segments, segments, segments]} />;
		case "cone":
			return <coneGeometry args={[1, 2, segments, segments]} />;
		case "cylinder":
			return <cylinderGeometry args={[1, 1, 2, segments, segments]} />;
		case "torus":
			return <torusGeometry args={[1, 0.4, segments / 2, segments]} />;
		case "octahedron":
			return <octahedronGeometry args={[1, 3]} />;
		case "dodecahedron":
			return <dodecahedronGeometry args={[1, 2]} />;
		case "icosahedron":
			return <icosahedronGeometry args={[1, 3]} />;
		default:
			return <sphereGeometry args={[1, segments, segments]} />;
	}
}

// Inner glowing core component with configurable geometry
function InnerCore({ geometry }: { geometry: string }) {
	const materialRef = useRef<ShaderMaterial>(null);

	const innerColor = "#690d52";
	const noiseScale = 0.2;
	const noiseIntensity = 0.17;
	const pulseSpeed = 0.7;
	const glowIntensity = 1.3;
	const fresnelPower = 2.6;
	const fresnelIntensity = 1.5;

	useFrame((state) => {
		if (materialRef.current) {
			materialRef.current.uniforms.time!.value = state.clock.getElapsedTime();
			materialRef.current.uniforms.innerColor!.value = new Color(innerColor);
			materialRef.current.uniforms.outerColor!.value = new Color("#ff8800");
			materialRef.current.uniforms.noiseScale!.value = noiseScale;
			materialRef.current.uniforms.noiseIntensity!.value = noiseIntensity;
			materialRef.current.uniforms.pulseSpeed!.value = pulseSpeed;
			materialRef.current.uniforms.glowIntensity!.value = glowIntensity;
			materialRef.current.uniforms.fresnelPower!.value = fresnelPower;
			materialRef.current.uniforms.fresnelIntensity!.value = fresnelIntensity;
		}
	});

	return (
		<mesh>
			{renderGeometry(geometry, 64)}
			{/* @ts-expect-error - custom material */}
			<organicSphereMaterial
				ref={materialRef}
				transparent
				depthWrite={false}
				blending={AdditiveBlending}
			/>
		</mesh>
	);
}

// Outer glow component with matching geometry
function OuterGlow({ geometry }: { geometry: string }) {
	const materialRef = useRef<ShaderMaterial>(null);

	const outerColor = "#000000";
	const glowSize = 1.2;
	const glowIntensity = 0.23;

	useFrame((state) => {
		if (materialRef.current) {
			materialRef.current.uniforms.time!.value = state.clock.getElapsedTime();
			materialRef.current.uniforms.outerColor!.value = new Color(outerColor);
			materialRef.current.uniforms.innerColor!.value = new Color(outerColor);
			materialRef.current.uniforms.noiseScale!.value = 0.5;
			materialRef.current.uniforms.noiseIntensity!.value = 0.2;
			materialRef.current.uniforms.pulseSpeed!.value = 0.3;
			materialRef.current.uniforms.glowIntensity!.value = glowIntensity;
			materialRef.current.uniforms.fresnelPower!.value = 2.0;
			materialRef.current.uniforms.fresnelIntensity!.value = 1.0;
		}
	});

	return (
		<mesh scale={[glowSize, glowSize, glowSize]}>
			{renderGeometry(geometry, 32)}
			{/* @ts-expect-error - custom material */}
			<organicSphereMaterial
				ref={materialRef}
				transparent
				depthWrite={false}
				blending={AdditiveBlending}
				side={BackSide}
			/>
		</mesh>
	);
}

// Main scene component
function Scene() {
	const geometry = "sphere";

	const bloomStrength = 1.2;
	const bloomRadius = 1.0;

	const screenDotSize = 5;
	const screenIntensity = 1;
	const enableScreen = true;

	return (
		<>
			<InnerCore geometry={geometry} />
			<OuterGlow geometry={geometry} />
			<OrbitControls
				enableZoom={true}
				enablePan={false}
				autoRotate
				autoRotateSpeed={0.5}
			/>
			<EffectComposer>
				<Bloom
					luminanceThreshold={0}
					luminanceSmoothing={0.9}
					intensity={bloomStrength}
					radius={bloomRadius}
				/>
			</EffectComposer>
			<ScreenEffect
				dotSize={screenDotSize}
				intensity={screenIntensity}
				enabled={enableScreen}
			/>
		</>
	);
}

export default function GlowingOrganicSphere() {
	return (
		<div className="h-screen w-full bg-background">
			<Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
				<color attach="background" args={["#0A0A0A"]} />
				<Scene />
			</Canvas>
		</div>
	);
}
