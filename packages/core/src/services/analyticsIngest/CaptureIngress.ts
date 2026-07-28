import { Context, Effect, Layer, Schema } from "effect";
import type { PlatformRuntime } from "@orbian/sdk/PlatformRuntime";

import type {
  CapturedEventV1Type,
  RouteClass,
} from "../../domain/analyticsIngest/AnalyticsIngest.ts";

export class CaptureIngressError extends Schema.TaggedErrorClass<CaptureIngressError>(
  "CaptureIngressError",
)("CaptureIngressError", {
  cause: Schema.optional(Schema.String),
  message: Schema.String,
}) {}

export interface CaptureIngressShape {
  readonly enqueueBatch: (
    events: ReadonlyArray<PublishableCaptureEvent>,
    // `PlatformRuntime` marks the queue send as runtime-only. The ingest-DLQ
    // write needs `Db`, but the live
    // adapter captures it at the layer's build (it closes over the `Db`-in-make
    // `AnalyticsIngestDlqService`), so it is no longer a per-call requirement.
  ) => Effect.Effect<void, CaptureIngressError, PlatformRuntime>;
}

/** Accepted capture event plus the route selected by capture policy. */
export interface PublishableCaptureEvent {
  readonly envelope: CapturedEventV1Type;
  readonly routeClass: RouteClass;
}

/**
 * Abstract ingress for accepted capture events. The queue-backed live adapter is
 * wired at the application root, so `packages/core` carries no infrastructure
 * dependency.
 */
export class CaptureIngress extends Context.Service<CaptureIngress, CaptureIngressShape>()(
  "@voidhash/core/CaptureIngress",
) {
  static readonly noop: Layer.Layer<CaptureIngress> = Layer.succeed(CaptureIngress, {
    enqueueBatch: () => Effect.void,
  });
}
