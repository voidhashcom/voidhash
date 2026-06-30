import { describe, expect, it } from "vitest";

import { flattenStyle, resolveStyle } from "../src/index";

describe("flattenStyle", () => {
  it("returns an empty object for falsy input", () => {
    expect(flattenStyle(undefined)).toEqual({});
    expect(flattenStyle(null)).toEqual({});
    expect(flattenStyle(false)).toEqual({});
  });

  it("flattens nested arrays with later entries winning", () => {
    expect(
      flattenStyle([{ padding: 4, opacity: 1 }, [{ padding: 8 }, false, [{ opacity: 0.5 }]], null]),
    ).toEqual({ padding: 8, opacity: 0.5 });
  });

  it("supports the conditional-entry idiom", () => {
    const selected = false;
    expect(flattenStyle([{ borderWidth: 1 }, selected && { borderWidth: 2 }])).toEqual({
      borderWidth: 1,
    });
  });
});

describe("resolveStyle", () => {
  it("expands paddingHorizontal/Vertical into physical edges", () => {
    expect(resolveStyle({ paddingHorizontal: 16, paddingVertical: 8 })).toEqual({
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 8,
      paddingBottom: 8,
    });
  });

  it("expands marginHorizontal/Vertical into physical edges", () => {
    expect(resolveStyle({ marginHorizontal: 12, marginVertical: 6 })).toEqual({
      marginLeft: 12,
      marginRight: 12,
      marginTop: 6,
      marginBottom: 6,
    });
  });

  it("lets explicit physical edges win over shorthands", () => {
    expect(resolveStyle({ paddingHorizontal: 16, paddingLeft: 4 })).toEqual({
      paddingLeft: 4,
      paddingRight: 16,
    });
  });

  it("expands shorthands provided across array entries", () => {
    expect(resolveStyle([{ paddingHorizontal: 16 }, { paddingRight: 2 }])).toEqual({
      paddingLeft: 16,
      paddingRight: 2,
    });
  });

  it("converts numeric lineHeight to pixels (RN semantics)", () => {
    expect(resolveStyle({ lineHeight: 20 })).toEqual({ lineHeight: "20px" });
    expect(resolveStyle({ lineHeight: "1.5em" })).toEqual({
      lineHeight: "1.5em",
    });
  });

  it("defaults borderStyle to solid when a border is set without one", () => {
    expect(resolveStyle({ borderWidth: 2, borderColor: "#fff" })).toEqual({
      borderWidth: 2,
      borderColor: "#fff",
      borderStyle: "solid",
    });
    expect(resolveStyle({ borderWidth: 2, borderStyle: "dashed" })).toEqual({
      borderWidth: 2,
      borderStyle: "dashed",
    });
  });

  it("passes the remaining subset through untouched", () => {
    expect(resolveStyle({ flexDirection: "row", gap: 8, backgroundColor: "#000" })).toEqual({
      flexDirection: "row",
      gap: 8,
      backgroundColor: "#000",
    });
  });

  // RN gives longhands precedence within one object regardless of key order;
  // on the DOM a CSS shorthand committed later resets its longhands. The
  // resolver must therefore emit shorthands first.
  it("emits padding before an earlier-declared paddingLeft", () => {
    const resolved = resolveStyle({ paddingLeft: 8, padding: 16 });
    expect(resolved).toEqual({ padding: 16, paddingLeft: 8 });
    expect(Object.keys(resolved)).toEqual(["padding", "paddingLeft"]);
  });

  it("emits borderRadius before an earlier-declared corner radius", () => {
    const resolved = resolveStyle({ borderTopLeftRadius: 4, borderRadius: 8 });
    expect(resolved).toEqual({ borderRadius: 8, borderTopLeftRadius: 4 });
    expect(Object.keys(resolved)).toEqual(["borderRadius", "borderTopLeftRadius"]);
  });

  it("keeps an explicit corner winning when the shorthand arrives in a later array entry", () => {
    const resolved = resolveStyle([{ borderTopLeftRadius: 4 }, { borderRadius: 8 }]);
    expect(resolved).toEqual({ borderRadius: 8, borderTopLeftRadius: 4 });
    expect(Object.keys(resolved)).toEqual(["borderRadius", "borderTopLeftRadius"]);
  });

  it("emits gap before rowGap/columnGap and flex before its longhands", () => {
    expect(Object.keys(resolveStyle({ rowGap: 4, gap: 8 }))).toEqual(["gap", "rowGap"]);
    expect(Object.keys(resolveStyle({ flexGrow: 2, flex: 1 }))).toEqual(["flex", "flexGrow"]);
  });

  it("emits Horizontal/Vertical expansions after the plain shorthand", () => {
    expect(Object.keys(resolveStyle({ paddingHorizontal: 8, padding: 16 }))).toEqual([
      "padding",
      "paddingLeft",
      "paddingRight",
    ]);
    expect(resolveStyle({ paddingHorizontal: 8, padding: 16 })).toEqual({
      padding: 16,
      paddingLeft: 8,
      paddingRight: 8,
    });
  });
});
