import * as Schema from "effect/Schema";
import {
  SendNotificationBody,
  SendNotificationResponse,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiAuthServiceError,
  ApiPushDeviceValidationError,
  ApiPushNotificationSendNotFoundError,
  ApiPushNotificationSendServiceError,
  ApiPushSendNotEnabledError,
  ApiPushSendServiceError,
} from "@voidhash/api-contracts/errors";
import {
  InternalFeatureFlagService,
  NotificationSendingService,
  PushNotificationSendService,
} from "@voidhash/core/services";
import { decodeCursor, encodeCursor, resolveRequestProjectId } from "@voidhash/core/utils";
import { PushNotificationSendStatus } from "@voidhash/db";
import { AuthSession, INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import {
  type ApiCredentialMethod,
  bridgeAuthSession,
  requireCredential,
} from "../../ApiMiddlewares.ts";
import * as Arr from "effect/Array";
import * as Match from "effect/Match";

/**
 * Dispatch and send history are both management surfaces; a publishable key
 * ships inside client bundles, so it must never reach either.
 */
const MANAGEMENT_CREDENTIALS: ReadonlyArray<ApiCredentialMethod> = ["user", "secret-key"];

/** Resolves an optional opaque cursor to the row id it points at. */
const toAfterId = (cursor: string | typeof Schema.Undefined.Type) => {
  return Option.match(Option.fromNullishOr(cursor), {
    onNone: () => Effect.succeed(Option.none<string>()),
    onSome: (value) => Effect.map(decodeCursor(value), Option.some),
  });
};

/** Builds the wire `pageInfo` from a keyset page's cursor state. */
const toPageInfo = (page: {
  readonly endCursorId: Option.Option<string>;
  readonly hasNextPage: boolean;
}) => {
  const endCursor: string | typeof Schema.Null.Type = page.hasNextPage
    ? Option.map(page.endCursorId, encodeCursor).pipe(Option.getOrNull)
    : null;
  return { endCursor, hasNextPage: page.hasNextPage };
};

/** Map the numeric send roll-up status to the API's string enum. */
const sendStatusToString = (status: number): SendNotificationResponse["status"] => {
  return Match.value(status).pipe(
    Match.when(PushNotificationSendStatus.InProgress, (): "in_progress" => "in_progress"),
    Match.when(PushNotificationSendStatus.Succeeded, (): "succeeded" => "succeeded"),
    Match.when(PushNotificationSendStatus.PartialFailed, (): "partial_failed" => "partial_failed"),
    Match.when(PushNotificationSendStatus.Failed, (): "failed" => "failed"),
    Match.when(PushNotificationSendStatus.NoRecipients, (): "no_recipients" => "no_recipients"),
    Match.orElse((): "pending" => "pending"),
  );
};

/**
 * Server-to-server push dispatch (`POST /api/v1/notifications`). A management
 * surface — secret-key or user credential only (never a publishable client key,
 * so a device can't push to arbitrary persons) and gated by the `notifications`
 * internal feature flag. Delegates to {@link NotificationSendingService}, which
 * writes the trail rows and enqueues per-device deliveries; the `202` response
 * carries the tracking id and up-front counts.
 */
export const NotificationsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "notifications",
  (handlers) =>
    Effect.gen(function* () {
      const sendService = yield* NotificationSendingService;
      const internalFeatureFlags = yield* InternalFeatureFlagService;

      /**
       * The dispatch path behind `POST /notifications`.
       *
       * @param payload - the notification body
       * @param idempotencyKey - resolved from the `Idempotency-Key` header when
       * present, else from the body field
       */
      const dispatch = (
        payload: typeof SendNotificationBody.Type,
        idempotencyKey: string | typeof Schema.Undefined.Type,
      ) =>
        Effect.fn("dispatch")(function* () {
          const session = yield* AuthSession;
          // Server-side only: a publishable (client-embedded) key must NEVER be
          // able to push to arbitrary persons in its project. Require a
          // secret/api key (the same trust level as the `persons` management API).
          yield* requireCredential(session, MANAGEMENT_CREDENTIALS);
          const projectId = yield* resolveRequestProjectId(session, payload.projectId);
          const organizationId = session?.projects.find(
            (project) => project.id === projectId,
          )?.organizationId;
          if (!organizationId) {
            // `resolveRequestProjectId` only ever returns a project taken from
            // this same session, so a missing organization is a broken session
            // record rather than a bad credential — a 500, not a 401.
            return yield* Effect.fail(
              new ApiAuthServiceError({
                cause: "Session project carries no organization",
                message: "No organization associated with this authentication session",
              }),
            );
          }

          // Internal feature-flag gate (voidhash-internal, per-org).
          const enabled = yield* internalFeatureFlags
            .isEnabled(organizationId, INTERNAL_FEATURE_FLAGS.notifications.key)
            .pipe(
              Effect.catchTag("InternalFeatureFlagServiceError", (error) =>
                Effect.fail(new ApiPushSendServiceError({ cause: error.message })),
              ),
            );
          if (!enabled) {
            return yield* Effect.fail(
              new ApiActionForbiddenError({
                message: "Notifications are not enabled for this organization",
              }),
            );
          }

          const personIds = payload.personIds ?? [];
          const distinctIds = payload.distinctIds ?? [];
          if (Arr.isReadonlyArrayEmpty(personIds) && Arr.isReadonlyArrayEmpty(distinctIds)) {
            return yield* Effect.fail(
              new ApiPushDeviceValidationError({
                message: "at least one of personIds or distinctIds is required",
              }),
            );
          }

          const result = yield* sendService.send({
            projectId,
            message: {
              title: payload.title,
              body: payload.body,
              data: payload.data,
              sound: payload.sound,
              badge: payload.badge,
              priority: payload.priority,
              ttl: payload.ttl,
              channelId: payload.channelId,
              collapseId: payload.collapseId,
            },
            personIds,
            distinctIds,
            idempotencyKey,
          });

          return new SendNotificationResponse({
            pushNotificationSendId: result.pushNotificationSendId,
            deviceCount: result.deviceCount,
            status: sendStatusToString(result.status),
            unresolvedDistinctIds: [...result.unresolvedDistinctIds],
          });
        })();

      return handlers.handle("createNotification", ({ headers, payload }) =>
        bridgeAuthSession(
          // The header is the canonical idempotency channel; the body field
          // stays accepted so a client can migrate without a flag day.
          dispatch(payload, headers["idempotency-key"] ?? payload.idempotencyKey),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new ApiActionForbiddenError({ message: error.message })),
            NotificationConfigNotEnabledError: (error) =>
              Effect.fail(new ApiPushSendNotEnabledError({ message: error.message })),
            NotificationSendingServiceError: (error) =>
              Effect.fail(new ApiPushSendServiceError({ cause: error.cause })),
          }),
        ),
      );
    }),
);

/**
 * Read-only send history (`/api/v1/notification-sends/*`) — what was
 * dispatched and how each device fared. Backed by
 * {@link PushNotificationSendService}, which never mutates.
 */
export const NotificationSendsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "notification_sends",
  (handlers) =>
    Effect.gen(function* () {
      const sendHistory = yield* PushNotificationSendService;

      return handlers
        .handle("listNotificationSends", ({ query }) =>
          bridgeAuthSession(
            Effect.fn("NotificationSendsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
              const after = yield* toAfterId(query.cursor);
              const page = yield* sendHistory.listSendsPage({
                after,
                limit: Option.fromNullishOr(query.limit),
                projectId,
              });
              return {
                data: page.sends.map(({ messagePurged, ...send }) => ({
                  ...send,
                  isMessagePurged: messagePurged,
                })),
                pageInfo: toPageInfo(page),
              };
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new ApiActionForbiddenError({ message: error.message })),
              PushNotificationSendServiceError: (error) =>
                Effect.fail(new ApiPushNotificationSendServiceError({ cause: error.cause })),
            }),
          ),
        )
        .handle("listNotificationSendDeliveries", ({ params, query }) =>
          bridgeAuthSession(
            Effect.fn("NotificationSendsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
              const after = yield* toAfterId(query.cursor);
              const page = yield* sendHistory.getSendDeliveriesPage({
                after,
                limit: Option.fromNullishOr(query.limit),
                projectId,
                sendId: params.sendId,
                status: Option.fromNullishOr(query.status),
              });
              return { data: page.deliveries, pageInfo: toPageInfo(page) };
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new ApiActionForbiddenError({ message: error.message })),
              PushNotificationSendNotFoundError: (error) =>
                Effect.fail(new ApiPushNotificationSendNotFoundError({ message: error.message })),
              PushNotificationSendServiceError: (error) =>
                Effect.fail(new ApiPushNotificationSendServiceError({ cause: error.cause })),
            }),
          ),
        );
    }),
);
