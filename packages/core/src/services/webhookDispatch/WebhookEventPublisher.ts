import { Cause, Context, Effect, Layer, Option } from "effect";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";

import type { WebhookEventType } from "../webhookManager/event-types.ts";
import { WebhookDispatchService } from "./WebhookDispatchService.ts";

/** One lifecycle event to fan out to a project's subscribed endpoints. */
export interface WebhookEventPublisherInput {
  readonly projectId: string;
  readonly eventType: WebhookEventType;
  /** Already schema-encoded payload — exactly the JSON body that goes on the wire. */
  readonly payload: object;
}

export interface WebhookEventPublisherShape {
  /**
   * Best-effort fan-out of one lifecycle event. Never fails and never
   * propagates a defect: a webhook is a side channel, so a broken endpoint
   * list, a dead workflow runner, or a DB hiccup must not roll back or delay
   * the state transition that produced the event.
   */
  readonly publish: (input: WebhookEventPublisherInput) => Effect.Effect<void>;
}

/**
 * Port that domain services call when a lifecycle transition actually
 * happened. Mirrors {@link import("../notifications/PushDeliveryDispatch").PushDeliveryDispatch}:
 * the state-mutating services depend only on this narrow, infallible seam, and
 * the composition root decides whether it resolves to the live
 * {@link WebhookDispatchService} or to {@link WebhookEventPublisher.noop}.
 *
 * Keeping `publish` at `Effect<void>` (no error, no requirements) is what stops
 * outbound-webhook plumbing from leaking `WorkflowRunner` / `PlatformRuntime`
 * into every payment-provider signature and every caller above it.
 */
export class WebhookEventPublisher extends Context.Service<
  WebhookEventPublisher,
  WebhookEventPublisherShape
>()("@voidhash/core/WebhookEventPublisher") {
  /** Drops every event. Used by tests and by runtimes with no workflow backend. */
  static readonly noop: Layer.Layer<WebhookEventPublisher> = Layer.succeed(WebhookEventPublisher, {
    publish: () => Effect.void,
  });

  /**
   * Live adapter over {@link WebhookDispatchService}.
   *
   * `WebhookDispatchService.emit` needs `WorkflowRunner` + `PlatformRuntime` to
   * start `DeliverWebhookWorkflow`. Both are provided per request / per
   * workflow activity rather than at layer-build time, so they are resolved
   * from the *calling* fiber's context and re-provided here. When the caller
   * runs outside such a runtime the event is dropped with a warning instead of
   * writing delivery rows that nothing would ever drain.
   */
  static readonly layer: Layer.Layer<WebhookEventPublisher, never, WebhookDispatchService> =
    Layer.effect(WebhookEventPublisher)(
      Effect.gen(function* () {
        const dispatch = yield* WebhookDispatchService;

        const publish = (input: WebhookEventPublisherInput) =>
          Effect.gen(function* () {
            const runner = yield* Effect.serviceOption(WorkflowRunner);
            const platform = yield* Effect.serviceOption(PlatformRuntime);
            if (Option.isNone(runner) || Option.isNone(platform)) {
              yield* Effect.logWarning(
                `Skipped webhook event ${input.eventType} for project ${input.projectId}: no workflow runtime in scope`,
              );
              return;
            }
            yield* dispatch.emit(input).pipe(
              Effect.provideService(WorkflowRunner, runner.value),
              Effect.provideService(PlatformRuntime, platform.value),
              Effect.catchCause((cause) =>
                Effect.logWarning(
                  `Failed to emit webhook event ${input.eventType} for project ${input.projectId}: ${Cause.pretty(cause)}`,
                ),
              ),
            );
          });

        return { publish };
      }),
    );
}
