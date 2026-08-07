import { describe, expect, test } from "vite-plus/test";

import { buildBackgroundStyles, type BackgroundStyleInput } from "./background";

const stop = (color: string, position: number) => ({ value: { color, position } });

function decodeGradientSvg(backgroundImage: string): string {
  const match = /^url\("data:image\/svg\+xml,(.*)"\)$/.exec(backgroundImage);
  expect(match, `unexpected backgroundImage: ${backgroundImage}`).not.toBeNull();
  return decodeURIComponent(match![1]!);
}

describe("buildBackgroundStyles", () => {
  test("disabled background is transparent regardless of type", () => {
    expect(buildBackgroundStyles({ backgroundEnabled: false, backgroundType: "gradient" })).toEqual({
      backgroundColor: "transparent",
    });
    expect(buildBackgroundStyles({})).toEqual({ backgroundColor: "transparent" });
  });

  test("solid uses backgroundColor", () => {
    expect(
      buildBackgroundStyles({
        backgroundEnabled: true,
        backgroundType: "solid",
        backgroundColor: "rgba(1, 2, 3, 1)",
      }),
    ).toEqual({ backgroundColor: "rgba(1, 2, 3, 1)" });
  });

  test("absent backgroundType defaults to solid", () => {
    expect(
      buildBackgroundStyles({ backgroundEnabled: true, backgroundColor: "rgba(9, 9, 9, 1)" }),
    ).toEqual({ backgroundColor: "rgba(9, 9, 9, 1)" });
  });

  describe("gradient", () => {
    const linear: BackgroundStyleInput = {
      backgroundEnabled: true,
      backgroundType: "gradient",
      backgroundGradient: {
        kind: "linear",
        startX: 0.5,
        startY: 0,
        endX: 0.5,
        endY: 1,
        stops: [stop("rgba(255, 255, 255, 1)", 0), stop("rgba(0, 0, 0, 1)", 1)],
      },
    };

    test("emits a normalized SVG data-URI with size/repeat", () => {
      const styles = buildBackgroundStyles(linear);
      expect(styles.backgroundSize).toBe("100% 100%");
      expect(styles.backgroundRepeat).toBe("no-repeat");
      const svg = decodeGradientSvg(styles.backgroundImage as string);
      expect(svg).toContain("preserveAspectRatio='none'");
      expect(svg).toContain("viewBox='0 0 1 1'");
      expect(svg).toContain("<linearGradient id='g' x1='0.5' y1='0' x2='0.5' y2='1'>");
      expect(svg).toContain("<stop offset='0' stop-color='rgba(255, 255, 255, 1)'/>");
      expect(svg).toContain("<stop offset='1' stop-color='rgba(0, 0, 0, 1)'/>");
      expect(svg).toContain("<rect width='1' height='1' fill='url(#g)'/>");
    });

    test("sorts stops by position before emitting", () => {
      const styles = buildBackgroundStyles({
        ...linear,
        backgroundGradient: {
          ...linear.backgroundGradient!,
          stops: [
            stop("rgba(0, 0, 0, 1)", 1),
            stop("rgba(128, 128, 128, 1)", 0.5),
            stop("rgba(255, 255, 255, 1)", 0),
          ],
        },
      });
      const svg = decodeGradientSvg(styles.backgroundImage as string);
      const first = svg.indexOf("offset='0'");
      const mid = svg.indexOf("offset='0.5'");
      const last = svg.indexOf("offset='1'");
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThan(mid);
      expect(mid).toBeLessThan(last);
    });

    test("accepts logical {color, position} stops (unwrapped shape)", () => {
      // A caller that builds a style from a non-CRDT source (preview tree,
      // compiled component, hand-written input) passes logical stops. The
      // builder must NOT read `.value` blindly and collapse to transparent.
      const styles = buildBackgroundStyles({
        backgroundEnabled: true,
        backgroundType: "gradient",
        backgroundGradient: {
          kind: "linear",
          startX: 0.5,
          startY: 0,
          endX: 0.5,
          endY: 1,
          stops: [
            { color: "rgba(255, 255, 255, 1)", position: 0 },
            { color: "rgba(0, 0, 0, 1)", position: 1 },
          ],
        },
      });
      expect(styles.backgroundColor).toBeUndefined();
      const svg = decodeGradientSvg(styles.backgroundImage as string);
      expect(svg).toContain("<stop offset='0' stop-color='rgba(255, 255, 255, 1)'/>");
      expect(svg).toContain("<stop offset='1' stop-color='rgba(0, 0, 0, 1)'/>");
    });

    test("wrapped and logical stops produce identical output", () => {
      const geometry = {
        kind: "linear" as const,
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
      };
      const wrapped = buildBackgroundStyles({
        backgroundEnabled: true,
        backgroundType: "gradient",
        backgroundGradient: {
          ...geometry,
          stops: [stop("rgba(1, 2, 3, 1)", 0), stop("rgba(4, 5, 6, 1)", 1)],
        },
      });
      const logical = buildBackgroundStyles({
        backgroundEnabled: true,
        backgroundType: "gradient",
        backgroundGradient: {
          ...geometry,
          stops: [
            { color: "rgba(1, 2, 3, 1)", position: 0 },
            { color: "rgba(4, 5, 6, 1)", position: 1 },
          ],
        },
      });
      expect(logical).toEqual(wrapped);
    });

    test("radial uses cx/cy at start and r = euclidean distance start→end", () => {
      const styles = buildBackgroundStyles({
        backgroundEnabled: true,
        backgroundType: "gradient",
        backgroundGradient: {
          kind: "radial",
          startX: 0,
          startY: 0,
          endX: 3,
          endY: 4,
          stops: [stop("rgba(1, 1, 1, 1)", 0), stop("rgba(2, 2, 2, 1)", 1)],
        },
      });
      const svg = decodeGradientSvg(styles.backgroundImage as string);
      expect(svg).toContain("<radialGradient id='g' cx='0' cy='0' r='5'>");
    });

    test("a single stop degrades to that solid color", () => {
      const styles = buildBackgroundStyles({
        ...linear,
        backgroundGradient: {
          ...linear.backgroundGradient!,
          stops: [stop("rgba(7, 7, 7, 1)", 0)],
        },
      });
      expect(styles).toEqual({ backgroundColor: "rgba(7, 7, 7, 1)" });
    });

    test("zero stops (or absent gradient) is transparent", () => {
      expect(
        buildBackgroundStyles({
          ...linear,
          backgroundGradient: { ...linear.backgroundGradient!, stops: [] },
        }),
      ).toEqual({ backgroundColor: "transparent" });
      expect(
        buildBackgroundStyles({ backgroundEnabled: true, backgroundType: "gradient" }),
      ).toEqual({ backgroundColor: "transparent" });
    });
  });

  describe("image", () => {
    test("maps resize modes to backgroundSize with center position and no-repeat", () => {
      const base = {
        backgroundEnabled: true,
        backgroundType: "image" as const,
      };
      const modes = {
        cover: "cover",
        contain: "contain",
        stretch: "100% 100%",
        center: "auto",
      } as const;
      for (const [resizeMode, size] of Object.entries(modes)) {
        const styles = buildBackgroundStyles({
          ...base,
          backgroundImage: {
            url: "https://example.com/a.png",
            resizeMode: resizeMode as keyof typeof modes,
          },
        });
        expect(styles).toEqual({
          backgroundImage: 'url("https://example.com/a.png")',
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: size,
        });
      }
    });

    test("empty url is transparent", () => {
      expect(
        buildBackgroundStyles({
          backgroundEnabled: true,
          backgroundType: "image",
          backgroundImage: { url: "", resizeMode: "cover" },
        }),
      ).toEqual({ backgroundColor: "transparent" });
    });

    test("encodes special characters in the url", () => {
      const styles = buildBackgroundStyles({
        backgroundEnabled: true,
        backgroundType: "image",
        backgroundImage: { url: "https://example.com/a b.png?x=1&y=2", resizeMode: "cover" },
      });
      expect(styles.backgroundImage).toBe('url("https://example.com/a%20b.png?x=1&y=2")');
    });
  });
});
