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
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as Match from "effect/Match";

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
  P.isObject(error) && error !== null;

const taggedErrorFields = (error: unknown): TaggedErrorLike => {
  if (isTaggedErrorLike(error)) return error;
  return {};
};

const toRpcConfiguration = <A extends { readonly enabled: boolean }>(configuration: A) => {
  const { enabled, ...rest } = configuration;
  return { ...rest, isEnabled: enabled };
};

export const PushNotificationConfigurationRpcsLive = PushNotificationConfigurationRpcsDef.toLayer(
  Effect.gen(function* PushNotificationConfigurationRpcsLive() {
    const service = yield* NotificationsConfigurationService;
    const mapUpdateError = (error: unknown) => {
      const tagged = taggedErrorFields(error);
      return Match.value(tagged).pipe(
        Match.when(
          { _tag: "ActionForbiddenError" },
          () => new RpcActionForbiddenError({ message: tagged.message ?? "" }),
        ),
        Match.when(
          { _tag: "NotificationConfigNotFoundError" },
          () =>
            new RpcPushNotificationConfigurationNotFoundError({
              message: tagged.message ?? "",
            }),
        ),
        Match.when(
          { _tag: "NotificationConfigKeyUnavailableError" },
          () =>
            new RpcPushNotificationConfigurationKeyUnavailableError({
              message: tagged.message ?? "",
            }),
        ),
        Match.when(
          { _tag: "NotificationConfigValidationError" },
          () =>
            new RpcPushNotificationConfigurationValidationError({
              cause: String(tagged.cause ?? error),
            }),
        ),
        Match.orElse(
          () =>
            new RpcPushNotificationConfigurationServiceError({
              cause: String(tagged.cause ?? error),
            }),
        ),
      );
    };
    return {
      ListPushNotificationConfigurations: ({ projectId }) =>
        service.getPushNotificationConfigurations(projectId).pipe(
          Effect.map((configurations) => configurations.map(toRpcConfiguration)),
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            NotificationsConfigurationServiceError: (error) =>
              Effect.fail(new RpcPushNotificationConfigurationServiceError({ cause: error.cause })),
          }),
        ),
      GetPushNotificationConfiguration: ({ id }) =>
        service.getPushNotificationConfigurationById(id).pipe(
          Effect.map(toRpcConfiguration),
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
      UpdatePushNotificationConfiguration: ({ isEnabled, ...input }) =>
        service.updatePushNotificationConfiguration({ ...input, enabled: isEnabled }).pipe(
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
