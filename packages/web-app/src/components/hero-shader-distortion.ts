import * as THREE from "three";

const DISTORTION_SIZE = 512;

/** Shared noise and finite-difference distortion for the cached and direct rendering paths. */
export const perlinWarpShader = `
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

vec2 samplePerlinWarp(vec2 uv, float time) {
  float epsilon = 0.012;
  float height = perlinSurface(uv, time);
  vec2 slope = vec2(
    perlinSurface(uv + vec2(epsilon, 0.0), time) - height,
    perlinSurface(uv + vec2(0.0, epsilon), time) - height
  ) / epsilon;
  return slope * vec2(0.012, 0.008) + height * vec2(0.006, -0.004);
}
`;

/** Creates a reusable distortion texture, or falls back when floating-point targets are unavailable. */
export function createHeroDistortionPass(gl: THREE.WebGLRenderer, invalidate: () => void) {
  if (
    !gl.extensions.has("EXT_color_buffer_float") &&
    !gl.extensions.has("EXT_color_buffer_half_float")
  ) {
    return null;
  }

  const target = new THREE.WebGLRenderTarget(DISTORTION_SIZE, DISTORTION_SIZE, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      void main() {
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      ${perlinWarpShader}
      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5) / ${(DISTORTION_SIZE - 1).toFixed(1)};
        gl_FragColor = vec4(samplePerlinWarp(uv, uTime), 0.0, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  scene.add(new THREE.Mesh(geometry, material));
  let lastTime: number | null = null;
  const reset = () => {
    lastTime = null;
    invalidate();
  };
  gl.domElement.addEventListener("webglcontextrestored", reset);

  return {
    texture: target.texture,
    // Endpoint samples keep refraction at the edges inside the interpolation domain.
    uvScale: (DISTORTION_SIZE - 1) / DISTORTION_SIZE,
    uvOffset: 0.5 / DISTORTION_SIZE,
    /** Updates the noise before the full-resolution pass, only when animation time changes. */
    render(time: number) {
      if (lastTime === time) {
        return;
      }
      material.uniforms.uTime.value = time;
      const previousTarget = gl.getRenderTarget();
      const previousCubeFace = gl.getActiveCubeFace();
      const previousMipmapLevel = gl.getActiveMipmapLevel();
      try {
        gl.setRenderTarget(target);
        gl.render(scene, camera);
        lastTime = time;
      } finally {
        gl.setRenderTarget(previousTarget, previousCubeFace, previousMipmapLevel);
      }
    },
    /** Releases the offscreen GPU resources and context-restoration listener. */
    dispose() {
      gl.domElement.removeEventListener("webglcontextrestored", reset);
      target.dispose();
      material.dispose();
      geometry.dispose();
    },
  };
}
