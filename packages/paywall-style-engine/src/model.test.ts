import { describe, expect, it } from "vitest";

import { deriveAxisSizing, sizingModePatch, type ParentFlexContext } from "./model.ts";

const columnStretch: ParentFlexContext = { direction: "column", alignItems: "stretch" };
const columnStart: ParentFlexContext = { direction: "column", alignItems: "flex-start" };
const rowStretch: ParentFlexContext = { direction: "row", alignItems: "stretch" };

describe("deriveAxisSizing", () => {
  it("derives fixed from a numeric cross-axis size; main-axis flex: 1 wins over a number", () => {
    expect(deriveAxisSizing("width", { width: 120 }, columnStretch)).toEqual({
      mode: "fixed",
      px: 120,
    });
    // flex-basis from `flex: 1` overrides the width on the main axis, so the
    // derived mode is fill (the repair pass prevents this combination anyway).
    expect(deriveAxisSizing("width", { width: 120, flex: 1 }, rowStretch)).toEqual({
      mode: "fill",
    });
  });

  it("derives cross-axis fill from explicit stretch and from container-driven stretch", () => {
    expect(
      deriveAxisSizing("width", { width: "auto", alignSelf: "stretch" }, columnStart),
    ).toEqual({ mode: "fill" });
    expect(deriveAxisSizing("width", { width: "auto", alignSelf: "auto" }, columnStretch)).toEqual({
      mode: "fill",
    });
  });

  it("derives cross-axis hug when alignment opts out of stretch", () => {
    expect(
      deriveAxisSizing("width", { width: "auto", alignSelf: "flex-start" }, columnStretch),
    ).toEqual({ mode: "hug" });
    expect(deriveAxisSizing("width", { width: "auto", alignSelf: "auto" }, columnStart)).toEqual({
      mode: "hug",
    });
  });

  it("derives main-axis fill from flex: 1 and hug from auto", () => {
    expect(deriveAxisSizing("width", { width: "auto", flex: 1 }, rowStretch)).toEqual({
      mode: "fill",
    });
    expect(deriveAxisSizing("width", { width: "auto" }, rowStretch)).toEqual({ mode: "hug" });
    expect(deriveAxisSizing("height", { height: "auto", flex: 1 }, columnStretch)).toEqual({
      mode: "fill",
    });
  });

  it("offers only fixed/hug without a flex parent", () => {
    expect(deriveAxisSizing("width", { width: "auto", flex: 1 }, null)).toEqual({ mode: "hug" });
    expect(deriveAxisSizing("width", { width: 44 }, null)).toEqual({ mode: "fixed", px: 44 });
  });
});

describe("sizingModePatch", () => {
  it("fills the cross axis via alignSelf: stretch", () => {
    expect(
      sizingModePatch("width", "fill", { fixedPx: 100, parent: columnStretch, currentAlignSelf: "auto" }),
    ).toEqual({ width: "auto", alignSelf: "stretch" });
  });

  it("fills the main axis via flex: 1", () => {
    expect(
      sizingModePatch("width", "fill", { fixedPx: 100, parent: rowStretch, currentAlignSelf: "auto" }),
    ).toEqual({ width: "auto", flex: 1 });
  });

  it("escapes a stretch-by-default parent when hugging the cross axis", () => {
    expect(
      sizingModePatch("width", "hug", { fixedPx: 100, parent: columnStretch, currentAlignSelf: "auto" }),
    ).toEqual({ width: "auto", alignSelf: "flex-start" });
    expect(
      sizingModePatch("width", "hug", { fixedPx: 100, parent: columnStart, currentAlignSelf: "center" }),
    ).toEqual({ width: "auto", alignSelf: "center" });
  });

  it("clears main-axis flex when hugging or fixing", () => {
    expect(
      sizingModePatch("width", "hug", { fixedPx: 100, parent: rowStretch, currentAlignSelf: "auto" }),
    ).toEqual({ width: "auto", flex: undefined });
    expect(
      sizingModePatch("width", "fixed", { fixedPx: 80, parent: rowStretch, currentAlignSelf: "auto" }),
    ).toEqual({ width: 80, flex: undefined });
  });

  it("clears stretch alignment when fixing the cross axis, preserving explicit alignment", () => {
    expect(
      sizingModePatch("width", "fixed", { fixedPx: 80, parent: columnStretch, currentAlignSelf: "stretch" }),
    ).toEqual({ width: 80, alignSelf: "auto" });
    expect(
      sizingModePatch("width", "fixed", { fixedPx: 80, parent: columnStretch, currentAlignSelf: "center" }),
    ).toEqual({ width: 80, alignSelf: "center" });
  });
});
