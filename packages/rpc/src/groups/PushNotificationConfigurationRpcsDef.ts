import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcPushNotificationConfigurationKeyUnavailableError,
  RpcPushNotificationConfigurationNotFoundError,
  RpcPushNotificationConfigurationServiceError,
  RpcPushNotificationConfigurationValidationError,
} from "../errors/PushNotificationConfiguration.ts";
import { AuthMiddleware } from "../middlewares.ts";

/**
 * Wire DTO for a push-notification configuration (FCM/APNs credentials for a
 * project). Unlike the payment-provider DTO this is the **secret-omitting** read
 * shape: `configuration` carries only the provider's non-secret metadata plus
 * `has*` presence flags (never the FCM service-account JSON or the APNs `.p8`).
 * The server strips secrets via `NotificationsConfigurationService.toReadDto`, so
 * this contract deliberately mirrors that reduced shape.
 */
export const PushNotificationConfiguration = Schema.Struct({
  activeProviderId: Schema.NullOr(Schema.String),
  configuration: Schema.ObjectKeyword,
  createdAt: Schema.NullOr(Schema.Date),
  deletedAt: Schema.NullOr(Schema.Date),
  enabled: Schema.Boolean,
  id: Schema.String,
  name: Schema.String,
  providerId: Schema.String,
  projectId: Schema.String,
  pushProviderKey: Schema.String,
  updatedAt: Schema.NullOr(Schema.Date),
});

export class PushNotificationConfigurationRpcsDef extends RpcGroup.make(
  Rpc.make("ListPushNotificationConfigurations", {
    error: Schema.Union([RpcActionForbiddenError, RpcPushNotificationConfigurationServiceError]),
    payload: Schema.Struct({
      projectId: Schema.String,
    }),
    success: Schema.Array(PushNotificationConfiguration),
  }),
  Rpc.make("GetPushNotificationConfiguration", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPushNotificationConfigurationServiceError,
      RpcPushNotificationConfigurationNotFoundError,
    ]),
    payload: Schema.Struct({
      id: Schema.String,
    }),
    success: PushNotificationConfiguration,
  }),
  Rpc.make("CreatePushNotificationConfiguration", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPushNotificationConfigurationServiceError,
      RpcPushNotificationConfigurationNotFoundError,
      RpcPushNotificationConfigurationKeyUnavailableError,
    ]),
    payload: Schema.Struct({
      projectId: Schema.String,
      providerId: Schema.String,
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("UpdatePushNotificationConfiguration", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPushNotificationConfigurationValidationError,
      RpcPushNotificationConfigurationServiceError,
      RpcPushNotificationConfigurationNotFoundError,
      RpcPushNotificationConfigurationKeyUnavailableError,
    ]),
    payload: Schema.Struct({
      configuration: Schema.Record(Schema.String, Schema.Unknown),
      enabled: Schema.Boolean,
      id: Schema.String,
      name: Schema.String,
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("DeletePushNotificationConfiguration", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPushNotificationConfigurationServiceError,
      RpcPushNotificationConfigurationNotFoundError,
    ]),
    payload: Schema.Struct({
      pushNotificationConfigurationId: Schema.String,
    }),
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
