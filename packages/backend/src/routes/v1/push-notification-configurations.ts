import * as Schema from "effect/Schema";
import * as Arr from "effect/Array";
import {
  createdResponse,
  PushNotificationConfigurationDetail,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiPushNotificationConfigurationKeyUnavailableError,
  ApiPushNotificationConfigurationNotFoundError,
  ApiPushNotificationConfigurationServiceError,
  ApiPushNotificationConfigurationValidationError,
} from "@voidhash/api-contracts/errors";
import { NotificationsConfigurationService } from "@voidhash/core/services";
import { paginate, resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import {
  type ApiCredentialMethod,
  bridgeAuthSession,
  requireCredential,
} from "../../ApiMiddlewares.ts";
import * as P from "effect/Predicate";

/** Push credentials are server-side only; publishable keys are rejected. */
const MANAGEMENT_CREDENTIALS: ReadonlyArray<ApiCredentialMethod> = ["user", "secret-key"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  P.isObject(value) && value !== null;

const toConfiguration = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) return value;
  return {};
};

interface PushConfigurationDto {
  readonly activeProviderId: string | typeof Schema.Null.Type;
  readonly configuration: unknown;
  readonly createdAt: Date | typeof Schema.Null.Type;
  readonly deletedAt: Date | typeof Schema.Null.Type;
  readonly enabled: boolean;
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly providerId: string;
  readonly pushProviderKey: string;
  readonly updatedAt: Date | typeof Schema.Null.Type;
}

/**
 * The service already hands back a secret-omitting DTO (`configuration` is the
 * provider's non-secret metadata plus `has*` flags), so this only reshapes it
 * onto the wire contract — it must never widen back to the stored blob.
 */
const toDetail = (row: PushConfigurationDto) => ({
  activeProviderId: row.activeProviderId,
  configuration: toConfiguration(row.configuration),
  createdAt: row.createdAt,
  deletedAt: row.deletedAt,
  isEnabled: row.enabled,
  id: row.id,
  name: row.name,
  projectId: row.projectId,
  providerId: row.providerId,
  pushProviderKey: row.pushProviderKey,
  updatedAt: row.updatedAt,
});

/** Omits `name` from an update when the caller did not send one, so the stored value survives. */
const nameUpdate = (name: string | typeof Schema.Undefined.Type): { name?: string } => {
  if (name === undefined) return {};
  return { name };
};

export const PushNotificationConfigurationsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "push_notification_configurations",
  (handlers) =>
    Effect.gen(function* () {
      const service = yield* NotificationsConfigurationService;

      return handlers
        .handle("listPushNotificationConfigurations", ({ query }) =>
          bridgeAuthSession(
            Effect.fn("PushNotificationConfigurationsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
              const rows = yield* service.getPushNotificationConfigurations(projectId);
              const matching = rows.filter(
                (row) => query.providerId === undefined || row.providerId === query.providerId,
              );
              const sorted = Arr.sortWith([...matching], (item) => item.id, Order.String);
              const page = yield* paginate(sorted, (row) => row.id, query);
              return { data: page.data.map(toDetail), pageInfo: page.pageInfo };
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              NotificationsConfigurationServiceError: (e) =>
                Effect.fail(new ApiPushNotificationConfigurationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("createPushNotificationConfiguration", ({ payload }) =>
          bridgeAuthSession(
            Effect.fn("PushNotificationConfigurationsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
              const created = yield* service.createPushNotificationConfiguration({
                projectId,
                providerId: payload.providerId,
              });
              const row = yield* service.getPushNotificationConfigurationById(created.id);
              const detail = toDetail(row);
              return yield* createdResponse(
                PushNotificationConfigurationDetail,
                detail,
                `/push-notification-configurations/${detail.id}`,
              );
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              NotificationConfigKeyUnavailableError: (e) =>
                Effect.fail(
                  new ApiPushNotificationConfigurationKeyUnavailableError({ message: e.message }),
                ),
              NotificationConfigNotFoundError: (e) =>
                Effect.fail(
                  new ApiPushNotificationConfigurationNotFoundError({ message: e.message }),
                ),
              NotificationsConfigurationServiceError: (e) =>
                Effect.fail(new ApiPushNotificationConfigurationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("getPushNotificationConfiguration", ({ params }) =>
          bridgeAuthSession(
            Effect.fn("PushNotificationConfigurationsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const row = yield* service.getPushNotificationConfigurationById(
                params.configurationId,
              );
              return toDetail(row);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              NotificationConfigNotFoundError: (e) =>
                Effect.fail(
                  new ApiPushNotificationConfigurationNotFoundError({ message: e.message }),
                ),
              NotificationsConfigurationServiceError: (e) =>
                Effect.fail(new ApiPushNotificationConfigurationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("updatePushNotificationConfiguration", ({ params, payload }) =>
          bridgeAuthSession(
            Effect.fn("PushNotificationConfigurationsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const existing = yield* service.getPushNotificationConfigurationById(
                params.configurationId,
              );
              // Secrets are write-only, so an omitted `configuration` must not
              // blank the stored credential: the service merges the incoming
              // fields over the persisted ones.
              yield* service.updatePushNotificationConfiguration({
                configuration: payload.configuration ?? {},
                enabled: payload.isEnabled ?? existing.enabled,
                id: params.configurationId,
                ...nameUpdate(payload.name),
              });
              const row = yield* service.getPushNotificationConfigurationById(
                params.configurationId,
              );
              return toDetail(row);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              NotificationConfigKeyUnavailableError: (e) =>
                Effect.fail(
                  new ApiPushNotificationConfigurationKeyUnavailableError({ message: e.message }),
                ),
              NotificationConfigNotFoundError: (e) =>
                Effect.fail(
                  new ApiPushNotificationConfigurationNotFoundError({ message: e.message }),
                ),
              NotificationConfigValidationError: (e) =>
                Effect.fail(
                  new ApiPushNotificationConfigurationValidationError({ cause: e.cause }),
                ),
              NotificationsConfigurationServiceError: (e) =>
                Effect.fail(new ApiPushNotificationConfigurationServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("deletePushNotificationConfiguration", ({ params }) =>
          bridgeAuthSession(
            Effect.fn("PushNotificationConfigurationsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              return yield* service.deletePushNotificationConfiguration({
                pushNotificationConfigurationId: params.configurationId,
              });
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              NotificationConfigNotFoundError: (e) =>
                Effect.fail(
                  new ApiPushNotificationConfigurationNotFoundError({ message: e.message }),
                ),
              NotificationsConfigurationServiceError: (e) =>
                Effect.fail(new ApiPushNotificationConfigurationServiceError({ cause: e.cause })),
            }),
          ),
        );
    }),
);
