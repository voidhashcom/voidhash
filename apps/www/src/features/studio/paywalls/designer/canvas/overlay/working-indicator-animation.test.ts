import { describe, expect, it } from "vitest";

import {
  advanceWorkingIndicator,
  createWorkingIndicatorAnimation,
  forEachWorkingIndicatorDot,
  getWorkingIndicatorDotRadius,
  setWorkingIndicatorActive,
  syncWorkingIndicatorScreens,
  updateWorkingIndicatorViewport,
  type WorkingIndicatorAnimation,
} from "./working-indicator-animation";

const SCREEN = {
  height: 844,
  id: "screen-1",
  width: 390,
  x: 0,
  y: 0,
};

const advanceTo = (animation: WorkingIndicatorAnimation, from: number, to: number) => {
  for (let now = from; now <= to; now += 16) {
    advanceWorkingIndicator(animation, now, 16);
  }
};

const readDots = (animation: WorkingIndicatorAnimation) => {
  const dots: Array<{
    alpha: number;
    depth: number;
    displacement: number;
    proximity: number;
    radius: number;
    sizeScale: number;
    x: number;
    y: number;
  }> = [];
  forEachWorkingIndicatorDot(animation, (dot, viewport) => {
    const homeX = dot.hx * viewport.scale + viewport.x;
    const homeY = dot.hy * viewport.scale + viewport.y;
    dots.push({
      alpha: dot.alpha,
      depth: dot.depth,
      displacement: Math.hypot(dot.x - homeX, dot.y - homeY),
      proximity: dot.proximity,
      radius: getWorkingIndicatorDotRadius(dot, viewport.scale),
      sizeScale: dot.sizeScale,
      x: dot.x,
      y: dot.y,
    });
  });
  return dots;
};

describe("working indicator animation", () => {
  it("uses three rows that grow toward the screen", () => {
    const animation = createWorkingIndicatorAnimation();
    syncWorkingIndicatorScreens(animation, [SCREEN]);

    const scalesByDepth = new Map(readDots(animation).map((dot) => [dot.depth, dot.sizeScale]));
    expect([...scalesByDepth.keys()].sort()).toEqual([1, 2, 3]);
    expect(scalesByDepth.get(1)).toBeCloseTo(1);
    expect(scalesByDepth.get(2)).toBeCloseTo(2 / 3);
    expect(scalesByDepth.get(3)).toBeCloseTo(1 / 3);
  });

  it("runs the magnetic wave while dots are entering and exiting", () => {
    const animation = createWorkingIndicatorAnimation();
    syncWorkingIndicatorScreens(animation, [SCREEN]);
    setWorkingIndicatorActive(animation, true, 0);

    advanceTo(animation, 0, 400);
    const enteringDots = readDots(animation);
    expect(animation.phase).toBe("starting");
    expect(enteringDots.some((dot) => dot.alpha > 0)).toBe(true);
    expect(enteringDots.some((dot) => dot.alpha > 0 && dot.proximity > 0)).toBe(true);

    advanceTo(animation, 416, 2200);
    expect(animation.phase).toBe("looping");
    setWorkingIndicatorActive(animation, false, 2200);
    advanceTo(animation, 2216, 2600);

    const exitingDots = readDots(animation);
    expect(animation.phase).toBe("ending");
    expect(exitingDots.some((dot) => dot.alpha > 0 && dot.alpha < 1)).toBe(true);
    expect(exitingDots.some((dot) => dot.alpha > 0 && dot.proximity > 0)).toBe(true);

    advanceTo(animation, 2616, 4200);
    expect(animation.phase).toBe("idle");
    expect(readDots(animation).every((dot) => dot.alpha === 0)).toBe(true);
  });

  it("keeps in-flight dots aligned with viewport pan and zoom", () => {
    const animation = createWorkingIndicatorAnimation();
    syncWorkingIndicatorScreens(animation, [SCREEN]);
    setWorkingIndicatorActive(animation, true, 0);
    advanceTo(animation, 0, 400);
    const before = readDots(animation)[0];
    expect(before).toBeDefined();

    updateWorkingIndicatorViewport(animation, { scale: 2, x: 50, y: 30 });
    const after = readDots(animation)[0];
    expect(after).toBeDefined();
    expect(after?.x).toBeCloseTo((before?.x ?? 0) * 2 + 50);
    expect(after?.y).toBeCloseTo((before?.y ?? 0) * 2 + 30);
    expect(after?.radius).toBeCloseTo((before?.radius ?? 0) * 2);
  });
});
