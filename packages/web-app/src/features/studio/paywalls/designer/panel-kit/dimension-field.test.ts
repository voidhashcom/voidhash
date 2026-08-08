import type { AlignItems, AlignSelf } from "@voidhash/mimic-schema";
import { describe, expect, test } from "vite-plus/test";

import {
  customAlignSelf,
  dimensionModeWrite,
  getDimensionState,
  hugAlignSelf,
  type DimensionAxis,
} from "./dimension-field";

/** A minimal flex-sizing node for the pure derivation under test. */
const node = (
  over: Partial<{
    width: number | "auto";
    height: number | "auto";
    flex: number | undefined;
    alignSelf: AlignSelf;
  }> = {},
) =>
  ({
    width: "auto",
    height: "auto",
    flex: undefined,
    alignSelf: "auto",
    ...over,
    // The kit types the node through NodeEditorProps; this shape is sufficient.
  }) as never;

describe("getDimensionState — cross axis (parent stretches the axis)", () => {
  // Width is the cross axis under a COLUMN parent.
  test("numeric cross size is custom even when parent + alignSelf stretch", () => {
    expect(getDimensionState("width", node({ width: 120, alignSelf: "stretch" }), "column", "stretch")).toBe(
      "custom",
    );
  });

  test("auto cross size + explicit alignSelf stretch is fill (any parent alignItems)", () => {
    expect(getDimensionState("width", node({ alignSelf: "stretch" }), "column", "flex-start")).toBe("fill");
  });

  test("auto cross size + alignSelf auto + parent stretch is fill (container-driven)", () => {
    expect(getDimensionState("width", node({ alignSelf: "auto" }), "column", "stretch")).toBe("fill");
  });

  test("auto cross size + alignSelf auto + parent NOT stretch is hug", () => {
    expect(getDimensionState("width", node({ alignSelf: "auto" }), "column", "flex-start")).toBe("hug");
  });

  test("auto cross size + explicit non-stretch alignSelf is hug", () => {
    expect(getDimensionState("width", node({ alignSelf: "center" }), "column", "stretch")).toBe("hug");
  });

  test("height is the cross axis under a ROW parent", () => {
    expect(getDimensionState("height", node({ alignSelf: "auto" }), "row", "stretch")).toBe("fill");
    expect(getDimensionState("height", node({ height: 80 }), "row", "stretch")).toBe("custom");
  });
});

describe("getDimensionState — main axis (fill via flex)", () => {
  test("flex:1 on the main axis is fill", () => {
    expect(getDimensionState("width", node({ flex: 1 }), "row", "stretch")).toBe("fill");
  });

  test("auto main size (no flex) is hug", () => {
    expect(getDimensionState("width", node({ width: "auto" }), "row", "stretch")).toBe("hug");
  });

  test("numeric main size is custom", () => {
    expect(getDimensionState("width", node({ width: 200 }), "row", "stretch")).toBe("custom");
  });

  test("height is the main axis under a COLUMN parent", () => {
    expect(getDimensionState("height", node({ flex: 1 }), "column", "stretch")).toBe("fill");
    expect(getDimensionState("height", node({ height: "auto" }), "column", "stretch")).toBe("hug");
  });
});

describe("hugAlignSelf", () => {
  test("preserves an explicit non-stretch alignment", () => {
    expect(hugAlignSelf("center", "stretch")).toBe("center");
    expect(hugAlignSelf("flex-end", "flex-start")).toBe("flex-end");
  });

  test("opts out of a stretch-by-default parent with flex-start", () => {
    expect(hugAlignSelf("auto", "stretch")).toBe("flex-start");
    expect(hugAlignSelf("stretch", "stretch")).toBe("flex-start");
  });

  test("stays auto when the parent does not stretch", () => {
    expect(hugAlignSelf("auto", "flex-start")).toBe("auto");
    expect(hugAlignSelf("stretch", "center")).toBe("auto");
  });
});

describe("customAlignSelf", () => {
  test("clears auto/stretch to auto (numeric size defeats stretch)", () => {
    expect(customAlignSelf("auto")).toBe("auto");
    expect(customAlignSelf("stretch")).toBe("auto");
  });

  test("preserves an explicit alignment", () => {
    expect(customAlignSelf("center")).toBe("center");
    expect(customAlignSelf("flex-end")).toBe("flex-end");
  });
});

describe("dimensionModeWrite", () => {
  const opts = (over: Partial<{ parentAlignItems: AlignItems; currentAlignSelf: AlignSelf }> = {}) => ({
    effectivePx: 100,
    parentDirection: "column" as const,
    parentAlignItems: "stretch" as AlignItems,
    currentAlignSelf: "auto" as AlignSelf,
    ...over,
  });

  test("fill on the cross axis writes auto + alignSelf stretch", () => {
    expect(dimensionModeWrite("width", "fill", opts())).toEqual({ width: "auto", alignSelf: "stretch" });
  });

  test("fill on the main axis writes auto + flex:1", () => {
    const write = dimensionModeWrite("width", "fill", { ...opts(), parentDirection: "row" });
    expect(write).toEqual({ width: "auto", flex: 1 });
  });

  test("hug on the cross axis opts out with flex-start under a stretch parent", () => {
    expect(dimensionModeWrite("width", "hug", opts())).toEqual({ width: "auto", alignSelf: "flex-start" });
  });

  test("hug on the cross axis preserves an explicit alignment", () => {
    expect(dimensionModeWrite("width", "hug", opts({ currentAlignSelf: "center" }))).toEqual({
      width: "auto",
      alignSelf: "center",
    });
  });

  test("hug on the main axis clears flex", () => {
    const write = dimensionModeWrite("width", "hug", { ...opts(), parentDirection: "row" });
    expect(write).toEqual({ width: "auto", flex: undefined });
    expect("flex" in write).toBe(true);
  });

  test("custom on the cross axis writes px + clears stretch to auto", () => {
    expect(dimensionModeWrite("width", "custom", opts({ currentAlignSelf: "stretch" }))).toEqual({
      width: 100,
      alignSelf: "auto",
    });
  });

  test("custom on the cross axis preserves an explicit alignment", () => {
    expect(dimensionModeWrite("width", "custom", opts({ currentAlignSelf: "center" }))).toEqual({
      width: 100,
      alignSelf: "center",
    });
  });

  test("custom on the main axis writes px + clears flex", () => {
    const write = dimensionModeWrite("width", "custom", { ...opts(), parentDirection: "row" });
    expect(write).toEqual({ width: 100, flex: undefined });
  });

  test("height axis targets the height key", () => {
    const axis: DimensionAxis = "height";
    expect(dimensionModeWrite(axis, "fill", { ...opts(), parentDirection: "row" })).toEqual({
      height: "auto",
      alignSelf: "stretch",
    });
  });
});
