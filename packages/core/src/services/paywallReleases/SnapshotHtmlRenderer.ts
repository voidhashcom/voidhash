import { Context, type Effect, Schema } from "effect";

/** Stable error returned when a paywall snapshot cannot be rendered to HTML. */
export class SnapshotHtmlRenderError extends Schema.TaggedErrorClass<SnapshotHtmlRenderError>(
  "SnapshotHtmlRenderError",
)("SnapshotHtmlRenderError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface SnapshotHtmlRenderInput {
  readonly snapshot: unknown;
  readonly componentTrees: Record<string, Record<string, unknown>>;
  readonly metadata: {
    readonly createdAt: string;
    readonly schemaVersion: number;
    readonly status: "draft";
    readonly version: number;
  };
}

export interface SnapshotHtmlRendererShape {
  /** Renders a decoded Mimic paywall snapshot into a self-contained hydrated document. */
  readonly render: (
    input: SnapshotHtmlRenderInput,
  ) => Effect.Effect<string, SnapshotHtmlRenderError>;
}

/** Provider-neutral boundary between release orchestration and the Preact HTML renderer. */
export class SnapshotHtmlRenderer extends Context.Service<
  SnapshotHtmlRenderer,
  SnapshotHtmlRendererShape
>()("@voidhash/core/SnapshotHtmlRenderer") {}
