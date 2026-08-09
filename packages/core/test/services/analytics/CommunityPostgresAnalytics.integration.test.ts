import type { CaptureEvent } from "@voidhash/api-contracts/event-capture";
import type { InternalAnalyticsEvent } from "@voidhash/core/domain/internalAnalytics/InternalAnalyticsEvents";
import { AnalyticsEventStore } from "@voidhash/core/services/analytics/AnalyticsEventStore";
import { AnalyticsDispatchService } from "@voidhash/core/services/analyticsIngest/AnalyticsDispatchService";
import {
  type CaptureRequest,
  EventCaptureService,
} from "@voidhash/core/services/analyticsIngest/EventCaptureService";
import { analyticsEvents, apiKeys, Db, eq } from "@voidhash/db";
import { Clock, DateTime, Effect, Layer } from "effect";
import { expect } from "vitest";

import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();
let sequence = 0;

const unique = (prefix: string) =>
  Effect.map(Clock.currentTimeMillis, (now) => `${prefix}_${now}_${sequence++}`);

const storeLive = AnalyticsEventStore.layer;
const captureLive = EventCaptureService.layer.pipe(Layer.provide(storeLive));
const dispatchLive = AnalyticsDispatchService.layer.pipe(Layer.provide(storeLive));

const captureEvent = (uuid: string, event: string): typeof CaptureEvent.Type => ({
  uuid,
  event,
  context: { locale: "en-US" },
  properties: { $app_version: "1.0.0" },
  distinct_id: "device-1",
});

const revenueEvent = (eventId: string, now: Date): InternalAnalyticsEvent => ({
  context: {},
  distinctId: "customer-1",
  eventId,
  eventName: "$purchase.completed",
  occurredAt: now,
  organizationId: CoreTestFixture.organizationId,
  personId: CoreTestFixture.userId,
  projectId: CoreTestFixture.projectId,
  properties: {
    amount: 999,
    amountUsd: 999,
    currency: "USD",
    paymentProviderConfigurationId: "configuration-1",
    paymentProviderConfigurationProductId: "configuration-product-1",
    providerEnvironment: 1,
    providerEventType: "purchase",
    providerId: "app-store",
    providerSubscriptionId: null,
    providerTransactionId: "transaction-1",
    providerWebhookNotificationId: null,
    source: "sdk",
  },
  token: "internal",
  transactionId: "transaction-1",
});

const withCleanup = <A, E, R>(
  eventIds: ReadonlyArray<string>,
  apiKeyId: string | undefined,
  effect: Effect.Effect<A, E, R>,
) =>
  effect.pipe(
    Effect.ensuring(
      Effect.gen(function* () {
        const db = yield* Db;
        for (const eventId of eventIds) {
          yield* db.delete(analyticsEvents).where(eq(analyticsEvents.eventId, eventId));
        }
        if (apiKeyId) yield* db.delete(apiKeys).where(eq(apiKeys.id, apiKeyId));
      }).pipe(Effect.ignore),
    ),
  );

test(
  "OSS capture synchronously stores allow-listed events and rejects all others",
  Effect.gen(function* () {
    const db = yield* Db;
    const now = yield* DateTime.nowAsDate;
    const apiKeyId = yield* unique("oss_capture_key");
    const token = `vh_pk_${apiKeyId}`;
    const supportedId = yield* unique("oss_supported_event");
    const customId = yield* unique("oss_custom_event");
    const reservedId = yield* unique("oss_reserved_event");

    yield* db.insert(apiKeys).values({
      end: token.slice(-8),
      id: apiKeyId,
      isPublic: true,
      key: token,
      name: "OSS analytics integration key",
      prefix: "vh_pk",
      projectId: CoreTestFixture.projectId,
    });

    yield* withCleanup(
      [supportedId, customId, reservedId],
      apiKeyId,
      Effect.gen(function* () {
        const capture = yield* EventCaptureService;
        const request: CaptureRequest = {
          events: [
            captureEvent(supportedId, "$app_opened"),
            captureEvent(customId, "checkout_started"),
            captureEvent(reservedId, "$purchase.completed"),
          ],
          request: {
            headers: {},
            receivedAt: now,
            requestId: yield* unique("oss_capture_request"),
            sentAt: now,
            token,
          },
        };
        const result = yield* capture.captureEvents(request);
        expect(result).toEqual({ accepted: 1, rejected: 2 });

        yield* capture.captureEvents(request);
        const rows = yield* db
          .select()
          .from(analyticsEvents)
          .where(eq(analyticsEvents.eventId, supportedId));
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          eventName: "$app_opened",
          identityMode: "personless",
          source: "sdk",
        });
      }).pipe(Effect.provide(captureLive)),
    );
  }),
);

test(
  "OSS trusted dispatch upserts revenue and skips non-revenue internal events",
  Effect.gen(function* () {
    const db = yield* Db;
    const now = yield* DateTime.nowAsDate;
    const eventId = yield* unique("oss_revenue_event");
    const exposureId = yield* unique("oss_exposure_event");
    const revenue = revenueEvent(eventId, now);
    const exposure: InternalAnalyticsEvent = {
      context: {},
      distinctId: "device-1",
      eventId: exposureId,
      eventName: "$experiment.exposed",
      occurredAt: now,
      organizationId: CoreTestFixture.organizationId,
      personId: null,
      projectId: CoreTestFixture.projectId,
      properties: { experimentId: "experiment-1", variantKey: "control" },
      token: "internal",
    };

    yield* withCleanup(
      [eventId, exposureId],
      undefined,
      Effect.gen(function* () {
        const dispatch = yield* AnalyticsDispatchService;
        yield* dispatch.dispatchTrusted([revenue, revenue, exposure]);
        const rows = yield* db
          .select()
          .from(analyticsEvents)
          .where(eq(analyticsEvents.eventId, eventId));
        const exposureRows = yield* db
          .select()
          .from(analyticsEvents)
          .where(eq(analyticsEvents.eventId, exposureId));

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          eventName: "$purchase.completed",
          identityMode: "full",
          source: "revenue",
        });
        expect(exposureRows).toHaveLength(0);
      }).pipe(Effect.provide(dispatchLive)),
    );
  }),
);
