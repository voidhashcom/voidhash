import { describe, expect, test } from "vite-plus/test";

import type { GradientStop } from "../../../state/actions/features/fill-style-actions";
import { nextStopPosition } from "./gradient-stops";

function stops(...positions: number[]): GradientStop[] {
  return positions.map((position) => ({ color: "rgba(0, 0, 0, 1)", position }));
}

describe("nextStopPosition", () => {
  test("returns 0.5 with no stops", () => {
    expect(nextStopPosition([])).toBe(0.5);
  });

  test("splits the largest interior gap", () => {
    expect(nextStopPosition(stops(0, 0.2, 1))).toBeCloseTo(0.6, 10);
  });

  test("uses the trailing edge span [last, 1] when it is largest", () => {
    // Regression: interior-only scan inserted at 0.85 instead of the true
    // largest span [0, 0.8], whose midpoint is 0.4.
    expect(nextStopPosition(stops(0.8, 0.9))).toBeCloseTo(0.4, 10);
  });

  test("uses the leading edge span [0, first] when it is largest", () => {
    expect(nextStopPosition(stops(0.7, 0.85, 1))).toBeCloseTo(0.35, 10);
  });

  test("degenerate all-equal positions resolve via an edge span", () => {
    // Both at 0.5: largest span is the tie [0, 0.5] (first-wins), midpoint 0.25.
    expect(nextStopPosition(stops(0.5, 0.5))).toBeCloseTo(0.25, 10);
  });

  test("always returns a finite position within [0, 1]", () => {
    for (const s of [stops(0), stops(1), stops(0, 1), stops(0.3, 0.3, 0.3)]) {
      const pos = nextStopPosition(s);
      expect(Number.isFinite(pos)).toBe(true);
      expect(pos).toBeGreaterThanOrEqual(0);
      expect(pos).toBeLessThanOrEqual(1);
    }
  });
});
