import { validate } from "@voidhash/mimic-core";
import { describe, expect, test } from "vite-plus/test";

import { ScreenNode, ViewNode } from "../nodes/index.ts";
import { screenNodeStyleSchema, viewNodeStyleSchema } from "../nodes/index.ts";

// Encode/decode round-trips through the real node data structs materialize
// schema defaults, so fixtures carry the exact snapshot shape the engine
// produces (mirrors node-styles.test.ts in the web renderer).
function makeViewStyle(style?: Parameters<typeof ViewNode.data.encode>[0]["style"]) {
  return ViewNode.data.decode(ViewNode.data.encode({ style })).style;
}

function makeScreenStyle(style?: Parameters<typeof ScreenNode.data.encode>[0]["style"]) {
  return ScreenNode.data.decode(ScreenNode.data.encode({ style })).style;
}

describe("background style defaults", () => {
  test("view style materializes solid/gradient/image background defaults", () => {
    const style = makeViewStyle();
    expect(style.backgroundType).toBe("solid");
    expect(style.backgroundGradient).toEqual({
      kind: "linear",
      startX: 0.5,
      startY: 0,
      endX: 0.5,
      endY: 1,
      stops: [
        { id: expect.any(String), pos: expect.any(String), value: { color: "rgba(255, 255, 255, 1)", position: 0 } },
        { id: expect.any(String), pos: expect.any(String), value: { color: "rgba(255, 255, 255, 0)", position: 1 } },
      ],
    });
    expect(style.backgroundImage).toEqual({ url: "", resizeMode: "cover" });
  });

  test("screen style materializes the same background defaults", () => {
    const style = makeScreenStyle();
    expect(style.backgroundType).toBe("solid");
    expect(style.backgroundGradient.kind).toBe("linear");
    expect(style.backgroundGradient.startX).toBe(0.5);
    expect(style.backgroundGradient.startY).toBe(0);
    expect(style.backgroundGradient.endX).toBe(0.5);
    expect(style.backgroundGradient.endY).toBe(1);
    expect(style.backgroundGradient.stops.map((s) => s.value)).toEqual([
      { color: "rgba(255, 255, 255, 1)", position: 0 },
      { color: "rgba(255, 255, 255, 0)", position: 1 },
    ]);
    expect(style.backgroundImage).toEqual({ url: "", resizeMode: "cover" });
  });
});

describe("background encode/decode round-trip", () => {
  test("gradient + image backgrounds survive nested Struct/Array round-trip", () => {
    const encoded = ViewNode.data.encode({
      style: {
        backgroundEnabled: true,
        backgroundType: "gradient",
        backgroundGradient: {
          kind: "radial",
          startX: 0,
          startY: 0,
          endX: 1,
          endY: 1,
          stops: [
            { color: "rgba(255, 0, 0, 1)", position: 0 },
            { color: "rgba(0, 0, 255, 1)", position: 0.5 },
            { color: "rgba(0, 255, 0, 1)", position: 1 },
          ],
        },
        backgroundImage: { url: "https://example.com/bg.png", resizeMode: "contain" },
      },
    });
    const validated = validate(ViewNode.data.schema, encoded);
    expect(validated).toBeDefined();
    const style = ViewNode.data.decode(validated!).style;

    expect(style.backgroundType).toBe("gradient");
    expect(style.backgroundGradient.kind).toBe("radial");
    expect(style.backgroundGradient.startX).toBe(0);
    expect(style.backgroundGradient.endX).toBe(1);
    expect(style.backgroundGradient.stops.map((s) => s.value)).toEqual([
      { color: "rgba(255, 0, 0, 1)", position: 0 },
      { color: "rgba(0, 0, 255, 1)", position: 0.5 },
      { color: "rgba(0, 255, 0, 1)", position: 1 },
    ]);
    expect(style.backgroundImage).toEqual({
      url: "https://example.com/bg.png",
      resizeMode: "contain",
    });
  });
});

describe("partial stripDefaults on nested background fields", () => {
  test("view style .partial({ stripDefaults: true }) accepts a gradient override and drops absent keys", () => {
    const overrideSchema = viewNodeStyleSchema.partial({ stripDefaults: true }).default({});

    // An empty override strips every default, including nested background structs.
    const empty = overrideSchema.decode(overrideSchema.encode({}));
    expect(empty).toEqual({});

    // A gradient override materializes the whole gradient object (nested field
    // defaults still fill), replacing the key wholesale — the intended
    // "overrides replace the whole object per key" semantic.
    const withGradient = overrideSchema.decode(
      overrideSchema.encode({
        backgroundType: "gradient",
        backgroundGradient: {
          kind: "linear",
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 1,
          stops: [{ color: "rgba(0, 0, 0, 1)", position: 0 }],
        },
      }),
    );
    expect(withGradient?.backgroundType).toBe("gradient");
    expect(withGradient?.backgroundColor).toBeUndefined();
    expect(withGradient?.backgroundGradient?.kind).toBe("linear");
    expect(withGradient?.backgroundGradient?.stops?.map((s: { value: unknown }) => s.value)).toEqual(
      [{ color: "rgba(0, 0, 0, 1)", position: 0 }],
    );
  });

  test("screen style .partial({ stripDefaults: true }) accepts an image override", () => {
    const overrideSchema = screenNodeStyleSchema.partial({ stripDefaults: true }).default({});
    const withImage = overrideSchema.decode(
      overrideSchema.encode({
        backgroundType: "image",
        backgroundImage: { url: "https://example.com/x.jpg", resizeMode: "stretch" },
      }),
    );
    expect(withImage?.backgroundType).toBe("image");
    expect(withImage?.backgroundImage).toEqual({
      url: "https://example.com/x.jpg",
      resizeMode: "stretch",
    });
  });
});
