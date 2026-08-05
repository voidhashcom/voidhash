/**
 * `AnalyticsDispatchService` is the single seam both transports use to enqueue
 * onto the shared analytics-ingest queue — a thin layer over the one
 * {@link CaptureIngress} producer.
 *
 *  - `dispatchCaptured` — the SDK path. Stamps each accepted envelope with an
 *    `Anonymous` / `Stitch` identity claim + `trustClass: "untrusted-sdk"`.
 *  - `dispatchTrusted` — the server-trusted revenue path. Maps each
 *    {@link InternalAnalyticsEvent} into a {@link CapturedEventV1} carrying a
 *    `Resolved` claim + `trustClass: "trusted-revenue"` + the trusted topic.
 *
 * Tests / non-worker hosts get {@link AnalyticsDispatchService.noop}.
 */
import { Context, Effect, Layer } from "effect";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";

import {
  type CapturedEventV1Type,
  type CapturedIdentityClaim,
  extractInnerProperties,
  makeCapturedEventFromInternalAnalyticsEvent,
} from "../../domain/analyticsIngest/AnalyticsIngest.ts";
import type { InternalAnalyticsEvent } from "../../domain/internalAnalytics/InternalAnalyticsEvents.ts";
import {
  CaptureIngress,
  type CaptureIngressError,
  type PublishableCaptureEvent,
} from "./CaptureIngress.ts";

export interface AnalyticsDispatchServiceShape {
  // `PlatformRuntime` marks the underlying queue send as runtime-only. `Db`
  // (the ingest-DLQ write) is captured at the `CaptureIngress` layer's build,
  // not per call, so it is not a method requirement — see `CaptureIngress`.
  readonly dispatchCaptured: (
    events: ReadonlyArray<PublishableCaptureEvent>,
  ) => Effect.Effect<void, CaptureIngressError, PlatformRuntime>;
  readonly dispatchTrusted: (
    events: ReadonlyArray<InternalAnalyticsEvent>,
  ) => Effect.Effect<void, CaptureIngressError, PlatformRuntime>;
}

/**
 * Stamps the SDK identity claim + trust class onto an accepted capture
 * envelope. `$identify` events with a `$previous_distinct_id` become a
 * `Stitch`; everything else is `Anonymous`. Server-side stamping keeps the
 * trust marker out of request-controlled input.
 */
export const stampSdkIdentityClaim = (envelope: CapturedEventV1Type): CapturedEventV1Type => {
  const inner = extractInnerProperties(envelope.properties);
  const previousDistinctId =
    typeof inner.$previous_distinct_id === "string" && inner.$previous_distinct_id.length > 0
      ? inner.$previous_distinct_id
      : undefined;
  const identityClaim: CapturedIdentityClaim =
    envelope.event === "$identify" && previousDistinctId !== undefined
      ? { _tag: "Stitch", distinctId: envelope.distinctId, previousDistinctId }
      : { _tag: "Anonymous", distinctId: envelope.distinctId };
  return { ...envelope, identityClaim, trustClass: "untrusted-sdk" };
};

export class AnalyticsDispatchService extends Context.Service<
  AnalyticsDispatchService,
  AnalyticsDispatchServiceShape
>()("@voidhash/core/AnalyticsDispatchService", {
  make: Effect.gen(function* () {
    const ingress = yield* CaptureIngress;

    const dispatchCaptured = (events: ReadonlyArray<PublishableCaptureEvent>) =>
      events.length === 0
        ? Effect.void
        : ingress.enqueueBatch(
            events.map((event) => ({
              envelope: stampSdkIdentityClaim(event.envelope),
              routeClass: event.routeClass,
            })),
          );

    const dispatchTrusted = (events: ReadonlyArray<InternalAnalyticsEvent>) =>
      events.length === 0
        ? Effect.void
        : ingress.enqueueBatch(
            events.map((event) => ({
              envelope: makeCapturedEventFromInternalAnalyticsEvent(event),
              // Revenue is server-trusted and always lands on the main lane; the
              // route never depends on quota (revenue never enters capture).
              routeClass: "main" as const,
            })),
          );

    return { dispatchCaptured, dispatchTrusted } satisfies AnalyticsDispatchServiceShape;
  }),
}) {
  static readonly layer = Layer.effect(AnalyticsDispatchService)(AnalyticsDispatchService.make);

  /** No-op dispatch for tests and non-worker hosts (mirrors {@link CaptureIngress.noop}). */
  static readonly noop: Layer.Layer<AnalyticsDispatchService> = Layer.succeed(
    AnalyticsDispatchService,
    {
      dispatchCaptured: () => Effect.void,
      dispatchTrusted: () => Effect.void,
    },
  );
}
