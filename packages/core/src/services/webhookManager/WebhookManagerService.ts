import { constant } from "@voidhash/lib/lang";
import { Context, DateTime, Effect, Layer, Option, Schema } from "effect";
import { getRandomValues } from "uncrypto";

import {
  WebhookDeliveryNotFoundError,
  WebhookEndpointNotFoundError,
  WebhookValidationError,
} from "../../domain/webhook/Webhook.ts";
import {
  AuditLogAction,
  AuditLogEntityType,
  Db,
  WebhookDeliveryStatus,
  type WebhookDeliveryStatusValue,
  WebhookEndpointStatus,
  type WebhookEndpointStatusValue,
  eq,
  webhookDeliveries,
  webhookEndpoints,
} from "@voidhash/db";
import * as Workflow from "@voidhash/platform/Workflow";
import { DeliverWebhook } from "../../workflows/definitions.ts";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import { type WebhookEventType, isValidWebhookEvent } from "./event-types.ts";

/**
 * Catch-all service error. Wraps `DbError` and other infrastructural
 * failures at the public-method boundary so callers see one stable error tag.
 */
export class WebhookServiceError extends Schema.TaggedErrorClass<WebhookServiceError>(
  "WebhookServiceError",
)("WebhookServiceError", { cause: Schema.String }) {}

export type WebhookEndpointStatusString = "active" | "disabled" | "failed";
export type WebhookDeliveryStatusString =
  | "pending"
  | "in_progress"
  | "succeeded"
  | "failed"
  | "exhausted";

// Annotated as `Record<number, …>` so raw DB integers index it directly, while
// `satisfies` still pins every enum member to a label at compile time.
const ENDPOINT_STATUS_TO_STRING: Record<number, WebhookEndpointStatusString> = {
  [WebhookEndpointStatus.Active]: "active",
  [WebhookEndpointStatus.Disabled]: "disabled",
  [WebhookEndpointStatus.Failed]: "failed",
} satisfies Record<WebhookEndpointStatusValue, WebhookEndpointStatusString>;

const DELIVERY_STATUS_TO_STRING: Record<number, WebhookDeliveryStatusString> = {
  [WebhookDeliveryStatus.Pending]: "pending",
  [WebhookDeliveryStatus.InProgress]: "in_progress",
  [WebhookDeliveryStatus.Succeeded]: "succeeded",
  [WebhookDeliveryStatus.Failed]: "failed",
  [WebhookDeliveryStatus.Exhausted]: "exhausted",
} satisfies Record<WebhookDeliveryStatusValue, WebhookDeliveryStatusString>;

const mapEndpointStatus = (status: number): WebhookEndpointStatusString =>
  ENDPOINT_STATUS_TO_STRING[status] ?? "disabled";

const mapDeliveryStatus = (status: number): WebhookDeliveryStatusString =>
  DELIVERY_STATUS_TO_STRING[status] ?? "pending";

interface WebhookEndpointRow {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly url: string;
  readonly secret: string;
  readonly status: number;
  readonly events: unknown;
  readonly description: string | null;
  readonly consecutiveFailures: number;
  readonly lastSuccessAt: Date | null;
  readonly createdAt: Date | null;
}

interface WebhookDeliveryRow {
  readonly id: string;
  readonly webhookEndpointId: string;
  readonly projectId: string;
  readonly eventType: string;
  readonly payload: unknown;
  readonly status: number;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly nextAttemptAt: Date | null;
  readonly eventOccurredAt: Date;
  readonly completedAt: Date | null;
  readonly createdAt: Date | null;
}

const decodeStrings = Schema.decodeUnknownOption(Schema.Array(Schema.String));

/**
 * Narrows the JSON `events` column to the known event union, dropping anything
 * the current build no longer recognises.
 */
const toWebhookEventTypes = (events: unknown): WebhookEventType[] =>
  Option.getOrElse(decodeStrings(events), (): ReadonlyArray<string> => []).filter(
    isValidWebhookEvent,
  );

const decodeRecord = Schema.decodeUnknownOption(Schema.Record(Schema.String, Schema.Unknown));

/** Narrows the JSON `payload` column to an object, defaulting to `{}`. */
const decodePayload = (payload: unknown): object =>
  Option.getOrElse(decodeRecord(payload), () => ({}));

const mapEndpointToResponse = (endpoint: WebhookEndpointRow) => ({
  consecutiveFailures: endpoint.consecutiveFailures,
  createdAt: endpoint.createdAt,
  description: endpoint.description,
  events: toWebhookEventTypes(endpoint.events),
  id: endpoint.id,
  lastSuccessAt: endpoint.lastSuccessAt,
  name: endpoint.name,
  projectId: endpoint.projectId,
  secret: endpoint.secret,
  status: mapEndpointStatus(endpoint.status),
  url: endpoint.url,
});

const mapDeliveryToResponse = (delivery: WebhookDeliveryRow) => ({
  attemptCount: delivery.attemptCount,
  completedAt: delivery.completedAt,
  createdAt: delivery.createdAt,
  eventOccurredAt: delivery.eventOccurredAt,
  eventType: delivery.eventType,
  id: delivery.id,
  maxAttempts: delivery.maxAttempts,
  nextAttemptAt: delivery.nextAttemptAt,
  payload: decodePayload(delivery.payload),
  projectId: delivery.projectId,
  status: mapDeliveryStatus(delivery.status),
  webhookEndpointId: delivery.webhookEndpointId,
});

/**
 * Generates a Cloudflare Workers–compatible webhook secret using Web Crypto's
 * `crypto.getRandomValues` instead of `node:crypto.randomBytes`. Format
 * matches the `internal/` version (`whsec_<64 hex chars>`) so existing secrets
 * remain interchangeable.
 */
const generateSecret = (): string => {
  const bytes = getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `whsec_${hex}`;
};

const validateUrl = (url: string): WebhookValidationError | null => {
  if (!URL.canParse(url)) {
    return new WebhookValidationError({ message: "Invalid URL format" });
  }
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return new WebhookValidationError({ message: "URL must use http or https protocol" });
  }
  return null;
};

/** Delivery listing scope: one endpoint when given, otherwise the whole project. */
const deliveriesWhere = (input: {
  readonly projectId: string;
  readonly endpointId?: string;
}): { projectId: string; webhookEndpointId?: string } => {
  if (input.endpointId) {
    return { projectId: input.projectId, webhookEndpointId: input.endpointId };
  }
  return { projectId: input.projectId };
};

const endpointLookupWhere = (input: {
  readonly projectId: string;
  readonly endpointId: string;
}): { id: string; projectId?: string } => {
  if (input.projectId) {
    return { id: input.endpointId, projectId: input.projectId };
  }
  return { id: input.endpointId };
};

const deliveryLookupWhere = (input: {
  readonly projectId: string;
  readonly deliveryId: string;
}): { id: string; projectId?: string } => {
  if (input.projectId) {
    return { id: input.deliveryId, projectId: input.projectId };
  }
  return { id: input.deliveryId };
};

const authorizeProject = (projectId: string, action: string) =>
  checkProjectPermission(
    projectId,
    "project:all",
    `You are not authorized to ${action} webhooks for this project`,
  );

const validateEvents = (events: ReadonlyArray<string>): WebhookValidationError | null => {
  const invalid = events.filter((event) => !isValidWebhookEvent(event));
  if (invalid.length > 0) {
    return new WebhookValidationError({ message: `Invalid event types: ${invalid.join(", ")}` });
  }
  if (events.length === 0) {
    return new WebhookValidationError({ message: "At least one event type must be specified" });
  }
  return null;
};

/**
 * `WebhookManagerService` is the CRUD surface for outbound webhook endpoints
 * and their delivery history.
 *
 * `AuditLogPort`, `AuthSession`, and `Db` are provided by the application
 * root.
 */
export class WebhookManagerService extends Context.Service<WebhookManagerService>()(
  "WebhookManagerService",
  {
    make: Effect.gen(function* () {
      const auditLog = yield* AuditLogPort;
      const db = yield* Db;

      const createEndpoint = Effect.fn("webhookManager.createEndpoint")(
        function* (input: {
          readonly projectId: string;
          readonly name: string;
          readonly url: string;
          readonly events: ReadonlyArray<string>;
          readonly description?: string;
        }) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* authorizeProject(input.projectId, "create");

          const urlError = validateUrl(input.url);
          if (urlError) return yield* Effect.fail(urlError);

          const eventsError = validateEvents(input.events);
          if (eventsError) return yield* Effect.fail(eventsError);

          const endpointId = generateId("webhookEndpoint");
          yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.id", endpointId);
          yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.status", "active");
          const secret = generateSecret();
          const createdAt = yield* DateTime.nowAsDate;

          yield* db.insert(webhookEndpoints).values({
            consecutiveFailures: 0,
            createdAt,
            description: input.description,
            events: [...input.events],
            id: endpointId,
            name: input.name,
            projectId: input.projectId,
            secret,
            status: WebhookEndpointStatus.Active,
            url: input.url,
          });

          yield* auditLog
            .append({
              projectId: input.projectId,
              entityType: AuditLogEntityType.WebhookEndpoint,
              entityId: endpointId,
              action: AuditLogAction.Created,
              changes: {
                snapshot: { name: input.name, url: input.url, events: input.events },
              },
            })
            .pipe(Effect.ignore);

          return {
            consecutiveFailures: 0,
            createdAt,
            description: input.description ?? null,
            events: toWebhookEventTypes(input.events),
            id: endpointId,
            lastSuccessAt: null,
            name: input.name,
            projectId: input.projectId,
            secret,
            status: constant("active"),
            url: input.url,
          };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new WebhookServiceError({
                    cause: `Failed to create webhook endpoint: ${String(error.cause)}`,
                  }),
                ),
            }),
          ),
      );

      const updateEndpoint = Effect.fn("webhookManager.updateEndpoint")(
        function* (input: {
          readonly projectId: string;
          readonly endpointId: string;
          readonly name?: string;
          readonly url?: string;
          readonly events?: ReadonlyArray<string>;
          readonly status?: "active" | "disabled";
          readonly description?: string | null;
        }) {
          yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.id", input.endpointId);

          const existing = yield* db.query.webhookEndpoints.findFirst({
            where: endpointLookupWhere(input),
          });
          if (!existing) {
            return yield* Effect.fail(
              new WebhookEndpointNotFoundError({ endpointId: input.endpointId }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", existing.projectId);
          yield* authorizeProject(existing.projectId, "update");

          if (input.url) {
            const urlError = validateUrl(input.url);
            if (urlError) return yield* Effect.fail(urlError);
          }
          if (input.events) {
            const eventsError = validateEvents(input.events);
            if (eventsError) return yield* Effect.fail(eventsError);
          }

          const updates: Partial<typeof webhookEndpoints.$inferInsert> = {};
          if (input.name !== undefined) updates.name = input.name;
          if (input.url !== undefined) updates.url = input.url;
          if (input.events !== undefined) updates.events = [...input.events];
          if (input.description !== undefined) updates.description = input.description;
          if (input.status !== undefined) {
            updates.status = WebhookEndpointStatus.Disabled;
            if (input.status === "active") {
              updates.status = WebhookEndpointStatus.Active;
              updates.consecutiveFailures = 0;
            }
          }

          yield* db
            .update(webhookEndpoints)
            .set(updates)
            .where(eq(webhookEndpoints.id, input.endpointId));

          yield* auditLog
            .append({
              projectId: existing.projectId,
              entityType: AuditLogEntityType.WebhookEndpoint,
              entityId: input.endpointId,
              action: AuditLogAction.Updated,
              changes: { snapshot: updates },
            })
            .pipe(Effect.ignore);

          const updated = yield* db.query.webhookEndpoints.findFirst({
            where: { id: input.endpointId, projectId: existing.projectId },
          });
          if (!updated) {
            return yield* Effect.fail(
              new WebhookEndpointNotFoundError({ endpointId: input.endpointId }),
            );
          }
          yield* Effect.annotateCurrentSpan(
            "voidhash.webhook.endpoint.status",
            mapEndpointStatus(updated.status),
          );
          return mapEndpointToResponse(updated);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new WebhookServiceError({
                    cause: `Failed to update webhook endpoint: ${String(error.cause)}`,
                  }),
                ),
            }),
          ),
      );

      const deleteEndpoint = Effect.fn("webhookManager.deleteEndpoint")(
        function* (input: { readonly projectId: string; readonly endpointId: string }) {
          yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.id", input.endpointId);

          const existing = yield* db.query.webhookEndpoints.findFirst({
            where: endpointLookupWhere(input),
          });
          if (!existing) {
            return yield* Effect.fail(
              new WebhookEndpointNotFoundError({ endpointId: input.endpointId }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", existing.projectId);
          yield* authorizeProject(existing.projectId, "delete");

          yield* db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, input.endpointId));

          yield* auditLog
            .append({
              projectId: existing.projectId,
              entityType: AuditLogEntityType.WebhookEndpoint,
              entityId: input.endpointId,
              action: AuditLogAction.Deleted,
            })
            .pipe(Effect.ignore);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new WebhookServiceError({
                    cause: `Failed to delete webhook endpoint: ${String(error.cause)}`,
                  }),
                ),
            }),
          ),
      );

      const getEndpointById = Effect.fn("webhookManager.getEndpointById")(
        function* (input: { readonly projectId: string; readonly endpointId: string }) {
          yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.id", input.endpointId);

          const endpoint = yield* db.query.webhookEndpoints.findFirst({
            where: endpointLookupWhere(input),
          });
          if (!endpoint) {
            return yield* Effect.fail(
              new WebhookEndpointNotFoundError({ endpointId: input.endpointId }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", endpoint.projectId);
          yield* authorizeProject(endpoint.projectId, "read");
          yield* Effect.annotateCurrentSpan(
            "voidhash.webhook.endpoint.status",
            mapEndpointStatus(endpoint.status),
          );
          return mapEndpointToResponse(endpoint);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new WebhookServiceError({
                    cause: `Failed to fetch webhook endpoint: ${String(error.cause)}`,
                  }),
                ),
            }),
          ),
      );

      const getEndpoints = Effect.fn("webhookManager.getEndpoints")(
        function* (input: { readonly projectId: string }) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* authorizeProject(input.projectId, "list");

          const endpoints = yield* db.query.webhookEndpoints.findMany({
            where: { projectId: input.projectId },
          });
          yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.count", endpoints.length);
          return endpoints.map(mapEndpointToResponse);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new WebhookServiceError({
                    cause: `Failed to fetch webhook endpoints: ${String(error.cause)}`,
                  }),
                ),
            }),
          ),
      );

      const rotateSecret = Effect.fn("webhookManager.rotateSecret")(
        function* (input: { readonly projectId: string; readonly endpointId: string }) {
          yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.id", input.endpointId);

          const existing = yield* db.query.webhookEndpoints.findFirst({
            where: endpointLookupWhere(input),
          });
          if (!existing) {
            return yield* Effect.fail(
              new WebhookEndpointNotFoundError({ endpointId: input.endpointId }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", existing.projectId);
          yield* authorizeProject(existing.projectId, "rotate");

          const newSecret = generateSecret();
          yield* db
            .update(webhookEndpoints)
            .set({ secret: newSecret })
            .where(eq(webhookEndpoints.id, input.endpointId));

          yield* auditLog
            .append({
              projectId: existing.projectId,
              entityType: AuditLogEntityType.WebhookEndpoint,
              entityId: input.endpointId,
              action: AuditLogAction.Updated,
            })
            .pipe(Effect.ignore);

          return mapEndpointToResponse({ ...existing, secret: newSecret });
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new WebhookServiceError({
                    cause: `Failed to rotate webhook secret: ${String(error.cause)}`,
                  }),
                ),
            }),
          ),
      );

      const getDeliveries = Effect.fn("webhookManager.getDeliveries")(
        function* (input: {
          readonly projectId: string;
          readonly endpointId?: string;
          readonly limit?: number;
        }) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          if (input.endpointId)
            yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.id", input.endpointId);
          yield* authorizeProject(input.projectId, "list");

          const limit = input.limit ?? 50;
          const deliveries = yield* db.query.webhookDeliveries.findMany({
            limit,
            orderBy: { createdAt: "desc" },
            where: deliveriesWhere(input),
          });
          return deliveries.map(mapDeliveryToResponse);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new WebhookServiceError({
                    cause: `Failed to fetch webhook deliveries: ${String(error.cause)}`,
                  }),
                ),
            }),
          ),
      );

      const getDeliveryById = Effect.fn("webhookManager.getDeliveryById")(
        function* (input: { readonly projectId: string; readonly deliveryId: string }) {
          yield* Effect.annotateCurrentSpan("voidhash.webhook.delivery.id", input.deliveryId);

          const delivery = yield* db.query.webhookDeliveries.findFirst({
            where: deliveryLookupWhere(input),
          });
          if (!delivery) {
            return yield* Effect.fail(
              new WebhookDeliveryNotFoundError({ deliveryId: input.deliveryId }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", delivery.projectId);
          yield* authorizeProject(delivery.projectId, "read");
          yield* Effect.annotateCurrentSpan("voidhash.webhook.event_type", delivery.eventType);
          yield* Effect.annotateCurrentSpan(
            "voidhash.webhook.endpoint.id",
            delivery.webhookEndpointId,
          );
          yield* Effect.annotateCurrentSpan(
            "voidhash.webhook.delivery.attempt_number",
            delivery.attemptCount,
          );

          const attempts = yield* db.query.webhookDeliveryAttempts.findMany({
            orderBy: { attemptNumber: "asc" },
            where: { webhookDeliveryId: input.deliveryId },
          });

          return {
            ...mapDeliveryToResponse(delivery),
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
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new WebhookServiceError({
                    cause: `Failed to fetch webhook delivery: ${String(error.cause)}`,
                  }),
                ),
            }),
          ),
      );

      const retryDelivery = Effect.fn("webhookManager.retryDelivery")(
        function* (input: { readonly projectId: string; readonly deliveryId: string }) {
          yield* Effect.annotateCurrentSpan("voidhash.webhook.delivery.id", input.deliveryId);

          const delivery = yield* db.query.webhookDeliveries.findFirst({
            where: deliveryLookupWhere(input),
          });
          if (!delivery) {
            return yield* Effect.fail(
              new WebhookDeliveryNotFoundError({ deliveryId: input.deliveryId }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", delivery.projectId);
          yield* authorizeProject(delivery.projectId, "retry");
          yield* Effect.annotateCurrentSpan("voidhash.webhook.event_type", delivery.eventType);
          yield* Effect.annotateCurrentSpan(
            "voidhash.webhook.endpoint.id",
            delivery.webhookEndpointId,
          );

          if (
            delivery.status !== WebhookDeliveryStatus.Failed &&
            delivery.status !== WebhookDeliveryStatus.Exhausted
          ) {
            return yield* Effect.fail(
              new WebhookValidationError({
                message: "Can only retry failed or exhausted deliveries",
              }),
            );
          }

          const endpoint = yield* db.query.webhookEndpoints.findFirst({
            where: { id: delivery.webhookEndpointId },
          });
          if (!endpoint) {
            return yield* Effect.fail(
              new WebhookServiceError({ cause: "Webhook endpoint not found for delivery" }),
            );
          }

          const nextAttemptNumber = delivery.attemptCount + 1;
          yield* Effect.annotateCurrentSpan(
            "voidhash.webhook.delivery.attempt_number",
            nextAttemptNumber,
          );

          yield* db
            .update(webhookDeliveries)
            .set({
              completedAt: null,
              nextAttemptAt: null,
              status: WebhookDeliveryStatus.InProgress,
            })
            .where(eq(webhookDeliveries.id, input.deliveryId));

          yield* Workflow.dispatchAndForget(DeliverWebhook, {
            attemptNumber: nextAttemptNumber,
            deliveryId: delivery.id,
            endpointId: endpoint.id,
            eventType: delivery.eventType,
            payload: delivery.payload,
            secret: endpoint.secret,
            url: endpoint.url,
          }).pipe(Effect.forkDetach);

          return mapDeliveryToResponse({
            ...delivery,
            completedAt: null,
            nextAttemptAt: null,
            status: WebhookDeliveryStatus.InProgress,
          });
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new WebhookServiceError({
                    cause: `Failed to retry webhook delivery: ${String(error.cause)}`,
                  }),
                ),
            }),
          ),
      );

      const testEndpoint = Effect.fn("webhookManager.testEndpoint")(
        function* (input: { readonly projectId: string; readonly endpointId: string }) {
          yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.id", input.endpointId);

          const endpoint = yield* db.query.webhookEndpoints.findFirst({
            where: endpointLookupWhere(input),
          });
          if (!endpoint) {
            return yield* Effect.fail(
              new WebhookEndpointNotFoundError({ endpointId: input.endpointId }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", endpoint.projectId);
          yield* authorizeProject(endpoint.projectId, "test");

          const deliveryId = generateId("webhookDelivery");
          const eventOccurredAt = yield* DateTime.nowAsDate;
          const eventType = "test.ping";
          yield* Effect.annotateCurrentSpan("voidhash.webhook.delivery.id", deliveryId);
          yield* Effect.annotateCurrentSpan("voidhash.webhook.event_type", eventType);
          yield* Effect.annotateCurrentSpan("voidhash.webhook.delivery.attempt_number", 1);
          const payload = {
            message: "This is a test webhook delivery",
            timestamp: eventOccurredAt.toISOString(),
          };
          const createdAt = yield* DateTime.nowAsDate;

          yield* db.insert(webhookDeliveries).values({
            attemptCount: 0,
            createdAt,
            eventOccurredAt,
            eventType,
            id: deliveryId,
            payload,
            projectId: endpoint.projectId,
            status: WebhookDeliveryStatus.Pending,
            webhookEndpointId: endpoint.id,
          });

          yield* Workflow.dispatchAndForget(DeliverWebhook, {
            attemptNumber: 1,
            deliveryId,
            endpointId: endpoint.id,
            eventType,
            payload,
            secret: endpoint.secret,
            url: endpoint.url,
          }).pipe(Effect.forkDetach);

          return mapDeliveryToResponse({
            attemptCount: 0,
            completedAt: null,
            createdAt,
            eventOccurredAt,
            eventType,
            id: deliveryId,
            maxAttempts: 5,
            nextAttemptAt: null,
            payload,
            projectId: endpoint.projectId,
            status: WebhookDeliveryStatus.Pending,
            webhookEndpointId: endpoint.id,
          });
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new WebhookServiceError({
                    cause: `Failed to test webhook endpoint: ${String(error.cause)}`,
                  }),
                ),
            }),
          ),
      );

      return constant({
        createEndpoint,
        deleteEndpoint,
        getDeliveries,
        getDeliveryById,
        getEndpointById,
        getEndpoints,
        retryDelivery,
        rotateSecret,
        testEndpoint,
        updateEndpoint,
      });
    }),
  },
) {
  static layer = Layer.effect(WebhookManagerService)(WebhookManagerService.make);
}
