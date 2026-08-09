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

/**
 * Stub for a service the subject never touches. Member access fails loudly as a
 * defect instead of silently yielding `undefined`, so a future dependency on one
 * of these layers surfaces immediately rather than as a confusing crash.
 */
const unusedService = <A extends object>(): A =>
  new Proxy(Object.create(null), {
    get: (_target, property) => {
      if (typeof property === "symbol") return undefined;
      return Effect.runSync(
        Effect.die(new Error(`unused test service member accessed: ${property}`)),
      );
    },
  });

describe("self-host paywall thumbnail renderer", () => {
  it("provides the manifest cache required by the thumbnail service", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const renderer = Layer.succeed(SnapshotImageRenderer, {
          render: () => Effect.succeed(new Uint8Array()),
        });
        const dependencies = Layer.mergeAll(
          Layer.succeed(Db, unusedService()),
          Layer.succeed(MimicHost, unusedService()),
          Layer.succeed(PaywallArtifactStore, unusedService()),
          Layer.succeed(ComponentCompiler, unusedService()),
          Layer.succeed(PublicFileStore, unusedService()),
        );

        const context = yield* Effect.scoped(
          Layer.build(makeSelfhostPaywallThumbnailServiceLive({}, renderer)).pipe(
            Effect.provide(dependencies),
          ),
        );

        expect(Context.get(context, PaywallThumbnailService)).toBeDefined();
      }),
    ));

  it("renders static paywall HTML through the screenshot port", () =>
    Effect.runPromise(
      Effect.gen(function* () {
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

        const rendered = yield* Effect.gen(function* () {
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
        );

        expect(rendered).toEqual(png);
        expect(screenshots).toHaveLength(1);
        expect(screenshots[0]).toContain('id="paywall-root"');
        expect(screenshots[0]).not.toContain("__VOIDHASH_PAYWALL__");
      }),
    ));
});
