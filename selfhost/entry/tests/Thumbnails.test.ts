import { HtmlScreenshot } from "@voidhash/core/services/paywallThumbnails/HtmlScreenshot";
import { SnapshotImageRenderer } from "@voidhash/core/services/paywallThumbnails/SnapshotImageRenderer";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { SelfhostSnapshotImageRendererLive } from "../src/backend/Thumbnails.ts";

describe("self-host paywall thumbnail renderer", () => {
  it("renders static paywall HTML through the screenshot port", async () => {
    const screenshots: string[] = [];
    const png = new Uint8Array([137, 80, 78, 71]);
    const screenshot = Layer.succeed(
      HtmlScreenshot,
      HtmlScreenshot.of({
        screenshot: (options) =>
          Effect.sync(() => {
            screenshots.push(options.html);
            return png;
          }),
      }),
    );

    const rendered = await Effect.runPromise(
      Effect.gen(function* () {
        const renderer = yield* SnapshotImageRenderer;
        return yield* renderer.render({
          componentTrees: {},
          localComponentTrees: {},
          deviceScaleFactor: 2,
          height: 812,
          snapshot: {
            type: "root",
            id: "root",
            parentId: null,
            pos: "a0",
            data: { name: "Paywall" },
            children: [],
          },
          width: 375,
        });
      }).pipe(
        Effect.provide(
          SelfhostSnapshotImageRendererLive.pipe(
            Layer.provide(screenshot),
          ),
        ),
      ),
    );

    expect(rendered).toEqual(png);
    expect(screenshots).toHaveLength(1);
    expect(screenshots[0]).toContain('id="paywall-root"');
    expect(screenshots[0]).not.toContain("__VOIDHASH_PAYWALL__");
  });
});
