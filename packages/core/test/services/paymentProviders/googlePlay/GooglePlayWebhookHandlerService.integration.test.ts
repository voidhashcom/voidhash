/**
 * Integration tests for the Google Play RTDN webhook handler
 * ({@link GooglePlayWebhookHandlerService}). Run against the real backend stack
 * (live DB). Only the branches that resolve BEFORE the live Play API fetch are
 * exercised here — config lookup, Pub/Sub envelope decode, and test
 * notifications. The branches that re-fetch authoritative purchase state (every
 * subscription / one-time / voided notification) mint an OAuth2 token and call
 * the Android Publisher API, which isn't available offline, so they are
 * deferred to `test.todo` (mirroring the App Store webhook handler suite, which
 * is entirely `test.todo` behind the live-Apple wall).
 */
import { DateTime, Effect, Encoding, Layer, Schema } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import {
  FxRateService,
  GooglePlayServerApi,
  GooglePlayWebhookHandlerService,
  IdentityProjectionPublisher,
  PerkGrantService,
  PersonIdentityService,
  PurchaseProcessingService,
} from "@voidhash/core/services";
import { WebhookEventPublisher } from "@voidhash/core/services/webhookDispatch/WebhookEventPublisher";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import { generateId } from "@voidhash/core/utils";
import { GooglePlayPaymentProviderConfigurationNotFoundError } from "../../../../src/services/paymentProviders/googlePlay/errors.ts";
import {
  Db,
  eq,
  inArray,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  paymentProviderNotificationProcessed,
  products,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

let seq = 0;
const uniq = (label: string) => `it-gpwh-${label}-${generateId("test")}-${seq++}`;

const HandlerLive = GooglePlayWebhookHandlerService.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      PurchaseProcessingService.layer.pipe(Layer.provide(WebhookEventPublisher.noop)),
      PersonIdentityService.layer,
      FxRateService.layer({ apiKey: Effect.succeed("test-fx-key") }),
      PaymentConfigSecretCrypto.layer({ key: Effect.succeed("") }),
      GooglePlayServerApi.layer,
    ),
  ),
  Layer.provideMerge(Layer.mergeAll(PerkGrantService.layer, IdentityProjectionPublisher.noop)),
);

/** Base64-encoded Pub/Sub push envelope around a DeveloperNotification. */
const envelope = (developerNotification: unknown, messageId = uniq("msg")) => ({
  message: {
    data: Encoding.encodeBase64(encodeJson(developerNotification)),
    messageId,
    publishTime: "2024-02-15T12:00:00.000Z",
  },
  subscription: "projects/p/subscriptions/s",
});

const seedConfig = (label: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const configId = generateId("paymentProviderConfiguration");
    const productId = generateId("product");
    const providerProductId = generateId("paymentProviderProduct");
    const packageName = `com.example.${label.replace(/[^a-z0-9]/gi, "")}${seq}`;
    yield* db.insert(products).values({
      id: productId,
      name: `GP WH IT ${label}`,
      projectId,
      slug: uniq(`${label}-slug`),
    });
    yield* db.insert(paymentProviderConfigurations).values({
      configuration: {
        googleRealTimeDeveloperNotificationForwardingUrl: "",
        googleRealTimeDeveloperNotificationTopicName: "",
        packageName,
        serviceAccountKey: "PLAINTEXT_KEY",
      },
      enabled: true,
      id: configId,
      name: `GP WH IT ${label}`,
      paymentProviderKey: packageName,
      projectId,
      providerId: "google-play",
    });
    yield* db.insert(paymentProviderConfigurationProducts).values({
      configuration: { productId: "premium" },
      id: providerProductId,
      isActive: true,
      paymentProviderConfigurationId: configId,
      productId,
      providerProductKey: "premium",
    });
    return { configId, productId, providerProductId };
  });

const cleanupConfig = (ids: { configId: string; productId: string; providerProductId: string }) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const ignore = <A, E>(eff: Effect.Effect<A, E, never>) => eff.pipe(Effect.ignore);
    yield* ignore(
      db
        .delete(paymentProviderNotificationProcessed)
        .where(
          eq(paymentProviderNotificationProcessed.paymentProviderConfigurationId, ids.configId),
        ),
    );
    yield* ignore(
      db
        .delete(paymentProviderConfigurationProducts)
        .where(inArray(paymentProviderConfigurationProducts.id, [ids.providerProductId])),
    );
    yield* ignore(
      db
        .delete(paymentProviderConfigurations)
        .where(inArray(paymentProviderConfigurations.id, [ids.configId])),
    );
    yield* ignore(db.delete(products).where(inArray(products.id, [ids.productId])));
  });

describe("GooglePlayWebhookHandlerService.acceptRtdnNotification", () => {
  test(
    "fails with ConfigurationNotFoundError for an unknown configuration id",
    Effect.gen(function* () {
      const handler = yield* GooglePlayWebhookHandlerService;
      const error = yield* Effect.flip(
        handler.acceptRtdnNotification({
          paymentProviderConfigurationId: "nonexistent-config",
          pubsubBody: envelope({ packageName: "com.x", testNotification: { version: "1.0" } }),
          receivedAt: yield* DateTime.nowAsDate,
        }),
      );
      expect(error).toBeInstanceOf(GooglePlayPaymentProviderConfigurationNotFoundError);
    }).pipe(Effect.provide(HandlerLive), CoreAuthSession.authenticate()),
  );

  test(
    "acks (handled:false) an undecodable Pub/Sub envelope without touching the Play API",
    Effect.gen(function* () {
      const handler = yield* GooglePlayWebhookHandlerService;
      const ids = yield* seedConfig("bad-envelope");
      const result = yield* handler
        .acceptRtdnNotification({
          paymentProviderConfigurationId: ids.configId,
          pubsubBody: { not: "a valid pubsub message" },
          receivedAt: yield* DateTime.nowAsDate,
        })
        .pipe(Effect.ensuring(cleanupConfig(ids)));
      expect(result.accepted).toBe(true);
      expect(result.handled).toBe(false);
    }).pipe(Effect.provide(HandlerLive), CoreAuthSession.authenticate()),
  );

  test(
    "acks a test notification and writes an ignored notification-ledger row",
    Effect.gen(function* () {
      const handler = yield* GooglePlayWebhookHandlerService;
      const ids = yield* seedConfig("test-notif");
      const messageId = uniq("test-msg");
      const result = yield* handler
        .acceptRtdnNotification({
          paymentProviderConfigurationId: ids.configId,
          pubsubBody: envelope(
            {
              eventTimeMillis: "1707998400000",
              packageName: "com.x",
              testNotification: { version: "1.0" },
            },
            messageId,
          ),
          receivedAt: yield* DateTime.nowAsDate,
        })
        .pipe(
          Effect.tap((value) =>
            Effect.gen(function* () {
              expect(value.accepted).toBe(true);
              expect(value.handled).toBe(true);
              const db = yield* Db;
              const row = yield* db.query.paymentProviderNotificationProcessed.findFirst({
                where: { notificationUuid: messageId },
              });
              expect(row?.result).toBe("ignored");
              expect(row?.providerId).toBe("google-play");
            }),
          ),
          Effect.ensuring(cleanupConfig(ids)),
        );
      expect(result.notificationType).toBe("TEST");
    }).pipe(Effect.provide(HandlerLive), CoreAuthSession.authenticate()),
  );

  // The remaining branches re-fetch authoritative state from the Play Developer
  // API (subscriptions.v2.get / products.v2.get) after minting an OAuth2 token,
  // which is not available offline.
  vitestTest.todo(
    "SUBSCRIPTION_PURCHASED → recordPurchase — deferred: needs a live subscriptions.v2.get fetch + service-account credentials",
  );
  vitestTest.todo(
    "voided purchase → recordRefund — deferred: needs a live purchase fetch for the refunded token",
  );
  vitestTest.todo(
    "product-not-mapped parks the raw Pub/Sub envelope (parked_pending_product_mapping) — deferred: reaching the dispatch requires the live fetch to resolve the productId first",
  );
});
