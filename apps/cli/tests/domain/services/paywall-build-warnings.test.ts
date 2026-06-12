import { describe, expect, it } from "vitest";

import { collectRenderErrorPlaceholderReasons } from "../../../src/domain/services/paywall-build";

/** A §3 preview tree wrapper, as emitted by `renderToNodeTree`. */
const tree = (root: unknown) => ({ root, state: "default", treeVersion: 1 });

describe("collectRenderErrorPlaceholderReasons", () => {
  it("reports a root placeholder produced by a thrown render", () => {
    expect(
      collectRenderErrorPlaceholderReasons(
        tree({ reason: "render threw: boom", type: "placeholder" }),
      ),
    ).toEqual(["render threw: boom"]);
  });

  it("skips the legitimate render-returned-null placeholder", () => {
    expect(
      collectRenderErrorPlaceholderReasons(
        tree({ reason: "render returned null", type: "placeholder" }),
      ),
    ).toEqual([]);
  });

  it("finds nested error placeholders and preserves order", () => {
    expect(
      collectRenderErrorPlaceholderReasons(
        tree({
          children: [
            { style: {}, text: "ok", type: "text" },
            {
              children: [
                {
                  reason: 'unsupported element type "div"',
                  type: "placeholder",
                },
                { reason: "render returned null", type: "placeholder" },
              ],
              style: {},
              type: "view",
            },
            { reason: "render threw: late", type: "placeholder" },
          ],
          style: {},
          type: "view",
        }),
      ),
    ).toEqual(['unsupported element type "div"', "render threw: late"]);
  });

  it("returns nothing for clean trees and non-tree values", () => {
    expect(
      collectRenderErrorPlaceholderReasons(
        tree({ children: [], style: {}, type: "view" }),
      ),
    ).toEqual([]);
    expect(collectRenderErrorPlaceholderReasons(undefined)).toEqual([]);
    expect(collectRenderErrorPlaceholderReasons("nonsense")).toEqual([]);
    expect(collectRenderErrorPlaceholderReasons({ type: "slot" })).toEqual([]);
  });

  it("ignores placeholder-shaped nodes without a string reason", () => {
    expect(
      collectRenderErrorPlaceholderReasons(tree({ type: "placeholder" })),
    ).toEqual([]);
    expect(
      collectRenderErrorPlaceholderReasons(
        tree({ reason: 42, type: "placeholder" }),
      ),
    ).toEqual([]);
  });
});
