import type { CaptureEvent } from "@voidhash/api-contracts/event-capture";
import type { InternalAnalyticsEvent } from "@voidhash/core/domain/internalAnalytics/InternalAnalyticsEvents";
import { AnalyticsEventStore } from "@voidhash/core/services/analytics/AnalyticsEventStore";
import { AnalyticsDispatchService } from "@voidhash/core/services/analyticsIngest/AnalyticsDispatchService";
import {
  type CaptureRequest,
  EventCaptureService,
} from "@voidhash/core/services/analyticsIngest/EventCaptureService";
import { analyticsEvents, apiKeys, captureProjectPolicies, Db, eq } from "@voidhash/db";
import { Clock, DateTime, Effect, Layer } from "effect";
import { expect } from "vitest";

import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

import { hashKey } from "../../../src/services/apiKeys/api-keys.ts";

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

/** Runs a test with registry defaults, then restores the fixture's prior policy. */
const withDefaultAdmissionPolicy = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const previous = yield* db.query.captureProjectPolicies.findFirst({
      where: { projectId: CoreTestFixture.projectId },
    });
    const clear = db
      .delete(captureProjectPolicies)
      .where(eq(captureProjectPolicies.projectId, CoreTestFixture.projectId));
    yield* clear;
    return yield* effect.pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          yield* clear;
          if (previous) yield* db.insert(captureProjectPolicies).values(previous);
        }).pipe(Effect.ignore),
      ),
    );
  });

test(
  "OSS capture stores custom events by default and rejects opted-out built-ins",
  Effect.gen(function* () {
    const db = yield* Db;
    const now = yield* DateTime.nowAsDate;
    const apiKeyId = yield* unique("oss_capture_key");
    const token = `vh_pk_${apiKeyId}`;
    const customId = yield* unique("oss_custom_event");
    const lifecycleId = yield* unique("oss_lifecycle_event");
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
      [customId, lifecycleId, reservedId],
      apiKeyId,
      withDefaultAdmissionPolicy(
        Effect.gen(function* () {
          const capture = yield* EventCaptureService;
          const request: CaptureRequest = {
            events: [
              captureEvent(customId, "checkout_started"),
              // Disabled by default self-hosted, and revenue can never be forged
              // from a publishable key.
              captureEvent(lifecycleId, "$app_opened"),
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
            .where(eq(analyticsEvents.eventId, customId));
          expect(rows).toHaveLength(1);
          expect(rows[0]).toMatchObject({
            eventName: "checkout_started",
            identityMode: "personless",
            source: "sdk",
          });
        }).pipe(Effect.provide(captureLive)),
      ),
    );
  }),
);

test(
  "OSS capture authorizes a hashed project secret key and never stores the raw secret",
  Effect.gen(function* () {
    const db = yield* Db;
    const now = yield* DateTime.nowAsDate;
    const apiKeyId = yield* unique("oss_secret_key");
    const rawSecret = `vh_sk_${apiKeyId}`;
    const hashedSecret = yield* hashKey(rawSecret);
    const customId = yield* unique("oss_secret_event");

    // Secret keys are stored hashed with `is_public = false`, the way
    // `createSecretKey` persists them.
    yield* db.insert(apiKeys).values({
      end: rawSecret.slice(-8),
      id: apiKeyId,
      isPublic: false,
      key: hashedSecret,
      name: "OSS secret key capture",
      prefix: "vh_sk",
      projectId: CoreTestFixture.projectId,
    });

    yield* withCleanup(
      [customId],
      apiKeyId,
      withDefaultAdmissionPolicy(
        Effect.gen(function* () {
          const capture = yield* EventCaptureService;
          const result = yield* capture.captureEvents({
            events: [captureEvent(customId, "checkout_started")],
            request: {
              headers: {},
              receivedAt: now,
              requestId: yield* unique("oss_secret_request"),
              sentAt: now,
              token: rawSecret,
            },
          });
          expect(result).toEqual({ accepted: 1, rejected: 0 });

          const rows = yield* db
            .select()
            .from(analyticsEvents)
            .where(eq(analyticsEvents.eventId, customId));
          expect(rows).toHaveLength(1);
          // Persisting the raw secret would leak a credential into the events
          // table; only the lookup digest may be stored.
          expect(rows[0]?.token).toBe(hashedSecret);
          expect(rows[0]?.token).not.toBe(rawSecret);
        }).pipe(Effect.provide(captureLive)),
      ),
    );
  }),
);

test(
  "OSS capture rejects a secret key presented in its raw, unhashed stored form",
  Effect.gen(function* () {
    const db = yield* Db;
    const now = yield* DateTime.nowAsDate;
    const apiKeyId = yield* unique("oss_raw_secret_key");
    const rawSecret = `vh_sk_${apiKeyId}`;

    // A row that (incorrectly) stores the plaintext secret must not authorize:
    // capture looks secret keys up by digest only.
    yield* db.insert(apiKeys).values({
      end: rawSecret.slice(-8),
      id: apiKeyId,
      isPublic: false,
      key: rawSecret,
      name: "OSS raw secret key",
      prefix: "vh_sk",
      projectId: CoreTestFixture.projectId,
    });

    yield* withCleanup(
      [],
      apiKeyId,
      withDefaultAdmissionPolicy(
        Effect.gen(function* () {
          const capture = yield* EventCaptureService;
          const error = yield* Effect.flip(
            capture.captureEvents({
              events: [captureEvent(yield* unique("oss_raw_secret_event"), "checkout_started")],
              request: {
                headers: {},
                receivedAt: now,
                requestId: yield* unique("oss_raw_secret_request"),
                sentAt: now,
                token: rawSecret,
              },
            }),
          );
          expect(error._tag).toBe("CaptureUnauthorizedError");
        }).pipe(Effect.provide(captureLive)),
      ),
    );
  }),
);

test(
  "OSS capture follows the project's admission policy for built-in and blocked events",
  Effect.gen(function* () {
    const db = yield* Db;
    const now = yield* DateTime.nowAsDate;
    const apiKeyId = yield* unique("oss_policy_key");
    const token = `vh_pk_${apiKeyId}`;
    const lifecycleId = yield* unique("oss_policy_lifecycle_event");
    const blockedId = yield* unique("oss_policy_blocked_event");

    yield* db.insert(apiKeys).values({
      end: token.slice(-8),
      id: apiKeyId,
      isPublic: true,
      key: token,
      name: "OSS admission policy integration key",
      prefix: "vh_pk",
      projectId: CoreTestFixture.projectId,
    });

    yield* withCleanup(
      [lifecycleId, blockedId],
      apiKeyId,
      withDefaultAdmissionPolicy(
        Effect.gen(function* () {
          yield* db.insert(captureProjectPolicies).values({
            builtinEventOverrides: { $app_opened: true },
            customEventBlocklist: ["checkout_started"],
            projectId: CoreTestFixture.projectId,
          });

          const capture = yield* EventCaptureService;
          const result = yield* capture.captureEvents({
            events: [
              captureEvent(lifecycleId, "$app_opened"),
              captureEvent(blockedId, "checkout_started"),
            ],
            request: {
              headers: {},
              receivedAt: now,
              requestId: yield* unique("oss_policy_request"),
              sentAt: now,
              token,
            },
          });
          expect(result).toEqual({ accepted: 1, rejected: 1 });

          const admittedRows = yield* db
            .select()
            .from(analyticsEvents)
            .where(eq(analyticsEvents.eventId, lifecycleId));
          const blockedRows = yield* db
            .select()
            .from(analyticsEvents)
            .where(eq(analyticsEvents.eventId, blockedId));
          expect(admittedRows).toHaveLength(1);
          expect(blockedRows).toHaveLength(0);
        }).pipe(Effect.provide(captureLive)),
      ),
    );
  }),
);

test(
  "OSS trusted dispatch upserts revenue and skips built-ins the project opted out of",
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
      withDefaultAdmissionPolicy(
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
      ),
    );
  }),
);

test(
  "OSS trusted dispatch stores an opted-in built-in",
  Effect.gen(function* () {
    const db = yield* Db;
    const now = yield* DateTime.nowAsDate;
    const exposureId = yield* unique("oss_admitted_exposure_event");

    yield* withCleanup(
      [exposureId],
      undefined,
      withDefaultAdmissionPolicy(
        Effect.gen(function* () {
          yield* db.insert(captureProjectPolicies).values({
            builtinEventOverrides: { "$experiment.exposed": true },
            projectId: CoreTestFixture.projectId,
          });

          const dispatch = yield* AnalyticsDispatchService;
          yield* dispatch.dispatchTrusted([
            {
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
            },
          ]);

          const rows = yield* db
            .select()
            .from(analyticsEvents)
            .where(eq(analyticsEvents.eventId, exposureId));
          expect(rows).toHaveLength(1);
        }).pipe(Effect.provide(dispatchLive)),
      ),
    );
  }),
);
