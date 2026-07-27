import { Context, type Effect, Schema } from "effect";

/**
 * Catch-all error for {@link SnapshotImageRenderer} operations. The adapter
 * wraps any rendering failure (HTML generation, screenshot) into this single
 * tag so {@link PaywallThumbnailService}'s catch boundary stays small.
 */
export class SnapshotImageRenderError extends Schema.TaggedErrorClass<SnapshotImageRenderError>(
  "SnapshotImageRenderError",
)("SnapshotImageRenderError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface SnapshotImageRenderInput {
  /**
   * The decoded paywall document ROOT node (renderer `SnapshotNode` shape) — the
   * `{id, type, parentId, pos, data, children}` tree the designer renders. Typed
   * as `unknown` here so `packages/core` stays free of the preact renderer
   * packages; the live adapter narrows it structurally (runtime-identical to the
   * client's `documentRootFromSnapshot`).
   */
  readonly snapshot: unknown;
  /**
   * Preview-tree artifacts for the snapshot's deployed component nodes, keyed by
   * `contentHash` then preview state, exactly as `ComponentArtifacts["trees"]`
   * expects. Component nodes without a matching tree render as placeholders.
   */
  readonly componentTrees: Record<string, Record<string, unknown>>;
  /** Preview trees for local components, keyed by document-relative component path. */
  readonly localComponentTrees: Record<string, Record<string, unknown>>;
  /** Viewport width in CSS pixels. */
  readonly width: number;
  /** Viewport height in CSS pixels. */
  readonly height: number;
  /** Device pixel ratio for the raster. */
  readonly deviceScaleFactor: number;
}

export interface SnapshotImageRendererShape {
  /**
   * Renders a paywall document snapshot to PNG bytes: composes the snapshot (and
   * its deployed and local component preview trees) into a self-contained,
   * non-hydrated HTML document, then rasterizes it in a headless browser.
   */
  readonly render: (
    input: SnapshotImageRenderInput,
  ) => Effect.Effect<Uint8Array, SnapshotImageRenderError>;
}

/**
 * Provider-agnostic port that turns a decoded paywall document snapshot into a
 * PNG. The snapshot→HTML composition lives behind this port (not in
 * `packages/core`) so core never imports the preact renderer packages; the live
 * adapter (`stacks/backend/infrastructure/SnapshotImageRenderer.ts`) calls
 * `renderPaywallToHtml({ hydrate: false })` and the {@link HtmlScreenshot} port.
 */
export class SnapshotImageRenderer extends Context.Service<
  SnapshotImageRenderer,
  SnapshotImageRendererShape
>()("infrastructure/SnapshotImageRenderer") {}
