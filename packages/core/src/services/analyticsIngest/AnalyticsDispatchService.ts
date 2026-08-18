import { captureProjectPolicies, Db, inArray } from "@voidhash/db";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { Context, DateTime, Effect, Layer } from "effect";

import { analyticsEventFromInternal } from "../../domain/analytics/AnalyticsEvent.ts";
import {
  admitEvent,
  emptyEventAdmissionPolicy,
  type EventAdmissionPolicy,
} from "../../domain/analytics/EventAdmission.ts";
import { type InternalAnalyticsEvent } from "../../domain/internalAnalytics/InternalAnalyticsEvents.ts";
import { AnalyticsEventStore } from "../analytics/AnalyticsEventStore.ts";

export interface AnalyticsDispatchServiceShape {
  readonly dispatchTrusted: (
    events: ReadonlyArray<InternalAnalyticsEvent>,
  ) => Effect.Effect<void, unknown, PlatformRuntime>;
}

const makeAnalyticsDispatchService = Effect.gen(function* () {
  const store = yield* AnalyticsEventStore;
  const db = yield* Db;

  /**
   * Load the admission policy of every project referenced by the batch. Trusted
   * batches are per-purchase and rarely span projects, so one `IN` query keeps
   * the dispatch a single round trip.
   */
  const loadPolicies = (projectIds: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      const rows = yield* db
        .select({
          builtinEventOverrides: captureProjectPolicies.builtinEventOverrides,
          customEventBlocklist: captureProjectPolicies.customEventBlocklist,
          projectId: captureProjectPolicies.projectId,
        })
        .from(captureProjectPolicies)
        .where(inArray(captureProjectPolicies.projectId, [...projectIds]));
      return new Map<string, EventAdmissionPolicy>(
        rows.map((row) => [
          row.projectId,
          {
            builtinEventOverrides: row.builtinEventOverrides,
            customEventBlocklist: row.customEventBlocklist,
          },
        ]),
      );
    });

  const dispatchTrusted = (events: ReadonlyArray<InternalAnalyticsEvent>) =>
    Effect.gen(function* () {
      if (events.length === 0) return;
      const processedAt = yield* DateTime.nowAsDate;
      const policies = yield* loadPolicies([...new Set(events.map((event) => event.projectId))]);
      const admitted = events
        .filter(
          (event) =>
            admitEvent({
              edition: "oss",
              eventName: event.eventName,
              policy: policies.get(event.projectId) ?? emptyEventAdmissionPolicy,
            }).admitted,
        )
        .map((event) => analyticsEventFromInternal(event, processedAt));
      yield* store.insert(admitted);
    });

  return { dispatchTrusted } satisfies AnalyticsDispatchServiceShape;
});

/**
 * Community trusted-event sink. Server-emitted events are synchronously
 * upserted into PostgreSQL, subject to the destination project's event
 * admission policy — the same registry the SDK capture path enforces.
 */
export class AnalyticsDispatchService extends Context.Service<
  AnalyticsDispatchService,
  AnalyticsDispatchServiceShape
>()("@voidhash/core/AnalyticsDispatchService") {
  static readonly layer: Layer.Layer<AnalyticsDispatchService, never, AnalyticsEventStore | Db> =
    Layer.effect(AnalyticsDispatchService)(makeAnalyticsDispatchService);

  /** No-op dispatch for tests and hosts that do not run analytics. */
  static readonly noop: Layer.Layer<AnalyticsDispatchService> = Layer.succeed(
    AnalyticsDispatchService,
    { dispatchTrusted: () => Effect.void },
  );
}
