/**
 * Vector-arcade engine behind the landing page's Asteroids easter egg.
 *
 * Deliberately framework-free and allocation-free: every entity lives in a pre-sized typed array,
 * the loop only runs while the board is on screen and being played, and `destroy()` hands the
 * canvas' backing store back to the browser. Nothing here touches React, so the whole module can
 * be code-split away from the landing bundle.
 */

const TAU = Math.PI * 2;

/** Fixed simulation step. Decoupling it from the display refresh keeps a 120Hz screen fair. */
const STEP_SECONDS = 1 / 60;

/** Clamp on a single frame's delta, so a backgrounded tab does not resume with a huge catch-up. */
const MAX_FRAME_SECONDS = 0.1;

const MAX_BULLETS = 16;
const MAX_ASTEROIDS = 48;
const MAX_PARTICLES = 320;
const STAR_COUNT = 70;

/** Radius per asteroid tier: large, medium, small. */
const TIER_RADII = [44, 25, 13];
const TIER_SCORES = [20, 50, 100];
const TIER_SPEEDS = [46, 68, 96];
const SHAPE_VARIANTS = 4;

const SHIP_TURN = 3.4;
const SHIP_THRUST = 330;
const SHIP_DRAG = 0.35;
const SHIP_MAX_SPEED = 400;
const SHIP_RADIUS = 11;

const BULLET_SPEED = 520;
const BULLET_LIFE = 1.05;
const FIRE_INTERVAL = 0.2;

const START_LIVES = 3;
const RESPAWN_DELAY = 1.1;
const INVULNERABLE_SECONDS = 2.4;
const WAVE_DELAY = 1.4;

/** Radius around the spawn point that must be clear of rocks before the ship comes back. */
const SPAWN_CLEARANCE = 90;

/**
 * Cap on the backing store so a wide monitor at dpr 3 does not allocate a 30MB canvas. Kept modest
 * because the CRT pass doubles the buffers (2D scene + WebGL target) and uploads the scene as a
 * texture every frame; the shader's softness hides the reduced sampling anyway.
 */
const MAX_DEVICE_PIXELS = 2_600_000;

const BACKDROP = "#000000";
const STAR_DIM = "#27272a";
const STAR_BRIGHT = "#3f3f46";
const SHIP_COLOR = "#fafafa";
const BULLET_COLOR = "#1e93ff";
const BULLET_HALO = "rgba(30, 147, 255, 0.3)";
const THRUST_COLOR = "#e4e4e7";

/** Grayscale per tier — large rocks read as background, small ones as threats. */
const TIER_COLORS = ["#52525c", "#71717b", "#a1a1aa"];

/** Monochrome sparks: the missiles stay the only colour on the board. */
const PARTICLE_COLORS = ["#fafafa", "#a1a1aa", "#52525c"];

/**
 * Distance of the virtual camera from a rock's centre, in radii. Governs how hard the wireframe's
 * near side is magnified against its far side — lower reads more 3D, higher more orthographic.
 */
const ROCK_FOCAL_RADII = 6;

export type AsteroidsStatus = "idle" | "playing" | "paused" | "over";

export type AsteroidsHud = {
  score: number;
  lives: number;
  wave: number;
};

export type AsteroidsAction = "left" | "right" | "thrust" | "fire";

/**
 * Optional post-processing stage: the engine renders the scene into its own 2D canvas and hands
 * every finished frame over instead of showing that canvas directly.
 */
export type AsteroidsCompositor = {
  resize: (width: number, height: number, scale: number) => void;
  draw: (scene: HTMLCanvasElement, timeSeconds: number) => void;
};

export type AsteroidsEngineOptions = {
  canvas: HTMLCanvasElement;
  compositor?: AsteroidsCompositor | null;
  reducedMotion: boolean;
  onHud: (hud: AsteroidsHud) => void;
  onStatus: (status: AsteroidsStatus) => void;
};

/** Small deterministic PRNG, used so the rock silhouettes are identical on every visit. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const GOLDEN = (1 + Math.sqrt(5)) / 2;

/** Unit icosahedron vertices; every rock mesh is a radially deformed copy of these 12 points. */
const ICO_VERTICES = [
  [-1, GOLDEN, 0],
  [1, GOLDEN, 0],
  [-1, -GOLDEN, 0],
  [1, -GOLDEN, 0],
  [0, -1, GOLDEN],
  [0, 1, GOLDEN],
  [0, -1, -GOLDEN],
  [0, 1, -GOLDEN],
  [GOLDEN, 0, -1],
  [GOLDEN, 0, 1],
  [-GOLDEN, 0, -1],
  [-GOLDEN, 0, 1],
] as const;

const ROCK_VERTEX_COUNT = ICO_VERTICES.length;

/**
 * The icosahedron's 30 edges as flat index pairs. Radial deformation moves vertices along their own
 * axis only, so the connectivity is shared by every variant.
 */
let sharedRockEdges: Uint8Array | null = null;

function rockEdges(): Uint8Array {
  if (sharedRockEdges) {
    return sharedRockEdges;
  }

  const pairs: number[] = [];
  for (let a = 0; a < ROCK_VERTEX_COUNT; a += 1) {
    for (let b = a + 1; b < ROCK_VERTEX_COUNT; b += 1) {
      const dx = ICO_VERTICES[a][0] - ICO_VERTICES[b][0];
      const dy = ICO_VERTICES[a][1] - ICO_VERTICES[b][1];
      const dz = ICO_VERTICES[a][2] - ICO_VERTICES[b][2];
      // Adjacent icosahedron vertices sit exactly 2 apart at this scale.
      if (dx * dx + dy * dy + dz * dz < 4.1) {
        pairs.push(a, b);
      }
    }
  }

  sharedRockEdges = new Uint8Array(pairs);
  return sharedRockEdges;
}

/**
 * Deformed rock meshes per tier and variant, as flat `x, y, z` vertex triples.
 *
 * Built lazily so the module stays importable during server rendering, and seeded so every visit
 * tumbles the same rocks.
 */
let sharedRockMeshes: Float32Array[][] | null = null;

function rockMeshes(): Float32Array[][] {
  if (sharedRockMeshes) {
    return sharedRockMeshes;
  }

  const random = mulberry32(0x5e_ed_10_23);
  const norm = Math.hypot(1, GOLDEN);

  sharedRockMeshes = TIER_RADII.map((radius) => {
    const variants: Float32Array[] = [];
    for (let variant = 0; variant < SHAPE_VARIANTS; variant += 1) {
      const mesh = new Float32Array(ROCK_VERTEX_COUNT * 3);
      for (let vertex = 0; vertex < ROCK_VERTEX_COUNT; vertex += 1) {
        const reach = (radius * (0.74 + random() * 0.38)) / norm;
        mesh[vertex * 3] = ICO_VERTICES[vertex][0] * reach;
        mesh[vertex * 3 + 1] = ICO_VERTICES[vertex][1] * reach;
        mesh[vertex * 3 + 2] = ICO_VERTICES[vertex][2] * reach;
      }
      variants.push(mesh);
    }
    return variants;
  });

  return sharedRockMeshes;
}

let sharedShipPath: Path2D | null = null;
let sharedFlamePath: Path2D | null = null;

function shipPath(): Path2D {
  if (!sharedShipPath) {
    const path = new Path2D();
    path.moveTo(15, 0);
    path.lineTo(-10, 9);
    path.lineTo(-6, 0);
    path.lineTo(-10, -9);
    path.closePath();
    sharedShipPath = path;
  }
  return sharedShipPath;
}

function flamePath(): Path2D {
  if (!sharedFlamePath) {
    const path = new Path2D();
    path.moveTo(-7, 5);
    path.lineTo(-17, 0);
    path.lineTo(-7, -5);
    sharedFlamePath = path;
  }
  return sharedFlamePath;
}

/** Shortest signed distance between two coordinates on a wrapping axis. */
function wrapDelta(delta: number, size: number): number {
  if (delta > size * 0.5) {
    return delta - size;
  }
  if (delta < -size * 0.5) {
    return delta + size;
  }
  return delta;
}

export class AsteroidsEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly compositor: AsteroidsCompositor | null;
  private readonly reducedMotion: boolean;
  private readonly onHud: (hud: AsteroidsHud) => void;
  private readonly onStatus: (status: AsteroidsStatus) => void;

  private width = 0;
  private height = 0;
  private scale = 1;

  private status: AsteroidsStatus = "idle";
  private destroyed = false;
  private frameHandle = 0;
  private lastFrameTime = 0;
  private accumulator = 0;
  private elapsed = 0;

  private score = 0;
  private lives = START_LIVES;
  private wave = 0;

  private readonly input = { left: false, right: false, thrust: false, fire: false };

  private shipX = 0;
  private shipY = 0;
  private shipVx = 0;
  private shipVy = 0;
  private shipAngle = -Math.PI / 2;
  private shipAlive = false;
  private respawnTimer = 0;
  private invulnerableTimer = 0;
  private fireTimer = 0;
  private waveTimer = 0;
  private shake = 0;

  private readonly bulletX = new Float32Array(MAX_BULLETS);
  private readonly bulletY = new Float32Array(MAX_BULLETS);
  private readonly bulletVx = new Float32Array(MAX_BULLETS);
  private readonly bulletVy = new Float32Array(MAX_BULLETS);
  private readonly bulletLife = new Float32Array(MAX_BULLETS);
  private bulletCount = 0;

  private readonly rockX = new Float32Array(MAX_ASTEROIDS);
  private readonly rockY = new Float32Array(MAX_ASTEROIDS);
  private readonly rockVx = new Float32Array(MAX_ASTEROIDS);
  private readonly rockVy = new Float32Array(MAX_ASTEROIDS);
  private readonly rockPitch = new Float32Array(MAX_ASTEROIDS);
  private readonly rockYaw = new Float32Array(MAX_ASTEROIDS);
  private readonly rockPitchSpin = new Float32Array(MAX_ASTEROIDS);
  private readonly rockYawSpin = new Float32Array(MAX_ASTEROIDS);
  private readonly rockTier = new Uint8Array(MAX_ASTEROIDS);
  private readonly rockVariant = new Uint8Array(MAX_ASTEROIDS);
  private rockCount = 0;

  /** Scratch for a single rock's projected vertices during rendering. */
  private readonly projectedX = new Float32Array(ROCK_VERTEX_COUNT);
  private readonly projectedY = new Float32Array(ROCK_VERTEX_COUNT);

  private readonly particleX = new Float32Array(MAX_PARTICLES);
  private readonly particleY = new Float32Array(MAX_PARTICLES);
  private readonly particleVx = new Float32Array(MAX_PARTICLES);
  private readonly particleVy = new Float32Array(MAX_PARTICLES);
  private readonly particleLife = new Float32Array(MAX_PARTICLES);
  private readonly particleSpan = new Float32Array(MAX_PARTICLES);
  private readonly particleColor = new Uint8Array(MAX_PARTICLES);
  private particleCount = 0;

  /** Star field as flat `x, y, size` triples — cheaper to keep than an offscreen canvas. */
  private readonly stars = new Float32Array(STAR_COUNT * 3);

  /** Scratch buffers for `spreadWrapped`, at most one copy per screen corner. */
  private readonly wrapSpreadX = new Float32Array(4);
  private readonly wrapSpreadY = new Float32Array(4);

  constructor({ canvas, compositor, reducedMotion, onHud, onStatus }: AsteroidsEngineOptions) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("Asteroids needs a 2D canvas context");
    }

    this.canvas = canvas;
    this.ctx = ctx;
    this.compositor = compositor ?? null;
    this.reducedMotion = reducedMotion;
    this.onHud = onHud;
    this.onStatus = onStatus;
  }

  /** Resizes the backing store to `width` x `height` CSS pixels and repaints once. */
  resize(width: number, height: number): void {
    if (this.destroyed || width <= 0 || height <= 0) {
      return;
    }

    const requested = Math.min(window.devicePixelRatio || 1, 2);
    const budget = Math.sqrt(MAX_DEVICE_PIXELS / (width * height));
    const scale = Math.max(1, Math.min(requested, budget));
    const sizeChanged = width !== this.width || height !== this.height;

    this.width = width;
    this.height = height;
    this.scale = scale;
    this.canvas.width = Math.round(width * scale);
    this.canvas.height = Math.round(height * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.compositor?.resize(width, height, scale);

    if (sizeChanged) {
      this.seedStars();
      if (this.status === "idle") {
        this.layoutAttractField();
      } else {
        this.containEntities();
      }
    }

    this.render();
  }

  /** Starts a fresh run from wave one. */
  start(): void {
    if (this.destroyed) {
      return;
    }

    this.score = 0;
    this.lives = START_LIVES;
    this.wave = 0;
    this.elapsed = 0;
    this.accumulator = 0;
    this.shake = 0;
    this.bulletCount = 0;
    this.rockCount = 0;
    this.particleCount = 0;
    this.input.left = false;
    this.input.right = false;
    this.input.thrust = false;
    this.input.fire = false;

    this.spawnShip();
    this.startWave();
    this.emitHud();
    this.setStatus("playing");
    this.runLoop();
  }

  /** Suspends the loop, keeping the board exactly as it stands. */
  pause(): void {
    if (this.status !== "playing") {
      return;
    }
    this.setStatus("paused");
    this.stopLoop();
    this.render();
  }

  /** Resumes a paused run. */
  resume(): void {
    if (this.status !== "paused" || this.destroyed) {
      return;
    }
    this.setStatus("playing");
    this.runLoop();
  }

  /**
   * Gates the render loop on the board being worth animating — on screen, in a visible tab.
   *
   * Separate from `pause()`: that is the player's own pause and shows an overlay, whereas this is
   * the page telling the engine nobody can see it, which should cost nothing at all.
   */
  setActive(active: boolean): void {
    if (this.destroyed) {
      return;
    }

    if (!active) {
      this.stopLoop();
      return;
    }
    if (this.status === "idle" || this.status === "playing") {
      this.runLoop();
    }
  }

  setInput(action: AsteroidsAction, pressed: boolean): void {
    this.input[action] = pressed;
  }

  /** Cancels the loop, drops listeners' last frame and releases the canvas' backing store. */
  destroy(): void {
    this.destroyed = true;
    this.stopLoop();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }

  private setStatus(status: AsteroidsStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.onStatus(status);
    }
  }

  private emitHud(): void {
    this.onHud({ lives: this.lives, score: this.score, wave: this.wave });
  }

  private runLoop(): void {
    if (this.frameHandle !== 0 || this.destroyed) {
      return;
    }
    this.lastFrameTime = performance.now();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  private stopLoop(): void {
    if (this.frameHandle !== 0) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
  }

  private readonly frame = (time: number): void => {
    this.frameHandle = requestAnimationFrame(this.frame);

    const delta = Math.min((time - this.lastFrameTime) / 1000, MAX_FRAME_SECONDS);
    this.lastFrameTime = time;
    this.accumulator += delta;

    while (this.accumulator >= STEP_SECONDS) {
      this.step(STEP_SECONDS);
      this.accumulator -= STEP_SECONDS;
    }

    this.render();

    // Once the wreckage has settled there is nothing left to animate on the game-over board, so the
    // loop retires itself instead of burning a frame budget behind the overlay.
    if (this.status === "over" && this.particleCount === 0 && this.shake === 0) {
      this.stopLoop();
    }
  };

  private step(delta: number): void {
    this.elapsed += delta;
    this.shake = Math.max(0, this.shake - delta * 26);

    if (this.status === "playing") {
      this.stepShip(delta);
      this.stepBullets(delta);
    }

    this.stepRocks(delta);
    this.stepParticles(delta);

    if (this.status !== "playing") {
      return;
    }

    this.resolveBulletHits();
    this.resolveShipHits();

    if (this.rockCount === 0) {
      this.waveTimer -= delta;
      if (this.waveTimer <= 0) {
        this.startWave();
      }
    }

    if (!this.shipAlive && this.lives > 0) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0 && this.spawnPointIsClear()) {
        this.spawnShip();
      }
    }
  }

  private stepShip(delta: number): void {
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - delta);
    this.fireTimer = Math.max(0, this.fireTimer - delta);

    if (!this.shipAlive) {
      return;
    }

    if (this.input.left) {
      this.shipAngle -= SHIP_TURN * delta;
    }
    if (this.input.right) {
      this.shipAngle += SHIP_TURN * delta;
    }

    if (this.input.thrust) {
      this.shipVx += Math.cos(this.shipAngle) * SHIP_THRUST * delta;
      this.shipVy += Math.sin(this.shipAngle) * SHIP_THRUST * delta;

      const speed = Math.hypot(this.shipVx, this.shipVy);
      if (speed > SHIP_MAX_SPEED) {
        const clamp = SHIP_MAX_SPEED / speed;
        this.shipVx *= clamp;
        this.shipVy *= clamp;
      }
      if (!this.reducedMotion) {
        this.emitThrustSpark();
      }
    }

    const drag = Math.max(0, 1 - SHIP_DRAG * delta);
    this.shipVx *= drag;
    this.shipVy *= drag;
    this.shipX = this.wrapX(this.shipX + this.shipVx * delta);
    this.shipY = this.wrapY(this.shipY + this.shipVy * delta);

    if (this.input.fire && this.fireTimer === 0) {
      this.fireBullet();
    }
  }

  private stepBullets(delta: number): void {
    for (let index = this.bulletCount - 1; index >= 0; index -= 1) {
      this.bulletLife[index] -= delta;
      if (this.bulletLife[index] <= 0) {
        this.removeBullet(index);
        continue;
      }
      this.bulletX[index] = this.wrapX(this.bulletX[index] + this.bulletVx[index] * delta);
      this.bulletY[index] = this.wrapY(this.bulletY[index] + this.bulletVy[index] * delta);
    }
  }

  private stepRocks(delta: number): void {
    for (let index = 0; index < this.rockCount; index += 1) {
      this.rockX[index] = this.wrapX(this.rockX[index] + this.rockVx[index] * delta);
      this.rockY[index] = this.wrapY(this.rockY[index] + this.rockVy[index] * delta);
      this.rockPitch[index] += this.rockPitchSpin[index] * delta;
      this.rockYaw[index] += this.rockYawSpin[index] * delta;
    }
  }

  private stepParticles(delta: number): void {
    for (let index = this.particleCount - 1; index >= 0; index -= 1) {
      this.particleLife[index] -= delta;
      if (this.particleLife[index] <= 0) {
        this.removeParticle(index);
        continue;
      }
      this.particleX[index] += this.particleVx[index] * delta;
      this.particleY[index] += this.particleVy[index] * delta;
      this.particleVx[index] *= 0.98;
      this.particleVy[index] *= 0.98;
    }
  }

  private resolveBulletHits(): void {
    for (let bullet = this.bulletCount - 1; bullet >= 0; bullet -= 1) {
      for (let rock = this.rockCount - 1; rock >= 0; rock -= 1) {
        const radius = TIER_RADII[this.rockTier[rock]];
        const dx = wrapDelta(this.bulletX[bullet] - this.rockX[rock], this.width);
        const dy = wrapDelta(this.bulletY[bullet] - this.rockY[rock], this.height);
        if (dx * dx + dy * dy > radius * radius) {
          continue;
        }

        this.removeBullet(bullet);
        this.breakRock(rock);
        break;
      }
    }
  }

  private resolveShipHits(): void {
    if (!this.shipAlive || this.invulnerableTimer > 0) {
      return;
    }

    for (let rock = this.rockCount - 1; rock >= 0; rock -= 1) {
      const radius = TIER_RADII[this.rockTier[rock]] + SHIP_RADIUS * 0.7;
      const dx = wrapDelta(this.shipX - this.rockX[rock], this.width);
      const dy = wrapDelta(this.shipY - this.rockY[rock], this.height);
      if (dx * dx + dy * dy > radius * radius) {
        continue;
      }

      this.breakRock(rock);
      this.destroyShip();
      return;
    }
  }

  private breakRock(index: number): void {
    const tier = this.rockTier[index];
    const x = this.rockX[index];
    const y = this.rockY[index];

    this.score += TIER_SCORES[tier];
    this.shake = Math.min(this.shake + (tier === 0 ? 6 : 3), 12);
    this.emitBurst(x, y, tier === 0 ? 16 : 10, 130 + tier * 40);
    this.removeRock(index);

    if (tier < TIER_RADII.length - 1) {
      const childTier = tier + 1;
      const base = Math.random() * TAU;
      for (let child = 0; child < 2; child += 1) {
        this.addRock(x, y, childTier, base + child * Math.PI + (Math.random() - 0.5));
      }
    }

    this.emitHud();
    if (this.rockCount === 0) {
      this.waveTimer = WAVE_DELAY;
    }
  }

  private destroyShip(): void {
    this.shipAlive = false;
    this.lives -= 1;
    this.shake = 14;
    this.emitBurst(this.shipX, this.shipY, 26, 190);
    this.emitHud();

    if (this.lives <= 0) {
      this.setStatus("over");
      return;
    }
    this.respawnTimer = RESPAWN_DELAY;
  }

  private spawnShip(): void {
    this.shipX = this.width * 0.5;
    this.shipY = this.height * 0.5;
    this.shipVx = 0;
    this.shipVy = 0;
    this.shipAngle = -Math.PI / 2;
    this.shipAlive = true;
    this.invulnerableTimer = INVULNERABLE_SECONDS;
  }

  private spawnPointIsClear(): boolean {
    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;

    for (let rock = 0; rock < this.rockCount; rock += 1) {
      const reach = SPAWN_CLEARANCE + TIER_RADII[this.rockTier[rock]];
      const dx = wrapDelta(centerX - this.rockX[rock], this.width);
      const dy = wrapDelta(centerY - this.rockY[rock], this.height);
      if (dx * dx + dy * dy < reach * reach) {
        return false;
      }
    }
    return true;
  }

  private startWave(): void {
    this.wave += 1;
    const count = Math.min(3 + this.wave, 9);

    for (let index = 0; index < count; index += 1) {
      // Rocks enter from the rim so a wave never materialises on top of the ship.
      const alongEdge = Math.random();
      const onVerticalEdge = Math.random() < 0.5;
      const x = onVerticalEdge ? (Math.random() < 0.5 ? 0 : this.width) : alongEdge * this.width;
      const y = onVerticalEdge ? alongEdge * this.height : Math.random() < 0.5 ? 0 : this.height;
      this.addRock(x, y, 0, Math.random() * TAU);
    }

    this.emitHud();
  }

  private addRock(x: number, y: number, tier: number, heading: number): void {
    if (this.rockCount >= MAX_ASTEROIDS) {
      return;
    }

    const index = this.rockCount;
    this.rockCount += 1;

    const speed = TIER_SPEEDS[tier] * (0.7 + Math.random() * 0.6) * (1 + this.wave * 0.04);
    this.rockX[index] = x;
    this.rockY[index] = y;
    this.rockVx[index] = Math.cos(heading) * speed;
    this.rockVy[index] = Math.sin(heading) * speed;
    this.rockPitch[index] = Math.random() * TAU;
    this.rockYaw[index] = Math.random() * TAU;
    this.rockPitchSpin[index] = (Math.random() - 0.5) * 1.4;
    this.rockYawSpin[index] = (Math.random() - 0.5) * 1.4;
    this.rockTier[index] = tier;
    this.rockVariant[index] = Math.floor(Math.random() * SHAPE_VARIANTS);
  }

  private fireBullet(): void {
    if (this.bulletCount >= MAX_BULLETS) {
      return;
    }

    const index = this.bulletCount;
    this.bulletCount += 1;
    this.fireTimer = FIRE_INTERVAL;

    const cos = Math.cos(this.shipAngle);
    const sin = Math.sin(this.shipAngle);
    this.bulletX[index] = this.shipX + cos * SHIP_RADIUS;
    this.bulletY[index] = this.shipY + sin * SHIP_RADIUS;
    this.bulletVx[index] = this.shipVx + cos * BULLET_SPEED;
    this.bulletVy[index] = this.shipVy + sin * BULLET_SPEED;
    this.bulletLife[index] = BULLET_LIFE;
  }

  private emitBurst(x: number, y: number, count: number, speed: number): void {
    for (let index = 0; index < count; index += 1) {
      const heading = Math.random() * TAU;
      const reach = speed * (0.3 + Math.random() * 0.7);
      this.addParticle(
        x,
        y,
        Math.cos(heading) * reach,
        Math.sin(heading) * reach,
        0.4 + Math.random() * 0.5,
        index % PARTICLE_COLORS.length,
      );
    }
  }

  private emitThrustSpark(): void {
    const heading = this.shipAngle + Math.PI + (Math.random() - 0.5) * 0.6;
    this.addParticle(
      this.shipX + Math.cos(heading) * 9,
      this.shipY + Math.sin(heading) * 9,
      this.shipVx * 0.4 + Math.cos(heading) * 110,
      this.shipVy * 0.4 + Math.sin(heading) * 110,
      0.22,
      1,
    );
  }

  private addParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    span: number,
    color: number,
  ): void {
    // The pool is a hard cap rather than a growable list: past it the newest spark is simply
    // dropped, which is invisible in a burst and keeps the frame's memory ceiling fixed.
    if (this.particleCount >= MAX_PARTICLES) {
      return;
    }

    const index = this.particleCount;
    this.particleCount += 1;
    this.particleX[index] = x;
    this.particleY[index] = y;
    this.particleVx[index] = vx;
    this.particleVy[index] = vy;
    this.particleLife[index] = span;
    this.particleSpan[index] = span;
    this.particleColor[index] = color;
  }

  private removeBullet(index: number): void {
    this.bulletCount -= 1;
    const last = this.bulletCount;
    if (index === last) {
      return;
    }
    this.bulletX[index] = this.bulletX[last];
    this.bulletY[index] = this.bulletY[last];
    this.bulletVx[index] = this.bulletVx[last];
    this.bulletVy[index] = this.bulletVy[last];
    this.bulletLife[index] = this.bulletLife[last];
  }

  private removeRock(index: number): void {
    this.rockCount -= 1;
    const last = this.rockCount;
    if (index === last) {
      return;
    }
    this.rockX[index] = this.rockX[last];
    this.rockY[index] = this.rockY[last];
    this.rockVx[index] = this.rockVx[last];
    this.rockVy[index] = this.rockVy[last];
    this.rockPitch[index] = this.rockPitch[last];
    this.rockYaw[index] = this.rockYaw[last];
    this.rockPitchSpin[index] = this.rockPitchSpin[last];
    this.rockYawSpin[index] = this.rockYawSpin[last];
    this.rockTier[index] = this.rockTier[last];
    this.rockVariant[index] = this.rockVariant[last];
  }

  private removeParticle(index: number): void {
    this.particleCount -= 1;
    const last = this.particleCount;
    if (index === last) {
      return;
    }
    this.particleX[index] = this.particleX[last];
    this.particleY[index] = this.particleY[last];
    this.particleVx[index] = this.particleVx[last];
    this.particleVy[index] = this.particleVy[last];
    this.particleLife[index] = this.particleLife[last];
    this.particleSpan[index] = this.particleSpan[last];
    this.particleColor[index] = this.particleColor[last];
  }

  private wrapX(value: number): number {
    if (value < 0) {
      return value + this.width;
    }
    if (value >= this.width) {
      return value - this.width;
    }
    return value;
  }

  private wrapY(value: number): number {
    if (value < 0) {
      return value + this.height;
    }
    if (value >= this.height) {
      return value - this.height;
    }
    return value;
  }

  private containEntities(): void {
    this.shipX = Math.min(this.shipX, this.width);
    this.shipY = Math.min(this.shipY, this.height);
    for (let rock = 0; rock < this.rockCount; rock += 1) {
      this.rockX[rock] = Math.min(this.rockX[rock], this.width);
      this.rockY[rock] = Math.min(this.rockY[rock], this.height);
    }
  }

  private seedStars(): void {
    for (let index = 0; index < STAR_COUNT; index += 1) {
      const offset = index * 3;
      this.stars[offset] = Math.random() * this.width;
      this.stars[offset + 1] = Math.random() * this.height;
      this.stars[offset + 2] = Math.random() < 0.2 ? 2 : 1;
    }
  }

  /** Drifting rocks behind the idle overlay, so the board is never an empty rectangle. */
  private layoutAttractField(): void {
    this.rockCount = 0;
    this.bulletCount = 0;
    this.particleCount = 0;
    this.shipAlive = false;

    for (let index = 0; index < 5; index += 1) {
      this.addRock(
        Math.random() * this.width,
        Math.random() * this.height,
        index % 2,
        Math.random() * TAU,
      );
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.fillStyle = BACKDROP;
    ctx.fillRect(0, 0, this.width, this.height);

    this.renderStars();

    const shakeX = this.shake === 0 ? 0 : (Math.random() - 0.5) * this.shake;
    const shakeY = this.shake === 0 ? 0 : (Math.random() - 0.5) * this.shake;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    ctx.lineJoin = "round";
    this.renderRocks();
    this.renderBullets();
    this.renderParticles();
    if (this.shipAlive) {
      this.renderShip();
    }

    ctx.restore();

    this.compositor?.draw(this.canvas, this.elapsed);
  }

  private renderStars(): void {
    const ctx = this.ctx;
    ctx.fillStyle = STAR_DIM;
    for (let index = 0; index < STAR_COUNT; index += 1) {
      const offset = index * 3;
      const size = this.stars[offset + 2];
      if (size > 1) {
        continue;
      }
      ctx.fillRect(this.stars[offset], this.stars[offset + 1], 1, 1);
    }

    ctx.fillStyle = STAR_BRIGHT;
    for (let index = 0; index < STAR_COUNT; index += 1) {
      const offset = index * 3;
      if (this.stars[offset + 2] <= 1) {
        continue;
      }
      ctx.fillRect(this.stars[offset], this.stars[offset + 1], 2, 2);
    }
  }

  /**
   * Draws each rock as a tumbling 3D wireframe: the mesh is rotated around two axes, projected
   * with a mild perspective, and its 30 edges stroked in a single path per rock.
   */
  private renderRocks(): void {
    const ctx = this.ctx;
    const meshes = rockMeshes();
    const edges = rockEdges();
    ctx.lineWidth = 1.25;

    for (let index = 0; index < this.rockCount; index += 1) {
      const tier = this.rockTier[index];
      const mesh = meshes[tier][this.rockVariant[index]];
      const radius = TIER_RADII[tier];
      const focal = radius * ROCK_FOCAL_RADII;

      const cosPitch = Math.cos(this.rockPitch[index]);
      const sinPitch = Math.sin(this.rockPitch[index]);
      const cosYaw = Math.cos(this.rockYaw[index]);
      const sinYaw = Math.sin(this.rockYaw[index]);

      for (let vertex = 0; vertex < ROCK_VERTEX_COUNT; vertex += 1) {
        const x = mesh[vertex * 3];
        const y = mesh[vertex * 3 + 1];
        const z = mesh[vertex * 3 + 2];
        const rotatedY = y * cosPitch - z * sinPitch;
        const pitchedZ = y * sinPitch + z * cosPitch;
        const rotatedX = x * cosYaw + pitchedZ * sinYaw;
        const rotatedZ = -x * sinYaw + pitchedZ * cosYaw;
        const perspective = focal / (focal - rotatedZ);
        this.projectedX[vertex] = rotatedX * perspective;
        this.projectedY[vertex] = rotatedY * perspective;
      }

      const copies = this.spreadWrapped(this.rockX[index], this.rockY[index], radius * 1.4);
      ctx.strokeStyle = TIER_COLORS[tier];
      ctx.beginPath();
      for (let copy = 0; copy < copies; copy += 1) {
        const offsetX = this.wrapSpreadX[copy];
        const offsetY = this.wrapSpreadY[copy];
        for (let edge = 0; edge < edges.length; edge += 2) {
          const a = edges[edge];
          const b = edges[edge + 1];
          ctx.moveTo(offsetX + this.projectedX[a], offsetY + this.projectedY[a]);
          ctx.lineTo(offsetX + this.projectedX[b], offsetY + this.projectedY[b]);
        }
      }
      ctx.stroke();
    }
  }

  private renderBullets(): void {
    const ctx = this.ctx;

    ctx.fillStyle = BULLET_HALO;
    for (let index = 0; index < this.bulletCount; index += 1) {
      ctx.beginPath();
      ctx.arc(this.bulletX[index], this.bulletY[index], 6, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = BULLET_COLOR;
    for (let index = 0; index < this.bulletCount; index += 1) {
      ctx.beginPath();
      ctx.arc(this.bulletX[index], this.bulletY[index], 2.4, 0, TAU);
      ctx.fill();
    }
  }

  private renderParticles(): void {
    const ctx = this.ctx;

    // Grouped by colour so a 300-spark burst costs three `fillStyle` writes instead of three
    // hundred.
    for (let color = 0; color < PARTICLE_COLORS.length; color += 1) {
      ctx.fillStyle = PARTICLE_COLORS[color];
      for (let index = 0; index < this.particleCount; index += 1) {
        if (this.particleColor[index] !== color) {
          continue;
        }
        ctx.globalAlpha = this.particleLife[index] / this.particleSpan[index];
        ctx.fillRect(this.particleX[index] - 1, this.particleY[index] - 1, 2, 2);
      }
    }

    ctx.globalAlpha = 1;
  }

  private renderShip(): void {
    // Blink through the grace period so the player can see they are not yet solid.
    if (this.invulnerableTimer > 0 && Math.floor(this.elapsed * 10) % 2 === 0) {
      return;
    }

    const ctx = this.ctx;
    const flaming = this.input.thrust && Math.floor(this.elapsed * 30) % 2 === 0;
    ctx.lineWidth = 2;

    const copies = this.spreadWrapped(this.shipX, this.shipY, SHIP_RADIUS + 6);
    for (let copy = 0; copy < copies; copy += 1) {
      ctx.save();
      ctx.translate(this.wrapSpreadX[copy], this.wrapSpreadY[copy]);
      ctx.rotate(this.shipAngle);
      if (flaming) {
        ctx.strokeStyle = THRUST_COLOR;
        ctx.stroke(flamePath());
      }
      ctx.strokeStyle = SHIP_COLOR;
      ctx.stroke(shipPath());
      ctx.restore();
    }
  }

  /**
   * Fills `wrapSpreadX/Y` with the entity's position plus a mirrored copy for every board edge it
   * currently straddles, so shapes cross the seam whole instead of popping to the other side.
   *
   * Returns the number of copies to draw. Writing into shared buffers rather than returning a list
   * — or taking a draw callback — keeps the render pass free of per-entity allocations.
   */
  private spreadWrapped(x: number, y: number, radius: number): number {
    this.wrapSpreadX[0] = x;
    this.wrapSpreadY[0] = y;
    let count = 1;

    const offsetX = x < radius ? this.width : x > this.width - radius ? -this.width : 0;
    const offsetY = y < radius ? this.height : y > this.height - radius ? -this.height : 0;

    if (offsetX !== 0) {
      this.wrapSpreadX[count] = x + offsetX;
      this.wrapSpreadY[count] = y;
      count += 1;
    }
    if (offsetY !== 0) {
      this.wrapSpreadX[count] = x;
      this.wrapSpreadY[count] = y + offsetY;
      count += 1;
    }
    if (offsetX !== 0 && offsetY !== 0) {
      this.wrapSpreadX[count] = x + offsetX;
      this.wrapSpreadY[count] = y + offsetY;
      count += 1;
    }

    return count;
  }
}
