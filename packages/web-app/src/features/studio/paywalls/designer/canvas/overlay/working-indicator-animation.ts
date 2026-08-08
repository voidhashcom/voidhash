export type WorkingIndicatorPhase = "idle" | "starting" | "looping" | "ending";

export interface WorkingIndicatorScreen {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorkingIndicatorViewport {
  scale: number;
  x: number;
  y: number;
}

interface AxisPoint {
  depth: number;
  value: number;
}

export interface WorkingIndicatorDot {
  alpha: number;
  delay: number;
  depth: number;
  hx: number;
  hy: number;
  proximity: number;
  sizeScale: number;
  sx: number;
  sy: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

interface WorkingIndicatorGrid {
  diagonalMaximum: number;
  diagonalMinimum: number;
  dots: WorkingIndicatorDot[];
  id: string;
  maximumDelay: number;
  signature: string;
  spacing: number;
}

export interface WorkingIndicatorAnimation {
  active: boolean;
  grids: WorkingIndicatorGrid[];
  loopStartedAt: number | null;
  maximumDelay: number;
  phase: WorkingIndicatorPhase;
  phaseStartedAt: number;
  viewport: WorkingIndicatorViewport;
}

export const WORKING_INDICATOR_DOT_SIZE = 3;

const ROWS = 3;
const DOT_COUNT = 41;
const NEAR_PULL = 0.3;
const ENTRY_DIAGONAL_STAGGER = 760;
const ENTRY_DEPTH_STAGGER = 180;
const ENTRY_FADE_DURATION = 360;
const ENTRY_SETTLE_DURATION = 900;
const EXIT_FADE_DURATION = 320;
const EXIT_SETTLE_DURATION = 720;
const LOOP_DURATION = 4200;
const LOOP_START_DELAY = 220;
const NORMAL_X = Math.SQRT1_2;
const NORMAL_Y = -Math.SQRT1_2;

/** Returns a dot's rendered radius at the current designer zoom. */
export function getWorkingIndicatorDotRadius(
  dot: WorkingIndicatorDot,
  viewportScale: number,
): number {
  return (
    (WORKING_INDICATOR_DOT_SIZE / 2) *
    dot.sizeScale *
    Math.max(0, viewportScale) *
    (1 + dot.proximity * 0.18)
  );
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const smoothstep = (value: number) => {
  const progress = clamp(value, 0, 1);
  return progress * progress * (3 - 2 * progress);
};

const toScreenX = (value: number, viewport: WorkingIndicatorViewport) =>
  value * viewport.scale + viewport.x;

const toScreenY = (value: number, viewport: WorkingIndicatorViewport) =>
  value * viewport.scale + viewport.y;

const buildInnerAxis = (start: number, end: number, count: number): AxisPoint[] => {
  const pointCount = Math.max(2, Math.round(count));
  const step = (end - start) / (pointCount - 1);
  return Array.from({ length: pointCount }, (_, index) => ({
    depth: 0,
    value: start + step * index,
  }));
};

const buildAxis = (
  start: number,
  end: number,
  innerCount: number,
  spacing: number,
): AxisPoint[] => [
  ...Array.from({ length: ROWS }, (_, index) => ({
    depth: ROWS - index,
    value: start - spacing * (ROWS - index),
  })),
  ...buildInnerAxis(start, end, innerCount),
  ...Array.from({ length: ROWS }, (_, index) => ({
    depth: index + 1,
    value: end + spacing * (index + 1),
  })),
];

const getStartPosition = (
  hx: number,
  hy: number,
  screen: WorkingIndicatorScreen,
  spacing: number,
) => {
  const right = screen.x + screen.width;
  const bottom = screen.y + screen.height;
  const horizontalDistance = hx < screen.x ? screen.x - hx : hx - right;
  const verticalDistance = hy < screen.y ? screen.y - hy : hy - bottom;
  const diagonalOffset = Math.min(
    Math.max(horizontalDistance, verticalDistance) * 0.45,
    spacing * 1.25,
  );

  if (horizontalDistance > 0 && (verticalDistance <= 0 || horizontalDistance <= verticalDistance)) {
    return {
      x: hx < screen.x ? screen.x : right,
      y: hy + diagonalOffset,
    };
  }

  return {
    x: hx - diagonalOffset,
    y: hy < screen.y ? screen.y : bottom,
  };
};

const buildGrid = (
  screen: WorkingIndicatorScreen,
  phase: WorkingIndicatorPhase,
  viewport: WorkingIndicatorViewport,
): WorkingIndicatorGrid => {
  const right = screen.x + screen.width;
  const bottom = screen.y + screen.height;
  const spacing = screen.width / Math.max(1, DOT_COUNT - 1);
  const verticalCount = Math.max(2, Math.round(screen.height / spacing)) + 1;
  const xAxis = buildAxis(screen.x, right, DOT_COUNT, spacing);
  const yAxis = buildAxis(screen.y, bottom, verticalCount, spacing);
  const dots: WorkingIndicatorDot[] = [];

  for (const xPoint of xAxis) {
    for (const yPoint of yAxis) {
      if (xPoint.depth === 0 && yPoint.depth === 0) {
        continue;
      }

      const start = getStartPosition(xPoint.value, yPoint.value, screen, spacing);
      const atStart = phase === "starting";
      const depth = Math.max(xPoint.depth, yPoint.depth);
      dots.push({
        alpha: phase === "idle" || atStart ? 0 : 1,
        delay: 0,
        depth,
        hx: xPoint.value,
        hy: yPoint.value,
        proximity: 0,
        sizeScale: (ROWS - depth + 1) / ROWS,
        sx: start.x,
        sy: start.y,
        vx: 0,
        vy: 0,
        x: toScreenX(atStart ? start.x : xPoint.value, viewport),
        y: toScreenY(atStart ? start.y : yPoint.value, viewport),
      });
    }
  }

  const diagonalMinimum = Math.min(...dots.map((dot) => dot.hx - dot.hy));
  const diagonalMaximum = Math.max(...dots.map((dot) => dot.hx - dot.hy));
  const diagonalRange = Math.max(1, diagonalMaximum - diagonalMinimum);

  for (const dot of dots) {
    const diagonalProgress = (dot.hx - dot.hy - diagonalMinimum) / diagonalRange;
    const distanceFromEdge = Math.hypot(dot.hx - dot.sx, dot.hy - dot.sy);
    const depthProgress = clamp(distanceFromEdge / (spacing * ROWS), 0, 1);
    dot.delay = diagonalProgress * ENTRY_DIAGONAL_STAGGER + depthProgress * ENTRY_DEPTH_STAGGER;
  }

  return {
    diagonalMaximum,
    diagonalMinimum,
    dots,
    id: screen.id,
    maximumDelay: Math.max(...dots.map((dot) => dot.delay)),
    signature: `${screen.x}:${screen.y}:${screen.width}:${screen.height}`,
    spacing,
  };
};

const setPhase = (
  animation: WorkingIndicatorAnimation,
  phase: WorkingIndicatorPhase,
  now: number,
) => {
  if (animation.phase === phase) {
    return;
  }

  animation.phase = phase;
  animation.phaseStartedAt = now;

  if (phase === "starting") {
    animation.loopStartedAt = now + LOOP_START_DELAY;
    for (const grid of animation.grids) {
      for (const dot of grid.dots) {
        dot.alpha = 0;
        dot.proximity = 0;
        dot.vx = 0;
        dot.vy = 0;
        dot.x = toScreenX(dot.sx, animation.viewport);
        dot.y = toScreenY(dot.sy, animation.viewport);
      }
    }
  }

  if (phase === "idle") {
    animation.loopStartedAt = null;
    for (const grid of animation.grids) {
      for (const dot of grid.dots) {
        dot.alpha = 0;
        dot.proximity = 0;
      }
    }
  }
};

const springTo = (
  dot: WorkingIndicatorDot,
  targetX: number,
  targetY: number,
  frameScale: number,
) => {
  dot.vx += (targetX - dot.x) * 0.11 * frameScale;
  dot.vy += (targetY - dot.y) * 0.11 * frameScale;
  const damping = 0.74 ** frameScale;
  dot.vx *= damping;
  dot.vy *= damping;
  dot.x += dot.vx * frameScale;
  dot.y += dot.vy * frameScale;
};

const springToMagneticTarget = (
  animation: WorkingIndicatorAnimation,
  dot: WorkingIndicatorDot,
  baseX: number,
  baseY: number,
  linePosition: number | null,
  attractionRadius: number,
  physicsSpacing: number,
  frameScale: number,
) => {
  const targetX = toScreenX(baseX, animation.viewport);
  const targetY = toScreenY(baseY, animation.viewport);
  if (linePosition === null) {
    dot.proximity = 0;
    springTo(dot, targetX, targetY, frameScale);
    return;
  }

  const homeX = toScreenX(dot.hx, animation.viewport);
  const homeY = toScreenY(dot.hy, animation.viewport);
  const signedDistance = (homeX - homeY - linePosition) * Math.SQRT1_2;
  const distance = Math.abs(signedDistance);
  const proximity = smoothstep(1 - distance / attractionRadius);
  const depthProgress = (dot.depth - 1) / (ROWS - 1);
  const pullIntensity = NEAR_PULL + (1 - NEAR_PULL) * depthProgress;
  const pull =
    Math.sign(signedDistance) *
    Math.min(distance * 0.66, physicsSpacing * 1.35) *
    proximity *
    pullIntensity;

  dot.proximity = proximity;
  springTo(dot, targetX - NORMAL_X * pull, targetY - NORMAL_Y * pull, frameScale);
};

/** Creates an idle working-indicator animation state. */
export function createWorkingIndicatorAnimation(
  viewport: WorkingIndicatorViewport = { scale: 1, x: 0, y: 0 },
): WorkingIndicatorAnimation {
  return {
    active: false,
    grids: [],
    loopStartedAt: null,
    maximumDelay: 0,
    phase: "idle",
    phaseStartedAt: 0,
    viewport,
  };
}

/** Reprojects in-flight dot positions when the designer viewport pans or zooms. */
export function updateWorkingIndicatorViewport(
  animation: WorkingIndicatorAnimation,
  viewport: WorkingIndicatorViewport,
): void {
  const previous = animation.viewport;
  if (previous.scale === viewport.scale && previous.x === viewport.x && previous.y === viewport.y) {
    return;
  }

  const scaleRatio = viewport.scale / previous.scale;
  for (const grid of animation.grids) {
    for (const dot of grid.dots) {
      const worldX = (dot.x - previous.x) / previous.scale;
      const worldY = (dot.y - previous.y) / previous.scale;
      dot.x = worldX * viewport.scale + viewport.x;
      dot.y = worldY * viewport.scale + viewport.y;
      dot.vx *= scaleRatio;
      dot.vy *= scaleRatio;
    }
  }
  animation.viewport = viewport;
}

/** Synchronizes one animated perimeter grid for each current designer screen. */
export function syncWorkingIndicatorScreens(
  animation: WorkingIndicatorAnimation,
  screens: WorkingIndicatorScreen[],
): void {
  const current = new Map(animation.grids.map((grid) => [grid.id, grid]));
  animation.grids = screens.flatMap((screen) => {
    if (
      !(
        Number.isFinite(screen.x) &&
        Number.isFinite(screen.y) &&
        Number.isFinite(screen.width) &&
        Number.isFinite(screen.height)
      ) ||
      screen.width <= 0 ||
      screen.height <= 0
    ) {
      return [];
    }

    const signature = `${screen.x}:${screen.y}:${screen.width}:${screen.height}`;
    const existing = current.get(screen.id);
    return [
      existing?.signature === signature
        ? existing
        : buildGrid(screen, animation.phase, animation.viewport),
    ];
  });
  animation.maximumDelay = Math.max(0, ...animation.grids.map((grid) => grid.maximumDelay));
}

/** Starts or ends the indicator without interrupting the magnetic loop. */
export function setWorkingIndicatorActive(
  animation: WorkingIndicatorAnimation,
  active: boolean,
  now: number,
): void {
  animation.active = active;
  if (active && (animation.phase === "idle" || animation.phase === "ending")) {
    setPhase(animation, "starting", now);
  } else if (!active && (animation.phase === "starting" || animation.phase === "looping")) {
    setPhase(animation, "ending", now);
  }
}

/** Advances spring physics, phase transitions, opacity, and magnetic proximity. */
export function advanceWorkingIndicator(
  animation: WorkingIndicatorAnimation,
  now: number,
  deltaMilliseconds: number,
): void {
  if (animation.phase === "idle") {
    return;
  }

  const frameScale = Math.min(deltaMilliseconds / (1000 / 60), 2);
  const loopElapsed = animation.loopStartedAt === null ? -1 : now - animation.loopStartedAt;

  for (const grid of animation.grids) {
    const physicsSpacing = Math.max(0.1, Math.min(grid.spacing * animation.viewport.scale, 24));
    const attractionRadius = physicsSpacing * 3.2;
    const sweepPadding = attractionRadius * Math.SQRT2;
    const diagonalOffset = animation.viewport.x - animation.viewport.y;
    const diagonalMinimum = grid.diagonalMinimum * animation.viewport.scale + diagonalOffset;
    const diagonalMaximum = grid.diagonalMaximum * animation.viewport.scale + diagonalOffset;
    const sweepProgress = ((loopElapsed % LOOP_DURATION) + LOOP_DURATION) % LOOP_DURATION;
    const linePosition =
      loopElapsed < 0
        ? null
        : diagonalMinimum -
          sweepPadding +
          (sweepProgress / LOOP_DURATION) * (diagonalMaximum - diagonalMinimum + sweepPadding * 2);

    for (const dot of grid.dots) {
      if (animation.phase === "starting") {
        const localElapsed = now - animation.phaseStartedAt - dot.delay;
        if (localElapsed < 0) {
          continue;
        }
        springToMagneticTarget(
          animation,
          dot,
          dot.hx,
          dot.hy,
          linePosition,
          attractionRadius,
          physicsSpacing,
          frameScale,
        );
        dot.alpha = smoothstep(localElapsed / ENTRY_FADE_DURATION);
      } else if (animation.phase === "looping") {
        springToMagneticTarget(
          animation,
          dot,
          dot.hx,
          dot.hy,
          linePosition,
          attractionRadius,
          physicsSpacing,
          frameScale,
        );
        dot.alpha = 1;
      } else if (animation.phase === "ending") {
        const localElapsed = now - animation.phaseStartedAt - dot.delay;
        const isExiting = localElapsed >= 0;
        springToMagneticTarget(
          animation,
          dot,
          isExiting ? dot.sx : dot.hx,
          isExiting ? dot.sy : dot.hy,
          linePosition,
          attractionRadius,
          physicsSpacing,
          frameScale,
        );
        if (isExiting) {
          dot.alpha = 1 - smoothstep(localElapsed / EXIT_FADE_DURATION);
        }
      }
    }
  }

  if (
    animation.phase === "starting" &&
    now - animation.phaseStartedAt > animation.maximumDelay + ENTRY_SETTLE_DURATION
  ) {
    setPhase(animation, "looping", now);
  } else if (
    animation.phase === "ending" &&
    now - animation.phaseStartedAt > animation.maximumDelay + EXIT_SETTLE_DURATION
  ) {
    setPhase(animation, "idle", now);
  }
}

/** Visits the current screen-space render data without allocating a dot array each frame. */
export function forEachWorkingIndicatorDot(
  animation: WorkingIndicatorAnimation,
  visitor: (
    dot: Readonly<WorkingIndicatorDot>,
    viewport: Readonly<WorkingIndicatorViewport>,
  ) => void,
): void {
  for (const grid of animation.grids) {
    for (const dot of grid.dots) {
      visitor(dot, animation.viewport);
    }
  }
}
