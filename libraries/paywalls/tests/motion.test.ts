import { describe, expect, it } from "vitest";

import { createManualFrameDriver, animateMotionValue } from "../src/motion/animation";
import { resolveDragGestureWinner } from "../src/motion/drag";
import { resolveMotionRestStyle } from "../src/motion/resolve";
import { compileMotionCss, compileMotionTransform } from "../src/motion/transform";
import { motionValue } from "../src/motion/value";

describe("motion values", () => {
  it("keeps previous values and reports updates without React state", () => {
    const value = motionValue(1);
    const values: number[] = [];
    const unsubscribe = value.on("change", (next) => values.push(next));
    value.set(4);
    value.set(4);
    value.set(9);
    unsubscribe();

    expect(value.get()).toBe(9);
    expect(value.getPrevious()).toBe(4);
    expect(values).toEqual([4, 9]);
  });

  it("supports interruptible manual-clock tween animation", () => {
    const driver = createManualFrameDriver();
    const value = motionValue(0);
    const stop = animateMotionValue(value, 10, { duration: 0.1 }, driver);
    driver.step(0);
    driver.step(50);
    expect(value.get()).toBe(5);
    stop();
    driver.step(100);
    expect(value.get()).toBe(5);
  });
});

describe("motion visual output", () => {
  it("uses one canonical transform order", () => {
    expect(compileMotionTransform({ rotate: 12, scale: 1.1, scaleX: 0.9, x: 8, y: -4 })).toBe(
      "translate3d(8px, -4px, 0) rotate(12deg) scale(1.1) scaleX(0.9)",
    );
    expect(compileMotionCss({ transformOrigin: { x: 0.25, y: 1 } })).toEqual({
      transformOrigin: "25% 100%",
    });
  });

  it("gives animate variants precedence over literal motion style", () => {
    expect(
      resolveMotionRestStyle(
        { animate: "open", variants: { open: { opacity: 1, y: 0 } } },
        { opacity: 0.5, x: 8, y: 24 },
      ),
    ).toEqual({ opacity: 1, x: 8, y: 0 });
  });
});

describe("drag arbitration", () => {
  it("keeps a horizontal card draggable in a vertical scroll and reserves matching axes by default", () => {
    expect(resolveDragGestureWinner({ direction: "x", drag: "x", scrollAxis: "y" })).toBe("drag");
    expect(resolveDragGestureWinner({ direction: "y", drag: "y", scrollAxis: "y" })).toBe("scroll");
    expect(
      resolveDragGestureWinner({ direction: "y", drag: "y", gesturePriority: "drag", scrollAxis: "y" }),
    ).toBe("drag");
  });
});
