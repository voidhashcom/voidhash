import * as Arr from "effect/Array";
import { constant } from "@voidhash/lib/lang";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { getRandomValues } from "uncrypto";

import { ActionForbiddenError } from "../../domain/auth/Auth.ts";
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
  and,
  desc,
  eq,
  sql,
  webhookDeliveries,
  webhookEndpoints,
} from "@voidhash/db";
import * as Workflow from "@voidhash/platform/Workflow";
import { DeliverWebhook } from "@voidhash/core-v2";
import { generateId } from "../../utils/generate-id.ts";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../utils/pagination.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import { WEBHOOK_DELIVERY_MAX_ATTEMPTS } from "../webhookDispatch/WebhookDeliveryService.ts";
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

type WebhookEndpointRow = typeof webhookEndpoints.$inferSelect;

type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect;

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
  maxAttempts: WEBHOOK_DELIVERY_MAX_ATTEMPTS,
  nextAttemptAt: delivery.nextAttemptAt,
  payload: decodePayload(delivery.payload),
  projectId: delivery.projectId,
  status: mapDeliveryStatus(delivery.status),
  webhookEndpointId: delivery.webhookEndpointId,
});

/**
 * `webhook_delivery.created_at` is nullable, so keyset comparisons coalesce it
 * to the epoch to keep the sort total and the row-value predicate well defined.
 */
const EPOCH = sql`'epoch'::timestamptz`;

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

const validateUrl = (url: string): Option.Option<WebhookValidationError> => {
  if (!URL.canParse(url)) {
    return Option.some(new WebhookValidationError({ message: "Invalid URL format" }));
  }
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return Option.some(
      new WebhookValidationError({ message: "URL must use http or https protocol" }),
    );
  }
  return Option.none();
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

// Lookups are always tenant-scoped: an id belonging to another project reads
// as not-found rather than resolving and relying on the later permission
// check alone.
const endpointLookupWhere = (input: {
  readonly projectId: string;
  readonly endpointId: string;
}): { id: string; projectId: string } => ({
  id: input.endpointId,
  projectId: input.projectId,
});

const deliveryLookupWhere = (input: {
  readonly projectId: string;
  readonly deliveryId: string;
}): { id: string; projectId: string } => ({
  id: input.deliveryId,
  projectId: input.projectId,
});

const authorizeProject = (projectId: string, action: string) =>
  checkProjectPermission(
    projectId,
    "project:all",
    `You are not authorized to ${action} webhooks for this project`,
  );

const validateEvents = (events: ReadonlyArray<string>): Option.Option<WebhookValidationError> => {
  const invalid = events.filter((event) => !isValidWebhookEvent(event));
  if (Arr.isReadonlyArrayNonEmpty(invalid)) {
    return Option.some(
      new WebhookValidationError({ message: `Invalid event types: ${invalid.join(", ")}` }),
    );
  }
  if (Arr.isReadonlyArrayEmpty(events)) {
    return Option.some(
      new WebhookValidationError({ message: "At least one event type must be specified" }),
    );
  }
  return Option.none();
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
          if (Option.isSome(urlError)) return yield* Effect.fail(urlError.value);

          const eventsError = validateEvents(input.events);
          if (Option.isSome(eventsError)) return yield* Effect.fail(eventsError.value);

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
          readonly description?: Option.Option<string>;
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
            if (Option.isSome(urlError)) return yield* Effect.fail(urlError.value);
          }
          if (input.events) {
            const eventsError = validateEvents(input.events);
            if (Option.isSome(eventsError)) return yield* Effect.fail(eventsError.value);
          }

          const updates: Partial<typeof webhookEndpoints.$inferInsert> = {};
          if (input.name !== undefined) updates.name = input.name;
          if (input.url !== undefined) updates.url = input.url;
          if (input.events !== undefined) updates.events = [...input.events];
          if (input.description !== undefined) {
            updates.description = Option.getOrNull(input.description);
          }
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

      /**
       * One keyset page of delivery history, newest first. Additive to
       * {@link getDeliveries}: the windowed read stays for the RPC dashboard,
       * while this pages the unbounded table directly in SQL. `after` is the
       * decoded cursor — the id of the last row the caller already saw.
       */
      const getDeliveriesPage = Effect.fn("webhookManager.getDeliveriesPage")(
        function* (input: {
          readonly projectId: string;
          readonly endpointId?: string;
          readonly after?: string;
          readonly limit?: number;
        }) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          if (input.endpointId)
            yield* Effect.annotateCurrentSpan("voidhash.webhook.endpoint.id", input.endpointId);
          yield* authorizeProject(input.projectId, "list");

          const limit = Math.min(input.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
          const conditions = [eq(webhookDeliveries.projectId, input.projectId)];
          if (input.endpointId !== undefined) {
            conditions.push(eq(webhookDeliveries.webhookEndpointId, input.endpointId));
          }

          if (input.after !== undefined) {
            const anchorRows = yield* db
              .select({ createdAt: webhookDeliveries.createdAt, id: webhookDeliveries.id })
              .from(webhookDeliveries)
              .where(
                and(
                  eq(webhookDeliveries.projectId, input.projectId),
                  eq(webhookDeliveries.id, input.after),
                ),
              )
              .limit(1);
            const cursorRow = anchorRows[0];
            // The cursor names a row that is no longer visible; replaying page
            // one would look like a scroll that never terminates.
            if (cursorRow === undefined) {
              return yield* Effect.fail(
                new ActionForbiddenError({
                  message: "Pagination cursor no longer refers to a known item.",
                }),
              );
            }
            conditions.push(
              sql`(coalesce(${webhookDeliveries.createdAt}, ${EPOCH}), ${webhookDeliveries.id}) < (coalesce(${cursorRow.createdAt}::timestamptz, ${EPOCH}), ${cursorRow.id}::text)`,
            );
          }

          // One row beyond the page answers `hasNextPage` without a COUNT.
          const rows = yield* db
            .select()
            .from(webhookDeliveries)
            .where(and(...conditions))
            .orderBy(
              sql`coalesce(${webhookDeliveries.createdAt}, ${EPOCH}) desc`,
              desc(webhookDeliveries.id),
            )
            .limit(limit + 1);

          const hasNextPage = rows.length > limit;
          const pageRows = rows.slice(0, limit);
          const endCursorId = Option.getOrNull(
            hasNextPage ? Option.map(Arr.last(pageRows), (lastRow) => lastRow.id) : Option.none(),
          );
          return { deliveries: pageRows.map(mapDeliveryToResponse), endCursorId, hasNextPage };
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
            url: endpoint.url,
          }).pipe(Effect.forkDetach);

          return mapDeliveryToResponse({
            attemptCount: 0,
            completedAt: null,
            createdAt,
            eventOccurredAt,
            eventType,
            id: deliveryId,
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
        getDeliveriesPage,
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
