import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiPushNotificationConfigurationKeyUnavailableError,
  ApiPushNotificationConfigurationNotFoundError,
  ApiPushNotificationConfigurationServiceError,
  ApiPushNotificationConfigurationValidationError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated } from "../Pagination.ts";
import {
  CreatePushNotificationConfigurationBody,
  ListPushNotificationConfigurationsQuery,
  PushNotificationConfigurationDetail,
  UpdatePushNotificationConfigurationBody,
} from "../schemas/providers.ts";

/**
 * FCM / APNs credentials, one configuration per (project, provider).
 *
 * Secret-key or user credential only. Secrets are write-only: `configuration`
 * on every read is the provider's secret-omitting DTO (non-secret metadata
 * plus `has*` presence flags), so a service-account JSON or an APNs `.p8`
 * never leaves the server once written.
 */
export const PushNotificationConfigurationsGroup = HttpApiGroup.make(
  "push_notification_configurations",
)
  .add(
    HttpApiEndpoint.get("listPushNotificationConfigurations", "/", {
      query: ListPushNotificationConfigurationsQuery,
      success: paginated(PushNotificationConfigurationDetail),
      error: [ApiActionForbiddenError, ApiPushNotificationConfigurationServiceError],
    }),
  )
  .add(
    // Registers a push provider for the project; credentials arrive by a
    // follow-up PATCH, so the configuration starts disabled.
    HttpApiEndpoint.post("createPushNotificationConfiguration", "/", {
      payload: CreatePushNotificationConfigurationBody,
      success: PushNotificationConfigurationDetail.pipe(HttpApiSchema.status(201)),
      error: [
        ApiActionForbiddenError,
        ApiPushNotificationConfigurationKeyUnavailableError,
        ApiPushNotificationConfigurationNotFoundError,
        ApiPushNotificationConfigurationServiceError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.get("getPushNotificationConfiguration", "/:configurationId", {
      params: { configurationId: Schema.String },
      success: PushNotificationConfigurationDetail,
      error: [
        ApiActionForbiddenError,
        ApiPushNotificationConfigurationNotFoundError,
        ApiPushNotificationConfigurationServiceError,
      ],
    }),
  )
  .add(
    // Last-writer-wins. Fields omitted from `configuration` keep their stored
    // (encrypted) value, so a caller can enable a provider without resending
    // the secret it can no longer read.
    HttpApiEndpoint.patch("updatePushNotificationConfiguration", "/:configurationId", {
      params: { configurationId: Schema.String },
      payload: UpdatePushNotificationConfigurationBody,
      success: PushNotificationConfigurationDetail,
      error: [
        ApiActionForbiddenError,
        ApiPushNotificationConfigurationKeyUnavailableError,
        ApiPushNotificationConfigurationNotFoundError,
        ApiPushNotificationConfigurationServiceError,
        ApiPushNotificationConfigurationValidationError,
      ],
    }),
  )
  .add(
    // Soft delete: the row is archived so send history stays resolvable.
    HttpApiEndpoint.delete("deletePushNotificationConfiguration", "/:configurationId", {
      params: { configurationId: Schema.String },
      error: [
        ApiActionForbiddenError,
        ApiPushNotificationConfigurationNotFoundError,
        ApiPushNotificationConfigurationServiceError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/push-notification-configurations");
