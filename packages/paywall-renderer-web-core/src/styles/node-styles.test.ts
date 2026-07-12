import { ScrollViewNode, ShapeNode, TextNode, ViewNode } from "@voidhash/mimic-schema";
import type { Properties } from "csstype";
import { describe, expect, test } from "vite-plus/test";

import { buildPreviewNodeStyles } from "../preview-tree/styles";
import { buildScrollViewStyles } from "./scroll-view-styles";
import { buildShapeContainerStyles } from "./shape-styles";
import { buildTextStyles } from "./text-styles";
import { px, pxOrAuto } from "./utils";
import { buildViewStyles } from "./view-styles";

// Encode/decode round-trips through the real node data structs materialize
// schema defaults, so fixtures carry the exact snapshot shape the engine
// produces.
function makeViewStyle(style?: Parameters<typeof ViewNode.data.encode>[0]["style"]) {
  return ViewNode.data.decode(ViewNode.data.encode({ style })).style;
}

function makeScrollViewStyle(style?: Parameters<typeof ScrollViewNode.data.encode>[0]["style"]) {
  return ScrollViewNode.data.decode(ScrollViewNode.data.encode({ style })).style;
}

function makeShapeStyle(style?: Parameters<typeof ShapeNode.data.encode>[0]["style"]) {
  return ShapeNode.data.decode(ShapeNode.data.encode({ style })).style;
}

function makeTextStyle(style?: Parameters<typeof TextNode.data.encode>[0]["style"]) {
  return TextNode.data.decode(TextNode.data.encode({ style })).style;
}

describe("pxOrAuto", () => {
  test('passes through "auto" and absent values as the CSS auto keyword', () => {
    expect(pxOrAuto("auto")).toBe("auto");
    expect(pxOrAuto(undefined)).toBe("auto");
  });

  test("converts numbers to px", () => {
    expect(pxOrAuto(0)).toBe("0");
    expect(pxOrAuto(12)).toBe("12px");
    expect(px(0)).toBe("0");
    expect(px(8)).toBe("8px");
  });
});

describe("buildViewStyles", () => {
  test("schema defaults yield auto (hug) dimensions without constraints or flex", () => {
    const styles = buildViewStyles(makeViewStyle());
    expect(styles.width).toBe("auto");
    expect(styles.height).toBe("auto");
    expect(styles.minWidth).toBeUndefined();
    expect(styles.maxWidth).toBeUndefined();
    expect(styles.minHeight).toBeUndefined();
    expect(styles.maxHeight).toBeUndefined();
    expect(styles.flex).toBeUndefined();
  });

  test('schema defaults yield relative flow with no positioning offsets', () => {
    const styles = buildViewStyles(makeViewStyle());
    expect(styles.position).toBe("relative");
    expect(styles.left).toBeUndefined();
    expect(styles.top).toBeUndefined();
    expect(styles.right).toBeUndefined();
    expect(styles.bottom).toBeUndefined();
  });

  test("absolute position with numeric offsets emits px (including zero)", () => {
    const styles = buildViewStyles(
      makeViewStyle({ position: "absolute", top: 10, left: 20, bottom: 0 }),
    );
    expect(styles.position).toBe("absolute");
    expect(styles.top).toBe("10px");
    expect(styles.left).toBe("20px");
    expect(styles.bottom).toBe("0");
    // An "auto" (default) offset is the CSS default and stays unset.
    expect(styles.right).toBeUndefined();
  });

  test('"auto" width/height (hug contents) lower to the CSS auto keyword', () => {
    const styles = buildViewStyles(makeViewStyle({ width: "auto", height: "auto" }));
    expect(styles.width).toBe("auto");
    expect(styles.height).toBe("auto");
  });

  test("explicit flex and min/max constraints emit values (including zero)", () => {
    const styles = buildViewStyles(makeViewStyle({ flex: 1, maxWidth: 320, minHeight: 0 }));
    expect(styles.flex).toBe(1);
    expect(styles.maxWidth).toBe("320px");
    expect(styles.minHeight).toBe("0");
    expect(styles.minWidth).toBeUndefined();
    expect(styles.maxHeight).toBeUndefined();
  });

  test("disabled background lowers to transparent", () => {
    const styles = buildViewStyles(makeViewStyle());
    expect(styles.backgroundColor).toBe("transparent");
  });

  test("enabled solid background uses backgroundColor", () => {
    const styles = buildViewStyles(
      makeViewStyle({ backgroundEnabled: true, backgroundColor: "rgba(1, 2, 3, 1)" }),
    );
    expect(styles.backgroundColor).toBe("rgba(1, 2, 3, 1)");
  });

  test("gradient background lowers to an SVG data-URI through the real schema", () => {
    const styles = buildViewStyles(
      makeViewStyle({
        backgroundEnabled: true,
        backgroundType: "gradient",
        backgroundGradient: {
          kind: "linear",
          startX: 0,
          startY: 0,
          endX: 1,
          endY: 1,
          stops: [
            { color: "rgba(255, 255, 255, 1)", position: 0 },
            { color: "rgba(0, 0, 0, 1)", position: 1 },
          ],
        },
      }),
    );
    expect(styles.backgroundSize).toBe("100% 100%");
    expect(String(styles.backgroundImage)).toContain("data:image/svg+xml,");
    expect(styles.backgroundColor).toBeUndefined();
  });

  test("image background lowers to url() through the real schema", () => {
    const styles = buildViewStyles(
      makeViewStyle({
        backgroundEnabled: true,
        backgroundType: "image",
        backgroundImage: { url: "https://example.com/bg.png", resizeMode: "contain" },
      }),
    );
    expect(styles.backgroundImage).toBe('url("https://example.com/bg.png")');
    expect(styles.backgroundSize).toBe("contain");
    expect(styles.backgroundPosition).toBe("center");
  });
});

describe("buildShapeContainerStyles", () => {
  test('"auto" dimensions and absent constraints mirror the flex semantics', () => {
    const styles = buildShapeContainerStyles(makeShapeStyle({ width: "auto", height: 24 }));
    expect(styles.width).toBe("auto");
    expect(styles.height).toBe("24px");
    expect(styles.minWidth).toBeUndefined();
    expect(styles.flex).toBeUndefined();
  });
});

describe("buildTextStyles", () => {
  test("absent min/max constraints and flex stay unset; present ones emit px", () => {
    const defaults = buildTextStyles(makeTextStyle());
    expect(defaults.minWidth).toBeUndefined();
    expect(defaults.maxHeight).toBeUndefined();
    expect(defaults.flex).toBeUndefined();

    const constrained = buildTextStyles(makeTextStyle({ flex: 2, minWidth: 40 }));
    expect(constrained.flex).toBe(2);
    expect(constrained.minWidth).toBe("40px");
  });

  test("schema defaults yield relative flow with no positioning offsets", () => {
    const styles = buildTextStyles(makeTextStyle());
    expect(styles.position).toBe("relative");
    expect(styles.left).toBeUndefined();
    expect(styles.top).toBeUndefined();
    expect(styles.right).toBeUndefined();
    expect(styles.bottom).toBeUndefined();
  });

  test("absolute position with numeric offsets emits px (including zero)", () => {
    const styles = buildTextStyles(
      makeTextStyle({ position: "absolute", top: 10, left: 0, bottom: 4 }),
    );
    expect(styles.position).toBe("absolute");
    expect(styles.top).toBe("10px");
    // A zero offset still emits (lowered to the unitless "0").
    expect(styles.left).toBe("0");
    expect(styles.bottom).toBe("4px");
    // An "auto" (default) offset is the CSS default and stays unset.
    expect(styles.right).toBeUndefined();
  });
});

describe("buildScrollViewStyles", () => {
  test("vertical (default) scrolls on Y and hides X, keeping column flow", () => {
    const styles = buildScrollViewStyles(makeScrollViewStyle(), {
      horizontal: false,
      showsScrollIndicator: true,
    });
    expect(styles.overflowY).toBe("auto");
    expect(styles.overflowX).toBe("hidden");
    expect(styles.flexDirection).toBe("column");
    expect(styles.WebkitOverflowScrolling).toBe("touch");
    // Indicator visible → no scrollbar suppression.
    expect(styles.scrollbarWidth).toBeUndefined();
  });

  test("horizontal scrolls on X, hides Y and forces row flow", () => {
    const styles = buildScrollViewStyles(makeScrollViewStyle({ flexDirection: "column" }), {
      horizontal: true,
      showsScrollIndicator: true,
    });
    expect(styles.overflowX).toBe("auto");
    expect(styles.overflowY).toBe("hidden");
    // RN horizontal ScrollView overrides the authored direction to row.
    expect(styles.flexDirection).toBe("row");
  });

  test("hidden indicator suppresses the scrollbar width", () => {
    const styles = buildScrollViewStyles(makeScrollViewStyle(), {
      horizontal: false,
      showsScrollIndicator: false,
    });
    expect(styles.scrollbarWidth).toBe("none");
  });

  // Yoga defaults a flex item's min main size to 0; CSS defaults it to `auto`
  // (content floor), which would keep a content-tall scrollView from ever
  // shrinking, so `overflowY: auto` never engages. We default `min-*: 0`.
  test("default min sizes are 0 so the box can shrink below content and scroll", () => {
    const styles = buildScrollViewStyles(makeScrollViewStyle(), {
      horizontal: false,
      showsScrollIndicator: true,
    });
    expect(styles.minHeight).toBe(0);
    expect(styles.minWidth).toBe(0);
  });

  test("author-set min sizes are preserved over the 0 default", () => {
    const styles = buildScrollViewStyles(makeScrollViewStyle({ minHeight: 100, minWidth: 40 }), {
      horizontal: false,
      showsScrollIndicator: true,
    });
    expect(styles.minHeight).toBe("100px");
    expect(styles.minWidth).toBe("40px");
  });

  // The document `scrollView` lowering hand-mirrors the preview-tree `scroll`
  // lowering (`SCROLL_BASE`); nested compositions must render identically, so
  // the scroll-specific CSS must never drift. Compare the real implementations
  // rather than duplicating literals.
  test("default (vertical) scroll CSS matches the preview-tree scroll lowering", () => {
    const documentStyles = buildScrollViewStyles(makeScrollViewStyle(), {
      horizontal: false,
      showsScrollIndicator: true,
    });
    const previewStyles = buildPreviewNodeStyles({}, "scroll");

    const scrollKeys = [
      "overflowX",
      "overflowY",
      "WebkitOverflowScrolling",
      "minHeight",
      "minWidth",
    ] as const;
    const pick = (styles: Properties) =>
      Object.fromEntries(scrollKeys.map((key) => [key, styles[key]]));

    expect(pick(documentStyles)).toEqual(pick(previewStyles));
    // Guard against the keys silently going absent from both sides.
    expect(documentStyles.overflowY).toBe("auto");
    expect(documentStyles.overflowX).toBe("hidden");
    expect(documentStyles.WebkitOverflowScrolling).toBe("touch");
  });
});
