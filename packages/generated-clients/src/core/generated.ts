import type * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"

export type AuthSession200MethodEnum = "secret-key"

export interface AuthSession200 {
  readonly "method": AuthSession200MethodEnum | AuthSession200MethodEnum | AuthSession200MethodEnum;
  readonly "name": string;
  readonly "organizations": ReadonlyArray<{
  readonly "id": string;
  readonly "name": string;
  readonly "slug": string
}>;
  readonly "projects": ReadonlyArray<{
  readonly "id": string;
  readonly "name": string;
  readonly "organizationId": string;
  readonly "slug": string
}>
}

export type EffectHttpApiSchemaErrorTag = "HttpApiSchemaError"

export interface EffectHttpApiSchemaError {
  readonly "_tag": EffectHttpApiSchemaErrorTag;
  readonly "message": string
}

export type ActionForbiddenErrorTag = "ActionForbiddenError"

export interface ActionForbiddenError {
  readonly "_tag": ActionForbiddenErrorTag;
  readonly "message": string
}

export type AuthenticationErrorTag = "AuthenticationError"

export interface AuthenticationError {
  readonly "_tag": AuthenticationErrorTag;
  readonly "cause": string;
  readonly "message": string
}

export type NotAuthenticatedErrorTag = "NotAuthenticatedError"

export interface NotAuthenticatedError {
  readonly "_tag": NotAuthenticatedErrorTag;
  readonly "message": string
}

export type AuthSession500 = AuthenticationError | NotAuthenticatedError

export interface ApiKey {
  readonly "end": string;
  readonly "id": string;
  readonly "isPublic": boolean;
  readonly "name": string;
  readonly "prefix": string;
  readonly "projectId": string;
  readonly "rawKey"?: string | null | undefined
}

export type ApiKeysListApiKeys200 = ReadonlyArray<ApiKey>

export type ApiKeyServiceErrorTag = "ApiKeyServiceError"

export interface ApiKeyServiceError {
  readonly "_tag": ApiKeyServiceErrorTag;
  readonly "cause": string
}

export type ApiKeysListApiKeys500 = ApiKeyServiceError | AuthenticationError | NotAuthenticatedError

export interface CreateSecretKeyBody {
  readonly "name": string;
  readonly "projectId": string
}

export interface ApiKeyWithRawKey {
  readonly "end": string;
  readonly "id": string;
  readonly "isPublic": boolean;
  readonly "name": string;
  readonly "prefix": string;
  readonly "projectId": string;
  readonly "rawKey": string
}

export type ApiKeysCreateSecretKey500 = ApiKeyServiceError | AuthenticationError | NotAuthenticatedError

export type ApiKeyNotFoundErrorTag = "ApiKeyNotFoundError"

export interface ApiKeyNotFoundError {
  readonly "_tag": ApiKeyNotFoundErrorTag;
  readonly "message": string
}

export type ApiKeysGetApiKeyById500 = ApiKeyServiceError | AuthenticationError | NotAuthenticatedError

export type ApiKeysDeleteApiKey500 = ApiKeyServiceError | AuthenticationError | NotAuthenticatedError

export type ApiKeysRotateSecretKey500 = ApiKeyServiceError | AuthenticationError | NotAuthenticatedError

export interface Person {
  readonly "personId": string;
  readonly "distinctId": string;
  readonly "email": string | null;
  readonly "name": string | null
}

export type PersonsListPersons200 = ReadonlyArray<Person>

export type PersonServiceErrorTag = "PersonServiceError"

export interface PersonServiceError {
  readonly "_tag": PersonServiceErrorTag;
  readonly "cause": string
}

export type PersonsListPersons500 = PersonServiceError | AuthenticationError | NotAuthenticatedError

export interface CreatePersonBody {
  readonly "distinctId": string;
  readonly "email"?: string | null | undefined;
  readonly "name"?: string | null | undefined
}

export type PersonInvalidAnonymousIdErrorTag = "PersonInvalidAnonymousIdError"

export interface PersonInvalidAnonymousIdError {
  readonly "_tag": PersonInvalidAnonymousIdErrorTag;
  readonly "id": string
}

export type PersonsCreatePerson400 = PersonInvalidAnonymousIdError | EffectHttpApiSchemaError

export type PersonsCreatePerson500 = PersonServiceError | AuthenticationError | NotAuthenticatedError

export type PersonNotFoundErrorTag = "PersonNotFoundError"

export interface PersonNotFoundError {
  readonly "_tag": PersonNotFoundErrorTag;
  readonly "id": string
}

export type PersonsGetPersonById500 = PersonServiceError | AuthenticationError | NotAuthenticatedError

export type PersonsGetPersonByDistinctId500 = PersonServiceError | AuthenticationError | NotAuthenticatedError

export interface CreateOrganizationBody {
  readonly "name": string
}

export interface Organization {
  readonly "id": string;
  readonly "name": string;
  readonly "slug": string
}

export type OrganizationServiceErrorTag = "OrganizationServiceError"

export interface OrganizationServiceError {
  readonly "_tag": OrganizationServiceErrorTag;
  readonly "cause": string
}

export type OrganizationsCreateOrganization500 = OrganizationServiceError | AuthenticationError | NotAuthenticatedError

export interface Perk {
  readonly "id": string;
  readonly "name": string;
  readonly "projectId": string;
  readonly "slug": string
}

export type PerksListPerks200 = ReadonlyArray<Perk>

export type PerkServiceErrorTag = "PerkServiceError"

export interface PerkServiceError {
  readonly "_tag": PerkServiceErrorTag;
  readonly "cause": string
}

export type PerksListPerks500 = PerkServiceError | AuthenticationError | NotAuthenticatedError

export interface PaywallLocation {
  readonly "description": string | null;
  readonly "id": string;
  readonly "name": string;
  readonly "projectId": string;
  readonly "slug": string
}

export type PaywallLocationsListPaywallLocations200 = ReadonlyArray<PaywallLocation>

export type PaywallLocationServiceErrorTag = "PaywallLocationServiceError"

export interface PaywallLocationServiceError {
  readonly "_tag": PaywallLocationServiceErrorTag;
  readonly "cause": string
}

export type PaywallLocationsListPaywallLocations500 = PaywallLocationServiceError | AuthenticationError | NotAuthenticatedError

export interface CreateProjectBody {
  readonly "name": string;
  readonly "organizationId": string
}

export interface Project {
  readonly "id": string;
  readonly "name": string;
  readonly "slug": string
}

export type ProjectServiceErrorTag = "ProjectServiceError"

export interface ProjectServiceError {
  readonly "_tag": ProjectServiceErrorTag;
  readonly "cause": string
}

export type ProjectsCreateProject500 = AuthenticationError | ProjectServiceError | AuthenticationError | NotAuthenticatedError

export type ProjectsListProjects200 = ReadonlyArray<Project>

export type ProjectsListProjects500 = ProjectServiceError | AuthenticationError | NotAuthenticatedError

export type ProductTypeEnum = "one-time-consumable"

export interface Product {
  readonly "id": string;
  readonly "name": string;
  readonly "projectId": string;
  readonly "slug": string;
  readonly "type": ProductTypeEnum | ProductTypeEnum | ProductTypeEnum
}

export type ProductsListProducts200 = ReadonlyArray<Product>

export type ProductServiceErrorTag = "ProductServiceError"

export interface ProductServiceError {
  readonly "_tag": ProductServiceErrorTag;
  readonly "cause": string
}

export type ProductsListProducts500 = ProductServiceError | AuthenticationError | NotAuthenticatedError

export interface ProductPerk {
  readonly "id": string;
  readonly "perkId": string;
  readonly "productId": string
}

export type ProductPerksListProductPerksByProductId200 = ReadonlyArray<ProductPerk>

export type ProductPerkValidationErrorTag = "ProductPerkValidationError"

export interface ProductPerkValidationError {
  readonly "_tag": ProductPerkValidationErrorTag;
  readonly "message": string
}

export type ProductPerksListProductPerksByProductId400 = ProductPerkValidationError | EffectHttpApiSchemaError

export type ProductPerkServiceErrorTag = "ProductPerkServiceError"

export interface ProductPerkServiceError {
  readonly "_tag": ProductPerkServiceErrorTag;
  readonly "cause": string
}

export type ProductPerksListProductPerksByProductId500 = ProductPerkServiceError | AuthenticationError | NotAuthenticatedError

export type SdkGetPersonParamsXIsBackgrounded = "false"

export type SdkGetPersonParamsXIsDebugBuildEnum = "false"

export type SdkGetPersonParamsXObserverModeEnum = "false"

export type SdkGetPersonParamsXPlatformFlavorEnum = "browser"

export type SdkGetPersonParamsXSdkEnum = "web"

export interface SdkGetPersonParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkGetPersonParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkGetPersonParamsXIsDebugBuildEnum | SdkGetPersonParamsXIsDebugBuildEnum;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkGetPersonParamsXObserverModeEnum | SdkGetPersonParamsXObserverModeEnum;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkGetPersonParamsXPlatformFlavorEnum | SdkGetPersonParamsXPlatformFlavorEnum;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkGetPersonParamsXSdkEnum | SdkGetPersonParamsXSdkEnum;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined
}

export type SdkEntitlementGrantSourceEnum = "manual"

export type SdkEntitlementGrantStatusEnum = "expired"

export interface SdkEntitlementGrant {
  readonly "expiresAt": string | null;
  readonly "perkId": string;
  readonly "source": SdkEntitlementGrantSourceEnum | SdkEntitlementGrantSourceEnum | SdkEntitlementGrantSourceEnum;
  readonly "sourceId": string | null;
  readonly "sourcePersonId": string;
  readonly "status": SdkEntitlementGrantStatusEnum | SdkEntitlementGrantStatusEnum
}

export type SdkPurchaseHistoryEntryTypeEnum = "subscription"

export interface SdkPurchaseHistoryEntry {
  readonly "createdAt": string;
  readonly "productId": string | null;
  readonly "providerKey": string;
  readonly "purchaseId": string;
  readonly "sourcePersonId": string;
  readonly "type": SdkPurchaseHistoryEntryTypeEnum | SdkPurchaseHistoryEntryTypeEnum
}

export type SdkPersonSnapshotContextModeEnum = "temporary_pending_transfer"

export type SdkCurrentSubscriptionStatusEnum = "trialing"

export interface SdkCurrentSubscription {
  readonly "expiresAt": string | null;
  readonly "productId": string | null;
  readonly "status": SdkCurrentSubscriptionStatusEnum | SdkCurrentSubscriptionStatusEnum | SdkCurrentSubscriptionStatusEnum | SdkCurrentSubscriptionStatusEnum | SdkCurrentSubscriptionStatusEnum;
  readonly "subscriptionId": string | null
}

export type SdkSubscriptionHistoryEntryStatusEnum = "past_due"

export interface SdkSubscriptionHistoryEntry {
  readonly "canceledAt": string | null;
  readonly "expiresAt": string | null;
  readonly "isTrial": boolean;
  readonly "productId": string | null;
  readonly "sourcePersonId": string;
  readonly "startsAt": string;
  readonly "status": SdkSubscriptionHistoryEntryStatusEnum | SdkSubscriptionHistoryEntryStatusEnum | SdkSubscriptionHistoryEntryStatusEnum | SdkSubscriptionHistoryEntryStatusEnum | SdkSubscriptionHistoryEntryStatusEnum;
  readonly "subscriptionId": string
}

export interface SdkPerson {
  readonly "distinctId": string;
  readonly "email": string | null;
  readonly "entitlements": {
  readonly "grants": ReadonlyArray<SdkEntitlementGrant>
};
  readonly "name": string | null;
  readonly "personId": string;
  readonly "purchases": {
  readonly "history": ReadonlyArray<SdkPurchaseHistoryEntry>
};
  readonly "snapshotContext": {
  readonly "includedPersonIds": ReadonlyArray<string>;
  readonly "migrationJobId": string | null;
  readonly "mode": SdkPersonSnapshotContextModeEnum | SdkPersonSnapshotContextModeEnum
};
  readonly "subscriptions": {
  readonly "current": SdkCurrentSubscription | null;
  readonly "history": ReadonlyArray<SdkSubscriptionHistoryEntry>
}
}

export type SdkValidationErrorTag = "SdkValidationError"

export interface SdkValidationError {
  readonly "_tag": SdkValidationErrorTag;
  readonly "message": string
}

export type SdkGetPerson400 = SdkValidationError | EffectHttpApiSchemaError

export type SdkPersonNotFoundErrorTag = "SdkPersonNotFoundError"

export interface SdkPersonNotFoundError {
  readonly "_tag": SdkPersonNotFoundErrorTag;
  readonly "message": string
}

export type SdkServiceErrorTag = "SdkServiceError"

export interface SdkServiceError {
  readonly "_tag": SdkServiceErrorTag;
  readonly "cause": string
}

export type SdkGetPerson500 = AuthenticationError | SdkServiceError | AuthenticationError | NotAuthenticatedError

export type SdkIdentifyPersonParamsXIsBackgrounded = "false"

export type SdkIdentifyPersonParamsXIsDebugBuildEnum = "false"

export type SdkIdentifyPersonParamsXObserverModeEnum = "false"

export type SdkIdentifyPersonParamsXPlatformFlavorEnum = "browser"

export type SdkIdentifyPersonParamsXSdkEnum = "web"

export interface SdkIdentifyPersonParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkIdentifyPersonParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkIdentifyPersonParamsXIsDebugBuildEnum | SdkIdentifyPersonParamsXIsDebugBuildEnum;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkIdentifyPersonParamsXObserverModeEnum | SdkIdentifyPersonParamsXObserverModeEnum;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkIdentifyPersonParamsXPlatformFlavorEnum | SdkIdentifyPersonParamsXPlatformFlavorEnum;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkIdentifyPersonParamsXSdkEnum | SdkIdentifyPersonParamsXSdkEnum;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined
}

export interface SdkIdentifyBody {
  readonly "distinctId": string;
  readonly "email"?: string | null | undefined;
  readonly "name"?: string | null | undefined;
  readonly "traits"?: Record<string, unknown> | null | undefined
}

export type SdkIdentifyPerson400 = SdkValidationError | EffectHttpApiSchemaError

export type SdkPersonAlreadyIdentifiedErrorTag = "SdkPersonAlreadyIdentifiedError"

export interface SdkPersonAlreadyIdentifiedError {
  readonly "_tag": SdkPersonAlreadyIdentifiedErrorTag;
  readonly "distinctId": string
}

export type SdkIdentifyPerson500 = AuthenticationError | SdkServiceError | AuthenticationError | NotAuthenticatedError

export type SdkSyncPersonAttributesParamsXIsBackgrounded = "false"

export type SdkSyncPersonAttributesParamsXIsDebugBuildEnum = "false"

export type SdkSyncPersonAttributesParamsXObserverModeEnum = "false"

export type SdkSyncPersonAttributesParamsXPlatformFlavorEnum = "browser"

export type SdkSyncPersonAttributesParamsXSdkEnum = "web"

export interface SdkSyncPersonAttributesParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkSyncPersonAttributesParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkSyncPersonAttributesParamsXIsDebugBuildEnum | SdkSyncPersonAttributesParamsXIsDebugBuildEnum;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkSyncPersonAttributesParamsXObserverModeEnum | SdkSyncPersonAttributesParamsXObserverModeEnum;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkSyncPersonAttributesParamsXPlatformFlavorEnum | SdkSyncPersonAttributesParamsXPlatformFlavorEnum;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkSyncPersonAttributesParamsXSdkEnum | SdkSyncPersonAttributesParamsXSdkEnum;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined
}

export interface SdkSyncPersonAttributesBody {
  readonly "email"?: string | null | undefined;
  readonly "name"?: string | null | undefined;
  readonly "traits"?: Record<string, unknown> | null | undefined
}

export type SdkSyncPersonAttributes400 = SdkValidationError | EffectHttpApiSchemaError

export type SdkSyncPersonAttributes500 = AuthenticationError | SdkServiceError | AuthenticationError | NotAuthenticatedError

export type SdkSyncTransactionParamsXIsBackgrounded = "false"

export type SdkSyncTransactionParamsXIsDebugBuildEnum = "false"

export type SdkSyncTransactionParamsXObserverModeEnum = "false"

export type SdkSyncTransactionParamsXPlatformFlavorEnum = "browser"

export type SdkSyncTransactionParamsXSdkEnum = "web"

export interface SdkSyncTransactionParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkSyncTransactionParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkSyncTransactionParamsXIsDebugBuildEnum | SdkSyncTransactionParamsXIsDebugBuildEnum;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkSyncTransactionParamsXObserverModeEnum | SdkSyncTransactionParamsXObserverModeEnum;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkSyncTransactionParamsXPlatformFlavorEnum | SdkSyncTransactionParamsXPlatformFlavorEnum;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkSyncTransactionParamsXSdkEnum | SdkSyncTransactionParamsXSdkEnum;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined
}

export type SdkSyncTransactionRequestPlatformEnum = "android"

export type SdkSyncTransactionRequestPurchaseDateEnum = "-Infinity"

export type SdkSyncTransactionRequestQuantityEnum = "-Infinity"

export interface SdkSyncTransactionRequest {
  readonly "platform": SdkSyncTransactionRequestPlatformEnum | SdkSyncTransactionRequestPlatformEnum;
  readonly "productId": string;
  readonly "purchaseDate": number | SdkSyncTransactionRequestPurchaseDateEnum | SdkSyncTransactionRequestPurchaseDateEnum | SdkSyncTransactionRequestPurchaseDateEnum;
  readonly "purchaseToken"?: string | null | undefined;
  readonly "quantity": number | SdkSyncTransactionRequestQuantityEnum | SdkSyncTransactionRequestQuantityEnum | SdkSyncTransactionRequestQuantityEnum;
  readonly "receipt"?: string | null | undefined;
  readonly "transactionId": string
}

export interface SdkSyncTransactionResponse {
  readonly "accepted": boolean
}

export type SdkSyncTransaction400 = SdkValidationError | EffectHttpApiSchemaError

export type SdkSyncTransaction500 = AuthenticationError | SdkServiceError | AuthenticationError | NotAuthenticatedError

export type SdkEvaluateFeatureFlagsParamsXIsBackgrounded = "false"

export type SdkEvaluateFeatureFlagsParamsXIsDebugBuildEnum = "false"

export type SdkEvaluateFeatureFlagsParamsXObserverModeEnum = "false"

export type SdkEvaluateFeatureFlagsParamsXPlatformFlavorEnum = "browser"

export type SdkEvaluateFeatureFlagsParamsXSdkEnum = "web"

export interface SdkEvaluateFeatureFlagsParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkEvaluateFeatureFlagsParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkEvaluateFeatureFlagsParamsXIsDebugBuildEnum | SdkEvaluateFeatureFlagsParamsXIsDebugBuildEnum;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkEvaluateFeatureFlagsParamsXObserverModeEnum | SdkEvaluateFeatureFlagsParamsXObserverModeEnum;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkEvaluateFeatureFlagsParamsXPlatformFlavorEnum | SdkEvaluateFeatureFlagsParamsXPlatformFlavorEnum;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkEvaluateFeatureFlagsParamsXSdkEnum | SdkEvaluateFeatureFlagsParamsXSdkEnum;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined
}

export interface EvaluateFeatureFlagsBody {
  readonly "flagKeys"?: ReadonlyArray<string> | null | undefined
}

export interface SdkFeatureFlagResult {
  readonly "enabled": boolean;
  readonly "key": string;
  readonly "variantKey": string | null
}

export interface SdkFeatureFlagsResponse {
  readonly "flags": ReadonlyArray<SdkFeatureFlagResult>
}

export type SdkEvaluateFeatureFlags500 = AuthenticationError | SdkServiceError | AuthenticationError | NotAuthenticatedError

export type SdkResolvePaywallParamsXIsBackgrounded = "false"

export type SdkResolvePaywallParamsXIsDebugBuildEnum = "false"

export type SdkResolvePaywallParamsXObserverModeEnum = "false"

export type SdkResolvePaywallParamsXPlatformFlavorEnum = "browser"

export type SdkResolvePaywallParamsXSdkEnum = "web"

export interface SdkResolvePaywallParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkResolvePaywallParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkResolvePaywallParamsXIsDebugBuildEnum | SdkResolvePaywallParamsXIsDebugBuildEnum;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkResolvePaywallParamsXObserverModeEnum | SdkResolvePaywallParamsXObserverModeEnum;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkResolvePaywallParamsXPlatformFlavorEnum | SdkResolvePaywallParamsXPlatformFlavorEnum;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkResolvePaywallParamsXSdkEnum | SdkResolvePaywallParamsXSdkEnum;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined
}

export interface SdkResolvePaywallBody {
  readonly "locationSlug": string
}

export type SdkResolvedPaywallShowingPaywallReleaseEnumVersionEnum = "-Infinity"

export type SdkResolvedPaywallShowingTypeEnum = "feature_flag"

export interface SdkResolvedPaywallShowing {
  readonly "id": string;
  readonly "paywall": {
  readonly "id": string;
  readonly "name": string;
  readonly "slug": string
} | null;
  readonly "paywallId": string | null;
  readonly "paywallRelease": {
  readonly "htmlUrl": string;
  readonly "publishedAt": string | null;
  readonly "releaseId": string;
  readonly "version": number | "NaN" | "Infinity" | "-Infinity"
} | null;
  readonly "paywallReleaseId": string | null;
  readonly "startedAt": string;
  readonly "type": SdkResolvedPaywallShowingTypeEnum | SdkResolvedPaywallShowingTypeEnum
}

export interface SdkResolvedPaywall {
  readonly "location": {
  readonly "id": string;
  readonly "name": string;
  readonly "slug": string
};
  readonly "showing": SdkResolvedPaywallShowing
}

export type SdkResolvePaywall200 = SdkResolvedPaywall | null

export type SdkResolvePaywall400 = SdkValidationError | EffectHttpApiSchemaError

export type SdkResolvePaywall500 = AuthenticationError | SdkServiceError | AuthenticationError | NotAuthenticatedError

export interface User {
  readonly "createdAt": string;
  readonly "email": string;
  readonly "emailVerified": boolean;
  readonly "id": string;
  readonly "image": string | null;
  readonly "name": string;
  readonly "organizations": ReadonlyArray<{
  readonly "id": string;
  readonly "logo": string | null;
  readonly "name": string;
  readonly "slug": string
}>;
  readonly "projects": ReadonlyArray<{
  readonly "id": string;
  readonly "logo": string | null;
  readonly "name": string;
  readonly "organizationId": string;
  readonly "slug": string
}>;
  readonly "updatedAt": string
}

export type UserServiceErrorTag = "UserServiceError"

export interface UserServiceError {
  readonly "_tag": UserServiceErrorTag;
  readonly "cause": string
}

export type UsersGetUser500 = AuthenticationError | UserServiceError | AuthenticationError | NotAuthenticatedError

export interface PaymentProviderConfiguration {
  readonly "enabled": boolean;
  readonly "id": string;
  readonly "name": string;
  readonly "projectId": string;
  readonly "providerId": string
}

export type PaymentProviderConfigurationsListPaymentProviderConfigurations200 = ReadonlyArray<PaymentProviderConfiguration>

export type PaymentProviderConfigurationServiceErrorTag = "PaymentProviderConfigurationServiceError"

export interface PaymentProviderConfigurationServiceError {
  readonly "_tag": PaymentProviderConfigurationServiceErrorTag;
  readonly "cause": string
}

export type PaymentProviderConfigurationsListPaymentProviderConfigurations500 = PaymentProviderConfigurationServiceError | AuthenticationError | NotAuthenticatedError

export interface PaymentProviderProduct {
  readonly "configuration": Record<string, unknown>;
  readonly "id": string;
  readonly "paymentProviderConfigurationId": string;
  readonly "productId": string;
  readonly "providerId": string
}

export type PaymentProviderProductsListPaymentProviderProducts200 = ReadonlyArray<PaymentProviderProduct>

export type PaymentProviderProductServiceErrorTag = "PaymentProviderProductServiceError"

export interface PaymentProviderProductServiceError {
  readonly "_tag": PaymentProviderProductServiceErrorTag;
  readonly "cause": string
}

export type PaymentProviderProductsListPaymentProviderProducts500 = PaymentProviderProductServiceError | AuthenticationError | NotAuthenticatedError

export interface DeployChangesetBody {
  readonly "changeset": {
  readonly "changes": ReadonlyArray<{
  readonly "changeType": "create-paywall-location";
  readonly "key": string;
  readonly "payload": {
  readonly "description"?: string | null | null | undefined;
  readonly "name": string;
  readonly "slug": string
}
} | {
  readonly "changeType": "update-paywall-location";
  readonly "key": string;
  readonly "payload": {
  readonly "description"?: string | null | null | undefined;
  readonly "name": string;
  readonly "slug": string
}
} | {
  readonly "changeType": "archive-paywall-location";
  readonly "key": string;
  readonly "payload": {
  readonly "slug": string
}
} | {
  readonly "changeType": "create-perk";
  readonly "key": string;
  readonly "payload": {
  readonly "name": string;
  readonly "slug": string
}
} | {
  readonly "changeType": "update-perk";
  readonly "key": string;
  readonly "payload": {
  readonly "name": string;
  readonly "slug": string
}
} | {
  readonly "changeType": "delete-perk";
  readonly "key": string;
  readonly "payload": {
  readonly "slug": string
}
} | {
  readonly "changeType": "create-product";
  readonly "key": string;
  readonly "payload": {
  readonly "name": string;
  readonly "slug": string
}
} | {
  readonly "changeType": "update-product";
  readonly "key": string;
  readonly "payload": {
  readonly "name": string;
  readonly "slug": string
}
} | {
  readonly "changeType": "delete-product";
  readonly "key": string;
  readonly "payload": {
  readonly "slug": string
}
} | {
  readonly "changeType": "create-product-perk";
  readonly "key": string;
  readonly "payload": {
  readonly "perkSlug": string;
  readonly "productSlug": string
}
} | {
  readonly "changeType": "delete-product-perk";
  readonly "key": string;
  readonly "payload": {
  readonly "perkSlug": string;
  readonly "productSlug": string
}
} | {
  readonly "changeType": "create-payment-provider-product";
  readonly "key": string;
  readonly "payload": {
  readonly "configuration": Record<string, unknown>;
  readonly "productSlug": string;
  readonly "providerId": string
}
} | {
  readonly "changeType": "update-payment-provider-product";
  readonly "key": string;
  readonly "payload": {
  readonly "configuration": Record<string, unknown>;
  readonly "productSlug": string;
  readonly "providerId": string
}
} | {
  readonly "changeType": "delete-payment-provider-product";
  readonly "key": string;
  readonly "payload": {
  readonly "productSlug": string;
  readonly "providerId": string
}
}>
}
}

export interface DeployChangesetResponse {
  readonly "deploymentId": string
}

export type ChangesetDeploymentServiceErrorTag = "ChangesetDeploymentServiceError"

export interface ChangesetDeploymentServiceError {
  readonly "_tag": ChangesetDeploymentServiceErrorTag;
  readonly "cause": null
}

export type ChangesetsDeployChangeset500 = AuthenticationError | ChangesetDeploymentServiceError | AuthenticationError | NotAuthenticatedError

export type WebhookEndpointConsecutiveFailuresEnum = "-Infinity"

export type WebhookEndpointStatusEnum = "failed"

export interface WebhookEndpoint {
  readonly "consecutiveFailures": number | WebhookEndpointConsecutiveFailuresEnum | WebhookEndpointConsecutiveFailuresEnum | WebhookEndpointConsecutiveFailuresEnum;
  readonly "createdAt": string | null;
  readonly "description": string | null;
  readonly "events": ReadonlyArray<"person.created" | "person.updated" | "person.deleted" | "subscription.created" | "subscription.renewed" | "subscription.cancelled" | "subscription.expired" | "purchase.completed" | "purchase.refunded">;
  readonly "id": string;
  readonly "lastSuccessAt": string | null;
  readonly "name": string;
  readonly "projectId": string;
  readonly "secret": string;
  readonly "status": WebhookEndpointStatusEnum | WebhookEndpointStatusEnum | WebhookEndpointStatusEnum;
  readonly "url": string
}

export type WebhooksListWebhookEndpoints200 = ReadonlyArray<WebhookEndpoint>

export type WebhookServiceErrorTag = "WebhookServiceError"

export interface WebhookServiceError {
  readonly "_tag": WebhookServiceErrorTag;
  readonly "cause": string
}

export type WebhooksListWebhookEndpoints500 = WebhookServiceError | AuthenticationError | NotAuthenticatedError

export interface CreateWebhookEndpointBody {
  readonly "description"?: string | null | undefined;
  readonly "events": ReadonlyArray<string>;
  readonly "name": string;
  readonly "url": string
}

export type WebhookValidationErrorTag = "WebhookValidationError"

export interface WebhookValidationError {
  readonly "_tag": WebhookValidationErrorTag;
  readonly "message": string
}

export type WebhooksCreateWebhookEndpoint400 = WebhookValidationError | EffectHttpApiSchemaError

export type WebhooksCreateWebhookEndpoint500 = WebhookServiceError | AuthenticationError | NotAuthenticatedError

export type WebhookEndpointNotFoundErrorTag = "WebhookEndpointNotFoundError"

export interface WebhookEndpointNotFoundError {
  readonly "_tag": WebhookEndpointNotFoundErrorTag;
  readonly "endpointId": string
}

export type WebhooksGetWebhookEndpoint500 = WebhookServiceError | AuthenticationError | NotAuthenticatedError

export type WebhooksDeleteWebhookEndpoint500 = WebhookServiceError | AuthenticationError | NotAuthenticatedError

export type UpdateWebhookEndpointBodyStatusEnum = "disabled"

export interface UpdateWebhookEndpointBody {
  readonly "description"?: string | null | null | undefined;
  readonly "events"?: ReadonlyArray<string> | null | undefined;
  readonly "name"?: string | null | undefined;
  readonly "status"?: UpdateWebhookEndpointBodyStatusEnum | UpdateWebhookEndpointBodyStatusEnum | null | undefined;
  readonly "url"?: string | null | undefined
}

export type WebhooksUpdateWebhookEndpoint400 = WebhookValidationError | EffectHttpApiSchemaError

export type WebhooksUpdateWebhookEndpoint500 = WebhookServiceError | AuthenticationError | NotAuthenticatedError

export type WebhooksRotateWebhookSecret500 = WebhookServiceError | AuthenticationError | NotAuthenticatedError

export type WebhookDeliveryAttemptCountEnum = "-Infinity"

export type WebhookDeliveryMaxAttemptsEnum = "-Infinity"

export type WebhookDeliveryStatusEnum = "exhausted"

export interface WebhookDelivery {
  readonly "attemptCount": number | WebhookDeliveryAttemptCountEnum | WebhookDeliveryAttemptCountEnum | WebhookDeliveryAttemptCountEnum;
  readonly "completedAt": string | null;
  readonly "createdAt": string | null;
  readonly "eventOccurredAt": string;
  readonly "eventType": string;
  readonly "id": string;
  readonly "maxAttempts": number | WebhookDeliveryMaxAttemptsEnum | WebhookDeliveryMaxAttemptsEnum | WebhookDeliveryMaxAttemptsEnum;
  readonly "nextAttemptAt": string | null;
  readonly "payload": null;
  readonly "projectId": string;
  readonly "status": WebhookDeliveryStatusEnum | WebhookDeliveryStatusEnum | WebhookDeliveryStatusEnum | WebhookDeliveryStatusEnum | WebhookDeliveryStatusEnum;
  readonly "webhookEndpointId": string
}

export type WebhooksTestWebhookEndpoint500 = WebhookServiceError | AuthenticationError | NotAuthenticatedError

export type WebhooksListWebhookDeliveries200 = ReadonlyArray<WebhookDelivery>

export type WebhooksListWebhookDeliveries500 = WebhookServiceError | AuthenticationError | NotAuthenticatedError

export type WebhookDeliveryWithAttemptsAttemptCountEnum = "-Infinity"

export type WebhookDeliveryAttemptAttemptNumberEnum = "-Infinity"

export type WebhookDeliveryAttemptDurationMsEnum = "-Infinity"

export type WebhookDeliveryAttemptStatusCodeEnum = "-Infinity"

export interface WebhookDeliveryAttempt {
  readonly "attemptNumber": number | WebhookDeliveryAttemptAttemptNumberEnum | WebhookDeliveryAttemptAttemptNumberEnum | WebhookDeliveryAttemptAttemptNumberEnum;
  readonly "createdAt": string | null;
  readonly "durationMs": number | WebhookDeliveryAttemptDurationMsEnum | WebhookDeliveryAttemptDurationMsEnum | WebhookDeliveryAttemptDurationMsEnum | null;
  readonly "errorMessage": string | null;
  readonly "id": string;
  readonly "responseBody": string | null;
  readonly "statusCode": number | WebhookDeliveryAttemptStatusCodeEnum | WebhookDeliveryAttemptStatusCodeEnum | WebhookDeliveryAttemptStatusCodeEnum | null;
  readonly "succeeded": boolean
}

export type WebhookDeliveryWithAttemptsMaxAttemptsEnum = "-Infinity"

export type WebhookDeliveryWithAttemptsStatusEnum = "exhausted"

export interface WebhookDeliveryWithAttempts {
  readonly "attemptCount": number | WebhookDeliveryWithAttemptsAttemptCountEnum | WebhookDeliveryWithAttemptsAttemptCountEnum | WebhookDeliveryWithAttemptsAttemptCountEnum;
  readonly "attempts": ReadonlyArray<WebhookDeliveryAttempt>;
  readonly "completedAt": string | null;
  readonly "createdAt": string | null;
  readonly "eventOccurredAt": string;
  readonly "eventType": string;
  readonly "id": string;
  readonly "maxAttempts": number | WebhookDeliveryWithAttemptsMaxAttemptsEnum | WebhookDeliveryWithAttemptsMaxAttemptsEnum | WebhookDeliveryWithAttemptsMaxAttemptsEnum;
  readonly "nextAttemptAt": string | null;
  readonly "payload": null;
  readonly "projectId": string;
  readonly "status": WebhookDeliveryWithAttemptsStatusEnum | WebhookDeliveryWithAttemptsStatusEnum | WebhookDeliveryWithAttemptsStatusEnum | WebhookDeliveryWithAttemptsStatusEnum | WebhookDeliveryWithAttemptsStatusEnum;
  readonly "webhookEndpointId": string
}

export type WebhookDeliveryNotFoundErrorTag = "WebhookDeliveryNotFoundError"

export interface WebhookDeliveryNotFoundError {
  readonly "_tag": WebhookDeliveryNotFoundErrorTag;
  readonly "deliveryId": string
}

export type WebhooksGetWebhookDelivery500 = WebhookServiceError | AuthenticationError | NotAuthenticatedError

export type WebhooksRetryWebhookDelivery400 = WebhookValidationError | EffectHttpApiSchemaError

export type WebhooksRetryWebhookDelivery500 = WebhookServiceError | AuthenticationError | NotAuthenticatedError

export const make = (
  httpClient: HttpClient.HttpClient, 
  options: {
    readonly transformClient?: ((client: HttpClient.HttpClient) => Effect.Effect<HttpClient.HttpClient>) | undefined
  } = {}
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
                typeof description === "string"
                  ? description
                  : JSON.stringify(description),
            }),
          }),
        ),
    )
  const withResponse: <A, E>(
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, E>,
  ) => (
    request: HttpClientRequest.HttpClientRequest,
  ) => Effect.Effect<any, any> = options.transformClient
    ? (f) => (request) =>
        Effect.flatMap(
          Effect.flatMap(options.transformClient!(httpClient), (client) =>
            client.execute(request),
          ),
          f,
        )
    : (f) => (request) => Effect.flatMap(httpClient.execute(request), f)
  const decodeSuccess = <A>(response: HttpClientResponse.HttpClientResponse) =>
    response.json as Effect.Effect<A, HttpClientError.HttpClientError>
  const decodeVoid = (_response: HttpClientResponse.HttpClientResponse) =>
    Effect.void
  const decodeError =
    <Tag extends string, E>(tag: Tag) =>
    (
      response: HttpClientResponse.HttpClientResponse,
    ): Effect.Effect<
      never,
      VoidhashCoreClientError<Tag, E> | HttpClientError.HttpClientError
    > =>
      Effect.flatMap(
        response.json as Effect.Effect<E, HttpClientError.HttpClientError>,
        (cause) => Effect.fail(VoidhashCoreClientError(tag, cause, response)),
      )
  const onRequest = (
    successCodes: ReadonlyArray<string>,
    errorCodes?: Record<string, string>,
  ) => {
    const cases: any = { orElse: unexpectedStatus }
    for (const code of successCodes) {
      cases[code] = decodeSuccess
    }
    if (errorCodes) {
      for (const [code, tag] of Object.entries(errorCodes)) {
        cases[code] = decodeError(tag)
      }
    }
    if (successCodes.length === 0) {
      cases["2xx"] = decodeVoid
    }
    return withResponse(HttpClientResponse.matchStatus(cases) as any)
  }
  return {
    httpClient,
    "authSession": () => HttpClientRequest.get(`/api/v1/auth/session`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"AuthSession500"})
  ),
  "apiKeysListApiKeys": () => HttpClientRequest.get(`/api/v1/api-keys`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"ApiKeysListApiKeys500"})
  ),
  "apiKeysCreateSecretKey": (options) => HttpClientRequest.post(`/api/v1/api-keys`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"ApiKeysCreateSecretKey500"})
  ),
  "apiKeysGetApiKeyById": (apiKeyId) => HttpClientRequest.get(`/api/v1/api-keys/${apiKeyId}`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","404":"ApiKeyNotFoundError","500":"ApiKeysGetApiKeyById500"})
  ),
  "apiKeysDeleteApiKey": (apiKeyId) => HttpClientRequest.delete(`/api/v1/api-keys/${apiKeyId}`).pipe(
    onRequest([], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","404":"ApiKeyNotFoundError","500":"ApiKeysDeleteApiKey500"})
  ),
  "apiKeysRotateSecretKey": (apiKeyId) => HttpClientRequest.post(`/api/v1/api-keys/${apiKeyId}/rotate`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","404":"ApiKeyNotFoundError","500":"ApiKeysRotateSecretKey500"})
  ),
  "personsListPersons": () => HttpClientRequest.get(`/api/v1/persons`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"PersonsListPersons500"})
  ),
  "personsCreatePerson": (options) => HttpClientRequest.post(`/api/v1/persons`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"PersonsCreatePerson400","403":"ActionForbiddenError","500":"PersonsCreatePerson500"})
  ),
  "personsGetPersonById": (personId) => HttpClientRequest.get(`/api/v1/persons/${personId}`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","404":"PersonNotFoundError","500":"PersonsGetPersonById500"})
  ),
  "personsGetPersonByDistinctId": (distinctId) => HttpClientRequest.get(`/api/v1/persons/by-distinct-id/${distinctId}`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","404":"PersonNotFoundError","500":"PersonsGetPersonByDistinctId500"})
  ),
  "organizationsCreateOrganization": (options) => HttpClientRequest.post(`/api/v1/organizations`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","500":"OrganizationsCreateOrganization500"})
  ),
  "perksListPerks": () => HttpClientRequest.get(`/api/v1/perks`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"PerksListPerks500"})
  ),
  "paywallLocationsListPaywallLocations": () => HttpClientRequest.get(`/api/v1/paywall-locations`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"PaywallLocationsListPaywallLocations500"})
  ),
  "projectsCreateProject": (options) => HttpClientRequest.post(`/api/v1/projects`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"ProjectsCreateProject500"})
  ),
  "projectsListProjects": (organizationId) => HttpClientRequest.get(`/api/v1/projects/${organizationId}`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"ProjectsListProjects500"})
  ),
  "productsListProducts": () => HttpClientRequest.get(`/api/v1/products`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"ProductsListProducts500"})
  ),
  "productPerksListProductPerksByProductId": (productId) => HttpClientRequest.get(`/api/v1/product-perks/by-product-id/${productId}`).pipe(
    onRequest(["2xx"], {"400":"ProductPerksListProductPerksByProductId400","403":"ActionForbiddenError","500":"ProductPerksListProductPerksByProductId500"})
  ),
  "sdkGetPerson": (options) => HttpClientRequest.get(`/api/v1/sdk/person`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options?.["x-distinct-id"] ?? undefined, "x-publishable-key": options?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options?.["x-client-locale"] ?? undefined, "x-client-version": options?.["x-client-version"] ?? undefined, "x-is-backgrounded": options?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options?.["x-is-debug-build"] ?? undefined, "x-nonce": options?.["x-nonce"] ?? undefined, "x-observer-mode": options?.["x-observer-mode"] ?? undefined, "x-platform": options?.["x-platform"] ?? undefined, "x-platform-brand": options?.["x-platform-brand"] ?? undefined, "x-platform-device": options?.["x-platform-device"] ?? undefined, "x-platform-flavor": options?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options?.["x-platform-version"] ?? undefined, "x-preferred-locales": options?.["x-preferred-locales"] ?? undefined, "x-sdk": options?.["x-sdk"] ?? undefined, "x-sdk-version": options?.["x-sdk-version"] ?? undefined, "x-storefront": options?.["x-storefront"] ?? undefined }),
    onRequest(["2xx"], {"400":"SdkGetPerson400","404":"SdkPersonNotFoundError","500":"SdkGetPerson500"})
  ),
  "sdkIdentifyPerson": (options) => HttpClientRequest.post(`/api/v1/sdk/identify`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"400":"SdkIdentifyPerson400","409":"SdkPersonAlreadyIdentifiedError","500":"SdkIdentifyPerson500"})
  ),
  "sdkSyncPersonAttributes": (options) => HttpClientRequest.post(`/api/v1/sdk/person/traits`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"400":"SdkSyncPersonAttributes400","500":"SdkSyncPersonAttributes500"})
  ),
  "sdkSyncTransaction": (options) => HttpClientRequest.post(`/api/v1/sdk/sync-transaction`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"400":"SdkSyncTransaction400","500":"SdkSyncTransaction500"})
  ),
  "sdkEvaluateFeatureFlags": (options) => HttpClientRequest.post(`/api/v1/sdk/evaluate-flags`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","500":"SdkEvaluateFeatureFlags500"})
  ),
  "sdkResolvePaywall": (options) => HttpClientRequest.post(`/api/v1/sdk/resolve-paywall`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"400":"SdkResolvePaywall400","500":"SdkResolvePaywall500"})
  ),
  "usersGetUser": () => HttpClientRequest.get(`/api/v1/users/current`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","500":"UsersGetUser500"})
  ),
  "paymentProviderConfigurationsListPaymentProviderConfigurations": () => HttpClientRequest.get(`/api/v1/payment-provider-configurations`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"PaymentProviderConfigurationsListPaymentProviderConfigurations500"})
  ),
  "paymentProviderProductsListPaymentProviderProducts": () => HttpClientRequest.get(`/api/v1/payment-provider-products`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"PaymentProviderProductsListPaymentProviderProducts500"})
  ),
  "changesetsDeployChangeset": (options) => HttpClientRequest.post(`/api/v1/changesets/deploy`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"ChangesetsDeployChangeset500"})
  ),
  "webhooksListWebhookEndpoints": () => HttpClientRequest.get(`/api/v1/webhooks/endpoints`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"WebhooksListWebhookEndpoints500"})
  ),
  "webhooksCreateWebhookEndpoint": (options) => HttpClientRequest.post(`/api/v1/webhooks/endpoints`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"WebhooksCreateWebhookEndpoint400","403":"ActionForbiddenError","500":"WebhooksCreateWebhookEndpoint500"})
  ),
  "webhooksGetWebhookEndpoint": (endpointId) => HttpClientRequest.get(`/api/v1/webhooks/endpoints/${endpointId}`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","404":"WebhookEndpointNotFoundError","500":"WebhooksGetWebhookEndpoint500"})
  ),
  "webhooksDeleteWebhookEndpoint": (endpointId) => HttpClientRequest.delete(`/api/v1/webhooks/endpoints/${endpointId}`).pipe(
    onRequest([], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","404":"WebhookEndpointNotFoundError","500":"WebhooksDeleteWebhookEndpoint500"})
  ),
  "webhooksUpdateWebhookEndpoint": (endpointId, options) => HttpClientRequest.patch(`/api/v1/webhooks/endpoints/${endpointId}`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"WebhooksUpdateWebhookEndpoint400","403":"ActionForbiddenError","404":"WebhookEndpointNotFoundError","500":"WebhooksUpdateWebhookEndpoint500"})
  ),
  "webhooksRotateWebhookSecret": (endpointId) => HttpClientRequest.post(`/api/v1/webhooks/endpoints/${endpointId}/rotate-secret`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","404":"WebhookEndpointNotFoundError","500":"WebhooksRotateWebhookSecret500"})
  ),
  "webhooksTestWebhookEndpoint": (endpointId) => HttpClientRequest.post(`/api/v1/webhooks/endpoints/${endpointId}/test`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","404":"WebhookEndpointNotFoundError","500":"WebhooksTestWebhookEndpoint500"})
  ),
  "webhooksListWebhookDeliveries": () => HttpClientRequest.get(`/api/v1/webhooks/deliveries`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","500":"WebhooksListWebhookDeliveries500"})
  ),
  "webhooksGetWebhookDelivery": (deliveryId) => HttpClientRequest.get(`/api/v1/webhooks/deliveries/${deliveryId}`).pipe(
    onRequest(["2xx"], {"400":"EffectHttpApiSchemaError","403":"ActionForbiddenError","404":"WebhookDeliveryNotFoundError","500":"WebhooksGetWebhookDelivery500"})
  ),
  "webhooksRetryWebhookDelivery": (deliveryId) => HttpClientRequest.post(`/api/v1/webhooks/deliveries/${deliveryId}/retry`).pipe(
    onRequest(["2xx"], {"400":"WebhooksRetryWebhookDelivery400","403":"ActionForbiddenError","404":"WebhookDeliveryNotFoundError","500":"WebhooksRetryWebhookDelivery500"})
  )
  }
}

export interface VoidhashCoreClient {
  readonly httpClient: HttpClient.HttpClient
  readonly "authSession": () => Effect.Effect<AuthSession200, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"AuthSession500", AuthSession500>>
  readonly "apiKeysListApiKeys": () => Effect.Effect<ApiKeysListApiKeys200, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"ApiKeysListApiKeys500", ApiKeysListApiKeys500>>
  readonly "apiKeysCreateSecretKey": (options: CreateSecretKeyBody) => Effect.Effect<ApiKeyWithRawKey, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"ApiKeysCreateSecretKey500", ApiKeysCreateSecretKey500>>
  readonly "apiKeysGetApiKeyById": (apiKeyId: string) => Effect.Effect<ApiKey, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"ApiKeyNotFoundError", ApiKeyNotFoundError> | VoidhashCoreClientError<"ApiKeysGetApiKeyById500", ApiKeysGetApiKeyById500>>
  readonly "apiKeysDeleteApiKey": (apiKeyId: string) => Effect.Effect<void, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"ApiKeyNotFoundError", ApiKeyNotFoundError> | VoidhashCoreClientError<"ApiKeysDeleteApiKey500", ApiKeysDeleteApiKey500>>
  readonly "apiKeysRotateSecretKey": (apiKeyId: string) => Effect.Effect<ApiKeyWithRawKey, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"ApiKeyNotFoundError", ApiKeyNotFoundError> | VoidhashCoreClientError<"ApiKeysRotateSecretKey500", ApiKeysRotateSecretKey500>>
  readonly "personsListPersons": () => Effect.Effect<PersonsListPersons200, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"PersonsListPersons500", PersonsListPersons500>>
  readonly "personsCreatePerson": (options: CreatePersonBody) => Effect.Effect<Person, HttpClientError.HttpClientError | VoidhashCoreClientError<"PersonsCreatePerson400", PersonsCreatePerson400> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"PersonsCreatePerson500", PersonsCreatePerson500>>
  readonly "personsGetPersonById": (personId: string) => Effect.Effect<Person, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"PersonNotFoundError", PersonNotFoundError> | VoidhashCoreClientError<"PersonsGetPersonById500", PersonsGetPersonById500>>
  readonly "personsGetPersonByDistinctId": (distinctId: string) => Effect.Effect<Person, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"PersonNotFoundError", PersonNotFoundError> | VoidhashCoreClientError<"PersonsGetPersonByDistinctId500", PersonsGetPersonByDistinctId500>>
  readonly "organizationsCreateOrganization": (options: CreateOrganizationBody) => Effect.Effect<Organization, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"OrganizationsCreateOrganization500", OrganizationsCreateOrganization500>>
  readonly "perksListPerks": () => Effect.Effect<PerksListPerks200, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"PerksListPerks500", PerksListPerks500>>
  readonly "paywallLocationsListPaywallLocations": () => Effect.Effect<PaywallLocationsListPaywallLocations200, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"PaywallLocationsListPaywallLocations500", PaywallLocationsListPaywallLocations500>>
  readonly "projectsCreateProject": (options: CreateProjectBody) => Effect.Effect<Project, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"ProjectsCreateProject500", ProjectsCreateProject500>>
  readonly "projectsListProjects": (organizationId: string) => Effect.Effect<ProjectsListProjects200, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"ProjectsListProjects500", ProjectsListProjects500>>
  readonly "productsListProducts": () => Effect.Effect<ProductsListProducts200, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"ProductsListProducts500", ProductsListProducts500>>
  readonly "productPerksListProductPerksByProductId": (productId: string) => Effect.Effect<ProductPerksListProductPerksByProductId200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ProductPerksListProductPerksByProductId400", ProductPerksListProductPerksByProductId400> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"ProductPerksListProductPerksByProductId500", ProductPerksListProductPerksByProductId500>>
  readonly "sdkGetPerson": (options: SdkGetPersonParams) => Effect.Effect<SdkPerson, HttpClientError.HttpClientError | VoidhashCoreClientError<"SdkGetPerson400", SdkGetPerson400> | VoidhashCoreClientError<"SdkPersonNotFoundError", SdkPersonNotFoundError> | VoidhashCoreClientError<"SdkGetPerson500", SdkGetPerson500>>
  readonly "sdkIdentifyPerson": (options: { readonly params: SdkIdentifyPersonParams; readonly payload: SdkIdentifyBody }) => Effect.Effect<SdkPerson, HttpClientError.HttpClientError | VoidhashCoreClientError<"SdkIdentifyPerson400", SdkIdentifyPerson400> | VoidhashCoreClientError<"SdkPersonAlreadyIdentifiedError", SdkPersonAlreadyIdentifiedError> | VoidhashCoreClientError<"SdkIdentifyPerson500", SdkIdentifyPerson500>>
  readonly "sdkSyncPersonAttributes": (options: { readonly params: SdkSyncPersonAttributesParams; readonly payload: SdkSyncPersonAttributesBody }) => Effect.Effect<SdkPerson, HttpClientError.HttpClientError | VoidhashCoreClientError<"SdkSyncPersonAttributes400", SdkSyncPersonAttributes400> | VoidhashCoreClientError<"SdkSyncPersonAttributes500", SdkSyncPersonAttributes500>>
  readonly "sdkSyncTransaction": (options: { readonly params: SdkSyncTransactionParams; readonly payload: SdkSyncTransactionRequest }) => Effect.Effect<SdkSyncTransactionResponse, HttpClientError.HttpClientError | VoidhashCoreClientError<"SdkSyncTransaction400", SdkSyncTransaction400> | VoidhashCoreClientError<"SdkSyncTransaction500", SdkSyncTransaction500>>
  readonly "sdkEvaluateFeatureFlags": (options: { readonly params: SdkEvaluateFeatureFlagsParams; readonly payload: EvaluateFeatureFlagsBody }) => Effect.Effect<SdkFeatureFlagsResponse, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"SdkEvaluateFeatureFlags500", SdkEvaluateFeatureFlags500>>
  readonly "sdkResolvePaywall": (options: { readonly params: SdkResolvePaywallParams; readonly payload: SdkResolvePaywallBody }) => Effect.Effect<SdkResolvePaywall200, HttpClientError.HttpClientError | VoidhashCoreClientError<"SdkResolvePaywall400", SdkResolvePaywall400> | VoidhashCoreClientError<"SdkResolvePaywall500", SdkResolvePaywall500>>
  readonly "usersGetUser": () => Effect.Effect<User, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"UsersGetUser500", UsersGetUser500>>
  readonly "paymentProviderConfigurationsListPaymentProviderConfigurations": () => Effect.Effect<PaymentProviderConfigurationsListPaymentProviderConfigurations200, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"PaymentProviderConfigurationsListPaymentProviderConfigurations500", PaymentProviderConfigurationsListPaymentProviderConfigurations500>>
  readonly "paymentProviderProductsListPaymentProviderProducts": () => Effect.Effect<PaymentProviderProductsListPaymentProviderProducts200, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"PaymentProviderProductsListPaymentProviderProducts500", PaymentProviderProductsListPaymentProviderProducts500>>
  readonly "changesetsDeployChangeset": (options: DeployChangesetBody) => Effect.Effect<DeployChangesetResponse, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"ChangesetsDeployChangeset500", ChangesetsDeployChangeset500>>
  readonly "webhooksListWebhookEndpoints": () => Effect.Effect<WebhooksListWebhookEndpoints200, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"WebhooksListWebhookEndpoints500", WebhooksListWebhookEndpoints500>>
  readonly "webhooksCreateWebhookEndpoint": (options: CreateWebhookEndpointBody) => Effect.Effect<WebhookEndpoint, HttpClientError.HttpClientError | VoidhashCoreClientError<"WebhooksCreateWebhookEndpoint400", WebhooksCreateWebhookEndpoint400> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"WebhooksCreateWebhookEndpoint500", WebhooksCreateWebhookEndpoint500>>
  readonly "webhooksGetWebhookEndpoint": (endpointId: string) => Effect.Effect<WebhookEndpoint, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"WebhookEndpointNotFoundError", WebhookEndpointNotFoundError> | VoidhashCoreClientError<"WebhooksGetWebhookEndpoint500", WebhooksGetWebhookEndpoint500>>
  readonly "webhooksDeleteWebhookEndpoint": (endpointId: string) => Effect.Effect<void, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"WebhookEndpointNotFoundError", WebhookEndpointNotFoundError> | VoidhashCoreClientError<"WebhooksDeleteWebhookEndpoint500", WebhooksDeleteWebhookEndpoint500>>
  readonly "webhooksUpdateWebhookEndpoint": (endpointId: string, options: UpdateWebhookEndpointBody) => Effect.Effect<WebhookEndpoint, HttpClientError.HttpClientError | VoidhashCoreClientError<"WebhooksUpdateWebhookEndpoint400", WebhooksUpdateWebhookEndpoint400> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"WebhookEndpointNotFoundError", WebhookEndpointNotFoundError> | VoidhashCoreClientError<"WebhooksUpdateWebhookEndpoint500", WebhooksUpdateWebhookEndpoint500>>
  readonly "webhooksRotateWebhookSecret": (endpointId: string) => Effect.Effect<WebhookEndpoint, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"WebhookEndpointNotFoundError", WebhookEndpointNotFoundError> | VoidhashCoreClientError<"WebhooksRotateWebhookSecret500", WebhooksRotateWebhookSecret500>>
  readonly "webhooksTestWebhookEndpoint": (endpointId: string) => Effect.Effect<WebhookDelivery, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"WebhookEndpointNotFoundError", WebhookEndpointNotFoundError> | VoidhashCoreClientError<"WebhooksTestWebhookEndpoint500", WebhooksTestWebhookEndpoint500>>
  readonly "webhooksListWebhookDeliveries": () => Effect.Effect<WebhooksListWebhookDeliveries200, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"WebhooksListWebhookDeliveries500", WebhooksListWebhookDeliveries500>>
  readonly "webhooksGetWebhookDelivery": (deliveryId: string) => Effect.Effect<WebhookDeliveryWithAttempts, HttpClientError.HttpClientError | VoidhashCoreClientError<"EffectHttpApiSchemaError", EffectHttpApiSchemaError> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"WebhookDeliveryNotFoundError", WebhookDeliveryNotFoundError> | VoidhashCoreClientError<"WebhooksGetWebhookDelivery500", WebhooksGetWebhookDelivery500>>
  readonly "webhooksRetryWebhookDelivery": (deliveryId: string) => Effect.Effect<WebhookDelivery, HttpClientError.HttpClientError | VoidhashCoreClientError<"WebhooksRetryWebhookDelivery400", WebhooksRetryWebhookDelivery400> | VoidhashCoreClientError<"ActionForbiddenError", ActionForbiddenError> | VoidhashCoreClientError<"WebhookDeliveryNotFoundError", WebhookDeliveryNotFoundError> | VoidhashCoreClientError<"WebhooksRetryWebhookDelivery500", WebhooksRetryWebhookDelivery500>>
}

export interface VoidhashCoreClientError<Tag extends string, E> extends Error {
  readonly _tag: Tag
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response: HttpClientResponse.HttpClientResponse
  readonly data: E
  readonly message: string
}

class VoidhashCoreClientErrorImpl extends Data.Error<{
  _tag: string
  data: any
  message: string
  request: HttpClientRequest.HttpClientRequest
  response: HttpClientResponse.HttpClientResponse
}> {
  name = "VoidhashCoreClientError"
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
  }) as any
