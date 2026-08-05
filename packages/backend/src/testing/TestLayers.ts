import {
  WebhookDeliveryNotFoundError,
  WebhookEndpointNotFoundError,
  WebhookValidationError,
} from "@voidhash/core/domain/webhook/Webhook";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { AppStoreReconcileOriginalTransactionWorkflow } from "@voidhash/core/services/paymentProviders/AppStoreReconcileOriginalTransactionWorkflow";
import { AppStoreReplayParkedNotificationsWorkflow } from "@voidhash/core/services/paymentProviders/AppStoreReplayParkedNotificationsWorkflow";
import { AppStoreReplayParkedSdkNotificationsWorkflow } from "@voidhash/core/services/paymentProviders/AppStoreReplayParkedSdkNotificationsWorkflow";
import { GooglePlayReplayParkedNotificationsWorkflow } from "@voidhash/core/services/paymentProviders/GooglePlayReplayParkedNotificationsWorkflow";
import { StripeReplayParkedNotificationsWorkflow } from "@voidhash/core/services/paymentProviders/StripeReplayParkedNotificationsWorkflow";
import { IdentifyDistinctIdCompletionWorkflow } from "@voidhash/core/services/personIdentity/IdentifyDistinctIdCompletionWorkflow";
import { WebhookDeliveryWorkflow } from "@voidhash/core/services/webhookDispatch/WebhookDeliveryWorkflow";
import {
  Db,
  eq,
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
  webhookDeliveries,
  webhookEndpoints,
} from "@voidhash/db";
import {
  ProjectSchemaCache,
  WebhookManagerService,
  WebhookServiceError,
  OrgDirectoryPort,
} from "@voidhash/core/services";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  BackendComponentCompilerStubLive,
  BackendMimicHostStubLive,
  BackendNoopIdentityProjectionPublisherLive,
  BackendPaymentProviderStubsLive,
  BackendPaywallArtifactStoreStubLive,
  BackendPaywallAssetConfigLive,
  BackendPublicFileStoreStubLive,
  BackendSnapshotImageRendererStubLive,
} from "../BackendApp.ts";
import { smokeIdsFromEmail } from "./smoke-ids.ts";

// The webhook path that consumes this stub never calls ClickHouse, so a Proxy
// that throws on any access is a safe placeholder that satisfies the
// requirement without standing up a real client.
const clickhouseStub = new Proxy(
  {},
  {
    get() {
      throw new Error("ClickhouseWebClient must not be used in this test");
    },
  },
) as unknown as ClickhouseWebClient.ClickhouseWebClient;

export const TestClickhouseLive = Layer.succeed(
  ClickhouseWebClient.ClickhouseWebClient,
  clickhouseStub,
);

// The asynchronous workflow ports the route graph dispatches to
// (`PersonIdentityService` → identity completion, webhook dispatch → delivery,
// App Store reconciliation → replay). Every one is a fire-and-forget `dispatch`,
// so the smoke stubs are no-ops. Unlike the other infrastructure services these
// surface as request-scoped requirements on the built handler, so they are
// provided to the worker's `fetch` directly rather than via the infra layer.
export const TestWorkflowPortsLive = Layer.mergeAll(
  Layer.succeed(IdentifyDistinctIdCompletionWorkflow, { dispatch: () => Effect.void }),
  Layer.succeed(WebhookDeliveryWorkflow, { dispatch: () => Effect.void }),
  Layer.succeed(AppStoreReplayParkedNotificationsWorkflow, { dispatch: () => Effect.void }),
  Layer.succeed(AppStoreReplayParkedSdkNotificationsWorkflow, { dispatch: () => Effect.void }),
  Layer.succeed(AppStoreReconcileOriginalTransactionWorkflow, { dispatch: () => Effect.void }),
  Layer.succeed(GooglePlayReplayParkedNotificationsWorkflow, { dispatch: () => Effect.void }),
  Layer.succeed(StripeReplayParkedNotificationsWorkflow, { dispatch: () => Effect.void }),
);

// In-memory no-op project schema cache. The smoke path never relies on a cache
// hit, so every read misses and writes are dropped.
export const TestProjectSchemaCacheLive = Layer.succeed(ProjectSchemaCache, {
  getByName: () => ({
    get: () => Effect.succeed(undefined),
    invalidate: () => Effect.void,
    set: () => Effect.void,
  }),
});

export const TestOrgDirectoryLive = Layer.succeed(OrgDirectoryPort, {
  createMembership: (input) =>
    Effect.succeed({
      id: `workos_mem_${crypto.randomUUID()}`,
      organizationId: input.workosOrganizationId,
      role: input.roleSlug ?? "member",
      userId: input.workosUserId,
    }),
  createOrganization: (input) =>
    Effect.succeed({
      externalId: input.externalId,
      id: `workos_org_${input.externalId.slice(0, 24)}`,
      name: input.name,
    }),
  deleteMembership: () => Effect.void,
  deleteOrganization: () => Effect.void,
  findUserByEmail: (email) =>
    Effect.succeed(
      (() => {
        const ids = smokeIdsFromEmail(email);
        if (!ids) return null;
        const isAdmin = email === ids.adminEmail;
        const isInvited = email === ids.invitedEmail;
        return {
          email,
          emailVerified: true,
          externalId: null,
          firstName: null,
          // The WorkOS user id (`user_xxx`), which the resolver matches against
          // our `workos_user_id` column — not the local primary key.
          id: isAdmin
            ? ids.workosAdminUserId
            : isInvited
              ? ids.workosInvitedUserId
              : ids.workosNormalUserId,
          lastName: null,
          profilePictureUrl: null,
        };
      })(),
    ),
  getOrganization: (workosOrganizationId) =>
    Effect.succeed({
      externalId: null,
      id: workosOrganizationId,
      name: `WorkOS ${workosOrganizationId}`,
    }),
  getOrganizationByExternalId: (externalId) =>
    Effect.succeed({
      externalId,
      id: `workos_org_${externalId.slice(0, 24)}`,
      name: `WorkOS ${externalId}`,
    }),
  listMembershipsForUser: () => Effect.succeed([]),
  updateMembershipRole: (workosMembershipId, input) =>
    Effect.succeed({
      id: workosMembershipId,
      organizationId: "unknown",
      role: input.roleSlug,
      userId: "unknown",
    }),
  updateOrganization: (input) =>
    Effect.succeed({
      externalId: null,
      id: input.workosOrganizationId,
      name: input.name ?? input.workosOrganizationId,
    }),
});

const webhookSecret = () => `whsec_${crypto.randomUUID().replaceAll("-", "").padEnd(64, "0")}`;

const webhookEndpointStatus = (status: number) =>
  status === WebhookEndpointStatus.Active
    ? "active"
    : status === WebhookEndpointStatus.Failed
      ? "failed"
      : "disabled";

const webhookDeliveryStatus = (status: number) =>
  status === WebhookDeliveryStatus.InProgress
    ? "in_progress"
    : status === WebhookDeliveryStatus.Succeeded
      ? "succeeded"
      : status === WebhookDeliveryStatus.Failed
        ? "failed"
        : status === WebhookDeliveryStatus.Exhausted
          ? "exhausted"
          : "pending";

const mapEndpoint = (endpoint: typeof webhookEndpoints.$inferSelect) => ({
  consecutiveFailures: endpoint.consecutiveFailures,
  createdAt: endpoint.createdAt,
  description: endpoint.description,
  events: endpoint.events,
  id: endpoint.id,
  lastSuccessAt: endpoint.lastSuccessAt,
  name: endpoint.name,
  projectId: endpoint.projectId,
  secret: endpoint.secret,
  status: webhookEndpointStatus(endpoint.status),
  url: endpoint.url,
});

const mapDelivery = (delivery: typeof webhookDeliveries.$inferSelect) => ({
  attemptCount: delivery.attemptCount,
  completedAt: delivery.completedAt,
  createdAt: delivery.createdAt,
  eventOccurredAt: delivery.eventOccurredAt,
  eventType: delivery.eventType,
  id: delivery.id,
  maxAttempts: delivery.maxAttempts,
  nextAttemptAt: delivery.nextAttemptAt,
  payload: delivery.payload,
  projectId: delivery.projectId,
  status: webhookDeliveryStatus(delivery.status),
  webhookEndpointId: delivery.webhookEndpointId,
});

const wrapWebhookDb = (effect: Effect.Effect<any, any, any>) =>
  effect.pipe(
    Effect.mapError((error) =>
      error &&
      typeof error === "object" &&
      "_tag" in error &&
      error._tag === "EffectDrizzleQueryError"
        ? new WebhookServiceError({ cause: String((error as { cause?: unknown }).cause) })
        : error,
    ),
  );

export const TestWebhookManagerServiceLive = Layer.effect(
  WebhookManagerService,
  Effect.gen(function* () {
    const db = yield* Db;

    const findEndpoint = (input: { readonly endpointId: string; readonly projectId?: string }) =>
      db.query.webhookEndpoints.findFirst({
        where: input.projectId
          ? { id: input.endpointId, projectId: input.projectId }
          : { id: input.endpointId },
      });

    const findDelivery = (input: { readonly deliveryId: string; readonly projectId?: string }) =>
      db.query.webhookDeliveries.findFirst({
        where: input.projectId
          ? { id: input.deliveryId, projectId: input.projectId }
          : { id: input.deliveryId },
      });

    return {
      createEndpoint: (input: any) =>
        wrapWebhookDb(
          Effect.gen(function* () {
            const parsedUrl = URL.canParse(input.url) ? new URL(input.url) : null;
            if (!parsedUrl || !["http:", "https:"].includes(parsedUrl.protocol)) {
              return yield* Effect.fail(new WebhookValidationError({ message: "Invalid URL" }));
            }
            if (input.events.length === 0) {
              return yield* Effect.fail(
                new WebhookValidationError({ message: "At least one event is required" }),
              );
            }

            const now = new Date();
            const endpoint = {
              consecutiveFailures: 0,
              createdAt: now,
              description: input.description ?? null,
              events: [...input.events],
              id: `webhookEndpoint_${crypto.randomUUID()}`,
              lastSuccessAt: null,
              name: input.name,
              projectId: input.projectId,
              secret: webhookSecret(),
              status: WebhookEndpointStatus.Active,
              updatedAt: now,
              url: input.url,
            };
            yield* db.insert(webhookEndpoints).values(endpoint);
            return mapEndpoint(endpoint);
          }),
        ),
      deleteEndpoint: (input: any) =>
        wrapWebhookDb(
          Effect.gen(function* () {
            const endpoint = yield* findEndpoint({ endpointId: input.endpointId });
            if (!endpoint) {
              return yield* Effect.fail(
                new WebhookEndpointNotFoundError({ endpointId: input.endpointId }),
              );
            }
            yield* db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, input.endpointId));
          }),
        ),
      getDeliveries: (input: any) =>
        wrapWebhookDb(
          db.query.webhookDeliveries
            .findMany({
              orderBy: { createdAt: "desc" },
              where: input.endpointId
                ? { webhookEndpointId: input.endpointId }
                : { projectId: input.projectId },
            })
            .pipe(Effect.map((deliveries) => deliveries.map(mapDelivery))),
        ),
      getDeliveryById: (input: any) =>
        wrapWebhookDb(
          Effect.gen(function* () {
            const delivery = yield* findDelivery({ deliveryId: input.deliveryId });
            if (!delivery) {
              return yield* Effect.fail(
                new WebhookDeliveryNotFoundError({ deliveryId: input.deliveryId }),
              );
            }
            const attempts = yield* db.query.webhookDeliveryAttempts.findMany({
              orderBy: { attemptNumber: "asc" },
              where: { webhookDeliveryId: input.deliveryId },
            });
            return {
              ...mapDelivery(delivery),
              attempts: attempts.map((attempt) => ({
                attemptNumber: attempt.attemptNumber,
                createdAt: attempt.createdAt,
                durationMs: attempt.durationMs,
                errorMessage: attempt.errorMessage,
                id: attempt.id,
                responseBody: attempt.responseBody,
                statusCode: attempt.statusCode,
                succeeded: attempt.succeeded,
              })),
            };
          }),
        ),
      getEndpointById: (input: any) =>
        wrapWebhookDb(
          Effect.gen(function* () {
            const endpoint = yield* findEndpoint({ endpointId: input.endpointId });
            if (!endpoint) {
              return yield* Effect.fail(
                new WebhookEndpointNotFoundError({ endpointId: input.endpointId }),
              );
            }
            return mapEndpoint(endpoint);
          }),
        ),
      getEndpoints: (input: any) =>
        wrapWebhookDb(
          db.query.webhookEndpoints
            .findMany({
              where: { projectId: input.projectId },
            })
            .pipe(Effect.map((endpoints) => endpoints.map(mapEndpoint))),
        ),
      retryDelivery: (input: any) =>
        wrapWebhookDb(
          Effect.gen(function* () {
            const delivery = yield* findDelivery({ deliveryId: input.deliveryId });
            if (!delivery) {
              return yield* Effect.fail(
                new WebhookDeliveryNotFoundError({ deliveryId: input.deliveryId }),
              );
            }
            return yield* Effect.fail(
              new WebhookValidationError({
                message: "Can only retry failed or exhausted deliveries",
              }),
            );
          }),
        ),
      rotateSecret: (input: any) =>
        wrapWebhookDb(
          Effect.gen(function* () {
            const endpoint = yield* findEndpoint({ endpointId: input.endpointId });
            if (!endpoint) {
              return yield* Effect.fail(
                new WebhookEndpointNotFoundError({ endpointId: input.endpointId }),
              );
            }
            const secret = webhookSecret();
            yield* db
              .update(webhookEndpoints)
              .set({ secret })
              .where(eq(webhookEndpoints.id, input.endpointId));
            return mapEndpoint({ ...endpoint, secret });
          }),
        ),
      testEndpoint: (input: any) =>
        wrapWebhookDb(
          Effect.gen(function* () {
            const endpoint = yield* findEndpoint({ endpointId: input.endpointId });
            if (!endpoint) {
              return yield* Effect.fail(
                new WebhookEndpointNotFoundError({ endpointId: input.endpointId }),
              );
            }
            const now = new Date();
            const delivery = {
              attemptCount: 0,
              completedAt: null,
              createdAt: now,
              eventOccurredAt: now,
              eventType: "test.ping",
              id: `webhookDelivery_${crypto.randomUUID()}`,
              maxAttempts: 5,
              nextAttemptAt: null,
              payload: { message: "RPC smoke webhook delivery" },
              projectId: endpoint.projectId,
              status: WebhookDeliveryStatus.Pending,
              webhookEndpointId: endpoint.id,
            };
            yield* db.insert(webhookDeliveries).values(delivery);
            return mapDelivery(delivery);
          }),
        ),
      updateEndpoint: (input: any) =>
        wrapWebhookDb(
          Effect.gen(function* () {
            const endpoint = yield* findEndpoint({ endpointId: input.endpointId });
            if (!endpoint) {
              return yield* Effect.fail(
                new WebhookEndpointNotFoundError({ endpointId: input.endpointId }),
              );
            }
            const updates: Partial<typeof webhookEndpoints.$inferInsert> = {};
            if (input.description !== undefined) updates.description = input.description;
            if (input.events !== undefined) updates.events = [...input.events];
            if (input.name !== undefined) updates.name = input.name;
            if (input.status !== undefined) {
              updates.status =
                input.status === "active"
                  ? WebhookEndpointStatus.Active
                  : WebhookEndpointStatus.Disabled;
            }
            if (input.url !== undefined) updates.url = input.url;
            yield* db
              .update(webhookEndpoints)
              .set(updates)
              .where(eq(webhookEndpoints.id, input.endpointId));
            return mapEndpoint({ ...endpoint, ...updates });
          }),
        ),
    } as any;
  }),
);

export const TestBackendStubInfrastructureLive = Layer.mergeAll(
  TestClickhouseLive,
  TestProjectSchemaCacheLive,
  TestOrgDirectoryLive,
  BackendMimicHostStubLive,
  BackendComponentCompilerStubLive,
  BackendSnapshotImageRendererStubLive,
  BackendPaywallAssetConfigLive,
  BackendPaywallArtifactStoreStubLive,
  BackendPublicFileStoreStubLive,
  BackendPaymentProviderStubsLive,
  BackendNoopIdentityProjectionPublisherLive,
);
