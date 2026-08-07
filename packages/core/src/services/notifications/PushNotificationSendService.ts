import { constant, pick } from "@voidhash/lib/lang";
import { Context, Effect, Layer, Schema } from "effect";

import { Db, PushNotificationDeliveryStatus, PushNotificationSendStatus } from "@voidhash/db";
import { AuthSession } from "../../domain/auth/Auth.ts";
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
            sends: rows.slice(0, limit).map((row) => ({
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
            })),
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
            deliveries: rows.map((row) => ({
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
            })),
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

      return constant({ getSendDeliveries, listSends });
    }),
  },
) {
  static layer = Layer.effect(PushNotificationSendService)(PushNotificationSendService.make);
}
