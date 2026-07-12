import { PushNotificationSendService } from "@voidhash/core/services";
import {
  PushNotificationSendRpcsDef,
  RpcActionForbiddenError,
  RpcPushNotificationSendNotFoundError,
  RpcPushNotificationSendServiceError,
} from "@voidhash/rpc";
import { Effect } from "effect";

/**
 * Read-only studio RPC surface for push-notification send history — the
 * "sent notifications" activity page. Delegates to
 * {@link PushNotificationSendService} and translates its domain errors (plus the
 * `ActionForbiddenError` from the project-permission check) into the `Rpc/Push…`
 * wire errors. Handlers return the service's plain read DTOs directly (each is a
 * `Schema.Struct`, so no `new Class(...)` encode is needed).
 */
export const PushNotificationSendRpcsLive = PushNotificationSendRpcsDef.toLayer(
  Effect.gen(function* PushNotificationSendRpcsLive() {
    const service = yield* PushNotificationSendService;
    return {
      ListPushNotificationSends: ({ limit, projectId }) =>
        service.listSends({ limit, projectId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PushNotificationSendServiceError: (error) =>
              Effect.fail(new RpcPushNotificationSendServiceError({ cause: error.cause })),
          }),
        ),
      GetPushNotificationSendDeliveries: ({ projectId, sendId }) =>
        service.getSendDeliveries({ projectId, sendId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PushNotificationSendNotFoundError: (error) =>
              Effect.fail(new RpcPushNotificationSendNotFoundError({ message: error.message })),
            PushNotificationSendServiceError: (error) =>
              Effect.fail(new RpcPushNotificationSendServiceError({ cause: error.cause })),
          }),
        ),
    };
  }),
);
