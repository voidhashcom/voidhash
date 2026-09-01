import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";

/**
 * Catch-all dispatch error. Wraps the underlying queue `send`/encode failure at
 * the publish boundary so the send path sees one stable tag. The concrete
 * queue-backed adapter lives at the application root; core only references this.
 */
export class PushDeliveryDispatchError extends Schema.TaggedErrorClass<PushDeliveryDispatchError>(
  "PushDeliveryDispatchError",
)("PushDeliveryDispatchError", {
  cause: Schema.String,
}) {}

/** One unit of work handed to the queue — a single `(send, device)` delivery row. */
export interface PushDeliveryDispatchItem {
  readonly pushNotificationDeliveryId: string;
  readonly pushNotificationSendId: string;
  readonly projectId: string;
  readonly provider: string;
}

export interface PushDeliveryDispatchShape {
  /**
   * Enqueue the given per-device deliveries for async processing.
   * `PlatformRuntime` marks the underlying queue send as runtime-only, exactly
   * like {@link import("../analyticsIngest/CaptureIngress").CaptureIngress}.
   */
  readonly dispatch: (
    items: ReadonlyArray<PushDeliveryDispatchItem>,
  ) => Effect.Effect<void, PushDeliveryDispatchError, PlatformRuntime>;
}

/**
 * Abstract dispatcher for per-device push deliveries. The queue-backed live
 * adapter is wired at the application root (over `PushDeliveryQueue`), so
 * `packages/core` carries no Cloudflare dependency. `NotificationSendingService`
 * depends only on this port. In dev — where the Alchemy sidecar has no queue
 * binding — the {@link PushDeliveryDispatch.noop} layer is used (rows are created
 * but never delivered), mirroring `CaptureIngress.noop`.
 */
export class PushDeliveryDispatch extends Context.Service<
  PushDeliveryDispatch,
  PushDeliveryDispatchShape
>()("@voidhash/core/PushDeliveryDispatch") {
  static readonly noop: Layer.Layer<PushDeliveryDispatch> = Layer.succeed(PushDeliveryDispatch, {
    dispatch: () => Effect.void,
  });
}
