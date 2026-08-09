import { NotificationsConfigurationService } from "@voidhash/core/services";
import {
  PushNotificationConfigurationRpcsDef,
  RpcActionForbiddenError,
  RpcPushNotificationConfigurationKeyUnavailableError,
  RpcPushNotificationConfigurationNotFoundError,
  RpcPushNotificationConfigurationServiceError,
  RpcPushNotificationConfigurationValidationError,
} from "@voidhash/rpc";
import { constant } from "@voidhash/lib/lang";
import { Effect } from "effect";

/**
 * Studio RPC surface for per-(project, provider) push credentials — the
 * deferred config-CRUD slice from Phase 1, now wired. Delegates to
 * {@link NotificationsConfigurationService} and translates its domain errors
 * (plus the `ActionForbiddenError` from the project-permission check) into the
 * `Rpc/Push…` wire errors. Handlers return the service's **secret-omitting**
 * read DTO directly — the DTO is a plain `Schema.Struct`, so no `new Class(...)`
 * encode is needed, and no secret ever reaches the browser.
 */
/** Structural view of the service errors these RPCs re-map onto wire errors. */
interface TaggedErrorLike {
  readonly _tag?: string;
  readonly cause?: unknown;
  readonly message?: string;
}

const isTaggedErrorLike = (error: unknown): error is TaggedErrorLike =>
  typeof error === "object" && error !== null;

const taggedErrorFields = (error: unknown): TaggedErrorLike => {
  if (isTaggedErrorLike(error)) return error;
  return {};
};

export const PushNotificationConfigurationRpcsLive = PushNotificationConfigurationRpcsDef.toLayer(
  Effect.gen(function* PushNotificationConfigurationRpcsLive() {
    const service = yield* NotificationsConfigurationService;
    const mapUpdateError = (error: unknown) => {
      const tagged = taggedErrorFields(error);
      switch (tagged._tag) {
        case "ActionForbiddenError":
          return new RpcActionForbiddenError({ message: tagged.message ?? "" });
        case "NotificationConfigNotFoundError":
          return new RpcPushNotificationConfigurationNotFoundError({
            message: tagged.message ?? "",
          });
        case "NotificationConfigKeyUnavailableError":
          return new RpcPushNotificationConfigurationKeyUnavailableError({
            message: tagged.message ?? "",
          });
        case "NotificationConfigValidationError":
          return new RpcPushNotificationConfigurationValidationError({
            cause: String(tagged.cause ?? error),
          });
        default:
          return new RpcPushNotificationConfigurationServiceError({
            cause: String(tagged.cause ?? error),
          });
      }
    };
    return {
      ListPushNotificationConfigurations: ({ projectId }) =>
        service.getPushNotificationConfigurations(projectId).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            NotificationsConfigurationServiceError: (error) =>
              Effect.fail(new RpcPushNotificationConfigurationServiceError({ cause: error.cause })),
          }),
        ),
      GetPushNotificationConfiguration: ({ id }) =>
        service.getPushNotificationConfigurationById(id).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            NotificationConfigNotFoundError: (error) =>
              Effect.fail(
                new RpcPushNotificationConfigurationNotFoundError({ message: error.message }),
              ),
            NotificationsConfigurationServiceError: (error) =>
              Effect.fail(new RpcPushNotificationConfigurationServiceError({ cause: error.cause })),
          }),
        ),
      CreatePushNotificationConfiguration: (input) =>
        service.createPushNotificationConfiguration(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            NotificationConfigNotFoundError: (error) =>
              Effect.fail(
                new RpcPushNotificationConfigurationNotFoundError({ message: error.message }),
              ),
            NotificationConfigKeyUnavailableError: (error) =>
              Effect.fail(
                new RpcPushNotificationConfigurationKeyUnavailableError({
                  message: error.message,
                }),
              ),
            NotificationsConfigurationServiceError: (error) =>
              Effect.fail(new RpcPushNotificationConfigurationServiceError({ cause: error.cause })),
          }),
        ),
      UpdatePushNotificationConfiguration: (input) =>
        service.updatePushNotificationConfiguration(input).pipe(
          Effect.map((result) => constant({ id: result.id })),
          Effect.mapError(mapUpdateError),
        ),
      DeletePushNotificationConfiguration: (input) =>
        service.deletePushNotificationConfiguration(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            NotificationConfigNotFoundError: (error) =>
              Effect.fail(
                new RpcPushNotificationConfigurationNotFoundError({ message: error.message }),
              ),
            NotificationsConfigurationServiceError: (error) =>
              Effect.fail(new RpcPushNotificationConfigurationServiceError({ cause: error.cause })),
          }),
        ),
    };
  }),
);
