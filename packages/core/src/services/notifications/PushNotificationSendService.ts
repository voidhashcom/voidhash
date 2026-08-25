import { constant, pick } from "@voidhash/lib/lang";
import { Context, Effect, Layer, Schema } from "effect";

import {
  Db,
  PushNotificationDeliveryStatus,
  PushNotificationSendStatus,
  and,
  asc,
  desc,
  eq,
  pushNotificationDeliveries,
  pushNotificationSends,
  sql,
} from "@voidhash/db";
import { ActionForbiddenError, AuthSession } from "../../domain/auth/Auth.ts";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../utils/pagination.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * Catch-all service error for the read-only send-history surface. Wraps
 * `EffectDrizzleQueryError` and other infrastructural failures at the
 * public-method boundary.
 */
export class PushNotificationSendServiceError extends Schema.TaggedErrorClass<PushNotificationSendServiceError>(
  "PushNotificationSendServiceError",
)("PushNotificationSendServiceError", { cause: Schema.String }) {}

/** Raised when a send id does not resolve to a row owned by the project. */
export class PushNotificationSendNotFoundError extends Schema.TaggedErrorClass<PushNotificationSendNotFoundError>(
  "PushNotificationSendNotFoundError",
)("PushNotificationSendNotFoundError", { message: Schema.String }) {}

/**
 * Maps the numeric `push_notification_send.status` column to a stable
 * snake_case label so the wire contract never leaks the enum encoding.
 */
const SEND_STATUS_LABELS: Record<number, string> = {
  [PushNotificationSendStatus.Pending]: "pending",
  [PushNotificationSendStatus.InProgress]: "in_progress",
  [PushNotificationSendStatus.Succeeded]: "succeeded",
  [PushNotificationSendStatus.PartialFailed]: "partial_failed",
  [PushNotificationSendStatus.Failed]: "failed",
  [PushNotificationSendStatus.NoRecipients]: "no_recipients",
};
const sendStatusLabel = (status: number): string => SEND_STATUS_LABELS[status] ?? "unknown";

/** Maps the numeric `push_notification_delivery.status` column to a label. */
const DELIVERY_STATUS_LABELS: Record<number, string> = {
  [PushNotificationDeliveryStatus.Pending]: "pending",
  [PushNotificationDeliveryStatus.InProgress]: "in_progress",
  [PushNotificationDeliveryStatus.Succeeded]: "succeeded",
  [PushNotificationDeliveryStatus.Failed]: "failed",
  [PushNotificationDeliveryStatus.Exhausted]: "exhausted",
};
const deliveryStatusLabel = (status: number): string => DELIVERY_STATUS_LABELS[status] ?? "unknown";

/**
 * Resolves a wire-level delivery-status label back to the numeric column value
 * so a status filter can be pushed into SQL. Unknown labels resolve to
 * `undefined`, which callers treat as a filter matching no rows.
 */
const deliveryStatusValueForLabel = (label: string): number | undefined => {
  for (const [value, knownLabel] of Object.entries(DELIVERY_STATUS_LABELS)) {
    if (knownLabel === label) return Number(value);
  }
  return undefined;
};

/** Shapes a `push_notification_send` row for the read surface. */
const toSendItem = (row: typeof pushNotificationSends.$inferSelect) => ({
  completedAt: row.completedAt,
  createdAt: row.createdAt,
  deviceCount: row.deviceCount,
  failedCount: row.failedCount,
  id: row.id,
  idempotencyKey: row.idempotencyKey,
  message: pick(row.messagePurgedAt === null, row.message, {}),
  messagePurged: row.messagePurgedAt !== null,
  requestedDistinctIdCount: row.requestedDistinctIds.length,
  requestedPersonCount: row.requestedPersonIds.length,
  skippedCount: row.skippedCount,
  status: sendStatusLabel(row.status),
  succeededCount: row.succeededCount,
  unresolvedDistinctIds: row.unresolvedDistinctIds,
});

/** Shapes a `push_notification_delivery` row for the read surface. */
const toDeliveryItem = (row: typeof pushNotificationDeliveries.$inferSelect) => ({
  attemptCount: row.attemptCount,
  completedAt: row.completedAt,
  createdAt: row.createdAt,
  id: row.id,
  lastError: row.lastError,
  maxAttempts: row.maxAttempts,
  nextAttemptAt: row.nextAttemptAt,
  personId: row.personId,
  provider: row.provider,
  providerMessageId: row.providerMessageId,
  status: deliveryStatusLabel(row.status),
});

/**
 * Read-only access to push-notification send history — the data behind the
 * studio "sent notifications" activity page. Every method is scoped to a
 * project via {@link checkProjectPermission} (`project:all`), mirroring the
 * analytics events-activity read path. Writes live in the delivery pipeline;
 * this service never mutates.
 */
export class PushNotificationSendService extends Context.Service<PushNotificationSendService>()(
  "PushNotificationSendService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;

      const listSends = Effect.fn("notifications.listSends")(
        function* (input: { readonly limit?: number; readonly projectId: string }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to access notification sends for project ${input.projectId}`,
          );

          const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
          yield* Effect.annotateCurrentSpan("voidhash.notifications.limit", limit);

          // Fetch `limit + 1` to compute `hasMore` without a second count query.
          const rows = yield* db.query.pushNotificationSends.findMany({
            where: { projectId: input.projectId },
            orderBy: { createdAt: "desc" },
            limit: limit + 1,
          });

          const hasMore = rows.length > limit;
          yield* Effect.annotateCurrentSpan("voidhash.notifications.has_more", hasMore);

          return {
            hasMore,
            sends: rows.slice(0, limit).map(toSendItem),
          };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PushNotificationSendServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const getSendDeliveries = Effect.fn("notifications.getSendDeliveries")(
        function* (input: { readonly projectId: string; readonly sendId: string }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to access notification sends for project ${input.projectId}`,
          );

          // Confirm the parent send exists AND belongs to this project before
          // returning any delivery rows — this both yields a clean 404 for a
          // bogus id and prevents cross-project delivery leakage.
          const send = yield* db.query.pushNotificationSends.findFirst({
            columns: { id: true },
            where: { id: input.sendId, projectId: input.projectId },
          });
          if (!send) {
            return yield* Effect.fail(
              new PushNotificationSendNotFoundError({
                message: `Notification send ${input.sendId} was not found in project ${input.projectId}`,
              }),
            );
          }

          const rows = yield* db.query.pushNotificationDeliveries.findMany({
            where: { pushNotificationSendId: input.sendId, projectId: input.projectId },
            orderBy: { createdAt: "asc" },
          });

          return {
            deliveries: rows.map(toDeliveryItem),
          };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PushNotificationSendServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      /**
       * One keyset page of send history, newest first. Additive to
       * {@link listSends}: the windowed read stays for the RPC dashboard, while
       * this pages the unbounded table directly in SQL. `after` is the decoded
       * cursor — the id of the last row the caller already saw.
       */
      const listSendsPage = Effect.fn("notifications.listSendsPage")(
        function* (input: {
          readonly after?: string | undefined;
          readonly limit?: number | undefined;
          readonly projectId: string;
        }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to access notification sends for project ${input.projectId}`,
          );

          const limit = Math.min(input.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
          const conditions = [eq(pushNotificationSends.projectId, input.projectId)];

          if (input.after !== undefined) {
            const anchorRows = yield* db
              .select({ createdAt: pushNotificationSends.createdAt, id: pushNotificationSends.id })
              .from(pushNotificationSends)
              .where(
                and(
                  eq(pushNotificationSends.projectId, input.projectId),
                  eq(pushNotificationSends.id, input.after),
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
            // Row-value comparison: strictly "older than the cursor row", with
            // the id breaking ties between rows sharing a timestamp.
            conditions.push(
              sql`(${pushNotificationSends.createdAt}, ${pushNotificationSends.id}) < (${cursorRow.createdAt}::timestamptz, ${cursorRow.id}::text)`,
            );
          }

          // One row beyond the page answers `hasNextPage` without a COUNT.
          const rows = yield* db
            .select()
            .from(pushNotificationSends)
            .where(and(...conditions))
            .orderBy(desc(pushNotificationSends.createdAt), desc(pushNotificationSends.id))
            .limit(limit + 1);

          const hasNextPage = rows.length > limit;
          const pageRows = rows.slice(0, limit);
          const lastRow = pageRows[pageRows.length - 1];
          let endCursorId: string | null = null;
          if (hasNextPage && lastRow !== undefined) {
            endCursorId = lastRow.id;
          }
          return { endCursorId, hasNextPage, sends: pageRows.map(toSendItem) };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PushNotificationSendServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      /**
       * One keyset page of the per-device delivery trail for a send, oldest
       * first (matching {@link getSendDeliveries}). Additive: the unpaged read
       * stays for the RPC dashboard. An optional `status` label narrows the
       * page in SQL; an unknown label matches no rows, mirroring the previous
       * in-memory filter.
       */
      const getSendDeliveriesPage = Effect.fn("notifications.getSendDeliveriesPage")(
        function* (input: {
          readonly after?: string | undefined;
          readonly limit?: number | undefined;
          readonly projectId: string;
          readonly sendId: string;
          readonly status?: string | undefined;
        }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to access notification sends for project ${input.projectId}`,
          );

          // Confirm the parent send exists AND belongs to this project before
          // returning any delivery rows — this both yields a clean 404 for a
          // bogus id and prevents cross-project delivery leakage.
          const send = yield* db.query.pushNotificationSends.findFirst({
            columns: { id: true },
            where: { id: input.sendId, projectId: input.projectId },
          });
          if (!send) {
            return yield* Effect.fail(
              new PushNotificationSendNotFoundError({
                message: `Notification send ${input.sendId} was not found in project ${input.projectId}`,
              }),
            );
          }

          const limit = Math.min(input.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
          const conditions = [
            eq(pushNotificationDeliveries.pushNotificationSendId, input.sendId),
            eq(pushNotificationDeliveries.projectId, input.projectId),
          ];
          if (input.status !== undefined) {
            const statusValue = deliveryStatusValueForLabel(input.status);
            if (statusValue === undefined) {
              return { deliveries: [], endCursorId: null, hasNextPage: false };
            }
            conditions.push(eq(pushNotificationDeliveries.status, statusValue));
          }

          if (input.after !== undefined) {
            const anchorRows = yield* db
              .select({
                createdAt: pushNotificationDeliveries.createdAt,
                id: pushNotificationDeliveries.id,
              })
              .from(pushNotificationDeliveries)
              .where(
                and(
                  eq(pushNotificationDeliveries.pushNotificationSendId, input.sendId),
                  eq(pushNotificationDeliveries.projectId, input.projectId),
                  eq(pushNotificationDeliveries.id, input.after),
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
            // Ascending walk, so the page starts strictly after the cursor row.
            conditions.push(
              sql`(${pushNotificationDeliveries.createdAt}, ${pushNotificationDeliveries.id}) > (${cursorRow.createdAt}::timestamptz, ${cursorRow.id}::text)`,
            );
          }

          // One row beyond the page answers `hasNextPage` without a COUNT.
          const rows = yield* db
            .select()
            .from(pushNotificationDeliveries)
            .where(and(...conditions))
            .orderBy(asc(pushNotificationDeliveries.createdAt), asc(pushNotificationDeliveries.id))
            .limit(limit + 1);

          const hasNextPage = rows.length > limit;
          const pageRows = rows.slice(0, limit);
          const lastRow = pageRows[pageRows.length - 1];
          let endCursorId: string | null = null;
          if (hasNextPage && lastRow !== undefined) {
            endCursorId = lastRow.id;
          }
          return { deliveries: pageRows.map(toDeliveryItem), endCursorId, hasNextPage };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new PushNotificationSendServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      return constant({ getSendDeliveries, getSendDeliveriesPage, listSends, listSendsPage });
    }),
  },
) {
  static layer = Layer.effect(PushNotificationSendService)(PushNotificationSendService.make);
}
