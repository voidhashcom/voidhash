import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import {
  ActionForbiddenError,
  ApiKeyNotFoundError,
  ApiKeyServiceError,
  AuthenticationError,
  ChangesetDeploymentServiceError,
  CustomerInvalidAnonymousIdError,
  CustomerNotFoundError,
  CustomerServiceError,
  OrganizationServiceError,
  PaymentProviderConfigurationServiceError,
  PaymentProviderProductServiceError,
  PaywallLocationServiceError,
  PerkServiceError,
  ProductPerkServiceError,
  ProductPerkValidationError,
  ProductServiceError,
  ProjectServiceError,
  SdkCustomerAlreadyIdentifiedError,
  SdkCustomerNotFoundError,
  SdkServiceError,
  SdkValidationError,
  UserServiceError,
  WebhookDeliveryNotFoundError,
  WebhookEndpointNotFoundError,
  WebhookServiceError,
  WebhookValidationError,
} from "./errors";
import { AuthMiddleware } from "./middlewares";
import {
  ApiKey,
  ApiKeyWithRawKey,
  CreateCustomerBody,
  CreateOrganizationBody,
  CreateProjectBody,
  CreateSecretKeyBody,
  CreateWebhookEndpointBody,
  Customer,
  DeployChangesetBody,
  DeployChangesetResponse,
  Organization,
  PaymentProviderConfiguration,
  PaymentProviderProduct,
  PaywallLocation,
  Perk,
  Product,
  ProductPerk,
  Project,
  EvaluateFeatureFlagsBody,
  SdkCustomer,
  SdkFeatureFlagsResponse,
  SdkHeaders,
  SdkIdentifyBody,
  SdkResolvePaywallBody,
  SdkResolvedPaywall,
  SdkSyncCustomerAttributesBody,
  SdkSyncTransactionBody,
  SdkSyncTransactionResponse,
  Session,
  UpdateWebhookEndpointBody,
  User,
  WebhookDelivery,
  WebhookDeliveryWithAttempts,
  WebhookEndpoint,
} from "./schema";

export const VoidhashV1Api = HttpApi.make("VoidhashV1Api")
  .add(
    HttpApiGroup.make("auth")
      .add(
        HttpApiEndpoint.get("session", "/session", {
          success: Session,
          error: [ActionForbiddenError],
        }).middleware(AuthMiddleware)
      )
      .prefix("/auth")
  )
  .add(
    HttpApiGroup.make("api_keys")
      .add(
        HttpApiEndpoint.post("createSecretKey", "/", {
          success: ApiKeyWithRawKey,
          payload: CreateSecretKeyBody,
          error: [ApiKeyServiceError, ActionForbiddenError],
        })
      )
      .add(
        HttpApiEndpoint.get("listApiKeys", "/", {
          success: Schema.Array(ApiKey),
          error: [ApiKeyServiceError, ActionForbiddenError],
        })
      )
      .add(
        HttpApiEndpoint.get("getApiKeyById", "/:apiKeyId", {
          params: { apiKeyId: Schema.String },
          success: ApiKey,
          error: [ApiKeyServiceError, ApiKeyNotFoundError, ActionForbiddenError],
        })
      )
      .add(
        HttpApiEndpoint.post("rotateSecretKey", "/:apiKeyId/rotate", {
          params: { apiKeyId: Schema.String },
          success: ApiKeyWithRawKey,
          error: [ApiKeyServiceError, ApiKeyNotFoundError, ActionForbiddenError],
        })
      )
      .add(
        HttpApiEndpoint.delete("deleteApiKey", "/:apiKeyId", {
          params: { apiKeyId: Schema.String },
          error: [ApiKeyServiceError, ApiKeyNotFoundError, ActionForbiddenError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/api-keys")
  )
  .add(
    HttpApiGroup.make("customers")
      .add(
        HttpApiEndpoint.post("createCustomer", "/", {
          payload: CreateCustomerBody,
          success: Customer,
          error: [ActionForbiddenError, CustomerInvalidAnonymousIdError, CustomerServiceError],
        })
      )
      .add(
        HttpApiEndpoint.get("listCustomers", "/", {
          success: Schema.Array(Customer),
          error: [ActionForbiddenError, CustomerServiceError],
        })
      )
      .add(
        HttpApiEndpoint.get("getCustomerById", "/:customerId", {
          params: { customerId: Schema.String },
          success: Customer,
          error: [ActionForbiddenError, CustomerNotFoundError, CustomerServiceError],
        })
      )
      .add(
        HttpApiEndpoint.get("byDistinctId", "/by-distinct-id/:distinctId", {
          params: { distinctId: Schema.String },
          success: Customer,
          error: [ActionForbiddenError, CustomerNotFoundError, CustomerServiceError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/customers")
  )
  .add(
    HttpApiGroup.make("organizations")
      .add(
        HttpApiEndpoint.post("createOrganization", "/", {
          payload: CreateOrganizationBody,
          success: Organization,
          error: [OrganizationServiceError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/organizations")
  )
  .add(
    HttpApiGroup.make("perks")
      .add(
        HttpApiEndpoint.get("listPerks", "/", {
          success: Schema.Array(Perk),
          error: [ActionForbiddenError, PerkServiceError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/perks")
  )
  .add(
    HttpApiGroup.make("paywall_locations")
      .add(
        HttpApiEndpoint.get("listPaywallLocations", "/", {
          success: Schema.Array(PaywallLocation),
          error: [ActionForbiddenError, PaywallLocationServiceError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/paywall-locations")
  )
  .add(
    HttpApiGroup.make("projects")
      .add(
        HttpApiEndpoint.post("createProject", "/", {
          payload: CreateProjectBody,
          success: Project,
          error: [ActionForbiddenError, AuthenticationError, ProjectServiceError],
        })
      )
      .add(
        HttpApiEndpoint.get("listProjects", "/:organizationId", {
          params: { organizationId: Schema.String },
          success: Schema.Array(Project),
          error: [ActionForbiddenError, ProjectServiceError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/projects")
  )
  .add(
    HttpApiGroup.make("products")
      .add(
        HttpApiEndpoint.get("listProducts", "/", {
          success: Schema.Array(Product),
          error: [ActionForbiddenError, ProductServiceError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/products")
  )
  .add(
    HttpApiGroup.make("product_perks")
      .add(
        HttpApiEndpoint.get("listProductPerksByProductId", "/by-product-id/:productId", {
          params: { productId: Schema.String },
          success: Schema.Array(ProductPerk),
          error: [ActionForbiddenError, ProductPerkServiceError, ProductPerkValidationError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/product-perks")
  )
  .add(
    HttpApiGroup.make("sdk")
      .add(
        HttpApiEndpoint.get("getCustomer", "/get-customer", {
          success: SdkCustomer,
          headers: SdkHeaders,
          error: [AuthenticationError, SdkServiceError, SdkCustomerNotFoundError, SdkValidationError],
        })
      )
      .add(
        HttpApiEndpoint.post("identify", "/identify", {
          payload: SdkIdentifyBody,
          success: SdkCustomer,
          headers: SdkHeaders,
          error: [AuthenticationError, SdkServiceError, SdkValidationError, SdkCustomerAlreadyIdentifiedError],
        })
      )
      .add(
        HttpApiEndpoint.post("syncCustomerAttributes", "/sync-customer-attributes", {
          payload: SdkSyncCustomerAttributesBody,
          success: SdkCustomer,
          headers: SdkHeaders,
          error: [AuthenticationError, SdkServiceError, SdkValidationError],
        })
      )
      .add(
        HttpApiEndpoint.post("syncTransaction", "/sync-transaction", {
          payload: SdkSyncTransactionBody,
          success: SdkSyncTransactionResponse,
          headers: SdkHeaders,
          error: [AuthenticationError, SdkServiceError, SdkValidationError],
        })
      )
      .add(
        HttpApiEndpoint.post("evaluateFeatureFlags", "/evaluate-flags", {
          payload: EvaluateFeatureFlagsBody,
          success: SdkFeatureFlagsResponse,
          headers: SdkHeaders,
          error: [AuthenticationError, SdkServiceError],
        })
      )
      .add(
        HttpApiEndpoint.post("resolvePaywall", "/resolve-paywall", {
          payload: SdkResolvePaywallBody,
          success: Schema.NullOr(SdkResolvedPaywall),
          headers: SdkHeaders,
          error: [AuthenticationError, SdkServiceError, SdkValidationError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/sdk")
  )
  .add(
    HttpApiGroup.make("users")
      .add(
        HttpApiEndpoint.get("getUser", "/current", {
          success: User,
          error: [AuthenticationError, UserServiceError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/users")
  )
  .add(
    HttpApiGroup.make("payment_provider_configurations")
      .add(
        HttpApiEndpoint.get("listPaymentProviderConfigurations", "/", {
          success: Schema.Array(PaymentProviderConfiguration),
          error: [ActionForbiddenError, PaymentProviderConfigurationServiceError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/payment-provider-configurations")
  )
  .add(
    HttpApiGroup.make("payment_provider_products")
      .add(
        HttpApiEndpoint.get("listPaymentProviderProducts", "/", {
          success: Schema.Array(PaymentProviderProduct),
          error: [ActionForbiddenError, PaymentProviderProductServiceError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/payment-provider-products")
  )
  .add(
    HttpApiGroup.make("changesets")
      .add(
        HttpApiEndpoint.post("deployChangeset", "/deploy", {
          payload: DeployChangesetBody,
          success: DeployChangesetResponse,
          error: [AuthenticationError, ActionForbiddenError, ChangesetDeploymentServiceError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/changesets")
  )
  .add(
    HttpApiGroup.make("webhooks")
      .add(
        HttpApiEndpoint.post("createWebhookEndpoint", "/endpoints", {
          payload: CreateWebhookEndpointBody,
          success: WebhookEndpoint,
          error: [ActionForbiddenError, WebhookValidationError, WebhookServiceError],
        })
      )
      .add(
        HttpApiEndpoint.get("listWebhookEndpoints", "/endpoints", {
          success: Schema.Array(WebhookEndpoint),
          error: [ActionForbiddenError, WebhookServiceError],
        })
      )
      .add(
        HttpApiEndpoint.get("getWebhookEndpoint", "/endpoints/:endpointId", {
          params: { endpointId: Schema.String },
          success: WebhookEndpoint,
          error: [ActionForbiddenError, WebhookEndpointNotFoundError, WebhookServiceError],
        })
      )
      .add(
        HttpApiEndpoint.patch("updateWebhookEndpoint", "/endpoints/:endpointId", {
          params: { endpointId: Schema.String },
          payload: UpdateWebhookEndpointBody,
          success: WebhookEndpoint,
          error: [ActionForbiddenError, WebhookEndpointNotFoundError, WebhookValidationError, WebhookServiceError],
        })
      )
      .add(
        HttpApiEndpoint.delete("deleteWebhookEndpoint", "/endpoints/:endpointId", {
          params: { endpointId: Schema.String },
          error: [ActionForbiddenError, WebhookEndpointNotFoundError, WebhookServiceError],
        })
      )
      .add(
        HttpApiEndpoint.post("rotateWebhookSecret", "/endpoints/:endpointId/rotate-secret", {
          params: { endpointId: Schema.String },
          success: WebhookEndpoint,
          error: [ActionForbiddenError, WebhookEndpointNotFoundError, WebhookServiceError],
        })
      )
      .add(
        HttpApiEndpoint.post("testWebhookEndpoint", "/endpoints/:endpointId/test", {
          params: { endpointId: Schema.String },
          success: WebhookDelivery,
          error: [ActionForbiddenError, WebhookEndpointNotFoundError, WebhookServiceError],
        })
      )
      .add(
        HttpApiEndpoint.get("listWebhookDeliveries", "/deliveries", {
          success: Schema.Array(WebhookDelivery),
          error: [ActionForbiddenError, WebhookServiceError],
        })
      )
      .add(
        HttpApiEndpoint.get("getWebhookDelivery", "/deliveries/:deliveryId", {
          params: { deliveryId: Schema.String },
          success: WebhookDeliveryWithAttempts,
          error: [ActionForbiddenError, WebhookDeliveryNotFoundError, WebhookServiceError],
        })
      )
      .add(
        HttpApiEndpoint.post("retryWebhookDelivery", "/deliveries/:deliveryId/retry", {
          params: { deliveryId: Schema.String },
          success: WebhookDelivery,
          error: [ActionForbiddenError, WebhookDeliveryNotFoundError, WebhookValidationError, WebhookServiceError],
        })
      )
      .middleware(AuthMiddleware)
      .prefix("/webhooks")
  )

  .prefix("/api/v1");
