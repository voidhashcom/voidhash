/**
 * CRT-style WebGL post-processing pass for the Asteroids board.
 *
 * The engine renders the scene into an offscreen 2D canvas; every finished frame is uploaded here
 * as a texture and redrawn onto the visible canvas with barrel curvature, bloom, chromatic
 * aberration, scanlines and a vignette. Kept dependency-free (raw WebGL1, one program, one
 * texture, a single fullscreen triangle) so the whole pass costs one draw call per frame and no
 * per-frame allocations.
 */

const VERTEX_SOURCE = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SOURCE = `
precision mediump float;

uniform sampler2D uScene;
uniform vec2 uResolution;
uniform float uTime;
uniform float uMotion;

varying vec2 vUv;

void main() {
  vec2 centered = vUv - 0.5;
  float r2 = dot(centered, centered);

  // Barrel curvature: samples pull outward towards the edges, leaving a thin curved black rim.
  vec2 uv = 0.5 + centered * (1.0 + 0.06 * r2);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Chromatic aberration grows with distance from the centre; frozen under reduced motion. Kept
  // subtle so the monochrome wireframes fringe rather than visibly split into colours.
  vec2 fringe = centered * r2 * 0.015 * uMotion;
  vec3 color = vec3(
    texture2D(uScene, uv + fringe).r,
    texture2D(uScene, uv).g,
    texture2D(uScene, uv - fringe).b
  );

  // Cheap bloom: eight taps, squared so only bright strokes glow and the void stays black.
  vec2 px = 1.0 / uResolution;
  vec3 glow = texture2D(uScene, uv + px * vec2(2.0, 2.0)).rgb
    + texture2D(uScene, uv + px * vec2(-2.0, 2.0)).rgb
    + texture2D(uScene, uv + px * vec2(2.0, -2.0)).rgb
    + texture2D(uScene, uv + px * vec2(-2.0, -2.0)).rgb
    + texture2D(uScene, uv + px * vec2(5.0, 0.0)).rgb
    + texture2D(uScene, uv + px * vec2(-5.0, 0.0)).rgb
    + texture2D(uScene, uv + px * vec2(0.0, 5.0)).rgb
    + texture2D(uScene, uv + px * vec2(0.0, -5.0)).rgb;
  glow *= 0.125;
  color += glow * glow * 1.2;

  float scanline = 0.92 + 0.08 * sin(uv.y * uResolution.y * 3.14159);
  float flicker = 1.0 + 0.012 * uMotion * sin(uTime * 82.0);
  float vignette = 1.0 - 0.55 * r2 * 1.6;

  gl_FragColor = vec4(color * scanline * flicker * vignette, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("CRT pass: shader allocation failed");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`CRT pass: shader compile failed: ${info}`);
  }
  return shader;
}

/** Implements the engine's `AsteroidsCompositor` contract on a WebGL canvas. */
export class CrtCompositor {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext;
  private readonly texture: WebGLTexture;
  private readonly timeUniform: WebGLUniformLocation | null;
  private readonly resolutionUniform: WebGLUniformLocation | null;

  private textureWidth = 0;
  private textureHeight = 0;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, reducedMotion: boolean) {
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      stencil: false,
    });
    if (!gl) {
      throw new Error("CRT pass: WebGL unavailable");
    }

    const program = gl.createProgram();
    if (!program) {
      throw new Error("CRT pass: program allocation failed");
    }
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`CRT pass: program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    gl.useProgram(program);

    // One triangle overshooting the viewport beats a quad: no index buffer, no diagonal seam.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error("CRT pass: texture allocation failed");
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    gl.uniform1i(gl.getUniformLocation(program, "uScene"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "uMotion"), reducedMotion ? 0 : 1);
    this.timeUniform = gl.getUniformLocation(program, "uTime");
    this.resolutionUniform = gl.getUniformLocation(program, "uResolution");

    this.canvas = canvas;
    this.gl = gl;
    this.texture = texture;
  }

  /** Matches the visible canvas to the scene canvas' device-pixel size. */
  resize(width: number, height: number, scale: number): void {
    if (this.destroyed) {
      return;
    }
    this.canvas.width = Math.round(width * scale);
    this.canvas.height = Math.round(height * scale);
    this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    this.gl.uniform2f(this.resolutionUniform, this.canvas.width, this.canvas.height);
  }

  /** Uploads the finished scene frame and redraws it through the CRT shader. */
  draw(scene: HTMLCanvasElement, timeSeconds: number): void {
    if (this.destroyed || scene.width === 0 || scene.height === 0) {
      return;
    }
    const gl = this.gl;

    // texSubImage2D skips the driver-side reallocation that texImage2D does per call, so the full
    // upload only happens when the scene canvas actually changed size.
    if (scene.width === this.textureWidth && scene.height === this.textureHeight) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, scene);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
      this.textureWidth = scene.width;
      this.textureHeight = scene.height;
    }

    gl.uniform1f(this.timeUniform, timeSeconds);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Releases the GL context and the canvas' backing store. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}

/**
 * Builds the CRT pass, or returns `null` where WebGL is unavailable so the caller can fall back to
 * showing the engine's own canvas — the game is fully playable without the shader.
 */
export function createCrtCompositor(
  canvas: HTMLCanvasElement,
  reducedMotion: boolean,
): CrtCompositor | null {
  try {
    return new CrtCompositor(canvas, reducedMotion);
  } catch {
    return null;
  }
}
