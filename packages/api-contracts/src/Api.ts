import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiApiKeyNotFoundError,
  ApiApiKeyServiceError,
  ApiAuthenticationError,
  ApiDeployBlobHashMismatchError,
  ApiDeployBlobNotDeclaredError,
  ApiIncompleteDeployError,
  ApiOrganizationServiceError,
  ApiPaymentProviderConfigurationServiceError,
  ApiPaymentProviderProductServiceError,
  ApiPaywallDeployNotFoundError,
  ApiPaywallDeployNotPendingError,
  ApiPaywallDeployServiceError,
  ApiPaywallDeployUpgradeRequiredError,
  ApiPaywallDeployValidationError,
  ApiPaywallLocationServiceError,
  ApiPerkServiceError,
  ApiPersonInvalidAnonymousIdError,
  ApiPersonNotFoundError,
  ApiPersonServiceError,
  ApiProductPerkServiceError,
  ApiProductPerkValidationError,
  ApiProductServiceError,
  ApiProjectServiceError,
  ApiPushDeviceNotFoundError,
  ApiPushDeviceServiceError,
  ApiPushDeviceValidationError,
  ApiPushSendNotEnabledError,
  ApiPushSendServiceError,
  ApiSchemaServiceError,
  ApiSdkPersonAlreadyIdentifiedError,
  ApiSdkPersonNotFoundError,
  ApiSdkServiceError,
  ApiSdkValidationError,
  ApiUserServiceError,
  ApiWebhookDeliveryNotFoundError,
  ApiWebhookEndpointNotFoundError,
  ApiWebhookServiceError,
  ApiWebhookValidationError,
} from "./errors/index.ts";
import { AuthMiddleware } from "./Middlewares.ts";
import {
  ApiKey,
  ApiKeyWithRawKey,
  CreateOrganizationBody,
  CreatePaywallDeployResponse,
  CreatePersonBody,
  CreateProjectBody,
  CreateSecretKeyBody,
  CreateWebhookEndpointBody,
  EvaluateFeatureFlagsBody,
  FinalizePaywallDeployResponse,
  Organization,
  PaymentProviderConfiguration,
  PaymentProviderProduct,
  PaywallDeployBlobBody,
  PaywallDeployManifestBody,
  PaywallLocation,
  Perk,
  Person,
  Product,
  ProductPerk,
  Project,
  ProjectSchemaResponse,
  RefreshDeviceBody,
  RegisterDeviceBody,
  RegisterDeviceResponse,
  SchemaVersion,
  SendNotificationBody,
  SendNotificationResponse,
  SdkFeatureFlagsResponse,
  SdkHeaders,
  SdkIdentifyBody,
  SdkPerson,
  SdkResolvePaywallBody,
  SdkResolvedPaywall,
  SdkSchema,
  SdkSyncPersonAttributesBody,
  SdkSyncTransactionBody,
  SdkSyncTransactionResponse,
  Session,
  UnregisterDeviceBody,
  UpdateWebhookEndpointBody,
  UploadPaywallDeployBlobResponse,
  User,
  WebhookDelivery,
  WebhookDeliveryWithAttempts,
  WebhookEndpoint,
} from "./Schema.ts";

export const VoidhashV1Api = HttpApi.make("VoidhashV1Api")
  .add(
    HttpApiGroup.make("auth")
      .add(
        HttpApiEndpoint.get("session", "/session", {
          success: Session,
          error: [ApiActionForbiddenError],
        }).middleware(AuthMiddleware),
      )
      .prefix("/auth"),
  )
  .add(
    HttpApiGroup.make("api_keys")
      .add(
        HttpApiEndpoint.post("createSecretKey", "/", {
          success: ApiKeyWithRawKey,
          payload: CreateSecretKeyBody,
          error: [ApiApiKeyServiceError, ApiActionForbiddenError],
        }),
      )
      .add(
        HttpApiEndpoint.get("listApiKeys", "/", {
          success: Schema.Array(ApiKey),
          error: [ApiApiKeyServiceError, ApiActionForbiddenError],
        }),
      )
      .add(
        HttpApiEndpoint.get("getApiKeyById", "/:apiKeyId", {
          params: { apiKeyId: Schema.String },
          success: ApiKey,
          error: [ApiApiKeyServiceError, ApiApiKeyNotFoundError, ApiActionForbiddenError],
        }),
      )
      .add(
        HttpApiEndpoint.post("rotateSecretKey", "/:apiKeyId/rotate", {
          params: { apiKeyId: Schema.String },
          success: ApiKeyWithRawKey,
          error: [ApiApiKeyServiceError, ApiApiKeyNotFoundError, ApiActionForbiddenError],
        }),
      )
      .add(
        HttpApiEndpoint.delete("deleteApiKey", "/:apiKeyId", {
          params: { apiKeyId: Schema.String },
          error: [ApiApiKeyServiceError, ApiApiKeyNotFoundError, ApiActionForbiddenError],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/api-keys"),
  )
  .add(
    HttpApiGroup.make("persons")
      .add(
        HttpApiEndpoint.post("createPerson", "/", {
          payload: CreatePersonBody,
          success: Person,
          error: [ApiActionForbiddenError, ApiPersonInvalidAnonymousIdError, ApiPersonServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.get("listPersons", "/", {
          success: Schema.Array(Person),
          error: [ApiActionForbiddenError, ApiPersonServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.get("getPersonById", "/:personId", {
          params: { personId: Schema.String },
          success: Person,
          error: [ApiActionForbiddenError, ApiPersonNotFoundError, ApiPersonServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.get("getPersonByDistinctId", "/by-distinct-id/:distinctId", {
          params: { distinctId: Schema.String },
          success: Person,
          error: [ApiActionForbiddenError, ApiPersonNotFoundError, ApiPersonServiceError],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/persons"),
  )
  .add(
    HttpApiGroup.make("notifications")
      .add(
        // Server-to-server push dispatch. Secret-key auth (server-side only —
        // clients must never be able to push to arbitrary persons) and gated by
        // the `notifications` internal feature flag.
        HttpApiEndpoint.post("sendNotification", "/send", {
          payload: SendNotificationBody,
          success: SendNotificationResponse,
          error: [
            ApiActionForbiddenError,
            ApiAuthenticationError,
            ApiPushDeviceValidationError,
            ApiPushSendNotEnabledError,
            ApiPushSendServiceError,
          ],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/notifications"),
  )
  .add(
    HttpApiGroup.make("organizations")
      .add(
        HttpApiEndpoint.post("createOrganization", "/", {
          payload: CreateOrganizationBody,
          success: Organization,
          error: [ApiOrganizationServiceError],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/organizations"),
  )
  .add(
    HttpApiGroup.make("perks")
      .add(
        HttpApiEndpoint.get("listPerks", "/", {
          success: Schema.Array(Perk),
          error: [ApiActionForbiddenError, ApiPerkServiceError],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/perks"),
  )
  .add(
    HttpApiGroup.make("paywall_deploys")
      .add(
        HttpApiEndpoint.post("createDeploy", "/", {
          payload: PaywallDeployManifestBody,
          success: CreatePaywallDeployResponse.pipe(HttpApiSchema.status(201)),
          error: [
            ApiActionForbiddenError,
            ApiPaywallDeployServiceError,
            ApiPaywallDeployUpgradeRequiredError,
            ApiPaywallDeployValidationError,
          ],
        }),
      )
      .add(
        HttpApiEndpoint.put("uploadBlob", "/:deployId/blobs/:sha256", {
          params: { deployId: Schema.String, sha256: Schema.String },
          payload: PaywallDeployBlobBody,
          success: UploadPaywallDeployBlobResponse,
          error: [
            ApiActionForbiddenError,
            ApiDeployBlobHashMismatchError,
            ApiDeployBlobNotDeclaredError,
            ApiPaywallDeployNotFoundError,
            ApiPaywallDeployNotPendingError,
            ApiPaywallDeployServiceError,
            // §1.1 size validation on the actual uploaded bytes (422).
            ApiPaywallDeployValidationError,
          ],
        }),
      )
      .add(
        HttpApiEndpoint.post("finalizeDeploy", "/:deployId/finalize", {
          params: { deployId: Schema.String },
          success: FinalizePaywallDeployResponse,
          error: [
            ApiActionForbiddenError,
            ApiIncompleteDeployError,
            ApiPaywallDeployNotFoundError,
            ApiPaywallDeployServiceError,
            ApiPaywallDeployValidationError,
          ],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/paywall-deploys"),
  )
  .add(
    HttpApiGroup.make("paywall_locations")
      .add(
        HttpApiEndpoint.get("listPaywallLocations", "/", {
          success: Schema.Array(PaywallLocation),
          error: [ApiActionForbiddenError, ApiPaywallLocationServiceError],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/paywall-locations"),
  )
  .add(
    HttpApiGroup.make("schema")
      .add(
        HttpApiEndpoint.get("getSchema", "/", {
          success: ProjectSchemaResponse,
          error: [ApiActionForbiddenError, ApiSchemaServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.get("getSchemaVersion", "/version", {
          success: SchemaVersion,
          error: [ApiActionForbiddenError, ApiSchemaServiceError],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/schema"),
  )
  .add(
    HttpApiGroup.make("projects")
      .add(
        HttpApiEndpoint.post("createProject", "/", {
          payload: CreateProjectBody,
          success: Project,
          error: [ApiActionForbiddenError, ApiAuthenticationError, ApiProjectServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.get("listProjects", "/:organizationId", {
          params: { organizationId: Schema.String },
          success: Schema.Array(Project),
          error: [ApiActionForbiddenError, ApiProjectServiceError],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/projects"),
  )
  .add(
    HttpApiGroup.make("products")
      .add(
        HttpApiEndpoint.get("listProducts", "/", {
          success: Schema.Array(Product),
          error: [ApiActionForbiddenError, ApiProductServiceError],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/products"),
  )
  .add(
    HttpApiGroup.make("product_perks")
      .add(
        HttpApiEndpoint.get("listProductPerksByProductId", "/by-product-id/:productId", {
          params: { productId: Schema.String },
          success: Schema.Array(ProductPerk),
          error: [
            ApiActionForbiddenError,
            ApiProductPerkServiceError,
            ApiProductPerkValidationError,
          ],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/product-perks"),
  )
  .add(
    HttpApiGroup.make("sdk")
      .add(
        HttpApiEndpoint.get("getPerson", "/person", {
          success: SdkPerson,
          headers: SdkHeaders,
          error: [
            ApiAuthenticationError,
            ApiSdkServiceError,
            ApiSdkPersonNotFoundError,
            ApiSdkValidationError,
          ],
        }),
      )
      .add(
        HttpApiEndpoint.post("identifyPerson", "/identify", {
          payload: SdkIdentifyBody,
          success: SdkPerson,
          headers: SdkHeaders,
          error: [
            ApiAuthenticationError,
            ApiSdkServiceError,
            ApiSdkValidationError,
            ApiSdkPersonAlreadyIdentifiedError,
            ApiSdkPersonNotFoundError,
          ],
        }),
      )
      .add(
        HttpApiEndpoint.post("syncPersonAttributes", "/person/traits", {
          payload: SdkSyncPersonAttributesBody,
          success: SdkPerson,
          headers: SdkHeaders,
          error: [
            ApiAuthenticationError,
            ApiSdkPersonNotFoundError,
            ApiSdkServiceError,
            ApiSdkValidationError,
          ],
        }),
      )
      .add(
        HttpApiEndpoint.post("syncTransaction", "/sync-transaction", {
          payload: SdkSyncTransactionBody,
          success: SdkSyncTransactionResponse,
          headers: SdkHeaders,
          error: [ApiAuthenticationError, ApiSdkServiceError, ApiSdkValidationError],
        }),
      )
      .add(
        HttpApiEndpoint.post("evaluateFeatureFlags", "/evaluate-flags", {
          payload: EvaluateFeatureFlagsBody,
          success: SdkFeatureFlagsResponse,
          headers: SdkHeaders,
          error: [ApiAuthenticationError, ApiSdkServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.post("resolvePaywall", "/resolve-paywall", {
          payload: SdkResolvePaywallBody,
          success: Schema.NullOr(SdkResolvedPaywall),
          headers: SdkHeaders,
          error: [ApiAuthenticationError, ApiSdkServiceError, ApiSdkValidationError],
        }),
      )
      .add(
        HttpApiEndpoint.get("getSchema", "/schema", {
          success: SdkSchema,
          headers: SdkHeaders,
          error: [ApiAuthenticationError, ApiSchemaServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.post("registerDevice", "/push-devices/register", {
          payload: RegisterDeviceBody,
          success: RegisterDeviceResponse,
          headers: SdkHeaders,
          error: [
            ApiActionForbiddenError,
            ApiAuthenticationError,
            ApiPushDeviceServiceError,
            ApiPushDeviceValidationError,
            ApiPushDeviceNotFoundError,
          ],
        }),
      )
      .add(
        HttpApiEndpoint.post("refreshDevice", "/push-devices/refresh", {
          payload: RefreshDeviceBody,
          success: Schema.Void,
          headers: SdkHeaders,
          error: [
            ApiActionForbiddenError,
            ApiAuthenticationError,
            ApiPushDeviceServiceError,
            ApiPushDeviceValidationError,
            ApiPushDeviceNotFoundError, // uniform: not-found OR not-owned
          ],
        }),
      )
      .add(
        HttpApiEndpoint.post("unregisterDevice", "/push-devices/unregister", {
          payload: UnregisterDeviceBody,
          success: Schema.Void,
          headers: SdkHeaders,
          error: [
            ApiActionForbiddenError,
            ApiAuthenticationError,
            ApiPushDeviceServiceError,
            ApiPushDeviceNotFoundError, // uniform: no existence oracle
          ],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/sdk"),
  )
  .add(
    HttpApiGroup.make("users")
      .add(
        HttpApiEndpoint.get("getUser", "/current", {
          success: User,
          error: [ApiAuthenticationError, ApiUserServiceError],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/users"),
  )
  .add(
    HttpApiGroup.make("payment_provider_configurations")
      .add(
        HttpApiEndpoint.get("listPaymentProviderConfigurations", "/", {
          success: Schema.Array(PaymentProviderConfiguration),
          error: [ApiActionForbiddenError, ApiPaymentProviderConfigurationServiceError],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/payment-provider-configurations"),
  )
  .add(
    HttpApiGroup.make("payment_provider_products")
      .add(
        HttpApiEndpoint.get("listPaymentProviderProducts", "/", {
          success: Schema.Array(PaymentProviderProduct),
          error: [ApiActionForbiddenError, ApiPaymentProviderProductServiceError],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/payment-provider-products"),
  )
  .add(
    HttpApiGroup.make("webhooks")
      .add(
        HttpApiEndpoint.post("createWebhookEndpoint", "/endpoints", {
          payload: CreateWebhookEndpointBody,
          success: WebhookEndpoint,
          error: [ApiActionForbiddenError, ApiWebhookValidationError, ApiWebhookServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.get("listWebhookEndpoints", "/endpoints", {
          success: Schema.Array(WebhookEndpoint),
          error: [ApiActionForbiddenError, ApiWebhookServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.get("getWebhookEndpoint", "/endpoints/:endpointId", {
          params: { endpointId: Schema.String },
          success: WebhookEndpoint,
          error: [ApiActionForbiddenError, ApiWebhookEndpointNotFoundError, ApiWebhookServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.patch("updateWebhookEndpoint", "/endpoints/:endpointId", {
          params: { endpointId: Schema.String },
          payload: UpdateWebhookEndpointBody,
          success: WebhookEndpoint,
          error: [
            ApiActionForbiddenError,
            ApiWebhookEndpointNotFoundError,
            ApiWebhookValidationError,
            ApiWebhookServiceError,
          ],
        }),
      )
      .add(
        HttpApiEndpoint.delete("deleteWebhookEndpoint", "/endpoints/:endpointId", {
          params: { endpointId: Schema.String },
          error: [ApiActionForbiddenError, ApiWebhookEndpointNotFoundError, ApiWebhookServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.post("rotateWebhookSecret", "/endpoints/:endpointId/rotate-secret", {
          params: { endpointId: Schema.String },
          success: WebhookEndpoint,
          error: [ApiActionForbiddenError, ApiWebhookEndpointNotFoundError, ApiWebhookServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.post("testWebhookEndpoint", "/endpoints/:endpointId/test", {
          params: { endpointId: Schema.String },
          success: WebhookDelivery,
          error: [ApiActionForbiddenError, ApiWebhookEndpointNotFoundError, ApiWebhookServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.get("listWebhookDeliveries", "/deliveries", {
          success: Schema.Array(WebhookDelivery),
          error: [ApiActionForbiddenError, ApiWebhookServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.get("getWebhookDelivery", "/deliveries/:deliveryId", {
          params: { deliveryId: Schema.String },
          success: WebhookDeliveryWithAttempts,
          error: [ApiActionForbiddenError, ApiWebhookDeliveryNotFoundError, ApiWebhookServiceError],
        }),
      )
      .add(
        HttpApiEndpoint.post("retryWebhookDelivery", "/deliveries/:deliveryId/retry", {
          params: { deliveryId: Schema.String },
          success: WebhookDelivery,
          error: [
            ApiActionForbiddenError,
            ApiWebhookDeliveryNotFoundError,
            ApiWebhookValidationError,
            ApiWebhookServiceError,
          ],
        }),
      )
      .middleware(AuthMiddleware)
      .prefix("/webhooks"),
  )
  .prefix("/api/v1");
