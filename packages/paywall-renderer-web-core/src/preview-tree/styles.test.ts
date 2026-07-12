import { describe, expect, test } from "vite-plus/test";

import {
  buildPreviewMotionStyles,
  buildPreviewNodeStyles,
  previewResizeModeToObjectFit,
} from "./styles";

describe("buildPreviewNodeStyles", () => {
  test("applies the RN view reset for view nodes", () => {
    const styles = buildPreviewNodeStyles({}, "view");
    expect(styles).toEqual({
      alignItems: "stretch",
      boxSizing: "border-box",
      display: "flex",
      flexBasis: "auto",
      flexDirection: "column",
      flexShrink: 0,
      margin: 0,
      minHeight: 0,
      minWidth: 0,
      padding: 0,
      position: "relative",
    });
  });

  test("applies the text reset for text nodes", () => {
    const styles = buildPreviewNodeStyles({}, "text");
    expect(styles).toEqual({
      boxSizing: "border-box",
      display: "block",
      margin: 0,
      padding: 0,
      whiteSpace: "pre-wrap",
      wordWrap: "break-word",
    });
  });

  test("applies pressable affordances on top of the view reset", () => {
    const styles = buildPreviewNodeStyles({}, "pressable");
    expect(styles).toMatchObject({
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      touchAction: "manipulation",
      userSelect: "none",
    });
  });

  test("applies vertical overflow for scroll nodes", () => {
    const styles = buildPreviewNodeStyles({}, "scroll");
    expect(styles).toMatchObject({
      display: "flex",
      overflowX: "hidden",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
    });
  });

  test("applies the image reset for image nodes", () => {
    const styles = buildPreviewNodeStyles({}, "image");
    expect(styles).toEqual({
      boxSizing: "border-box",
      display: "block",
    });
  });

  test("converts numbers to px and passes percent strings through", () => {
    const styles = buildPreviewNodeStyles(
      { fontSize: 16, height: "50%", lineHeight: 24, width: 120 },
      "text",
    );
    expect(styles).toMatchObject({
      fontSize: "16px",
      height: "50%",
      lineHeight: "24px",
      width: "120px",
    });
  });

  test("keeps unitless keys numeric", () => {
    const styles = buildPreviewNodeStyles(
      {
        aspectRatio: 1.5,
        flex: 1,
        flexGrow: 2,
        flexShrink: 1,
        fontWeight: 700,
        opacity: 0.5,
        zIndex: 3,
      },
      "view",
    );
    expect(styles).toMatchObject({
      aspectRatio: 1.5,
      flex: 1,
      flexGrow: 2,
      flexShrink: 1,
      fontWeight: 700,
      opacity: 0.5,
      zIndex: 3,
    });
  });

  test("emits the flex shorthand before its longhands so longhands win", () => {
    const styles = buildPreviewNodeStyles({ flex: 1, flexBasis: "auto" }, "view");
    const keys = Object.keys(styles);
    expect(keys.indexOf("flex")).toBeLessThan(keys.indexOf("flexBasis"));
    expect(styles).toMatchObject({ flex: 1, flexBasis: "auto" });
  });

  test("re-emits reset longhands after shorthands so they win in insertion order", () => {
    const styles = buildPreviewNodeStyles({ flex: 1, flexShrink: 0 }, "view");
    const keys = Object.keys(styles);
    expect(keys.indexOf("flex")).toBeLessThan(keys.indexOf("flexShrink"));
    expect(styles).toMatchObject({ flex: 1, flexShrink: 0 });
  });

  test("emits per-side padding/margin edges as px", () => {
    const styles = buildPreviewNodeStyles(
      {
        marginBottom: 4,
        marginTop: 8,
        paddingLeft: 30,
        paddingRight: 20,
      },
      "view",
    );
    expect(styles).toMatchObject({
      marginBottom: "4px",
      marginTop: "8px",
      paddingLeft: "30px",
      paddingRight: "20px",
    });
  });

  test("a per-side border width implies solid borderStyle", () => {
    expect(buildPreviewNodeStyles({ borderTopWidth: 2 }, "view")).toMatchObject({
      borderStyle: "solid",
      borderTopWidth: "2px",
    });
    expect(buildPreviewNodeStyles({ borderColor: "#fff" }, "view")).toMatchObject({
      borderColor: "#fff",
      borderStyle: "solid",
    });
    expect(
      buildPreviewNodeStyles({ borderStyle: "dashed", borderTopWidth: 2 }, "view"),
    ).toMatchObject({
      borderStyle: "dashed",
      borderTopWidth: "2px",
    });
    expect(buildPreviewNodeStyles({}, "view").borderStyle).toBe(undefined);
  });

  test("author styles override the reset", () => {
    const styles = buildPreviewNodeStyles(
      { alignItems: "center", flexDirection: "row", position: "absolute" },
      "view",
    );
    expect(styles).toMatchObject({
      alignItems: "center",
      flexDirection: "row",
      position: "absolute",
    });
  });

  test("zero stays unitless", () => {
    expect(buildPreviewNodeStyles({ gap: 0, width: 0 }, "view")).toMatchObject({
      gap: 0,
      width: 0,
    });
  });

  test("solid background passes backgroundColor through untouched", () => {
    const styles = buildPreviewNodeStyles(
      { backgroundColor: "rgba(1, 2, 3, 1)", backgroundType: "solid" },
      "view",
    );
    expect(styles.backgroundColor).toBe("rgba(1, 2, 3, 1)");
    // The structured derivation keys never reach the DOM.
    expect("backgroundType" in styles).toBe(false);
    expect("backgroundGradient" in styles).toBe(false);
  });

  test("gradient background lowers to an SVG data-URI and drops backgroundColor", () => {
    const styles = buildPreviewNodeStyles(
      {
        backgroundColor: "rgba(1, 2, 3, 1)",
        backgroundType: "gradient",
        backgroundGradient: {
          kind: "linear",
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 1,
          stops: [
            { color: "rgba(255, 0, 0, 1)", position: 0 },
            { color: "rgba(0, 0, 255, 1)", position: 1 },
          ],
        },
      },
      "view",
    );
    expect(styles.backgroundColor).toBeUndefined();
    expect(String(styles.backgroundImage)).toContain("data:image/svg+xml");
    expect(styles.backgroundSize).toBe("100% 100%");
    expect("backgroundGradient" in styles).toBe(false);
  });

  test("image background lowers to a url() with resize-mapped size", () => {
    const styles = buildPreviewNodeStyles(
      {
        backgroundType: "image",
        backgroundImage: { url: "https://cdn.example.com/bg.png", resizeMode: "contain" },
      },
      "view",
    );
    expect(String(styles.backgroundImage)).toContain("https://cdn.example.com/bg.png");
    expect(styles.backgroundSize).toBe("contain");
  });

  test("a single-stop gradient degrades to that solid color", () => {
    const styles = buildPreviewNodeStyles(
      {
        backgroundType: "gradient",
        backgroundGradient: {
          kind: "linear",
          startX: 0,
          startY: 0,
          endX: 1,
          endY: 1,
          stops: [{ color: "rgba(9, 9, 9, 1)", position: 0 }],
        },
      },
      "view",
    );
    expect(styles.backgroundColor).toBe("rgba(9, 9, 9, 1)");
    expect(styles.backgroundImage).toBeUndefined();
  });
});

describe("buildPreviewMotionStyles", () => {
  test("lowers v2 rest motion after static style using canonical transform order", () => {
    expect(
      buildPreviewNodeStyles({ opacity: 0.2 }, "view", {
        opacity: 1,
        rotate: 10,
        scale: 1.1,
        x: 12,
        y: -4,
      }),
    ).toMatchObject({
      opacity: 1,
      transform: "translate3d(12px, -4px, 0) rotate(10deg) scale(1.1)",
    });
    expect(buildPreviewMotionStyles({ transformOrigin: { x: 0.5, y: 0 } })).toEqual({
      transformOrigin: "50% 0%",
    });
  });
});

describe("previewResizeModeToObjectFit", () => {
  test("maps every resize mode and defaults to cover", () => {
    expect(previewResizeModeToObjectFit("cover")).toBe("cover");
    expect(previewResizeModeToObjectFit("contain")).toBe("contain");
    expect(previewResizeModeToObjectFit("stretch")).toBe("fill");
    expect(previewResizeModeToObjectFit("center")).toBe("none");
    expect(previewResizeModeToObjectFit(undefined)).toBe("cover");
  });
});
