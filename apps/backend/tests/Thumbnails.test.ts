import { PaywallArtifactStore } from "@voidhash/core/services/paywallDeploys/PaywallArtifactStore";
import { MimicHost } from "@voidhash/core/services/paywalls/MimicHost";
import { HtmlScreenshot } from "@voidhash/core/services/paywallThumbnails/HtmlScreenshot";
import { PaywallThumbnailService } from "@voidhash/core/services/paywallThumbnails/PaywallThumbnailService";
import { SnapshotImageRenderer } from "@voidhash/core/services/paywallThumbnails/SnapshotImageRenderer";
import { PublicFileStore } from "@voidhash/core/services/storage/PublicFileStore";
import { ComponentCompiler } from "@voidhash/core/services/paywallWorkspace/ComponentCompiler";
import { Db } from "@voidhash/db";
import { Context, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import {
  makeSelfhostPaywallThumbnailServiceLive,
  SelfhostSnapshotImageRendererLive,
} from "../src/backend/Thumbnails.ts";

describe("self-host paywall thumbnail renderer", () => {
  it("provides the manifest cache required by the thumbnail service", async () => {
    const renderer = Layer.succeed(SnapshotImageRenderer, {
      render: () => Effect.succeed(new Uint8Array()),
    });
    const dependencies = Layer.mergeAll(
      Layer.succeed(Db, {} as never),
      Layer.succeed(MimicHost, {} as never),
      Layer.succeed(PaywallArtifactStore, {} as never),
      Layer.succeed(ComponentCompiler, {} as never),
      Layer.succeed(PublicFileStore, {} as never),
    );

    const context = await Effect.runPromise(
      Effect.scoped(
        Layer.build(makeSelfhostPaywallThumbnailServiceLive({}, renderer)).pipe(
          Effect.provide(dependencies),
        ),
      ),
    );

    expect(Context.get(context, PaywallThumbnailService)).toBeDefined();
  });

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
            Layer.provide(
              Layer.succeed(PublicFileStore, {
                publicBaseUrl: "https://files.test",
                publicUrl: (key) => `https://files.test/files/${key}`,
                putObject: () => Effect.void,
                getObject: () => Effect.succeed(null),
                deleteObject: () => Effect.void,
              }),
            ),
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
