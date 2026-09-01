import {
  SnapshotHtmlRenderer,
  SnapshotHtmlRenderError,
} from "@voidhash/core/services/paywallReleases/SnapshotHtmlRenderer";
import { causeMessage } from "@voidhash/lib/lang";
import type { ComponentArtifacts, SnapshotNode } from "@voidhash/paywall-renderer-preact";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";

/**
 * The only boundary where the schema-neutral `SnapshotHtmlRenderInput` (typed
 * `unknown` in core so it carries no Preact dependency) meets the renderer's
 * structural node type. Shape-only check; the renderer validates the contents.
 */
const isSnapshotNode = (value: unknown): value is SnapshotNode =>
  P.isObject(value) && value !== null;

/** Companion boundary check for the component preview trees carried alongside the snapshot. */
const isComponentTrees = (
  value: Record<string, Record<string, unknown>>,
): value is ComponentArtifacts["trees"] => P.isObject(value) && value !== null;

const renderFailure = (cause: unknown) =>
  new SnapshotHtmlRenderError({
    cause: causeMessage(cause),
    message: "Failed to render the paywall release document",
  });

const loadPreact = () => import("preact");
const loadPreactRenderer = () => import("@voidhash/paywall-renderer-preact");

/** Portable Preact adapter for hydrated visual paywall release documents. */
export const BackendSnapshotHtmlRendererLive = Layer.succeed(SnapshotHtmlRenderer, {
  render: (input) =>
    Effect.fn("render")(function* () {
      if (!isSnapshotNode(input.snapshot)) {
        return yield* renderFailure("The paywall release document is not a snapshot node");
      }
      if (!isComponentTrees(input.componentTrees)) {
        return yield* renderFailure("The paywall release document has invalid component trees");
      }

      const snapshot = input.snapshot;
      const trees = input.componentTrees;

      const preact = yield* Effect.tryPromise({ catch: renderFailure, try: loadPreact });
      // Compiled component trees reference the `React` global, so the Preact
      // runtime is published there before rendering (without clobbering an
      // existing runtime).
      if (Reflect.get(globalThis, "React") === undefined) {
        Reflect.set(globalThis, "React", preact);
      }
      const { renderPaywallToHtml } = yield* Effect.tryPromise({
        catch: renderFailure,
        try: loadPreactRenderer,
      });

      return yield* Effect.try({
        catch: renderFailure,
        try: () =>
          renderPaywallToHtml(snapshot, {
            componentArtifacts: {
              trees,
            },
            hydrate: true,
            metadata: input.metadata,
          }).html,
      });
    })(),
});
