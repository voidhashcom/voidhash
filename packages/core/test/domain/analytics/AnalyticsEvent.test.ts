import {
  analyticsEventFromCapture,
  analyticsEventFromHostedProcessed,
  analyticsEventFromInternal,
  COMMUNITY_CAPTURE_EVENT_NAMES,
  isCommunityCaptureEventName,
} from "@voidhash/core/domain/analytics/AnalyticsEvent";
import type { InternalAnalyticsEvent } from "@voidhash/core/domain/internalAnalytics/InternalAnalyticsEvents";
import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

const occurredAt = DateTime.toDateUtc(DateTime.makeUnsafe("2026-08-01T12:34:56.789Z"));

const revenueEvent = (): InternalAnalyticsEvent => ({
  context: { sdk: "react-native" },
  distinctId: "customer-1",
  eventId: "revenue-event-1",
  eventName: "$purchase.completed",
  occurredAt,
  organizationId: "org-1",
  personId: "person-1",
  projectId: "project-1",
  properties: {
    amount: 1299,
    amountUsd: 1299,
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

describe("shared analytics event contract", () => {
  it("defines the complete Community SDK allow-list", () => {
    expect(COMMUNITY_CAPTURE_EVENT_NAMES).toEqual([
      "$app_installed",
      "$app_updated",
      "$app_opened",
      "$app_backgrounded",
      "$app_became_active",
      "$sign_out",
    ]);
    expect(isCommunityCaptureEventName("$app_opened")).toBe(true);
    expect(isCommunityCaptureEventName("checkout_started")).toBe(false);
    expect(isCommunityCaptureEventName("$identify")).toBe(false);
    expect(isCommunityCaptureEventName("$purchase.completed")).toBe(false);
  });

  it("keeps capture IDs and event IDs stable across SDK retries", () => {
    const input = {
      event: {
        uuid: "sdk-event-1",
        event: "$app_opened",
        context: { locale: "en-US" },
        properties: { $app_version: "2.0.0" },
        distinct_id: "device-1",
      },
      organizationId: "org-1",
      projectId: "project-1",
      receivedAt: occurredAt,
      requestId: "request-1",
      requestPath: "/i/v1/capture",
      sentAt: occurredAt,
      token: "vh_pk_test",
    };

    const first = analyticsEventFromCapture(input);
    const retry = analyticsEventFromCapture({ ...input, requestId: "request-2" });

    expect(first.eventId).toBe("sdk-event-1");
    expect(first.captureId).toBe("capture_sdk-event-1");
    expect(retry.eventId).toBe(first.eventId);
    expect(retry.captureId).toBe(first.captureId);
    expect(first.identityMode).toBe("personless");
  });

  it("maps trusted revenue and hosted processed events to the same semantics", () => {
    const portable = analyticsEventFromInternal(revenueEvent(), occurredAt);
    const hosted = analyticsEventFromHostedProcessed({
      captureId: portable.captureId,
      context: portable.context,
      distinctId: portable.distinctId,
      event: portable.eventName,
      eventTimestamp: portable.eventTimestamp.toISOString(),
      identity: {
        distinctId: portable.distinctId,
        mode: portable.identityMode,
        personId: portable.personId ?? undefined,
      },
      organizationId: portable.organizationId,
      processedAt: portable.processedAt.toISOString(),
      processedEventId: portable.eventId,
      projectId: portable.projectId,
      properties: portable.properties,
      request: { path: portable.requestPath ?? undefined, requestId: portable.requestId },
      routing: { sourceTopic: portable.sourceTopic },
      token: portable.token,
    });

    expect(hosted).toEqual(portable);
  });

  it("normalizes the hosted capture wrapper to the stored SDK properties", () => {
    const hosted = analyticsEventFromHostedProcessed({
      captureId: "capture-sdk-1",
      context: {},
      distinctId: "device-1",
      event: "$app_opened",
      eventTimestamp: occurredAt.toISOString(),
      identity: { distinctId: "device-1", mode: "personless" },
      organizationId: "org-1",
      processedAt: occurredAt.toISOString(),
      processedEventId: "sdk-1",
      projectId: "project-1",
      properties: {
        distinctId: "device-1",
        properties: { $app_version: "2.0.0" },
        $process_person_profile: false,
      },
      request: { requestId: "request-1" },
      routing: { sourceTopic: "capture.v1" },
      token: "vh_pk_test",
    });

    expect(hosted.properties).toEqual({ $app_version: "2.0.0" });
  });
});
