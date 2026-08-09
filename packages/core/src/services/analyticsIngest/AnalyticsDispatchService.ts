import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { Context, DateTime, Effect, Layer } from "effect";

import { analyticsEventFromInternal } from "../../domain/analytics/AnalyticsEvent.ts";
import {
  isReservedRevenueEventName,
  type InternalAnalyticsEvent,
} from "../../domain/internalAnalytics/InternalAnalyticsEvents.ts";
import { AnalyticsEventStore } from "../analytics/AnalyticsEventStore.ts";

export interface AnalyticsDispatchServiceShape {
  readonly dispatchTrusted: (
    events: ReadonlyArray<InternalAnalyticsEvent>,
  ) => Effect.Effect<void, unknown, PlatformRuntime>;
}

const makeAnalyticsDispatchService = Effect.gen(function* () {
  const store = yield* AnalyticsEventStore;
  const dispatchTrusted = (events: ReadonlyArray<InternalAnalyticsEvent>) =>
    Effect.gen(function* () {
      const processedAt = yield* DateTime.nowAsDate;
      const revenueEvents = events
        .filter((event) => isReservedRevenueEventName(event.eventName))
        .map((event) => analyticsEventFromInternal(event, processedAt));
      yield* store.insert(revenueEvents);
    });

  return { dispatchTrusted } satisfies AnalyticsDispatchServiceShape;
});

/**
 * Community trusted-event sink. Revenue events are synchronously upserted into
 * PostgreSQL; other internal analytics classes are left to hosted editions.
 */
export class AnalyticsDispatchService extends Context.Service<
  AnalyticsDispatchService,
  AnalyticsDispatchServiceShape
>()("@voidhash/core/AnalyticsDispatchService") {
  static readonly layer: Layer.Layer<AnalyticsDispatchService, never, AnalyticsEventStore> =
    Layer.effect(AnalyticsDispatchService)(makeAnalyticsDispatchService);

  /** No-op dispatch for tests and hosts that do not run analytics. */
  static readonly noop: Layer.Layer<AnalyticsDispatchService> = Layer.succeed(
    AnalyticsDispatchService,
    { dispatchTrusted: () => Effect.void },
  );
}
