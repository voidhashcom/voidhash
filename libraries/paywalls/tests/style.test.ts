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
      flattenStyle([
        { paddingLeft: 4, opacity: 1 },
        [{ paddingLeft: 8 }, false, [{ opacity: 0.5 }]],
        null,
      ]),
    ).toEqual({ paddingLeft: 8, opacity: 0.5 });
  });

  it("supports the conditional-entry idiom", () => {
    const selected = false;
    expect(flattenStyle([{ borderTopWidth: 1 }, selected && { borderTopWidth: 2 }])).toEqual({
      borderTopWidth: 1,
    });
  });
});

describe("resolveStyle", () => {
  it("passes the RN-expanded edge fields through untouched", () => {
    expect(
      resolveStyle({ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8 }),
    ).toEqual({
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 8,
      paddingBottom: 8,
    });
  });

  it("converts numeric lineHeight to pixels (RN semantics)", () => {
    expect(resolveStyle({ lineHeight: 20 })).toEqual({ lineHeight: "20px" });
    expect(resolveStyle({ lineHeight: "1.5em" })).toEqual({
      lineHeight: "1.5em",
    });
  });

  it("defaults borderStyle to solid when a per-edge border width is set without one", () => {
    expect(resolveStyle({ borderTopWidth: 2, borderColor: "#fff" })).toEqual({
      borderTopWidth: 2,
      borderColor: "#fff",
      borderStyle: "solid",
    });
    expect(resolveStyle({ borderLeftWidth: 2, borderStyle: "dashed" })).toEqual({
      borderLeftWidth: 2,
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
  // on the DOM a CSS shorthand committed later resets its longhands (`flex`
  // expands to flex-grow/flex-shrink/flex-basis). The resolver must therefore
  // emit `flex` (and `gap`) before their longhands.
  it("emits flex before an earlier-declared flexGrow", () => {
    const resolved = resolveStyle({ flexGrow: 2, flex: 1 });
    expect(resolved).toEqual({ flex: 1, flexGrow: 2 });
    expect(Object.keys(resolved)).toEqual(["flex", "flexGrow"]);
  });

  it("keeps flex winning when the shorthand arrives in a later array entry", () => {
    const resolved = resolveStyle([{ flexGrow: 2 }, { flex: 1 }]);
    expect(resolved).toEqual({ flex: 1, flexGrow: 2 });
    expect(Object.keys(resolved)).toEqual(["flex", "flexGrow"]);
  });

  it("lets later array entries win per-key", () => {
    expect(resolveStyle([{ paddingLeft: 16 }, { paddingRight: 2 }])).toEqual({
      paddingLeft: 16,
      paddingRight: 2,
    });
    expect(resolveStyle([{ paddingLeft: 16 }, { paddingLeft: 4 }])).toEqual({
      paddingLeft: 4,
    });
  });
});

describe("resolveStyle — structured backgrounds", () => {
  it("leaves backgroundColor pass-through for a solid or absent type", () => {
    expect(resolveStyle({ backgroundColor: "#000" })).toEqual({ backgroundColor: "#000" });
    expect(resolveStyle({ backgroundColor: "#000", backgroundType: "solid" })).toEqual({
      backgroundColor: "#000",
    });
  });

  it("never leaks the structured background fields as raw CSS", () => {
    const out = resolveStyle({
      backgroundColor: "#000",
      backgroundType: "solid",
      backgroundGradient: {
        kind: "linear",
        startX: 0.5,
        startY: 0,
        endX: 0.5,
        endY: 1,
        stops: [{ color: "rgba(0,0,0,1)", position: 0 }],
      },
      backgroundImage: { url: "", resizeMode: "cover" },
    });
    expect(out).toEqual({ backgroundColor: "#000" });
  });

  it("lowers a two-stop linear gradient to an SVG data-URI background", () => {
    const out = resolveStyle({
      backgroundType: "gradient",
      backgroundGradient: {
        kind: "linear",
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        stops: [
          { color: "rgba(255, 0, 0, 1)", position: 0 },
          { color: "rgba(0, 0, 255, 1)", position: 1 },
        ],
      },
    });
    const svg =
      "<svg xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none' viewBox='0 0 1 1'>" +
      "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0' stop-color='rgba(255, 0, 0, 1)'/>" +
      "<stop offset='1' stop-color='rgba(0, 0, 255, 1)'/>" +
      "</linearGradient></defs><rect width='1' height='1' fill='url(#g)'/></svg>";
    expect(out).toEqual({
      backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
    });
  });

  it("sorts gradient stops by position and degrades a single stop to a solid color", () => {
    const sorted = resolveStyle({
      backgroundType: "gradient",
      backgroundGradient: {
        kind: "linear",
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 1,
        stops: [
          { color: "rgba(0, 0, 255, 1)", position: 1 },
          { color: "rgba(255, 0, 0, 1)", position: 0 },
        ],
      },
    }) as Record<string, string>;
    expect(decodeURIComponent(sorted.backgroundImage!)).toContain(
      "<stop offset='0' stop-color='rgba(255, 0, 0, 1)'/><stop offset='1' stop-color='rgba(0, 0, 255, 1)'/>",
    );

    expect(
      resolveStyle({
        backgroundType: "gradient",
        backgroundGradient: {
          kind: "linear",
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 1,
          stops: [{ color: "rgba(1, 2, 3, 1)", position: 0.5 }],
        },
      }),
    ).toEqual({ backgroundColor: "rgba(1, 2, 3, 1)" });
  });

  it("emits a radial gradient with r = hypot(end - start)", () => {
    const out = resolveStyle({
      backgroundType: "gradient",
      backgroundGradient: {
        kind: "radial",
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 0,
        stops: [
          { color: "rgba(0, 0, 0, 1)", position: 0 },
          { color: "rgba(255, 255, 255, 1)", position: 1 },
        ],
      },
    }) as Record<string, string>;
    expect(decodeURIComponent(out.backgroundImage!)).toContain(
      "<radialGradient id='g' cx='0' cy='0' r='1'>",
    );
  });

  it("falls back to transparent for a gradient with zero stops", () => {
    expect(
      resolveStyle({
        backgroundType: "gradient",
        backgroundGradient: {
          kind: "linear",
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 1,
          stops: [],
        },
      }),
    ).toEqual({ backgroundColor: "transparent" });
  });

  it("lowers an image background with the resize-mode → backgroundSize mapping", () => {
    expect(
      resolveStyle({
        backgroundType: "image",
        backgroundImage: { url: "https://cdn.test/bg.png", resizeMode: "contain" },
      }),
    ).toEqual({
      backgroundImage: 'url("https://cdn.test/bg.png")',
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "contain",
    });
    expect(
      resolveStyle({
        backgroundType: "image",
        backgroundImage: { url: "https://cdn.test/bg.png", resizeMode: "stretch" },
      }),
    ).toMatchObject({ backgroundSize: "100% 100%" });
    expect(
      resolveStyle({
        backgroundType: "image",
        backgroundImage: { url: "https://cdn.test/bg.png", resizeMode: "center" },
      }),
    ).toMatchObject({ backgroundSize: "auto" });
  });

  it("falls back to transparent for an image background with an empty url", () => {
    expect(
      resolveStyle({
        backgroundType: "image",
        backgroundImage: { url: "", resizeMode: "cover" },
      }),
    ).toEqual({ backgroundColor: "transparent" });
  });
});
