import { MimicDocumentIdleMessage } from "@voidhash/mimic-db/ws/idle-notify";
import {
  HtmlScreenshot,
  HtmlScreenshotError,
} from "@voidhash/core/services/paywallThumbnails/HtmlScreenshot";
import { inlinePublicFileImages } from "@voidhash/core/services/paywallThumbnails/inlinePublicFileImages";
import { PaywallThumbnailService } from "@voidhash/core/services/paywallThumbnails/PaywallThumbnailService";
import {
  SnapshotImageRenderer,
  SnapshotImageRenderError,
  type SnapshotImageRendererShape,
} from "@voidhash/core/services/paywallThumbnails/SnapshotImageRenderer";
import { PublicFileStore } from "@voidhash/core/services/storage/PublicFileStore";
import { ComponentManifestCacheService } from "@voidhash/core/services/paywallWorkspace/ComponentManifestCacheService";
import type {
  PreviewTree,
  SnapshotNode,
} from "@voidhash/paywall-renderer-web-core";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { QueueDriver } from "@voidhash/platform/Queue";
import { Screenshot } from "@voidhash/platform/Screenshot";
import {
  ChromiumScreenshotLive,
  type ChromiumScreenshotConfig,
} from "@voidhash/platform-node/Screenshot";
import { NodePlatformRuntimeLive } from "@voidhash/platform-node/PlatformRuntime";
import { Cause, Effect, Layer } from "effect";

import { mimicDocumentIdleQueueName } from "../mimic/MimicDocumentIdleQueue.ts";

/** Bridges the generic Node screenshot adapter to the thumbnail-domain port. */
export const SelfhostHtmlScreenshotLive = Layer.effect(
  HtmlScreenshot,
  Effect.gen(function* () {
    const screenshot = yield* Screenshot;
    const runtime = yield* PlatformRuntime;
    return HtmlScreenshot.of({
      screenshot: (options) =>
        screenshot.renderPng(options).pipe(
          Effect.provideService(PlatformRuntime, runtime),
          Effect.mapError(
            (error) =>
              new HtmlScreenshotError({
                cause: error.cause,
                message: `Chromium screenshot ${error.operation} failed`,
              }),
          ),
        ),
    });
  }),
);

/**
 * Renders a Mimic paywall snapshot to static HTML, then to PNG bytes.
 * Public-file-store asset URLs are inlined as `data:` URIs first so the
 * screenshot browser never depends on the serving origin being reachable
 * (e.g. a container that cannot hairpin back to its own public domain).
 */
export const SelfhostSnapshotImageRendererLive = Layer.effect(
  SnapshotImageRenderer,
  Effect.gen(function* () {
    const htmlScreenshot = yield* HtmlScreenshot;
    const publicFileStore = yield* PublicFileStore;
    const { renderPaywallToHtml } = yield* Effect.promise(async () => {
      const preact = await import("preact");
      const runtimeGlobals = globalThis as unknown as {
        React?: typeof preact;
      };
      // The production Node entry executes workspace TSX through `tsx`, whose
      // classic transform references the React global. Point that compatibility
      // hook at Preact before the renderer evaluates any JSX.
      runtimeGlobals.React ??= preact;
      return import("@voidhash/paywall-renderer-preact");
    });

    return {
      render: ({
        snapshot,
        componentTrees,
        localComponentTrees,
        width,
        height,
        deviceScaleFactor,
      }) =>
        Effect.gen(function* () {
          const html = yield* Effect.try({
            try: () =>
              renderPaywallToHtml(snapshot as SnapshotNode, {
                componentArtifacts: {
                  trees: componentTrees as Record<
                    string,
                    Record<string, PreviewTree>
                  >,
                  localTrees: localComponentTrees as Record<
                    string,
                    Record<string, PreviewTree>
                  >,
                },
                hydrate: false,
              }).html,
            catch: (cause) =>
              new SnapshotImageRenderError({
                cause: cause instanceof Error ? cause.message : String(cause),
                message: "rendering the paywall snapshot to HTML failed",
              }),
          });

          const inlined = yield* inlinePublicFileImages(html, publicFileStore).pipe(
            Effect.mapError(
              (error) =>
                new SnapshotImageRenderError({
                  cause: error.cause,
                  message: error.message,
                }),
            ),
          );

          return yield* htmlScreenshot
            .screenshot({ deviceScaleFactor, height, html: inlined, width })
            .pipe(
              Effect.mapError(
                (error) =>
                  new SnapshotImageRenderError({
                    cause: error.cause,
                    message: error.message,
                  }),
              ),
            );
        }),
    } satisfies SnapshotImageRendererShape;
  }),
);

/** Builds the Chromium-backed snapshot renderer shared by MCP previews and thumbnails. */
export const makeSelfhostSnapshotImageRendererLive = (
  screenshotConfig: ChromiumScreenshotConfig,
): Layer.Layer<SnapshotImageRenderer, never, PublicFileStore> =>
  SelfhostSnapshotImageRendererLive.pipe(
    Layer.provide(
      SelfhostHtmlScreenshotLive.pipe(
        Layer.provide(
          Layer.merge(
            ChromiumScreenshotLive(screenshotConfig),
            NodePlatformRuntimeLive,
          ),
        ),
      ),
    ),
    Layer.orDie,
  );

/** Builds the Chromium-backed thumbnail service for the self-host runtime. */
export const makeSelfhostPaywallThumbnailServiceLive = (
  screenshotConfig: ChromiumScreenshotConfig,
  renderer: Layer.Layer<SnapshotImageRenderer, never, PublicFileStore> =
    makeSelfhostSnapshotImageRendererLive(screenshotConfig),
) => {
  return PaywallThumbnailService.layer.pipe(
    Layer.provide(renderer),
    Layer.provide(ComponentManifestCacheService.layer),
  );
};

/** Runs the best-effort paywall-thumbnail queue consumer until interrupted. */
export const runSelfhostPaywallThumbnailConsumer = Effect.gen(function* () {
  const queues = yield* QueueDriver;
  const runtime = yield* PlatformRuntime;
  const service = yield* PaywallThumbnailService;

  return yield* queues
    .consumeBatch(
      mimicDocumentIdleQueueName,
      MimicDocumentIdleMessage,
      (messages) =>
        Effect.forEach(
          messages,
          (message) =>
            service
              .handleDocumentIdle({
                documentId: message.documentId,
                seq: message.seq,
              })
              .pipe(
                Effect.tapCause((cause) =>
                  Effect.logWarning(
                    "paywall thumbnail render failed; will retry then drop",
                    {
                      cause: Cause.pretty(cause),
                      paywallDocumentId: message.documentId,
                      seq: message.seq,
                    },
                  ),
                ),
              ),
          { discard: true },
        ),
      { batchSize: 1, maxRetries: 2 },
    )
    .pipe(Effect.provideService(PlatformRuntime, runtime));
});
