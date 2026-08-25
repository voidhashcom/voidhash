import { ActionForbiddenError } from "@voidhash/core/domain/auth/Auth";
import {
  WebhookDeliveryNotFoundError,
  WebhookEndpointNotFoundError,
  WebhookValidationError,
} from "@voidhash/core/domain/webhook/Webhook";
import * as TestWorkflowRunner from "@voidhash/platform/TestWorkflowRunner";
import { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";
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
import { generateId } from "@voidhash/core/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Random from "effect/Random";

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

/** Recording workflow runner used by backend smoke tests. */
export const TestWorkflowRunnerLive = Layer.succeed(WorkflowRunner, TestWorkflowRunner.make());

// In-memory no-op project schema cache. The smoke path never relies on a cache
// hit, so every read misses and writes are dropped.
export const TestProjectSchemaCacheLive = Layer.succeed(ProjectSchemaCache, {
  getByName: () => ({
    get: () => Effect.succeed(undefined),
    invalidate: () => Effect.void,
    set: () => Effect.void,
  }),
});

// The WorkOS user id (`user_xxx`) the resolver matches against our
// `workos_user_id` column — not the local primary key.
const smokeWorkosUserId = (email: string, ids: NonNullable<ReturnType<typeof smokeIdsFromEmail>>) => {
  if (email === ids.adminEmail) return ids.workosAdminUserId;
  if (email === ids.invitedEmail) return ids.workosInvitedUserId;
  return ids.workosNormalUserId;
};

/** The directory user the smoke suite's seeded emails resolve to. */
const smokeUser = (email: string) => {
  const ids = smokeIdsFromEmail(email);
  if (!ids) return null;
  return {
    email,
    emailVerified: true,
    externalId: null,
    firstName: null,
    id: smokeWorkosUserId(email, ids),
    lastName: null,
    profilePictureUrl: null,
  };
};

export const TestOrgDirectoryLive = Layer.succeed(OrgDirectoryPort, {
  createMembership: (input) =>
    Effect.succeed({
      id: `workos_mem_${generateId("member")}`,
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
  findUserByEmail: (email) => Effect.succeed(smokeUser(email)),
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

/** A `whsec_<64 hex chars>` secret, matching the production secret shape. */
const webhookSecret = Effect.gen(function* () {
  const digits = yield* Effect.forEach(Array.from({ length: 64 }), () =>
    Random.nextIntBetween(0, 16),
  );
  return `whsec_${digits.map((digit) => digit.toString(16)).join("")}`;
});

const webhookEndpointStatus = (status: number) => {
  if (status === WebhookEndpointStatus.Active) return "active";
  if (status === WebhookEndpointStatus.Failed) return "failed";
  return "disabled";
};

const endpointStatusValue = (status: string) => {
  if (status === "active") return WebhookEndpointStatus.Active;
  return WebhookEndpointStatus.Disabled;
};

const webhookDeliveryStatus = (status: number) => {
  if (status === WebhookDeliveryStatus.InProgress) return "in_progress";
  if (status === WebhookDeliveryStatus.Succeeded) return "succeeded";
  if (status === WebhookDeliveryStatus.Failed) return "failed";
  if (status === WebhookDeliveryStatus.Exhausted) return "exhausted";
  return "pending";
};

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

const parseUrl = (url: string): URL | null => {
  if (!URL.canParse(url)) return null;
  return new URL(url);
};

const isDrizzleQueryError = (error: unknown): error is { readonly cause?: unknown } => {
  if (error === null || typeof error !== "object") return false;
  return "_tag" in error && error._tag === "EffectDrizzleQueryError";
};

const toWebhookServiceError = (error: unknown) => {
  if (isDrizzleQueryError(error)) return new WebhookServiceError({ cause: String(error.cause) });
  return error;
};

const wrapWebhookDb = (effect: Effect.Effect<any, any, any>) =>
  effect.pipe(Effect.mapError(toWebhookServiceError));

// The stub reimplements the manager's handlers over the smoke database rather
// than inhabiting its full generated signature (RPC payload/result schemas,
// span-annotated `Effect.fn` wrappers). The single loosening lives here.

const webhookManagerStub = (handlers: Record<string, unknown>): any => handlers;

export const TestWebhookManagerServiceLive = Layer.effect(
  WebhookManagerService,
  Effect.gen(function* () {
    const db = yield* Db;

    const findEndpoint = (input: { readonly endpointId: string; readonly projectId?: string }) => {
      if (input.projectId) {
        return db.query.webhookEndpoints.findFirst({
          where: { id: input.endpointId, projectId: input.projectId },
        });
      }
      return db.query.webhookEndpoints.findFirst({ where: { id: input.endpointId } });
    };

    const findDelivery = (input: { readonly deliveryId: string; readonly projectId?: string }) => {
      if (input.projectId) {
        return db.query.webhookDeliveries.findFirst({
          where: { id: input.deliveryId, projectId: input.projectId },
        });
      }
      return db.query.webhookDeliveries.findFirst({ where: { id: input.deliveryId } });
    };

    const findDeliveries = (input: { readonly endpointId?: string; readonly projectId: string }) => {
      if (input.endpointId) {
        return db.query.webhookDeliveries.findMany({
          orderBy: { createdAt: "desc" },
          where: { webhookEndpointId: input.endpointId },
        });
      }
      return db.query.webhookDeliveries.findMany({
        orderBy: { createdAt: "desc" },
        where: { projectId: input.projectId },
      });
    };

    return webhookManagerStub({
      createEndpoint: (input: any) =>
        wrapWebhookDb(
          Effect.gen(function* () {
            const parsedUrl = parseUrl(input.url);
            if (!parsedUrl || !["http:", "https:"].includes(parsedUrl.protocol)) {
              return yield* Effect.fail(new WebhookValidationError({ message: "Invalid URL" }));
            }
            if (input.events.length === 0) {
              return yield* Effect.fail(
                new WebhookValidationError({ message: "At least one event is required" }),
              );
            }

            const now = yield* DateTime.nowAsDate;
            const secret = yield* webhookSecret;
            const endpoint = {
              consecutiveFailures: 0,
              createdAt: now,
              description: input.description ?? null,
              events: [...input.events],
              id: generateId("webhookEndpoint"),
              lastSuccessAt: null,
              name: input.name,
              projectId: input.projectId,
              secret,
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
          findDeliveries(input).pipe(Effect.map((deliveries) => deliveries.map(mapDelivery))),
        ),
      // In-memory mirror of the keyset read: same anchor semantics (a stale
      // cursor fails rather than replaying page one), applied over the full
      // ordered list the smoke database holds.
      getDeliveriesPage: (input: any) =>
        wrapWebhookDb(
          Effect.gen(function* () {
            const deliveries = (yield* findDeliveries(input)).map(mapDelivery);
            const limit = input.limit ?? 50;
            let start = 0;
            if (input.after !== undefined) {
              const index = deliveries.findIndex((delivery) => delivery.id === input.after);
              if (index === -1) {
                return yield* Effect.fail(
                  new ActionForbiddenError({
                    message: "Pagination cursor no longer refers to a known item.",
                  }),
                );
              }
              start = index + 1;
            }
            const pageRows = deliveries.slice(start, start + limit);
            const hasNextPage = start + limit < deliveries.length;
            const lastRow = pageRows[pageRows.length - 1];
            let endCursorId: string | null = null;
            if (hasNextPage && lastRow !== undefined) {
              endCursorId = lastRow.id;
            }
            return { deliveries: pageRows, endCursorId, hasNextPage };
          }),
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
            const secret = yield* webhookSecret;
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
            const now = yield* DateTime.nowAsDate;
            const delivery = {
              attemptCount: 0,
              completedAt: null,
              createdAt: now,
              eventOccurredAt: now,
              eventType: "test.ping",
              id: generateId("webhookDelivery"),
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
              updates.status = endpointStatusValue(input.status);
            }
            if (input.url !== undefined) updates.url = input.url;
            yield* db
              .update(webhookEndpoints)
              .set(updates)
              .where(eq(webhookEndpoints.id, input.endpointId));
            return mapEndpoint({ ...endpoint, ...updates });
          }),
        ),
    });
  }),
);

export const TestBackendStubInfrastructureLive = Layer.mergeAll(
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
