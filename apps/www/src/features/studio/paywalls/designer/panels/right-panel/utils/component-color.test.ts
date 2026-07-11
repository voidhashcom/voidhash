import { describe, expect, test } from "vite-plus/test";

import { hexColorToRgbaString, rgbaStringToHexColor } from "./component-color";

describe("hexColorToRgbaString", () => {
  test("converts 6-digit hex with and without leading #", () => {
    expect(hexColorToRgbaString("#FF0000")).toBe("rgba(255, 0, 0, 1)");
    expect(hexColorToRgbaString("00ff00")).toBe("rgba(0, 255, 0, 1)");
  });

  test("expands 3-digit shorthand", () => {
    expect(hexColorToRgbaString("#0af")).toBe("rgba(0, 170, 255, 1)");
  });

  test("reads the alpha channel from 8-digit hex", () => {
    expect(hexColorToRgbaString("#FF000080")).toBe("rgba(255, 0, 0, 0.5)");
  });

  test("falls back to opaque white for invalid input", () => {
    expect(hexColorToRgbaString("not-a-color")).toBe("rgba(255, 255, 255, 1)");
    expect(hexColorToRgbaString("")).toBe("rgba(255, 255, 255, 1)");
  });
});

describe("rgbaStringToHexColor", () => {
  test("converts opaque rgba to 6-digit hex", () => {
    expect(rgbaStringToHexColor("rgba(255, 0, 0, 1)")).toBe("#FF0000");
    expect(rgbaStringToHexColor("rgb(0, 170, 255)")).toBe("#00AAFF");
  });

  test("keeps the alpha channel as an 8-digit hex", () => {
    expect(rgbaStringToHexColor("rgba(255, 0, 0, 0.5)")).toBe("#FF000080");
  });

  test("falls back to white for invalid input", () => {
    expect(rgbaStringToHexColor("#FF0000")).toBe("#FFFFFF");
    expect(rgbaStringToHexColor("")).toBe("#FFFFFF");
  });
});

describe("round-trips", () => {
  test("hex → rgba → hex is stable", () => {
    for (const hex of ["#000000", "#FFFFFF", "#1A2B3C", "#FF000080"]) {
      expect(rgbaStringToHexColor(hexColorToRgbaString(hex))).toBe(hex);
    }
  });
});
