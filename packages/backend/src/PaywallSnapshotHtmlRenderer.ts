import {
  SnapshotHtmlRenderer,
  SnapshotHtmlRenderError,
} from "@voidhash/core/services/paywallReleases/SnapshotHtmlRenderer";
import type { ComponentArtifacts, SnapshotNode } from "@voidhash/paywall-renderer-preact";
import { Effect, Layer } from "effect";

/** Portable Preact adapter for hydrated visual paywall release documents. */
export const BackendSnapshotHtmlRendererLive = Layer.succeed(SnapshotHtmlRenderer, {
  render: (input) =>
    Effect.tryPromise({
      try: async () => {
        const preact = await import("preact");
        const runtimeGlobals = globalThis as unknown as { React?: typeof preact };
        runtimeGlobals.React ??= preact;
        const { renderPaywallToHtml } = await import("@voidhash/paywall-renderer-preact");
        return renderPaywallToHtml(input.snapshot as SnapshotNode, {
          componentArtifacts: {
            trees: input.componentTrees,
          } as ComponentArtifacts,
          hydrate: true,
          metadata: input.metadata,
        }).html;
      },
      catch: (cause) =>
        new SnapshotHtmlRenderError({
          cause: cause instanceof Error ? cause.message : String(cause),
          message: "Failed to render the paywall release document",
        }),
    }),
});
