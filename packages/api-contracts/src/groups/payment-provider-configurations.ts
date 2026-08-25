import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiPaymentProviderAlreadyExistsError,
  ApiPaymentProviderConfigurationKeyUnavailableError,
  ApiPaymentProviderConfigurationNotFoundError,
  ApiPaymentProviderConfigurationServiceError,
  ApiPaymentProviderConfigurationValidationError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated } from "../Pagination.ts";
import {
  CreatePaymentProviderConfigurationBody,
  ListPaymentProviderConfigurationsQuery,
  PaymentProviderConfigurationDetail,
  UpdatePaymentProviderConfigurationBody,
} from "../schemas/providers.ts";

/**
 * Payment-provider credentials, one configuration per (project, provider).
 *
 * Every endpoint accepts a secret key or a user credential (session /
 * `x-api-key`); publishable keys are rejected because these rows hold billing
 * credentials. The stored credential blob is never returned — reads expose
 * `configurationPresence` (`has<Field>` booleans) instead.
 */
export const PaymentProviderConfigurationsGroup = HttpApiGroup.make(
  "payment_provider_configurations",
)
  .add(
    // Configurations for the resolved project, newest-stable order, paginated.
    HttpApiEndpoint.get("listPaymentProviderConfigurations", "/", {
      query: ListPaymentProviderConfigurationsQuery,
      success: paginated(PaymentProviderConfigurationDetail),
      error: [ApiActionForbiddenError, ApiPaymentProviderConfigurationServiceError],
    }),
  )
  .add(
    // Registers a provider for the project. Credentials are supplied by a
    // follow-up PATCH, so the new configuration starts disabled.
    HttpApiEndpoint.post("createPaymentProviderConfiguration", "/", {
      payload: CreatePaymentProviderConfigurationBody,
      success: PaymentProviderConfigurationDetail.pipe(HttpApiSchema.status(201)),
      error: [
        ApiActionForbiddenError,
        ApiPaymentProviderAlreadyExistsError,
        ApiPaymentProviderConfigurationNotFoundError,
        ApiPaymentProviderConfigurationServiceError,
        ApiPaymentProviderConfigurationValidationError,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.get("getPaymentProviderConfiguration", "/:configurationId", {
      params: { configurationId: Schema.String },
      success: PaymentProviderConfigurationDetail,
      error: [
        ApiActionForbiddenError,
        ApiPaymentProviderConfigurationNotFoundError,
        ApiPaymentProviderConfigurationServiceError,
      ],
    }),
  )
  .add(
    // Last-writer-wins: there is no optimistic-concurrency check, so a
    // concurrent PATCH silently overwrites. Enabling validates the credentials
    // against the provider.
    HttpApiEndpoint.patch("updatePaymentProviderConfiguration", "/:configurationId", {
      params: { configurationId: Schema.String },
      payload: UpdatePaymentProviderConfigurationBody,
      success: PaymentProviderConfigurationDetail,
      error: [
        ApiActionForbiddenError,
        ApiPaymentProviderConfigurationKeyUnavailableError,
        ApiPaymentProviderConfigurationNotFoundError,
        ApiPaymentProviderConfigurationServiceError,
        ApiPaymentProviderConfigurationValidationError,
      ],
    }),
  )
  .add(
    // Soft delete: the row is archived so historical purchases keep resolving.
    HttpApiEndpoint.delete("deletePaymentProviderConfiguration", "/:configurationId", {
      params: { configurationId: Schema.String },
      error: [
        ApiActionForbiddenError,
        ApiPaymentProviderConfigurationNotFoundError,
        ApiPaymentProviderConfigurationServiceError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/payment-provider-configurations");
