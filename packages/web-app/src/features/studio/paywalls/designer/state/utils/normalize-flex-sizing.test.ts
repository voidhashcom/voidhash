import { describe, expect, test } from "vite-plus/test";

import { normalizeFlexSizing } from "./normalize-flex-sizing";

describe("normalizeFlexSizing (engine adapter)", () => {
  test("fixed main-axis width clears a flex read from the CURRENT style as the null sentinel", () => {
    const result = normalizeFlexSizing({ width: 100 }, { flex: 1 }, "row");
    expect(result).toEqual({ width: 100, flex: null });
  });

  test("fixed cross-axis width clears an explicit stretch to auto", () => {
    const result = normalizeFlexSizing({ width: 100 }, { alignSelf: "stretch" }, "column");
    expect(result).toEqual({ width: 100, alignSelf: "auto" });
  });

  test("container-driven stretch (alignSelf auto) is left alone", () => {
    const result = normalizeFlexSizing({ width: 100 }, { alignSelf: "auto" }, "column");
    expect(result).toEqual({ width: 100 });
  });

  test("a null (clear) width triggers no repair", () => {
    const result = normalizeFlexSizing({ width: null }, { flex: 1 }, "row");
    expect(result).toEqual({ width: null });
  });

  test("an incoming stretch alongside a fixed cross size is repaired to auto", () => {
    const result = normalizeFlexSizing({ width: 100, alignSelf: "stretch" }, {}, "column");
    expect(result).toEqual({ width: 100, alignSelf: "auto" });
  });

  test("no flex parent passes updates through untouched", () => {
    const result = normalizeFlexSizing({ width: 100 }, { flex: 1, alignSelf: "stretch" }, null);
    expect(result).toEqual({ width: 100 });
  });

  test("height mirrors the axis pairing (row parent: stretch cleared; column parent: flex cleared)", () => {
    expect(normalizeFlexSizing({ height: 50 }, { alignSelf: "stretch" }, "row")).toEqual({
      height: 50,
      alignSelf: "auto",
    });
    expect(normalizeFlexSizing({ height: 50 }, { flex: 1 }, "column")).toEqual({
      height: 50,
      flex: null,
    });
  });
});
