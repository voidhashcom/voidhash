import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import {
  ApiActionForbiddenError,
  ApiAuthenticationError,
  ApiPushDeviceNotFoundError,
  ApiPushDeviceServiceError,
  ApiPushDeviceValidationError,
  ApiSchemaServiceError,
  ApiSdkPersonAlreadyIdentifiedError,
  ApiSdkPersonNotFoundError,
  ApiSdkServiceError,
  ApiSdkValidationError,
} from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import {
  EvaluateFeatureFlagsBody,
  RefreshDeviceBody,
  RegisterDeviceBody,
  RegisterDeviceResponse,
  SdkDevelopmentPurchaseBody,
  SdkDevelopmentPurchaseResponse,
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
  UnregisterDeviceBody,
} from "../Schema.ts";

export const SdkGroup = HttpApiGroup.make("sdk")
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
    HttpApiEndpoint.post("developmentPurchase", "/development/purchase", {
      payload: SdkDevelopmentPurchaseBody,
      success: SdkDevelopmentPurchaseResponse,
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
  /**
   * The SDK-shaped projection of the project schema. Distinct from
   * `schema.getSchema` (`GET /schema`), which serves the management shape —
   * the ids differ so generated clients keep both.
   */
  .add(
    HttpApiEndpoint.get("getSdkSchema", "/schema", {
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
  .prefix("/sdk");
