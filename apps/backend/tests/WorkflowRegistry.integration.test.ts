// oxlint-disable-next-line effect/noNodeBuiltinImport -- the test stands up a real loopback FX server whose `.address()`/`.close()` handles are driven directly; `HttpServer` from effect/unstable/http would not hand back the `http.Server` this fixture needs.
import { createServer } from "node:http";

import { AnalyticsDispatchService } from "@voidhash/core/services/analyticsIngest/AnalyticsDispatchService";
import {
  AppStoreExpireParkedNotifications,
  AppStoreReconcileOriginalTransaction,
  AppStoreReplayParkedNotifications,
  AppStoreReplayParkedSdkNotifications,
  DeliverWebhook,
  FxRateSync,
  GooglePlayReplayParkedNotifications,
  PurchaseLedgerDrain,
  StripeReplayParkedNotifications,
} from "@voidhash/core/workflows/definitions";
import { backendWorkflows } from "@voidhash/core/workflows/registry";
import { generateId } from "@voidhash/core/utils/generate-id";
import {
  Db,
  type InsertPurchaseLedger,
  PurchaseLedgerStatus,
  WebhookDeliveryStatus,
  and,
  eq,
  fxRates,
  inArray,
  paymentProviderNotificationProcessed,
  purchaseLedger,
  sql,
  webhookDeliveries,
  webhookDeliveryAttempts,
  webhookEndpoints,
} from "@voidhash/db";
import { causeMessage, constant } from "@voidhash/lib/lang";
import * as Workflow from "@voidhash/platform/Workflow";
import { Clock, Data, DateTime, Effect, Exit, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { makeSelfhostPlatformLayers } from "../src/backend/PlatformProfile.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";

class WorkflowRegistryTestError extends Data.TaggedError("WorkflowRegistryTestError")<{
  readonly message: string;
}> {}

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

const FX_UPDATE_UNIX = 1_767_225_600;
const FX_AS_OF_DATE = DateTime.toDateUtc(DateTime.makeUnsafe(FX_UPDATE_UNIX * 1_000));
const FX_CURRENCY = "XTS";
const DAY_MS = 24 * 60 * 60 * 1_000;

describe("self-host workflow registry", () => {
  it("executes every workflow through the Postgres-backed cluster runner", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const marker = `workflow-coverage-${generateId("test")}`;
        const webhookEndpointId = `${marker}-endpoint`;
        const webhookDeliveryId = `${marker}-delivery`;
        const ledgerId = `${marker}-ledger`;
        const expireId = `${marker}-expire`;
        const appProductId = `${marker}-app-product`;
        const appSdkId = `${marker}-app-sdk`;
        const googleId = `${marker}-google`;
        const stripeId = `${marker}-stripe`;
        const expireTriggeredAt = (yield* DateTime.nowAsDate).toISOString();
        const notificationIds = [expireId, appProductId, appSdkId, googleId, stripeId];
        const receivedWebhookBodies: string[] = [];
        let fxRequests = 0;

        const server = createServer((request, response) => {
          if (request.url?.endsWith("/latest/USD")) {
            fxRequests++;
            response.writeHead(200, { "content-type": "application/json" });
            response.end(
              encodeJson({
                base_code: "USD",
                conversion_rates: { [FX_CURRENCY]: 2 },
                result: "success",
                time_last_update_unix: FX_UPDATE_UNIX,
              }),
            );
            return;
          }

          const chunks: Buffer[] = [];
          request.on("data", (chunk: Buffer) => chunks.push(chunk));
          request.on("end", () => {
            receivedWebhookBodies.push(Buffer.concat(chunks).toString("utf8"));
            response.writeHead(204).end();
          });
        });
        const address = yield* Effect.callback<
          { readonly port: number },
          WorkflowRegistryTestError
        >((resume) => {
          const onError = (error: Error) =>
            resume(Effect.fail(new WorkflowRegistryTestError({ message: causeMessage(error) })));
          server.once("error", onError);
          server.listen(0, "127.0.0.1", () => {
            server.off("error", onError);
            const listening = server.address();
            if (listening === null || typeof listening === "string") {
              resume(
                Effect.fail(
                  new WorkflowRegistryTestError({
                    message: "HTTP server did not expose a TCP port",
                  }),
                ),
              );
              return;
            }
            resume(Effect.succeed({ port: listening.port }));
          });
        });

        // oxlint-disable-next-line effect/noGlobals -- test lifecycle fixture: `getSelfhostRuntimeConfig()` below reads the FX endpoint synchronously from the real environment, so the loopback server's port has to be staged in process.env and restored in cleanup; a Config layer would not reach that synchronous read.
        const originalFxBaseUrl = process.env.EXCHANGE_RATE_API_BASE_URL;
        // oxlint-disable-next-line effect/noGlobals -- test lifecycle fixture: original value captured so cleanup can restore the real environment.
        const originalFxApiKey = process.env.EXCHANGE_RATE_API_KEY;
        // oxlint-disable-next-line effect/noGlobals -- test lifecycle fixture: points the synchronous selfhost config read at the loopback FX server started above.
        process.env.EXCHANGE_RATE_API_BASE_URL = `http://127.0.0.1:${address.port}/fx`;
        // oxlint-disable-next-line effect/noGlobals -- test lifecycle fixture: supplies the API key the synchronous selfhost config read expects.
        process.env.EXCHANGE_RATE_API_KEY = "integration";

        const config = getSelfhostRuntimeConfig();
        const database = Db.layer(config.database);
        const platformDatabase = Db.layer(config.platformDatabase);
        const platform = makeSelfhostPlatformLayers(config);
        const workflowRuntime = Layer.merge(platform.workflowRunner, platform.runtime);
        const workflowInfra = Layer.merge(database, AnalyticsDispatchService.noop);

        const cleanupApplicationRows = Effect.gen(function* () {
          const db = yield* Db;
          yield* db
            .delete(webhookDeliveryAttempts)
            .where(eq(webhookDeliveryAttempts.webhookDeliveryId, webhookDeliveryId))
            .pipe(Effect.ignore);
          yield* db
            .delete(webhookDeliveries)
            .where(eq(webhookDeliveries.id, webhookDeliveryId))
            .pipe(Effect.ignore);
          yield* db
            .delete(webhookEndpoints)
            .where(eq(webhookEndpoints.id, webhookEndpointId))
            .pipe(Effect.ignore);
          yield* db
            .delete(paymentProviderNotificationProcessed)
            .where(inArray(paymentProviderNotificationProcessed.id, notificationIds))
            .pipe(Effect.ignore);
          yield* db
            .delete(purchaseLedger)
            .where(eq(purchaseLedger.id, ledgerId))
            .pipe(Effect.ignore);
          yield* db
            .delete(fxRates)
            .where(and(eq(fxRates.currency, FX_CURRENCY), eq(fxRates.asOfDate, FX_AS_OF_DATE)))
            .pipe(Effect.ignore);
        }).pipe(Effect.provide(database));

        const cleanupWorkflowRows = Effect.gen(function* () {
          const db = yield* Db;
          const markerPattern = `%${marker}%`;
          yield* db.execute(sql`
              DELETE FROM cluster_replies
              WHERE request_id IN (
                SELECT request_id FROM cluster_messages
                WHERE entity_id IN (
                  SELECT entity_id FROM cluster_messages
                  WHERE tag = 'run'
                    AND (
                      payload::jsonb::text LIKE ${markerPattern}
                      OR payload::jsonb ->> 'triggeredAt' = ${expireTriggeredAt}
                    )
                )
              )
            `);
          yield* db.execute(sql`
              DELETE FROM cluster_messages
              WHERE entity_id IN (
                SELECT entity_id FROM cluster_messages
                WHERE tag = 'run'
                  AND (
                    payload::jsonb::text LIKE ${markerPattern}
                    OR payload::jsonb ->> 'triggeredAt' = ${expireTriggeredAt}
                  )
              )
            `);
        }).pipe(Effect.provide(platformDatabase), Effect.ignore);

        const body = Effect.gen(function* () {
          yield* cleanupApplicationRows;
          yield* Effect.scoped(
            Effect.gen(function* () {
              const db = yield* Db;

              yield* db.insert(webhookEndpoints).values({
                events: ["person.created"],
                id: webhookEndpointId,
                name: "workflow registry integration",
                projectId: `${marker}-project`,
                secret: "whsec_integration",
                url: `http://127.0.0.1:${address.port}/webhook`,
              });
              yield* db.insert(webhookDeliveries).values({
                eventOccurredAt: yield* DateTime.nowAsDate,
                eventType: "person.created",
                id: webhookDeliveryId,
                payload: { marker },
                projectId: `${marker}-project`,
                webhookEndpointId,
              });

              const ledgerRow: InsertPurchaseLedger = {
                attemptCount: 0,
                claimedAt: null,
                claimedBy: null,
                eventsPayload: [],
                id: ledgerId,
                idempotencyKey: `${marker}-ledger-key`,
                lastError: null,
                nextAttemptAt: null,
                organizationId: `${marker}-organization`,
                personId: `${marker}-person`,
                projectId: `${marker}-project`,
                providerEventType: "integration-test",
                providerId: "stripe",
                publishedAt: null,
                rawProviderPayload: null,
                resultPayload: {},
                source: "webhook",
                status: PurchaseLedgerStatus.Pending,
              };
              yield* db.insert(purchaseLedger).values(ledgerRow);

              yield* db.insert(paymentProviderNotificationProcessed).values([
                {
                  id: expireId,
                  notificationType: "integration-test",
                  notificationUuid: `${expireId}-uuid`,
                  parkedRawPayload: null,
                  parkedUntilOriginalTransactionId: `${expireId}-original`,
                  paymentProviderConfigurationId: `${expireId}-config`,
                  processedAt: DateTime.toDateUtc(
                    DateTime.makeUnsafe((yield* Clock.currentTimeMillis) - 91 * DAY_MS),
                  ),
                  providerId: "apple-app-store",
                  result: "parked_pending_sdk_confirmation",
                  source: "webhook",
                },
                {
                  id: appProductId,
                  notificationType: "integration-test",
                  notificationUuid: `${appProductId}-uuid`,
                  parkedRawPayload: null,
                  parkedUntilProviderProductKey: `${appProductId}-key`,
                  paymentProviderConfigurationId: `${appProductId}-config`,
                  providerId: "apple-app-store",
                  result: "parked_pending_product_mapping",
                  source: "webhook",
                },
                {
                  id: appSdkId,
                  notificationType: "integration-test",
                  notificationUuid: `${appSdkId}-uuid`,
                  parkedRawPayload: null,
                  parkedUntilOriginalTransactionId: `${appSdkId}-original`,
                  paymentProviderConfigurationId: `${appSdkId}-config`,
                  providerId: "apple-app-store",
                  result: "parked_pending_sdk_confirmation",
                  source: "webhook",
                },
                {
                  id: googleId,
                  notificationType: "integration-test",
                  notificationUuid: `${googleId}-uuid`,
                  parkedRawPayload: null,
                  parkedUntilProviderProductKey: `${googleId}-key`,
                  paymentProviderConfigurationId: `${googleId}-config`,
                  providerId: "google-play",
                  result: "parked_pending_product_mapping",
                  source: "webhook",
                },
                {
                  id: stripeId,
                  notificationType: "integration-test",
                  notificationUuid: `${stripeId}-uuid`,
                  parkedRawPayload: null,
                  parkedUntilProviderProductKey: `${stripeId}-key`,
                  paymentProviderConfigurationId: `${stripeId}-config`,
                  providerId: "stripe",
                  result: "parked_pending_product_mapping",
                  source: "webhook",
                },
              ]);

              yield* Effect.forEach(
                backendWorkflows,
                (registration) => registration.register(workflowInfra),
                { discard: true },
              );

              const webhookResult = yield* Workflow.execute(DeliverWebhook, {
                attemptNumber: 1,
                deliveryId: webhookDeliveryId,
                endpointId: webhookEndpointId,
                eventType: "person.created",
                payload: { marker },
                secret: "whsec_integration",
                url: `http://127.0.0.1:${address.port}/webhook`,
              });
              expect(webhookResult).toBeUndefined();
              expect(receivedWebhookBodies).toEqual([encodeJson({ marker })]);
              expect(
                (yield* db.query.webhookDeliveries.findFirst({ where: { id: webhookDeliveryId } }))
                  ?.status,
              ).toBe(WebhookDeliveryStatus.Succeeded);

              const fxPayload = { runId: `${marker}-fx` };
              expect(yield* Workflow.execute(FxRateSync, fxPayload)).toEqual({ refreshedCount: 1 });
              expect(yield* Workflow.execute(FxRateSync, fxPayload)).toEqual({ refreshedCount: 1 });
              expect(fxRequests).toBe(1);
              expect(
                yield* db.query.fxRates.findFirst({
                  where: { asOfDate: { eq: FX_AS_OF_DATE }, currency: FX_CURRENCY },
                }),
              ).toMatchObject({
                currency: FX_CURRENCY,
                source: `exchange-rate-api:latest:${FX_UPDATE_UNIX}`,
                usdRate: 500_000,
              });

              const drain = yield* Workflow.execute(PurchaseLedgerDrain, {
                runId: `${marker}-drain`,
              });
              expect(drain.batches).toBeGreaterThanOrEqual(1);
              expect(drain.batches).toBeLessThanOrEqual(10);
              expect(
                (yield* db.query.purchaseLedger.findFirst({ where: { id: ledgerId } }))?.status,
              ).toBe(PurchaseLedgerStatus.Published);

              const expiry = yield* Workflow.execute(AppStoreExpireParkedNotifications, {
                triggeredAt: expireTriggeredAt,
              });
              expect(expiry.expired).toBeGreaterThanOrEqual(1);
              expect(
                (yield* db.query.paymentProviderNotificationProcessed.findFirst({
                  where: { id: expireId },
                }))?.result,
              ).toBe("expired");

              const replayExpected = { appliedCount: 0, failedCount: 1, totalParked: 1 };
              expect(
                yield* Workflow.execute(AppStoreReplayParkedNotifications, {
                  paymentProviderConfigurationId: `${appProductId}-config`,
                  paymentProviderProductId: `${appProductId}-product`,
                  providerProductKey: `${appProductId}-key`,
                  requestedAt: `${marker}-app-product-request`,
                }),
              ).toEqual(replayExpected);
              expect(
                yield* Workflow.execute(AppStoreReplayParkedSdkNotifications, {
                  originalTransactionId: `${appSdkId}-original`,
                  paymentProviderConfigurationId: `${appSdkId}-config`,
                  requestedAt: `${marker}-app-sdk-request`,
                }),
              ).toEqual(replayExpected);
              expect(
                yield* Workflow.execute(GooglePlayReplayParkedNotifications, {
                  paymentProviderConfigurationId: `${googleId}-config`,
                  paymentProviderProductId: `${googleId}-product`,
                  providerProductKey: `${googleId}-key`,
                  requestedAt: `${marker}-google-request`,
                }),
              ).toEqual(replayExpected);
              expect(
                yield* Workflow.execute(StripeReplayParkedNotifications, {
                  paymentProviderConfigurationId: `${stripeId}-config`,
                  paymentProviderProductId: `${stripeId}-product`,
                  providerProductKey: `${stripeId}-key`,
                  requestedAt: `${marker}-stripe-request`,
                }),
              ).toEqual(replayExpected);

              for (const [id, note] of constant([
                [appProductId, "parked_raw_payload missing or not a string"],
                [appSdkId, "parked_raw_payload missing or not a string"],
                [googleId, "parked_raw_payload missing"],
                [stripeId, "parked_raw_payload missing or not a string"],
              ])) {
                expect(
                  yield* db.query.paymentProviderNotificationProcessed.findFirst({
                    where: { id },
                  }),
                ).toMatchObject({
                  parkedRawPayload: null,
                  parkedUntilOriginalTransactionId: null,
                  parkedUntilProviderProductKey: null,
                  result: "failed",
                  resultNote: note,
                });
              }

              const reconcileExit = yield* Effect.exit(
                Workflow.execute(AppStoreReconcileOriginalTransaction, {
                  originalTransactionId: `${marker}-missing-original`,
                  paymentProviderConfigurationId: `${marker}-missing-config`,
                  reason: "admin_repair",
                  triggeredAt: (yield* DateTime.nowAsDate).toISOString(),
                }),
              );
              expect(Exit.isFailure(reconcileExit)).toBe(true);
            }).pipe(Effect.provide(database), Effect.provide(workflowRuntime)),
          );
        });

        const cleanup = Effect.gen(function* () {
          yield* cleanupApplicationRows;
          yield* cleanupWorkflowRows;
          // oxlint-disable-next-line effect/noGlobals -- test lifecycle cleanup: restores the real environment the fixture mutated above; no Effect-scoped equivalent exists for a synchronous process.env read.
          if (originalFxBaseUrl === undefined) delete process.env.EXCHANGE_RATE_API_BASE_URL;
          // oxlint-disable-next-line effect/noGlobals -- test lifecycle cleanup: restores the captured original FX base URL.
          else process.env.EXCHANGE_RATE_API_BASE_URL = originalFxBaseUrl;
          // oxlint-disable-next-line effect/noGlobals -- test lifecycle cleanup: restores the real environment the fixture mutated above.
          if (originalFxApiKey === undefined) delete process.env.EXCHANGE_RATE_API_KEY;
          // oxlint-disable-next-line effect/noGlobals -- test lifecycle cleanup: restores the captured original FX API key.
          else process.env.EXCHANGE_RATE_API_KEY = originalFxApiKey;
          yield* Effect.callback<void>((resume) => {
            server.close(() => resume(Effect.void));
          });
        }).pipe(Effect.orDie);

        yield* body.pipe(Effect.ensuring(cleanup));
      }),
    ), 240_000);
});
