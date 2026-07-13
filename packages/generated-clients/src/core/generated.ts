import type * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

export type AuthSession200MethodEnum = "secret-key";

export interface AuthSession200 {
  readonly method: AuthSession200MethodEnum | AuthSession200MethodEnum | AuthSession200MethodEnum;
  readonly name: string;
  readonly organizations: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }>;
  readonly projects: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly organizationId: string;
    readonly slug: string;
  }>;
}

export type EffectHttpApiSchemaErrorTag = "HttpApiSchemaError";

export interface EffectHttpApiSchemaError {
  readonly _tag: EffectHttpApiSchemaErrorTag;
  readonly message: string;
}

export type ApiActionForbiddenErrorTag = "Api/ActionForbiddenError";

export interface ApiActionForbiddenError {
  readonly _tag: ApiActionForbiddenErrorTag;
  readonly message: string;
}

export type ApiAuthenticationErrorTag = "Api/AuthenticationError";

export interface ApiAuthenticationError {
  readonly _tag: ApiAuthenticationErrorTag;
  readonly cause: string;
  readonly message: string;
}

export type ApiNotAuthenticatedErrorTag = "Api/NotAuthenticatedError";

export interface ApiNotAuthenticatedError {
  readonly _tag: ApiNotAuthenticatedErrorTag;
  readonly message: string;
}

export type AuthSession500 = ApiAuthenticationError | ApiNotAuthenticatedError;

export interface ApiKey {
  readonly end: string;
  readonly id: string;
  readonly isPublic: boolean;
  readonly name: string;
  readonly prefix: string;
  readonly projectId: string;
  readonly rawKey?: string | null | undefined;
}

export type ApiKeysListApiKeys200 = ReadonlyArray<ApiKey>;

export type ApiApiKeyServiceErrorTag = "Api/ApiKeyServiceError";

export interface ApiApiKeyServiceError {
  readonly _tag: ApiApiKeyServiceErrorTag;
  readonly cause: string;
}

export type ApiKeysListApiKeys500 =
  | ApiApiKeyServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface CreateSecretKeyBody {
  readonly name: string;
  readonly projectId: string;
}

export interface ApiKeyWithRawKey {
  readonly end: string;
  readonly id: string;
  readonly isPublic: boolean;
  readonly name: string;
  readonly prefix: string;
  readonly projectId: string;
  readonly rawKey: string;
}

export type ApiKeysCreateSecretKey500 =
  | ApiApiKeyServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type ApiApiKeyNotFoundErrorTag = "Api/ApiKeyNotFoundError";

export interface ApiApiKeyNotFoundError {
  readonly _tag: ApiApiKeyNotFoundErrorTag;
  readonly message: string;
}

export type ApiKeysGetApiKeyById500 =
  | ApiApiKeyServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type ApiKeysDeleteApiKey500 =
  | ApiApiKeyServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type ApiKeysRotateSecretKey500 =
  | ApiApiKeyServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface Person {
  readonly personId: string;
  readonly distinctId: string;
  readonly email: string | null;
  readonly name: string | null;
}

export type PersonsListPersons200 = ReadonlyArray<Person>;

export type ApiPersonServiceErrorTag = "Api/PersonServiceError";

export interface ApiPersonServiceError {
  readonly _tag: ApiPersonServiceErrorTag;
  readonly cause: string;
}

export type PersonsListPersons500 =
  | ApiPersonServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface CreatePersonBody {
  readonly distinctId: string;
  readonly email?: string | null | undefined;
  readonly name?: string | null | undefined;
}

export type ApiPersonInvalidAnonymousIdErrorTag = "Api/PersonInvalidAnonymousIdError";

export interface ApiPersonInvalidAnonymousIdError {
  readonly _tag: ApiPersonInvalidAnonymousIdErrorTag;
  readonly id: string;
}

export type PersonsCreatePerson400 = ApiPersonInvalidAnonymousIdError | EffectHttpApiSchemaError;

export type PersonsCreatePerson500 =
  | ApiPersonServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type ApiPersonNotFoundErrorTag = "Api/PersonNotFoundError";

export interface ApiPersonNotFoundError {
  readonly _tag: ApiPersonNotFoundErrorTag;
  readonly id: string;
}

export type PersonsGetPersonById500 =
  | ApiPersonServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type PersonsGetPersonByDistinctId500 =
  | ApiPersonServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface CreateOrganizationBody {
  readonly name: string;
}

export interface Organization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export type ApiOrganizationServiceErrorTag = "Api/OrganizationServiceError";

export interface ApiOrganizationServiceError {
  readonly _tag: ApiOrganizationServiceErrorTag;
  readonly cause: string;
}

export type OrganizationsCreateOrganization500 =
  | ApiOrganizationServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface Perk {
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
}

export type PerksListPerks200 = ReadonlyArray<Perk>;

export type ApiPerkServiceErrorTag = "Api/PerkServiceError";

export interface ApiPerkServiceError {
  readonly _tag: ApiPerkServiceErrorTag;
  readonly cause: string;
}

export type PerksListPerks500 =
  | ApiPerkServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface PaywallLocation {
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
}

export type PaywallLocationsListPaywallLocations200 = ReadonlyArray<PaywallLocation>;

export type ApiPaywallLocationServiceErrorTag = "Api/PaywallLocationServiceError";

export interface ApiPaywallLocationServiceError {
  readonly _tag: ApiPaywallLocationServiceErrorTag;
  readonly cause: string;
}

export type PaywallLocationsListPaywallLocations500 =
  | ApiPaywallLocationServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface SchemaLocation {
  readonly description: string | null;
  readonly name: string;
  readonly slug: string;
}

export interface SchemaPerk {
  readonly name: string;
  readonly slug: string;
}

export type SchemaProductProviderProviderIdEnum = "appleAppStore" | "googlePlay";

export interface SchemaProductProvider {
  readonly configuration: Record<string, unknown>;
  readonly providerId: SchemaProductProviderProviderIdEnum | SchemaProductProviderProviderIdEnum;
}

export type SchemaProductType = "one-time" | "one-time-consumable" | "subscription";

export interface SchemaProduct {
  readonly name: string;
  readonly perks: ReadonlyArray<string>;
  readonly providers: ReadonlyArray<SchemaProductProvider>;
  readonly slug: string;
  readonly type: SchemaProductType;
}

export interface ProjectSchemaResponse {
  readonly enabledProviders: ReadonlyArray<"appleAppStore" | "googlePlay">;
  readonly locations: ReadonlyArray<SchemaLocation>;
  readonly perks: ReadonlyArray<SchemaPerk>;
  readonly products: ReadonlyArray<SchemaProduct>;
  readonly version: string;
}

export type ApiSchemaServiceErrorTag = "Api/SchemaServiceError";

export interface ApiSchemaServiceError {
  readonly _tag: ApiSchemaServiceErrorTag;
  readonly cause: string;
}

export type SchemaGetSchema500 =
  | ApiSchemaServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface SchemaVersion {
  readonly version: string;
}

export type SchemaGetSchemaVersion500 =
  | ApiSchemaServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface CreateProjectBody {
  readonly name: string;
  readonly organizationId: string;
}

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export type ApiProjectServiceErrorTag = "Api/ProjectServiceError";

export interface ApiProjectServiceError {
  readonly _tag: ApiProjectServiceErrorTag;
  readonly cause: string;
}

export type ProjectsCreateProject500 =
  | ApiAuthenticationError
  | ApiProjectServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type ProjectsListProjects200 = ReadonlyArray<Project>;

export type ProjectsListProjects500 =
  | ApiProjectServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type ProductTypeEnum = "one-time-consumable";

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly slug: string;
  readonly type: ProductTypeEnum | ProductTypeEnum | ProductTypeEnum;
}

export type ProductsListProducts200 = ReadonlyArray<Product>;

export type ApiProductServiceErrorTag = "Api/ProductServiceError";

export interface ApiProductServiceError {
  readonly _tag: ApiProductServiceErrorTag;
  readonly cause: string;
}

export type ProductsListProducts500 =
  | ApiProductServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface ProductPerk {
  readonly id: string;
  readonly perkId: string;
  readonly productId: string;
}

export type ProductPerksListProductPerksByProductId200 = ReadonlyArray<ProductPerk>;

export type ApiProductPerkValidationErrorTag = "Api/ProductPerkValidationError";

export interface ApiProductPerkValidationError {
  readonly _tag: ApiProductPerkValidationErrorTag;
  readonly message: string;
}

export type ProductPerksListProductPerksByProductId400 =
  | ApiProductPerkValidationError
  | EffectHttpApiSchemaError;

export type ApiProductPerkServiceErrorTag = "Api/ProductPerkServiceError";

export interface ApiProductPerkServiceError {
  readonly _tag: ApiProductPerkServiceErrorTag;
  readonly cause: string;
}

export type ProductPerksListProductPerksByProductId500 =
  | ApiProductPerkServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type SdkGetPersonParamsXIsBackgrounded = "false";

export type SdkGetPersonParamsXIsDebugBuildEnum = "false";

export type SdkGetPersonParamsXObserverModeEnum = "false";

export type SdkGetPersonParamsXPlatformFlavorEnum = "browser";

export type SdkGetPersonParamsXSdkEnum = "web";

export interface SdkGetPersonParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkGetPersonParamsXIsBackgrounded;
  readonly "x-is-debug-build":
    | SdkGetPersonParamsXIsDebugBuildEnum
    | SdkGetPersonParamsXIsDebugBuildEnum;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode":
    | SdkGetPersonParamsXObserverModeEnum
    | SdkGetPersonParamsXObserverModeEnum;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor":
    | SdkGetPersonParamsXPlatformFlavorEnum
    | SdkGetPersonParamsXPlatformFlavorEnum;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkGetPersonParamsXSdkEnum | SdkGetPersonParamsXSdkEnum;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
}

export type SdkEntitlementGrantSourceEnum = "manual";

export type SdkEntitlementGrantStatusEnum = "expired";

export interface SdkEntitlementGrant {
  readonly expiresAt: string | null;
  readonly perkId: string;
  readonly source:
    | SdkEntitlementGrantSourceEnum
    | SdkEntitlementGrantSourceEnum
    | SdkEntitlementGrantSourceEnum;
  readonly sourceId: string | null;
  readonly sourcePersonId: string;
  readonly status: SdkEntitlementGrantStatusEnum | SdkEntitlementGrantStatusEnum;
}

export type SdkPurchaseHistoryEntryTypeEnum = "subscription";

export interface SdkPurchaseHistoryEntry {
  readonly createdAt: string;
  readonly productId: string | null;
  readonly providerKey: string;
  readonly purchaseId: string;
  readonly sourcePersonId: string;
  readonly type: SdkPurchaseHistoryEntryTypeEnum | SdkPurchaseHistoryEntryTypeEnum;
}

export type SdkPersonSnapshotContextModeEnum = "temporary_pending_transfer";

export type SdkCurrentSubscriptionStatusEnum = "trialing";

export interface SdkCurrentSubscription {
  readonly expiresAt: string | null;
  readonly productId: string | null;
  readonly status:
    | SdkCurrentSubscriptionStatusEnum
    | SdkCurrentSubscriptionStatusEnum
    | SdkCurrentSubscriptionStatusEnum
    | SdkCurrentSubscriptionStatusEnum
    | SdkCurrentSubscriptionStatusEnum;
  readonly subscriptionId: string | null;
}

export type SdkSubscriptionHistoryEntryStatusEnum = "past_due";

export interface SdkSubscriptionHistoryEntry {
  readonly canceledAt: string | null;
  readonly expiresAt: string | null;
  readonly isTrial: boolean;
  readonly productId: string | null;
  readonly sourcePersonId: string;
  readonly startsAt: string;
  readonly status:
    | SdkSubscriptionHistoryEntryStatusEnum
    | SdkSubscriptionHistoryEntryStatusEnum
    | SdkSubscriptionHistoryEntryStatusEnum
    | SdkSubscriptionHistoryEntryStatusEnum
    | SdkSubscriptionHistoryEntryStatusEnum;
  readonly subscriptionId: string;
}

export interface SdkPerson {
  readonly distinctId: string;
  readonly email: string | null;
  readonly entitlements: {
    readonly grants: ReadonlyArray<SdkEntitlementGrant>;
  };
  readonly name: string | null;
  readonly personId: string;
  readonly purchases: {
    readonly history: ReadonlyArray<SdkPurchaseHistoryEntry>;
  };
  readonly snapshotContext: {
    readonly includedPersonIds: ReadonlyArray<string>;
    readonly migrationJobId: string | null;
    readonly mode: SdkPersonSnapshotContextModeEnum | SdkPersonSnapshotContextModeEnum;
  };
  readonly subscriptions: {
    readonly current: SdkCurrentSubscription | null;
    readonly history: ReadonlyArray<SdkSubscriptionHistoryEntry>;
  };
}

export type ApiSdkValidationErrorTag = "Api/SdkValidationError";

export interface ApiSdkValidationError {
  readonly _tag: ApiSdkValidationErrorTag;
  readonly message: string;
}

export type SdkGetPerson400 = ApiSdkValidationError | EffectHttpApiSchemaError;

export type ApiSdkPersonNotFoundErrorTag = "Api/SdkPersonNotFoundError";

export interface ApiSdkPersonNotFoundError {
  readonly _tag: ApiSdkPersonNotFoundErrorTag;
  readonly message: string;
}

export type ApiSdkServiceErrorTag = "Api/SdkServiceError";

export interface ApiSdkServiceError {
  readonly _tag: ApiSdkServiceErrorTag;
  readonly cause: string;
}

export type SdkGetPerson500 =
  | ApiAuthenticationError
  | ApiSdkServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type SdkIdentifyPersonParamsXIsBackgrounded = "false";

export type SdkIdentifyPersonParamsXIsDebugBuildEnum = "false";

export type SdkIdentifyPersonParamsXObserverModeEnum = "false";

export type SdkIdentifyPersonParamsXPlatformFlavorEnum = "browser";

export type SdkIdentifyPersonParamsXSdkEnum = "web";

export interface SdkIdentifyPersonParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkIdentifyPersonParamsXIsBackgrounded;
  readonly "x-is-debug-build":
    | SdkIdentifyPersonParamsXIsDebugBuildEnum
    | SdkIdentifyPersonParamsXIsDebugBuildEnum;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode":
    | SdkIdentifyPersonParamsXObserverModeEnum
    | SdkIdentifyPersonParamsXObserverModeEnum;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor":
    | SdkIdentifyPersonParamsXPlatformFlavorEnum
    | SdkIdentifyPersonParamsXPlatformFlavorEnum;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkIdentifyPersonParamsXSdkEnum | SdkIdentifyPersonParamsXSdkEnum;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
}

export interface SdkIdentifyBody {
  readonly distinctId: string;
  readonly email?: string | null | undefined;
  readonly name?: string | null | undefined;
  readonly traits?: Record<string, unknown> | null | undefined;
}

export type SdkIdentifyPerson400 = ApiSdkValidationError | EffectHttpApiSchemaError;

export type ApiSdkPersonAlreadyIdentifiedErrorTag = "Api/SdkPersonAlreadyIdentifiedError";

export interface ApiSdkPersonAlreadyIdentifiedError {
  readonly _tag: ApiSdkPersonAlreadyIdentifiedErrorTag;
  readonly distinctId: string;
}

export type SdkIdentifyPerson500 =
  | ApiAuthenticationError
  | ApiSdkServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type SdkSyncPersonAttributesParamsXIsBackgrounded = "false";

export type SdkSyncPersonAttributesParamsXIsDebugBuildEnum = "false";

export type SdkSyncPersonAttributesParamsXObserverModeEnum = "false";

export type SdkSyncPersonAttributesParamsXPlatformFlavorEnum = "browser";

export type SdkSyncPersonAttributesParamsXSdkEnum = "web";

export interface SdkSyncPersonAttributesParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkSyncPersonAttributesParamsXIsBackgrounded;
  readonly "x-is-debug-build":
    | SdkSyncPersonAttributesParamsXIsDebugBuildEnum
    | SdkSyncPersonAttributesParamsXIsDebugBuildEnum;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode":
    | SdkSyncPersonAttributesParamsXObserverModeEnum
    | SdkSyncPersonAttributesParamsXObserverModeEnum;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor":
    | SdkSyncPersonAttributesParamsXPlatformFlavorEnum
    | SdkSyncPersonAttributesParamsXPlatformFlavorEnum;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkSyncPersonAttributesParamsXSdkEnum | SdkSyncPersonAttributesParamsXSdkEnum;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
}

export interface SdkSyncPersonAttributesBody {
  readonly email?: string | null | undefined;
  readonly name?: string | null | undefined;
  readonly traits?: Record<string, unknown> | null | undefined;
  readonly setOnce?: Record<string, unknown> | null | undefined;
  readonly clientEventId?: string | null | undefined;
}

export type SdkSyncPersonAttributes400 = ApiSdkValidationError | EffectHttpApiSchemaError;

export type SdkSyncPersonAttributes500 =
  | ApiAuthenticationError
  | ApiSdkServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type SdkSyncTransactionParamsXIsBackgrounded = "false" | "true";

export type SdkSyncTransactionParamsXIsDebugBuildEnum = "false" | "true";

export type SdkSyncTransactionParamsXObserverModeEnum = "false" | "true";

export type SdkSyncTransactionParamsXPlatformFlavorEnum = "browser" | "native";

export type SdkSyncTransactionParamsXSdkEnum = "react-native" | "web";

export interface SdkSyncTransactionParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkSyncTransactionParamsXIsBackgrounded;
  readonly "x-is-debug-build":
    | SdkSyncTransactionParamsXIsDebugBuildEnum
    | SdkSyncTransactionParamsXIsDebugBuildEnum;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode":
    | SdkSyncTransactionParamsXObserverModeEnum
    | SdkSyncTransactionParamsXObserverModeEnum;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor":
    | SdkSyncTransactionParamsXPlatformFlavorEnum
    | SdkSyncTransactionParamsXPlatformFlavorEnum;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkSyncTransactionParamsXSdkEnum | SdkSyncTransactionParamsXSdkEnum;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
}

export type SdkSyncTransactionRequestPlatformEnum = "android" | "ios";

export type SdkSyncTransactionRequestPurchaseDateEnum = "-Infinity";

export type SdkSyncTransactionRequestQuantityEnum = "-Infinity";

export interface SdkSyncTransactionRequest {
  readonly appAccountToken?: string | null | undefined;
  readonly platform: SdkSyncTransactionRequestPlatformEnum | SdkSyncTransactionRequestPlatformEnum;
  readonly providerProductId?: string | null | undefined;
  readonly productSlug: string;
  readonly purchaseDate:
    | number
    | SdkSyncTransactionRequestPurchaseDateEnum
    | SdkSyncTransactionRequestPurchaseDateEnum
    | SdkSyncTransactionRequestPurchaseDateEnum;
  readonly purchaseToken?: string | null | undefined;
  readonly quantity:
    | number
    | SdkSyncTransactionRequestQuantityEnum
    | SdkSyncTransactionRequestQuantityEnum
    | SdkSyncTransactionRequestQuantityEnum;
  readonly receipt?: string | null | undefined;
  readonly transactionId: string;
}

export interface SdkSyncTransactionResponse {
  readonly accepted: boolean;
}

export type SdkSyncTransaction400 = ApiSdkValidationError | EffectHttpApiSchemaError;

export type SdkSyncTransaction500 =
  | ApiAuthenticationError
  | ApiSdkServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type SdkEvaluateFeatureFlagsParamsXIsBackgrounded = "false";

export type SdkEvaluateFeatureFlagsParamsXIsDebugBuildEnum = "false";

export type SdkEvaluateFeatureFlagsParamsXObserverModeEnum = "false";

export type SdkEvaluateFeatureFlagsParamsXPlatformFlavorEnum = "browser";

export type SdkEvaluateFeatureFlagsParamsXSdkEnum = "web";

export interface SdkEvaluateFeatureFlagsParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkEvaluateFeatureFlagsParamsXIsBackgrounded;
  readonly "x-is-debug-build":
    | SdkEvaluateFeatureFlagsParamsXIsDebugBuildEnum
    | SdkEvaluateFeatureFlagsParamsXIsDebugBuildEnum;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode":
    | SdkEvaluateFeatureFlagsParamsXObserverModeEnum
    | SdkEvaluateFeatureFlagsParamsXObserverModeEnum;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor":
    | SdkEvaluateFeatureFlagsParamsXPlatformFlavorEnum
    | SdkEvaluateFeatureFlagsParamsXPlatformFlavorEnum;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkEvaluateFeatureFlagsParamsXSdkEnum | SdkEvaluateFeatureFlagsParamsXSdkEnum;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
}

export interface EvaluateFeatureFlagsBody {
  readonly flagKeys?: ReadonlyArray<string> | null | undefined;
}

export interface SdkFeatureFlagResult {
  readonly enabled: boolean;
  readonly key: string;
  readonly variantKey: string | null;
}

export interface SdkFeatureFlagsResponse {
  readonly flags: ReadonlyArray<SdkFeatureFlagResult>;
}

export type SdkEvaluateFeatureFlags500 =
  | ApiAuthenticationError
  | ApiSdkServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type SdkResolvePaywallParamsXIsBackgrounded = "false";

export type SdkResolvePaywallParamsXIsDebugBuildEnum = "false";

export type SdkResolvePaywallParamsXObserverModeEnum = "false";

export type SdkResolvePaywallParamsXPlatformFlavorEnum = "browser";

export type SdkResolvePaywallParamsXSdkEnum = "web";

export interface SdkResolvePaywallParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkResolvePaywallParamsXIsBackgrounded;
  readonly "x-is-debug-build":
    | SdkResolvePaywallParamsXIsDebugBuildEnum
    | SdkResolvePaywallParamsXIsDebugBuildEnum;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode":
    | SdkResolvePaywallParamsXObserverModeEnum
    | SdkResolvePaywallParamsXObserverModeEnum;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor":
    | SdkResolvePaywallParamsXPlatformFlavorEnum
    | SdkResolvePaywallParamsXPlatformFlavorEnum;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkResolvePaywallParamsXSdkEnum | SdkResolvePaywallParamsXSdkEnum;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
}

export interface SdkResolvePaywallBody {
  readonly locationSlug: string;
}

export type SdkResolvedPaywallShowingPaywallReleaseEnumVersionEnum = "-Infinity";

export type SdkResolvedPaywallShowingTypeEnum = "feature_flag";

export interface SdkResolvedPaywallShowing {
  readonly id: string;
  readonly paywall: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  } | null;
  readonly paywallId: string | null;
  readonly paywallRelease: {
    readonly htmlUrl: string;
    readonly publishedAt: string | null;
    readonly releaseId: string;
    readonly version: number | "NaN" | "Infinity" | "-Infinity";
    // extended by hand for paywall-deploy contract §6 (code-release runtime block); keep when regenerating.
    // Optional/nullable on purpose: old servers omit it (visual-editor releases send null) and the
    // client decodes responses with a plain JSON cast, so absence must remain valid.
    readonly runtime?:
      | {
          readonly contentHash: string;
          readonly productSlugs: ReadonlyArray<string>;
          readonly variables: Readonly<Record<string, string | number | boolean>>;
        }
      | null
      | undefined;
  } | null;
  readonly paywallReleaseId: string | null;
  readonly startedAt: string;
  readonly type: SdkResolvedPaywallShowingTypeEnum | SdkResolvedPaywallShowingTypeEnum;
}

export interface SdkResolvedPaywall {
  readonly location: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  };
  readonly showing: SdkResolvedPaywallShowing;
}

export type SdkResolvePaywall200 = SdkResolvedPaywall | null;

export type SdkResolvePaywall400 = ApiSdkValidationError | EffectHttpApiSchemaError;

export type SdkResolvePaywall500 =
  | ApiAuthenticationError
  | ApiSdkServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type SdkGetSchemaParamsXIsBackgrounded = "false";

export type SdkGetSchemaParamsXIsDebugBuildEnum = "false";

export type SdkGetSchemaParamsXObserverModeEnum = "false";

export type SdkGetSchemaParamsXPlatformFlavorEnum = "browser";

export type SdkGetSchemaParamsXSdkEnum = "web";

export interface SdkGetSchemaParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkGetSchemaParamsXIsBackgrounded;
  readonly "x-is-debug-build":
    | SdkGetSchemaParamsXIsDebugBuildEnum
    | SdkGetSchemaParamsXIsDebugBuildEnum;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode":
    | SdkGetSchemaParamsXObserverModeEnum
    | SdkGetSchemaParamsXObserverModeEnum;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor":
    | SdkGetSchemaParamsXPlatformFlavorEnum
    | SdkGetSchemaParamsXPlatformFlavorEnum;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkGetSchemaParamsXSdkEnum | SdkGetSchemaParamsXSdkEnum;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
}

export interface SdkSchema {
  readonly locations: Record<string, unknown>;
  readonly perks: Record<string, unknown>;
  readonly products: Record<string, unknown>;
  readonly version: string;
}

export type SdkGetSchema500 =
  | ApiAuthenticationError
  | ApiSchemaServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface User {
  readonly createdAt: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly id: string;
  readonly image: string | null;
  readonly name: string;
  readonly organizations: ReadonlyArray<{
    readonly id: string;
    readonly logo: string | null;
    readonly name: string;
    readonly slug: string;
  }>;
  readonly projects: ReadonlyArray<{
    readonly id: string;
    readonly logo: string | null;
    readonly name: string;
    readonly organizationId: string;
    readonly slug: string;
  }>;
  readonly updatedAt: string;
}

export type ApiUserServiceErrorTag = "Api/UserServiceError";

export interface ApiUserServiceError {
  readonly _tag: ApiUserServiceErrorTag;
  readonly cause: string;
}

export type UsersGetUser500 =
  | ApiAuthenticationError
  | ApiUserServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface PaymentProviderConfiguration {
  readonly enabled: boolean;
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly providerId: string;
}

export type PaymentProviderConfigurationsListPaymentProviderConfigurations200 =
  ReadonlyArray<PaymentProviderConfiguration>;

export type ApiPaymentProviderConfigurationServiceErrorTag =
  "Api/PaymentProviderConfigurationServiceError";

export interface ApiPaymentProviderConfigurationServiceError {
  readonly _tag: ApiPaymentProviderConfigurationServiceErrorTag;
  readonly cause: string;
}

export type PaymentProviderConfigurationsListPaymentProviderConfigurations500 =
  | ApiPaymentProviderConfigurationServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface PaymentProviderProduct {
  readonly configuration: Record<string, unknown>;
  readonly id: string;
  readonly paymentProviderConfigurationId: string;
  readonly productId: string;
  readonly providerId: string;
}

export type PaymentProviderProductsListPaymentProviderProducts200 =
  ReadonlyArray<PaymentProviderProduct>;

export type ApiPaymentProviderProductServiceErrorTag = "Api/PaymentProviderProductServiceError";

export interface ApiPaymentProviderProductServiceError {
  readonly _tag: ApiPaymentProviderProductServiceErrorTag;
  readonly cause: string;
}

export type PaymentProviderProductsListPaymentProviderProducts500 =
  | ApiPaymentProviderProductServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type WebhookEndpointConsecutiveFailuresEnum = "-Infinity";

export type WebhookEndpointStatusEnum = "failed";

export interface WebhookEndpoint {
  readonly consecutiveFailures:
    | number
    | WebhookEndpointConsecutiveFailuresEnum
    | WebhookEndpointConsecutiveFailuresEnum
    | WebhookEndpointConsecutiveFailuresEnum;
  readonly createdAt: string | null;
  readonly description: string | null;
  readonly events: ReadonlyArray<
    | "person.created"
    | "person.updated"
    | "person.deleted"
    | "subscription.created"
    | "subscription.renewed"
    | "subscription.cancelled"
    | "subscription.expired"
    | "purchase.completed"
    | "purchase.refunded"
  >;
  readonly id: string;
  readonly lastSuccessAt: string | null;
  readonly name: string;
  readonly projectId: string;
  readonly secret: string;
  readonly status:
    | WebhookEndpointStatusEnum
    | WebhookEndpointStatusEnum
    | WebhookEndpointStatusEnum;
  readonly url: string;
}

export type WebhooksListWebhookEndpoints200 = ReadonlyArray<WebhookEndpoint>;

export type ApiWebhookServiceErrorTag = "Api/WebhookServiceError";

export interface ApiWebhookServiceError {
  readonly _tag: ApiWebhookServiceErrorTag;
  readonly cause: string;
}

export type WebhooksListWebhookEndpoints500 =
  | ApiWebhookServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export interface CreateWebhookEndpointBody {
  readonly description?: string | null | undefined;
  readonly events: ReadonlyArray<string>;
  readonly name: string;
  readonly url: string;
}

export type ApiWebhookValidationErrorTag = "Api/WebhookValidationError";

export interface ApiWebhookValidationError {
  readonly _tag: ApiWebhookValidationErrorTag;
  readonly message: string;
}

export type WebhooksCreateWebhookEndpoint400 = ApiWebhookValidationError | EffectHttpApiSchemaError;

export type WebhooksCreateWebhookEndpoint500 =
  | ApiWebhookServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type ApiWebhookEndpointNotFoundErrorTag = "Api/WebhookEndpointNotFoundError";

export interface ApiWebhookEndpointNotFoundError {
  readonly _tag: ApiWebhookEndpointNotFoundErrorTag;
  readonly endpointId: string;
}

export type WebhooksGetWebhookEndpoint500 =
  | ApiWebhookServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type WebhooksDeleteWebhookEndpoint500 =
  | ApiWebhookServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type UpdateWebhookEndpointBodyStatusEnum = "disabled";

export interface UpdateWebhookEndpointBody {
  readonly description?: string | null | null | undefined;
  readonly events?: ReadonlyArray<string> | null | undefined;
  readonly name?: string | null | undefined;
  readonly status?:
    | UpdateWebhookEndpointBodyStatusEnum
    | UpdateWebhookEndpointBodyStatusEnum
    | null
    | undefined;
  readonly url?: string | null | undefined;
}

export type WebhooksUpdateWebhookEndpoint400 = ApiWebhookValidationError | EffectHttpApiSchemaError;

export type WebhooksUpdateWebhookEndpoint500 =
  | ApiWebhookServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type WebhooksRotateWebhookSecret500 =
  | ApiWebhookServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type WebhookDeliveryAttemptCountEnum = "-Infinity";

export type WebhookDeliveryMaxAttemptsEnum = "-Infinity";

export type WebhookDeliveryStatusEnum = "exhausted";

export interface WebhookDelivery {
  readonly attemptCount:
    | number
    | WebhookDeliveryAttemptCountEnum
    | WebhookDeliveryAttemptCountEnum
    | WebhookDeliveryAttemptCountEnum;
  readonly completedAt: string | null;
  readonly createdAt: string | null;
  readonly eventOccurredAt: string;
  readonly eventType: string;
  readonly id: string;
  readonly maxAttempts:
    | number
    | WebhookDeliveryMaxAttemptsEnum
    | WebhookDeliveryMaxAttemptsEnum
    | WebhookDeliveryMaxAttemptsEnum;
  readonly nextAttemptAt: string | null;
  readonly payload: null;
  readonly projectId: string;
  readonly status:
    | WebhookDeliveryStatusEnum
    | WebhookDeliveryStatusEnum
    | WebhookDeliveryStatusEnum
    | WebhookDeliveryStatusEnum
    | WebhookDeliveryStatusEnum;
  readonly webhookEndpointId: string;
}

export type WebhooksTestWebhookEndpoint500 =
  | ApiWebhookServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type WebhooksListWebhookDeliveries200 = ReadonlyArray<WebhookDelivery>;

export type WebhooksListWebhookDeliveries500 =
  | ApiWebhookServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type WebhookDeliveryWithAttemptsAttemptCountEnum = "-Infinity";

export type WebhookDeliveryAttemptAttemptNumberEnum = "-Infinity";

export type WebhookDeliveryAttemptDurationMsEnum = "-Infinity";

export type WebhookDeliveryAttemptStatusCodeEnum = "-Infinity";

export interface WebhookDeliveryAttempt {
  readonly attemptNumber:
    | number
    | WebhookDeliveryAttemptAttemptNumberEnum
    | WebhookDeliveryAttemptAttemptNumberEnum
    | WebhookDeliveryAttemptAttemptNumberEnum;
  readonly createdAt: string | null;
  readonly durationMs:
    | number
    | WebhookDeliveryAttemptDurationMsEnum
    | WebhookDeliveryAttemptDurationMsEnum
    | WebhookDeliveryAttemptDurationMsEnum
    | null;
  readonly errorMessage: string | null;
  readonly id: string;
  readonly responseBody: string | null;
  readonly statusCode:
    | number
    | WebhookDeliveryAttemptStatusCodeEnum
    | WebhookDeliveryAttemptStatusCodeEnum
    | WebhookDeliveryAttemptStatusCodeEnum
    | null;
  readonly succeeded: boolean;
}

export type WebhookDeliveryWithAttemptsMaxAttemptsEnum = "-Infinity";

export type WebhookDeliveryWithAttemptsStatusEnum = "exhausted";

export interface WebhookDeliveryWithAttempts {
  readonly attemptCount:
    | number
    | WebhookDeliveryWithAttemptsAttemptCountEnum
    | WebhookDeliveryWithAttemptsAttemptCountEnum
    | WebhookDeliveryWithAttemptsAttemptCountEnum;
  readonly attempts: ReadonlyArray<WebhookDeliveryAttempt>;
  readonly completedAt: string | null;
  readonly createdAt: string | null;
  readonly eventOccurredAt: string;
  readonly eventType: string;
  readonly id: string;
  readonly maxAttempts:
    | number
    | WebhookDeliveryWithAttemptsMaxAttemptsEnum
    | WebhookDeliveryWithAttemptsMaxAttemptsEnum
    | WebhookDeliveryWithAttemptsMaxAttemptsEnum;
  readonly nextAttemptAt: string | null;
  readonly payload: null;
  readonly projectId: string;
  readonly status:
    | WebhookDeliveryWithAttemptsStatusEnum
    | WebhookDeliveryWithAttemptsStatusEnum
    | WebhookDeliveryWithAttemptsStatusEnum
    | WebhookDeliveryWithAttemptsStatusEnum
    | WebhookDeliveryWithAttemptsStatusEnum;
  readonly webhookEndpointId: string;
}

export type ApiWebhookDeliveryNotFoundErrorTag = "Api/WebhookDeliveryNotFoundError";

export interface ApiWebhookDeliveryNotFoundError {
  readonly _tag: ApiWebhookDeliveryNotFoundErrorTag;
  readonly deliveryId: string;
}

export type WebhooksGetWebhookDelivery500 =
  | ApiWebhookServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export type WebhooksRetryWebhookDelivery400 = ApiWebhookValidationError | EffectHttpApiSchemaError;

export type WebhooksRetryWebhookDelivery500 =
  | ApiWebhookServiceError
  | ApiAuthenticationError
  | ApiNotAuthenticatedError;

export const make = (
  httpClient: HttpClient.HttpClient,
  options: {
    readonly transformClient?:
      | ((client: HttpClient.HttpClient) => Effect.Effect<HttpClient.HttpClient>)
      | undefined;
  } = {},
): VoidhashCoreClient => {
  const unexpectedStatus = (response: HttpClientResponse.HttpClientResponse) =>
    Effect.flatMap(
      Effect.orElseSucceed(response.json, () => "Unexpected status code"),
      (description) =>
        Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.StatusCodeError({
              request: response.request,
              response,
              description:
                typeof description === "string" ? description : JSON.stringify(description),
            }),
          }),
        ),
    );
  const withResponse: <A, E>(
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, E>,
  ) => (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<any, any> =
    options.transformClient
      ? (f) => (request) =>
          Effect.flatMap(
            Effect.flatMap(options.transformClient!(httpClient), (client) =>
              client.execute(request),
            ),
            f,
          )
      : (f) => (request) => Effect.flatMap(httpClient.execute(request), f);
  const decodeSuccess = <A>(response: HttpClientResponse.HttpClientResponse) =>
    response.json as Effect.Effect<A, HttpClientError.HttpClientError>;
  const decodeVoid = (_response: HttpClientResponse.HttpClientResponse) => Effect.void;
  const decodeError =
    <Tag extends string, E>(tag: Tag) =>
    (
      response: HttpClientResponse.HttpClientResponse,
    ): Effect.Effect<never, VoidhashCoreClientError<Tag, E> | HttpClientError.HttpClientError> =>
      Effect.flatMap(response.json as Effect.Effect<E, HttpClientError.HttpClientError>, (cause) =>
        Effect.fail(VoidhashCoreClientError(tag, cause, response)),
      );
  const onRequest = (successCodes: ReadonlyArray<string>, errorCodes?: Record<string, string>) => {
    const cases: any = { orElse: unexpectedStatus };
    for (const code of successCodes) {
      cases[code] = decodeSuccess;
    }
    if (errorCodes) {
      for (const [code, tag] of Object.entries(errorCodes)) {
        cases[code] = decodeError(tag);
      }
    }
    if (successCodes.length === 0) {
      cases["2xx"] = decodeVoid;
    }
    return withResponse(HttpClientResponse.matchStatus(cases) as any);
  };
  return {
    httpClient,
    authSession: () =>
      HttpClientRequest.get(`/api/v1/auth/session`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "AuthSession500",
        }),
      ),
    apiKeysListApiKeys: () =>
      HttpClientRequest.get(`/api/v1/api-keys`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "ApiKeysListApiKeys500",
        }),
      ),
    apiKeysCreateSecretKey: (options) =>
      HttpClientRequest.post(`/api/v1/api-keys`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "ApiKeysCreateSecretKey500",
        }),
      ),
    apiKeysGetApiKeyById: (apiKeyId) =>
      HttpClientRequest.get(`/api/v1/api-keys/${apiKeyId}`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "404": "ApiApiKeyNotFoundError",
          "500": "ApiKeysGetApiKeyById500",
        }),
      ),
    apiKeysDeleteApiKey: (apiKeyId) =>
      HttpClientRequest.delete(`/api/v1/api-keys/${apiKeyId}`).pipe(
        onRequest([], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "404": "ApiApiKeyNotFoundError",
          "500": "ApiKeysDeleteApiKey500",
        }),
      ),
    apiKeysRotateSecretKey: (apiKeyId) =>
      HttpClientRequest.post(`/api/v1/api-keys/${apiKeyId}/rotate`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "404": "ApiApiKeyNotFoundError",
          "500": "ApiKeysRotateSecretKey500",
        }),
      ),
    personsListPersons: () =>
      HttpClientRequest.get(`/api/v1/persons`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "PersonsListPersons500",
        }),
      ),
    personsCreatePerson: (options) =>
      HttpClientRequest.post(`/api/v1/persons`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "PersonsCreatePerson400",
          "403": "ApiActionForbiddenError",
          "500": "PersonsCreatePerson500",
        }),
      ),
    personsGetPersonById: (personId) =>
      HttpClientRequest.get(`/api/v1/persons/${personId}`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "404": "ApiPersonNotFoundError",
          "500": "PersonsGetPersonById500",
        }),
      ),
    personsGetPersonByDistinctId: (distinctId) =>
      HttpClientRequest.get(`/api/v1/persons/by-distinct-id/${distinctId}`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "404": "ApiPersonNotFoundError",
          "500": "PersonsGetPersonByDistinctId500",
        }),
      ),
    organizationsCreateOrganization: (options) =>
      HttpClientRequest.post(`/api/v1/organizations`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "500": "OrganizationsCreateOrganization500",
        }),
      ),
    perksListPerks: () =>
      HttpClientRequest.get(`/api/v1/perks`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "PerksListPerks500",
        }),
      ),
    paywallLocationsListPaywallLocations: () =>
      HttpClientRequest.get(`/api/v1/paywall-locations`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "PaywallLocationsListPaywallLocations500",
        }),
      ),
    schemaGetSchema: () =>
      HttpClientRequest.get(`/api/v1/schema`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "SchemaGetSchema500",
        }),
      ),
    schemaGetSchemaVersion: () =>
      HttpClientRequest.get(`/api/v1/schema/version`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "SchemaGetSchemaVersion500",
        }),
      ),
    projectsCreateProject: (options) =>
      HttpClientRequest.post(`/api/v1/projects`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "ProjectsCreateProject500",
        }),
      ),
    projectsListProjects: (organizationId) =>
      HttpClientRequest.get(`/api/v1/projects/${organizationId}`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "ProjectsListProjects500",
        }),
      ),
    productsListProducts: () =>
      HttpClientRequest.get(`/api/v1/products`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "ProductsListProducts500",
        }),
      ),
    productPerksListProductPerksByProductId: (productId) =>
      HttpClientRequest.get(`/api/v1/product-perks/by-product-id/${productId}`).pipe(
        onRequest(["2xx"], {
          "400": "ProductPerksListProductPerksByProductId400",
          "403": "ApiActionForbiddenError",
          "500": "ProductPerksListProductPerksByProductId500",
        }),
      ),
    sdkGetPerson: (options) =>
      HttpClientRequest.get(`/api/v1/sdk/person`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options?.["x-client-locale"] ?? undefined,
          "x-client-version": options?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options?.["x-nonce"] ?? undefined,
          "x-observer-mode": options?.["x-observer-mode"] ?? undefined,
          "x-platform": options?.["x-platform"] ?? undefined,
          "x-platform-brand": options?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options?.["x-sdk"] ?? undefined,
          "x-sdk-version": options?.["x-sdk-version"] ?? undefined,
          "x-storefront": options?.["x-storefront"] ?? undefined,
        }),
        onRequest(["2xx"], {
          "400": "SdkGetPerson400",
          "404": "ApiSdkPersonNotFoundError",
          "500": "SdkGetPerson500",
        }),
      ),
    sdkIdentifyPerson: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/identify`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], {
          "400": "SdkIdentifyPerson400",
          "404": "ApiSdkPersonNotFoundError",
          "409": "ApiSdkPersonAlreadyIdentifiedError",
          "500": "SdkIdentifyPerson500",
        }),
      ),
    sdkSyncPersonAttributes: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/person/traits`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], {
          "400": "SdkSyncPersonAttributes400",
          "404": "ApiSdkPersonNotFoundError",
          "500": "SdkSyncPersonAttributes500",
        }),
      ),
    sdkSyncTransaction: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/sync-transaction`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], { "400": "SdkSyncTransaction400", "500": "SdkSyncTransaction500" }),
      ),
    sdkEvaluateFeatureFlags: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/evaluate-flags`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "500": "SdkEvaluateFeatureFlags500",
        }),
      ),
    sdkResolvePaywall: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/resolve-paywall`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options.params?.["x-client-locale"] ?? undefined,
          "x-client-version": options.params?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options.params?.["x-nonce"] ?? undefined,
          "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined,
          "x-platform": options.params?.["x-platform"] ?? undefined,
          "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options.params?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options.params?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options.params?.["x-sdk"] ?? undefined,
          "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined,
          "x-storefront": options.params?.["x-storefront"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], { "400": "SdkResolvePaywall400", "500": "SdkResolvePaywall500" }),
      ),
    sdkGetSchema: (options) =>
      HttpClientRequest.get(`/api/v1/sdk/schema`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options?.["x-distinct-id"] ?? undefined,
          "x-publishable-key": options?.["x-publishable-key"] ?? undefined,
          "x-client-bundle-id": options?.["x-client-bundle-id"] ?? undefined,
          "x-client-locale": options?.["x-client-locale"] ?? undefined,
          "x-client-version": options?.["x-client-version"] ?? undefined,
          "x-is-backgrounded": options?.["x-is-backgrounded"] ?? undefined,
          "x-is-debug-build": options?.["x-is-debug-build"] ?? undefined,
          "x-nonce": options?.["x-nonce"] ?? undefined,
          "x-observer-mode": options?.["x-observer-mode"] ?? undefined,
          "x-platform": options?.["x-platform"] ?? undefined,
          "x-platform-brand": options?.["x-platform-brand"] ?? undefined,
          "x-platform-device": options?.["x-platform-device"] ?? undefined,
          "x-platform-flavor": options?.["x-platform-flavor"] ?? undefined,
          "x-platform-flavor-version": options?.["x-platform-flavor-version"] ?? undefined,
          "x-platform-version": options?.["x-platform-version"] ?? undefined,
          "x-preferred-locales": options?.["x-preferred-locales"] ?? undefined,
          "x-sdk": options?.["x-sdk"] ?? undefined,
          "x-sdk-version": options?.["x-sdk-version"] ?? undefined,
          "x-storefront": options?.["x-storefront"] ?? undefined,
        }),
        onRequest(["2xx"], { "400": "EffectHttpApiSchemaError", "500": "SdkGetSchema500" }),
      ),
    usersGetUser: () =>
      HttpClientRequest.get(`/api/v1/users/current`).pipe(
        onRequest(["2xx"], { "400": "EffectHttpApiSchemaError", "500": "UsersGetUser500" }),
      ),
    paymentProviderConfigurationsListPaymentProviderConfigurations: () =>
      HttpClientRequest.get(`/api/v1/payment-provider-configurations`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "PaymentProviderConfigurationsListPaymentProviderConfigurations500",
        }),
      ),
    paymentProviderProductsListPaymentProviderProducts: () =>
      HttpClientRequest.get(`/api/v1/payment-provider-products`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "PaymentProviderProductsListPaymentProviderProducts500",
        }),
      ),
    webhooksListWebhookEndpoints: () =>
      HttpClientRequest.get(`/api/v1/webhooks/endpoints`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "WebhooksListWebhookEndpoints500",
        }),
      ),
    webhooksCreateWebhookEndpoint: (options) =>
      HttpClientRequest.post(`/api/v1/webhooks/endpoints`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "WebhooksCreateWebhookEndpoint400",
          "403": "ApiActionForbiddenError",
          "500": "WebhooksCreateWebhookEndpoint500",
        }),
      ),
    webhooksGetWebhookEndpoint: (endpointId) =>
      HttpClientRequest.get(`/api/v1/webhooks/endpoints/${endpointId}`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "404": "ApiWebhookEndpointNotFoundError",
          "500": "WebhooksGetWebhookEndpoint500",
        }),
      ),
    webhooksDeleteWebhookEndpoint: (endpointId) =>
      HttpClientRequest.delete(`/api/v1/webhooks/endpoints/${endpointId}`).pipe(
        onRequest([], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "404": "ApiWebhookEndpointNotFoundError",
          "500": "WebhooksDeleteWebhookEndpoint500",
        }),
      ),
    webhooksUpdateWebhookEndpoint: (endpointId, options) =>
      HttpClientRequest.patch(`/api/v1/webhooks/endpoints/${endpointId}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(options),
        onRequest(["2xx"], {
          "400": "WebhooksUpdateWebhookEndpoint400",
          "403": "ApiActionForbiddenError",
          "404": "ApiWebhookEndpointNotFoundError",
          "500": "WebhooksUpdateWebhookEndpoint500",
        }),
      ),
    webhooksRotateWebhookSecret: (endpointId) =>
      HttpClientRequest.post(`/api/v1/webhooks/endpoints/${endpointId}/rotate-secret`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "404": "ApiWebhookEndpointNotFoundError",
          "500": "WebhooksRotateWebhookSecret500",
        }),
      ),
    webhooksTestWebhookEndpoint: (endpointId) =>
      HttpClientRequest.post(`/api/v1/webhooks/endpoints/${endpointId}/test`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "404": "ApiWebhookEndpointNotFoundError",
          "500": "WebhooksTestWebhookEndpoint500",
        }),
      ),
    webhooksListWebhookDeliveries: () =>
      HttpClientRequest.get(`/api/v1/webhooks/deliveries`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "500": "WebhooksListWebhookDeliveries500",
        }),
      ),
    webhooksGetWebhookDelivery: (deliveryId) =>
      HttpClientRequest.get(`/api/v1/webhooks/deliveries/${deliveryId}`).pipe(
        onRequest(["2xx"], {
          "400": "EffectHttpApiSchemaError",
          "403": "ApiActionForbiddenError",
          "404": "ApiWebhookDeliveryNotFoundError",
          "500": "WebhooksGetWebhookDelivery500",
        }),
      ),
    webhooksRetryWebhookDelivery: (deliveryId) =>
      HttpClientRequest.post(`/api/v1/webhooks/deliveries/${deliveryId}/retry`).pipe(
        onRequest(["2xx"], {
          "400": "WebhooksRetryWebhookDelivery400",
          "403": "ApiActionForbiddenError",
          "404": "ApiWebhookDeliveryNotFoundError",
          "500": "WebhooksRetryWebhookDelivery500",
        }),
      ),
  };
};

export interface VoidhashCoreClient {
  readonly httpClient: HttpClient.HttpClient;
  readonly authSession: () => Effect.Effect<
    AuthSession200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"AuthSession500", AuthSession500>
  >;
  readonly apiKeysListApiKeys: () => Effect.Effect<
    ApiKeysListApiKeys200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiKeysListApiKeys500", ApiKeysListApiKeys500>
  >;
  readonly apiKeysCreateSecretKey: (
    options: CreateSecretKeyBody,
  ) => Effect.Effect<
    ApiKeyWithRawKey,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiKeysCreateSecretKey500", ApiKeysCreateSecretKey500>
  >;
  readonly apiKeysGetApiKeyById: (
    apiKeyId: string,
  ) => Effect.Effect<
    ApiKey,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiApiKeyNotFoundError", ApiApiKeyNotFoundError>
    | VoidhashCoreClientError<"ApiKeysGetApiKeyById500", ApiKeysGetApiKeyById500>
  >;
  readonly apiKeysDeleteApiKey: (
    apiKeyId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiApiKeyNotFoundError", ApiApiKeyNotFoundError>
    | VoidhashCoreClientError<"ApiKeysDeleteApiKey500", ApiKeysDeleteApiKey500>
  >;
  readonly apiKeysRotateSecretKey: (
    apiKeyId: string,
  ) => Effect.Effect<
    ApiKeyWithRawKey,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiApiKeyNotFoundError", ApiApiKeyNotFoundError>
    | VoidhashCoreClientError<"ApiKeysRotateSecretKey500", ApiKeysRotateSecretKey500>
  >;
  readonly personsListPersons: () => Effect.Effect<
    PersonsListPersons200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"PersonsListPersons500", PersonsListPersons500>
  >;
  readonly personsCreatePerson: (
    options: CreatePersonBody,
  ) => Effect.Effect<
    Person,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"PersonsCreatePerson400", PersonsCreatePerson400>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"PersonsCreatePerson500", PersonsCreatePerson500>
  >;
  readonly personsGetPersonById: (
    personId: string,
  ) => Effect.Effect<
    Person,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiPersonNotFoundError", ApiPersonNotFoundError>
    | VoidhashCoreClientError<"PersonsGetPersonById500", PersonsGetPersonById500>
  >;
  readonly personsGetPersonByDistinctId: (
    distinctId: string,
  ) => Effect.Effect<
    Person,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiPersonNotFoundError", ApiPersonNotFoundError>
    | VoidhashCoreClientError<"PersonsGetPersonByDistinctId500", PersonsGetPersonByDistinctId500>
  >;
  readonly organizationsCreateOrganization: (
    options: CreateOrganizationBody,
  ) => Effect.Effect<
    Organization,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<
        "OrganizationsCreateOrganization500",
        OrganizationsCreateOrganization500
      >
  >;
  readonly perksListPerks: () => Effect.Effect<
    PerksListPerks200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"PerksListPerks500", PerksListPerks500>
  >;
  readonly paywallLocationsListPaywallLocations: () => Effect.Effect<
    PaywallLocationsListPaywallLocations200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<
        "PaywallLocationsListPaywallLocations500",
        PaywallLocationsListPaywallLocations500
      >
  >;
  readonly schemaGetSchema: () => Effect.Effect<
    ProjectSchemaResponse,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"SchemaGetSchema500", SchemaGetSchema500>
  >;
  readonly schemaGetSchemaVersion: () => Effect.Effect<
    SchemaVersion,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"SchemaGetSchemaVersion500", SchemaGetSchemaVersion500>
  >;
  readonly projectsCreateProject: (
    options: CreateProjectBody,
  ) => Effect.Effect<
    Project,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ProjectsCreateProject500", ProjectsCreateProject500>
  >;
  readonly projectsListProjects: (
    organizationId: string,
  ) => Effect.Effect<
    ProjectsListProjects200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ProjectsListProjects500", ProjectsListProjects500>
  >;
  readonly productsListProducts: () => Effect.Effect<
    ProductsListProducts200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ProductsListProducts500", ProductsListProducts500>
  >;
  readonly productPerksListProductPerksByProductId: (
    productId: string,
  ) => Effect.Effect<
    ProductPerksListProductPerksByProductId200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<
        "ProductPerksListProductPerksByProductId400",
        ProductPerksListProductPerksByProductId400
      >
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<
        "ProductPerksListProductPerksByProductId500",
        ProductPerksListProductPerksByProductId500
      >
  >;
  readonly sdkGetPerson: (
    options: SdkGetPersonParams,
  ) => Effect.Effect<
    SdkPerson,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"SdkGetPerson400", SdkGetPerson400>
    | VoidhashCoreClientError<"ApiSdkPersonNotFoundError", ApiSdkPersonNotFoundError>
    | VoidhashCoreClientError<"SdkGetPerson500", SdkGetPerson500>
  >;
  readonly sdkIdentifyPerson: (options: {
    readonly params: SdkIdentifyPersonParams;
    readonly payload: SdkIdentifyBody;
  }) => Effect.Effect<
    SdkPerson,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"SdkIdentifyPerson400", SdkIdentifyPerson400>
    | VoidhashCoreClientError<"ApiSdkPersonNotFoundError", ApiSdkPersonNotFoundError>
    | VoidhashCoreClientError<
        "ApiSdkPersonAlreadyIdentifiedError",
        ApiSdkPersonAlreadyIdentifiedError
      >
    | VoidhashCoreClientError<"SdkIdentifyPerson500", SdkIdentifyPerson500>
  >;
  readonly sdkSyncPersonAttributes: (options: {
    readonly params: SdkSyncPersonAttributesParams;
    readonly payload: SdkSyncPersonAttributesBody;
  }) => Effect.Effect<
    SdkPerson,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"SdkSyncPersonAttributes400", SdkSyncPersonAttributes400>
    | VoidhashCoreClientError<"ApiSdkPersonNotFoundError", ApiSdkPersonNotFoundError>
    | VoidhashCoreClientError<"SdkSyncPersonAttributes500", SdkSyncPersonAttributes500>
  >;
  readonly sdkSyncTransaction: (options: {
    readonly params: SdkSyncTransactionParams;
    readonly payload: SdkSyncTransactionRequest;
  }) => Effect.Effect<
    SdkSyncTransactionResponse,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"SdkSyncTransaction400", SdkSyncTransaction400>
    | VoidhashCoreClientError<"SdkSyncTransaction500", SdkSyncTransaction500>
  >;
  readonly sdkEvaluateFeatureFlags: (options: {
    readonly params: SdkEvaluateFeatureFlagsParams;
    readonly payload: EvaluateFeatureFlagsBody;
  }) => Effect.Effect<
    SdkFeatureFlagsResponse,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"SdkEvaluateFeatureFlags500", SdkEvaluateFeatureFlags500>
  >;
  readonly sdkResolvePaywall: (options: {
    readonly params: SdkResolvePaywallParams;
    readonly payload: SdkResolvePaywallBody;
  }) => Effect.Effect<
    SdkResolvePaywall200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"SdkResolvePaywall400", SdkResolvePaywall400>
    | VoidhashCoreClientError<"SdkResolvePaywall500", SdkResolvePaywall500>
  >;
  readonly sdkGetSchema: (
    options: SdkGetSchemaParams,
  ) => Effect.Effect<
    SdkSchema,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"SdkGetSchema500", SdkGetSchema500>
  >;
  readonly usersGetUser: () => Effect.Effect<
    User,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"UsersGetUser500", UsersGetUser500>
  >;
  readonly paymentProviderConfigurationsListPaymentProviderConfigurations: () => Effect.Effect<
    PaymentProviderConfigurationsListPaymentProviderConfigurations200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<
        "PaymentProviderConfigurationsListPaymentProviderConfigurations500",
        PaymentProviderConfigurationsListPaymentProviderConfigurations500
      >
  >;
  readonly paymentProviderProductsListPaymentProviderProducts: () => Effect.Effect<
    PaymentProviderProductsListPaymentProviderProducts200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<
        "PaymentProviderProductsListPaymentProviderProducts500",
        PaymentProviderProductsListPaymentProviderProducts500
      >
  >;
  readonly webhooksListWebhookEndpoints: () => Effect.Effect<
    WebhooksListWebhookEndpoints200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"WebhooksListWebhookEndpoints500", WebhooksListWebhookEndpoints500>
  >;
  readonly webhooksCreateWebhookEndpoint: (
    options: CreateWebhookEndpointBody,
  ) => Effect.Effect<
    WebhookEndpoint,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"WebhooksCreateWebhookEndpoint400", WebhooksCreateWebhookEndpoint400>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"WebhooksCreateWebhookEndpoint500", WebhooksCreateWebhookEndpoint500>
  >;
  readonly webhooksGetWebhookEndpoint: (
    endpointId: string,
  ) => Effect.Effect<
    WebhookEndpoint,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiWebhookEndpointNotFoundError", ApiWebhookEndpointNotFoundError>
    | VoidhashCoreClientError<"WebhooksGetWebhookEndpoint500", WebhooksGetWebhookEndpoint500>
  >;
  readonly webhooksDeleteWebhookEndpoint: (
    endpointId: string,
  ) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiWebhookEndpointNotFoundError", ApiWebhookEndpointNotFoundError>
    | VoidhashCoreClientError<"WebhooksDeleteWebhookEndpoint500", WebhooksDeleteWebhookEndpoint500>
  >;
  readonly webhooksUpdateWebhookEndpoint: (
    endpointId: string,
    options: UpdateWebhookEndpointBody,
  ) => Effect.Effect<
    WebhookEndpoint,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"WebhooksUpdateWebhookEndpoint400", WebhooksUpdateWebhookEndpoint400>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiWebhookEndpointNotFoundError", ApiWebhookEndpointNotFoundError>
    | VoidhashCoreClientError<"WebhooksUpdateWebhookEndpoint500", WebhooksUpdateWebhookEndpoint500>
  >;
  readonly webhooksRotateWebhookSecret: (
    endpointId: string,
  ) => Effect.Effect<
    WebhookEndpoint,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiWebhookEndpointNotFoundError", ApiWebhookEndpointNotFoundError>
    | VoidhashCoreClientError<"WebhooksRotateWebhookSecret500", WebhooksRotateWebhookSecret500>
  >;
  readonly webhooksTestWebhookEndpoint: (
    endpointId: string,
  ) => Effect.Effect<
    WebhookDelivery,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiWebhookEndpointNotFoundError", ApiWebhookEndpointNotFoundError>
    | VoidhashCoreClientError<"WebhooksTestWebhookEndpoint500", WebhooksTestWebhookEndpoint500>
  >;
  readonly webhooksListWebhookDeliveries: () => Effect.Effect<
    WebhooksListWebhookDeliveries200,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"WebhooksListWebhookDeliveries500", WebhooksListWebhookDeliveries500>
  >;
  readonly webhooksGetWebhookDelivery: (
    deliveryId: string,
  ) => Effect.Effect<
    WebhookDeliveryWithAttempts,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiWebhookDeliveryNotFoundError", ApiWebhookDeliveryNotFoundError>
    | VoidhashCoreClientError<"WebhooksGetWebhookDelivery500", WebhooksGetWebhookDelivery500>
  >;
  readonly webhooksRetryWebhookDelivery: (
    deliveryId: string,
  ) => Effect.Effect<
    WebhookDelivery,
    | HttpClientError.HttpClientError
    | VoidhashCoreClientError<"WebhooksRetryWebhookDelivery400", WebhooksRetryWebhookDelivery400>
    | VoidhashCoreClientError<"ApiActionForbiddenError", ApiActionForbiddenError>
    | VoidhashCoreClientError<"ApiWebhookDeliveryNotFoundError", ApiWebhookDeliveryNotFoundError>
    | VoidhashCoreClientError<"WebhooksRetryWebhookDelivery500", WebhooksRetryWebhookDelivery500>
  >;
}

export interface VoidhashCoreClientError<Tag extends string, E> extends Error {
  readonly _tag: Tag;
  readonly request: HttpClientRequest.HttpClientRequest;
  readonly response: HttpClientResponse.HttpClientResponse;
  readonly data: E;
  readonly message: string;
}

class VoidhashCoreClientErrorImpl extends Data.Error<{
  _tag: string;
  data: any;
  message: string;
  request: HttpClientRequest.HttpClientRequest;
  response: HttpClientResponse.HttpClientResponse;
}> {
  name = "VoidhashCoreClientError";
}

export const VoidhashCoreClientError = <Tag extends string, E>(
  tag: Tag,
  data: E,
  response: HttpClientResponse.HttpClientResponse,
): VoidhashCoreClientError<Tag, E> =>
  new VoidhashCoreClientErrorImpl({
    _tag: tag,
    data,
    message: JSON.stringify(data),
    response,
    request: response.request,
  }) as any;
