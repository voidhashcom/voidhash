import { SendNotificationResponse, VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiAuthenticationError,
  ApiPushDeviceValidationError,
  ApiPushSendNotEnabledError,
  ApiPushSendServiceError,
} from "@voidhash/api-contracts/errors";
import {
  InternalFeatureFlagService,
  NotificationSendingService,
} from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { PushNotificationSendStatus } from "@voidhash/db";
import { AuthSession, INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

/** Map the numeric send roll-up status to the API's string enum. */
const sendStatusToString = (status: number): SendNotificationResponse["status"] => {
  switch (status) {
    case PushNotificationSendStatus.InProgress:
      return "in_progress";
    case PushNotificationSendStatus.Succeeded:
      return "succeeded";
    case PushNotificationSendStatus.PartialFailed:
      return "partial_failed";
    case PushNotificationSendStatus.Failed:
      return "failed";
    case PushNotificationSendStatus.NoRecipients:
      return "no_recipients";
    default:
      return "pending";
  }
};

/**
 * Server-to-server push dispatch (`POST /api/v1/notifications/send`). A
 * management surface — secret-key authenticated (never a publishable client key,
 * so a device can't push to arbitrary persons) and gated by the `notifications`
 * internal feature flag. Delegates to {@link NotificationSendingService}, which
 * writes the trail rows and enqueues per-device deliveries; the response carries
 * the tracking id and up-front counts.
 */
export const NotificationsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "notifications",
  (handlers) =>
    Effect.gen(function* () {
      const sendService = yield* NotificationSendingService;
      const internalFeatureFlags = yield* InternalFeatureFlagService;

      return handlers.handle("sendNotification", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            // Server-side only: a publishable (client-embedded) key must NEVER be
            // able to push to arbitrary persons in its project. Require a
            // secret/api key (the same trust level as the `persons` management API).
            if (session?.method === "publishable-key") {
              return yield* Effect.fail(
                new ApiActionForbiddenError({
                  message: "Push dispatch requires a secret API key, not a publishable key",
                }),
              );
            }
            const projectId = yield* extractAuthorizedProjectId(session);
            const organizationId = session?.projects.find(
              (project) => project.id === projectId,
            )?.organizationId;
            if (!organizationId) {
              return yield* Effect.fail(
                new ApiAuthenticationError({
                  cause: "No organization associated with this authentication session",
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
            if (personIds.length === 0 && distinctIds.length === 0) {
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
              idempotencyKey: payload.idempotencyKey,
            });

            return new SendNotificationResponse({
              pushNotificationSendId: result.pushNotificationSendId,
              deviceCount: result.deviceCount,
              status: sendStatusToString(result.status),
              unresolvedDistinctIds: [...result.unresolvedDistinctIds],
            });
          }),
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
