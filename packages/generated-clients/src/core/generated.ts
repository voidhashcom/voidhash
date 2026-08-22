import type * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"

export type AuthSession200Method = "api-key" | "publishable-key" | "secret-key"

export interface AuthSession200 {
  readonly "method": AuthSession200Method;
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

export type ApiNotAuthenticatedErrorJsonEncodingTag = "Api/NotAuthenticatedError"

export interface ApiNotAuthenticatedErrorJsonEncoding {
  readonly "_tag": ApiNotAuthenticatedErrorJsonEncodingTag;
  readonly "message": string
}

export type ApiActionForbiddenErrorJsonEncodingTag = "Api/ActionForbiddenError"

export interface ApiActionForbiddenErrorJsonEncoding {
  readonly "_tag": ApiActionForbiddenErrorJsonEncodingTag;
  readonly "message": string
}

export type ApiAuthenticationErrorJsonEncodingTag = "Api/AuthenticationError"

export interface ApiAuthenticationErrorJsonEncoding {
  readonly "_tag": ApiAuthenticationErrorJsonEncodingTag;
  readonly "cause": string;
  readonly "message": string
}

export interface ApiKeyJsonEncoding {
  readonly "end": string;
  readonly "id": string;
  readonly "isPublic": boolean;
  readonly "name": string;
  readonly "prefix": string;
  readonly "projectId": string;
  readonly "rawKey"?: string | null | undefined
}

export type ApiKeysListApiKeys200 = ReadonlyArray<ApiKeyJsonEncoding>

export type ApiApiKeyServiceErrorJsonEncodingTag = "Api/ApiKeyServiceError"

export interface ApiApiKeyServiceErrorJsonEncoding {
  readonly "_tag": ApiApiKeyServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type ApiKeysListApiKeys500 = ApiApiKeyServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface CreateSecretKeyBodyJsonEncoding {
  readonly "name": string;
  readonly "projectId": string
}

export interface ApiKeyWithRawKeyJsonEncoding {
  readonly "end": string;
  readonly "id": string;
  readonly "isPublic": boolean;
  readonly "name": string;
  readonly "prefix": string;
  readonly "projectId": string;
  readonly "rawKey": string
}

export type ApiKeysCreateSecretKey500 = ApiApiKeyServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type ApiApiKeyNotFoundErrorJsonEncodingTag = "Api/ApiKeyNotFoundError"

export interface ApiApiKeyNotFoundErrorJsonEncoding {
  readonly "_tag": ApiApiKeyNotFoundErrorJsonEncodingTag;
  readonly "message": string
}

export type ApiKeysGetApiKeyById500 = ApiApiKeyServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type ApiKeysDeleteApiKey500 = ApiApiKeyServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type ApiKeysRotateSecretKey500 = ApiApiKeyServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface PersonJsonEncoding {
  readonly "personId": string;
  readonly "distinctId": string;
  readonly "email": string | null;
  readonly "name": string | null
}

export type PersonsListPersons200 = ReadonlyArray<PersonJsonEncoding>

export type ApiPersonServiceErrorJsonEncodingTag = "Api/PersonServiceError"

export interface ApiPersonServiceErrorJsonEncoding {
  readonly "_tag": ApiPersonServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type PersonsListPersons500 = ApiPersonServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface CreatePersonBodyJsonEncoding {
  readonly "distinctId": string;
  readonly "email"?: string | null | undefined;
  readonly "name"?: string | null | undefined
}

export type ApiPersonInvalidAnonymousIdErrorJsonEncodingTag = "Api/PersonInvalidAnonymousIdError"

export interface ApiPersonInvalidAnonymousIdErrorJsonEncoding {
  readonly "_tag": ApiPersonInvalidAnonymousIdErrorJsonEncodingTag;
  readonly "id": string
}

export type PersonsCreatePerson500 = ApiPersonServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type ApiPersonNotFoundErrorJsonEncodingTag = "Api/PersonNotFoundError"

export interface ApiPersonNotFoundErrorJsonEncoding {
  readonly "_tag": ApiPersonNotFoundErrorJsonEncodingTag;
  readonly "id": string
}

export type PersonsGetPersonById500 = ApiPersonServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type PersonsGetPersonByDistinctId500 = ApiPersonServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type SdkEntitlementGrantJsonEncodingSource = "subscription" | "purchase" | "manual"

export type SdkEntitlementGrantJsonEncodingStatus = "active" | "expired"

export interface SdkEntitlementGrantJsonEncoding {
  readonly "expiresAt": string | null;
  readonly "perkId": string;
  readonly "source": SdkEntitlementGrantJsonEncodingSource;
  readonly "sourceId": string | null;
  readonly "sourcePersonId": string;
  readonly "status": SdkEntitlementGrantJsonEncodingStatus
}

export interface PersonEntitlementsResponseJsonEncoding {
  readonly "grants": ReadonlyArray<SdkEntitlementGrantJsonEncoding>
}

export type PersonsGetPersonEntitlements500 = ApiPersonServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type Objects = Record<string, unknown>

export interface SetPersonAttributesBodyJsonEncoding {
  readonly "distinctId": string;
  readonly "email"?: string | null | undefined;
  readonly "name"?: string | null | undefined;
  readonly "traits"?: Objects | null | undefined;
  readonly "setOnce"?: Objects | null | undefined
}

export type PersonsSetPersonAttributes500 = ApiPersonServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type SendNotificationBodyJsonEncodingBadgeEnum = "Infinity" | "-Infinity" | "NaN"

export type SendNotificationBodyJsonEncodingPriorityEnum = "default" | "high"

export type SendNotificationBodyJsonEncodingTtlEnum = "Infinity" | "-Infinity" | "NaN"

export interface SendNotificationBodyJsonEncoding {
  readonly "personIds"?: ReadonlyArray<string> | null | undefined;
  readonly "distinctIds"?: ReadonlyArray<string> | null | undefined;
  readonly "title": string;
  readonly "body": string;
  readonly "data"?: Record<string, unknown> | null | undefined;
  readonly "sound"?: string | null | undefined;
  readonly "badge"?: number | SendNotificationBodyJsonEncodingBadgeEnum | null | undefined;
  readonly "priority"?: SendNotificationBodyJsonEncodingPriorityEnum | null | undefined;
  readonly "ttl"?: number | SendNotificationBodyJsonEncodingTtlEnum | null | undefined;
  readonly "channelId"?: string | null | undefined;
  readonly "collapseId"?: string | null | undefined;
  readonly "idempotencyKey"?: string | null | undefined
}

export type SendNotificationResponseJsonEncodingDeviceCountEnum = "Infinity" | "-Infinity" | "NaN"

export type SendNotificationResponseJsonEncodingStatus = "pending" | "in_progress" | "succeeded" | "partial_failed" | "failed" | "no_recipients"

export interface SendNotificationResponseJsonEncoding {
  readonly "pushNotificationSendId": string;
  readonly "deviceCount": number | SendNotificationResponseJsonEncodingDeviceCountEnum;
  readonly "status": SendNotificationResponseJsonEncodingStatus;
  readonly "unresolvedDistinctIds": ReadonlyArray<string>
}

export type ApiPushDeviceValidationErrorJsonEncodingTag = "Api/PushDeviceValidationError"

export interface ApiPushDeviceValidationErrorJsonEncoding {
  readonly "_tag": ApiPushDeviceValidationErrorJsonEncodingTag;
  readonly "message": string
}

export type ApiPushSendNotEnabledErrorJsonEncodingTag = "Api/PushSendNotEnabledError"

export interface ApiPushSendNotEnabledErrorJsonEncoding {
  readonly "_tag": ApiPushSendNotEnabledErrorJsonEncodingTag;
  readonly "message": string
}

export type ApiPushSendServiceErrorJsonEncodingTag = "Api/PushSendServiceError"

export interface ApiPushSendServiceErrorJsonEncoding {
  readonly "_tag": ApiPushSendServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type NotificationsSendNotification500 = ApiAuthenticationErrorJsonEncoding | ApiPushSendServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface CreateOrganizationBodyJsonEncoding {
  readonly "name": string
}

export interface OrganizationJsonEncoding {
  readonly "id": string;
  readonly "name": string;
  readonly "slug": string
}

export type ApiOrganizationServiceErrorJsonEncodingTag = "Api/OrganizationServiceError"

export interface ApiOrganizationServiceErrorJsonEncoding {
  readonly "_tag": ApiOrganizationServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type OrganizationsCreateOrganization500 = ApiOrganizationServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface PerkJsonEncoding {
  readonly "id": string;
  readonly "name": string;
  readonly "projectId": string;
  readonly "slug": string
}

export type PerksListPerks200 = ReadonlyArray<PerkJsonEncoding>

export type ApiPerkServiceErrorJsonEncodingTag = "Api/PerkServiceError"

export interface ApiPerkServiceErrorJsonEncoding {
  readonly "_tag": ApiPerkServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type PerksListPerks500 = ApiPerkServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface PaywallDeploysCreateDeployRequest {
  
}

export interface CreatePaywallDeployResponseJsonEncoding {
  readonly "deployId": string;
  readonly "missing": ReadonlyArray<string>
}

export type ApiPaywallDeployUpgradeRequiredErrorJsonEncodingTag = "Api/PaywallDeployUpgradeRequiredError"

export type ApiPaywallDeployUpgradeRequiredErrorJsonEncodingSchemaVersionEnum = "Infinity" | "-Infinity" | "NaN"

export interface ApiPaywallDeployUpgradeRequiredErrorJsonEncoding {
  readonly "_tag": ApiPaywallDeployUpgradeRequiredErrorJsonEncodingTag;
  readonly "message": string;
  readonly "schemaVersion": number | ApiPaywallDeployUpgradeRequiredErrorJsonEncodingSchemaVersionEnum | null
}

export type ApiPaywallDeployValidationErrorJsonEncodingTag = "Api/PaywallDeployValidationError"

export interface ApiPaywallDeployValidationErrorJsonEncoding {
  readonly "_tag": ApiPaywallDeployValidationErrorJsonEncodingTag;
  readonly "message": string;
  readonly "violations": ReadonlyArray<string>
}

export type ApiPaywallDeployServiceErrorJsonEncodingTag = "Api/PaywallDeployServiceError"

export interface ApiPaywallDeployServiceErrorJsonEncoding {
  readonly "_tag": ApiPaywallDeployServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type PaywallDeploysCreateDeploy500 = ApiPaywallDeployServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type UploadPaywallDeployBlobResponseJsonEncoding = Record<string, unknown>

export type ApiDeployBlobNotDeclaredErrorJsonEncodingTag = "Api/DeployBlobNotDeclaredError"

export interface ApiDeployBlobNotDeclaredErrorJsonEncoding {
  readonly "_tag": ApiDeployBlobNotDeclaredErrorJsonEncodingTag;
  readonly "sha256": string
}

export type ApiPaywallDeployNotFoundErrorJsonEncodingTag = "Api/PaywallDeployNotFoundError"

export interface ApiPaywallDeployNotFoundErrorJsonEncoding {
  readonly "_tag": ApiPaywallDeployNotFoundErrorJsonEncodingTag;
  readonly "message": string
}

export type PaywallDeploysUploadBlob404 = ApiDeployBlobNotDeclaredErrorJsonEncoding | ApiPaywallDeployNotFoundErrorJsonEncoding

export type ApiPaywallDeployNotPendingErrorJsonEncodingTag = "Api/PaywallDeployNotPendingError"

export interface ApiPaywallDeployNotPendingErrorJsonEncoding {
  readonly "_tag": ApiPaywallDeployNotPendingErrorJsonEncodingTag;
  readonly "message": string
}

export type ApiDeployBlobHashMismatchErrorJsonEncodingTag = "Api/DeployBlobHashMismatchError"

export interface ApiDeployBlobHashMismatchErrorJsonEncoding {
  readonly "_tag": ApiDeployBlobHashMismatchErrorJsonEncodingTag;
  readonly "actualSha256": string;
  readonly "expectedSha256": string
}

export type PaywallDeploysUploadBlob422 = ApiDeployBlobHashMismatchErrorJsonEncoding | ApiPaywallDeployValidationErrorJsonEncoding

export type PaywallDeploysUploadBlob500 = ApiPaywallDeployServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type FinalizedPaywallDeployComponentJsonEncodingVersionEnum = "Infinity" | "-Infinity" | "NaN"

export interface FinalizedPaywallDeployComponentJsonEncoding {
  readonly "componentId": string;
  readonly "contentHash": string;
  readonly "id": string;
  readonly "version": number | FinalizedPaywallDeployComponentJsonEncodingVersionEnum
}

export type FinalizedPaywallDeployPaywallJsonEncodingVersionEnum = "Infinity" | "-Infinity" | "NaN"

export interface FinalizedPaywallDeployPaywallJsonEncoding {
  readonly "contentHash": string;
  readonly "id": string;
  readonly "paywallId": string;
  readonly "releaseId": string;
  readonly "url": string;
  readonly "version": number | FinalizedPaywallDeployPaywallJsonEncodingVersionEnum
}

export type FinalizePaywallDeployResponseJsonEncodingStatus = "ready"

export interface FinalizePaywallDeployResponseJsonEncoding {
  readonly "components": ReadonlyArray<FinalizedPaywallDeployComponentJsonEncoding>;
  readonly "deployId": string;
  readonly "paywalls": ReadonlyArray<FinalizedPaywallDeployPaywallJsonEncoding>;
  readonly "status": FinalizePaywallDeployResponseJsonEncodingStatus
}

export type ApiIncompleteDeployErrorJsonEncodingTag = "Api/IncompleteDeployError"

export interface ApiIncompleteDeployErrorJsonEncoding {
  readonly "_tag": ApiIncompleteDeployErrorJsonEncodingTag;
  readonly "missing": ReadonlyArray<string>
}

export type PaywallDeploysFinalizeDeploy500 = ApiPaywallDeployServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface PaywallLocationJsonEncoding {
  readonly "description": string | null;
  readonly "id": string;
  readonly "name": string;
  readonly "projectId": string;
  readonly "slug": string
}

export type PaywallLocationsListPaywallLocations200 = ReadonlyArray<PaywallLocationJsonEncoding>

export type ApiPaywallLocationServiceErrorJsonEncodingTag = "Api/PaywallLocationServiceError"

export interface ApiPaywallLocationServiceErrorJsonEncoding {
  readonly "_tag": ApiPaywallLocationServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type PaywallLocationsListPaywallLocations500 = ApiPaywallLocationServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface SchemaLocationJsonEncoding {
  readonly "description": string | null;
  readonly "name": string;
  readonly "slug": string
}

export interface SchemaPerkJsonEncoding {
  readonly "name": string;
  readonly "slug": string
}

export type SchemaProductJsonEncodingDurationEnum = "weekly" | "monthly" | "quarterly" | "semi-annual" | "annual"

export type Objects1 = Record<string, unknown>

export type SchemaProductProviderJsonEncodingProviderId = "appleAppStore" | "googlePlay"

export interface SchemaProductProviderJsonEncoding {
  readonly "configuration": Objects1;
  readonly "providerId": SchemaProductProviderJsonEncodingProviderId
}

export type SchemaProductJsonEncodingType = "subscription" | "one-time" | "one-time-consumable"

export interface SchemaProductJsonEncoding {
  readonly "duration": SchemaProductJsonEncodingDurationEnum | null;
  readonly "name": string;
  readonly "perks": ReadonlyArray<string>;
  readonly "providers": ReadonlyArray<SchemaProductProviderJsonEncoding>;
  readonly "slug": string;
  readonly "type": SchemaProductJsonEncodingType
}

export interface ProjectSchemaResponseJsonEncoding {
  readonly "enabledProviders": ReadonlyArray<"appleAppStore" | "googlePlay">;
  readonly "locations": ReadonlyArray<SchemaLocationJsonEncoding>;
  readonly "perks": ReadonlyArray<SchemaPerkJsonEncoding>;
  readonly "products": ReadonlyArray<SchemaProductJsonEncoding>;
  readonly "version": string
}

export type ApiSchemaServiceErrorJsonEncodingTag = "Api/SchemaServiceError"

export interface ApiSchemaServiceErrorJsonEncoding {
  readonly "_tag": ApiSchemaServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type SchemaGetSchema500 = ApiSchemaServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface SchemaVersionJsonEncoding {
  readonly "version": string
}

export type SchemaGetSchemaVersion500 = ApiSchemaServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface CreateProjectBodyJsonEncoding {
  readonly "name": string;
  readonly "organizationId": string
}

export interface ProjectJsonEncoding {
  readonly "id": string;
  readonly "name": string;
  readonly "slug": string
}

export type ApiProjectServiceErrorJsonEncodingTag = "Api/ProjectServiceError"

export interface ApiProjectServiceErrorJsonEncoding {
  readonly "_tag": ApiProjectServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type ProjectsCreateProject500 = ApiAuthenticationErrorJsonEncoding | ApiProjectServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type ProjectsListProjects200 = ReadonlyArray<ProjectJsonEncoding>

export type ProjectsListProjects500 = ApiProjectServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type ProductJsonEncodingDurationEnum = "Infinity" | "-Infinity" | "NaN"

export type ProductJsonEncodingType = "subscription" | "one-time" | "one-time-consumable"

export interface ProductJsonEncoding {
  readonly "duration": number | ProductJsonEncodingDurationEnum | null;
  readonly "id": string;
  readonly "name": string;
  readonly "projectId": string;
  readonly "slug": string;
  readonly "type": ProductJsonEncodingType
}

export type ProductsListProducts200 = ReadonlyArray<ProductJsonEncoding>

export type ApiProductServiceErrorJsonEncodingTag = "Api/ProductServiceError"

export interface ApiProductServiceErrorJsonEncoding {
  readonly "_tag": ApiProductServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type ProductsListProducts500 = ApiProductServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface ProductPerkJsonEncoding {
  readonly "id": string;
  readonly "perkId": string;
  readonly "productId": string
}

export type ProductPerksListProductPerksByProductId200 = ReadonlyArray<ProductPerkJsonEncoding>

export type ApiProductPerkValidationErrorJsonEncodingTag = "Api/ProductPerkValidationError"

export interface ApiProductPerkValidationErrorJsonEncoding {
  readonly "_tag": ApiProductPerkValidationErrorJsonEncodingTag;
  readonly "message": string
}

export type ApiProductPerkServiceErrorJsonEncodingTag = "Api/ProductPerkServiceError"

export interface ApiProductPerkServiceErrorJsonEncoding {
  readonly "_tag": ApiProductPerkServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type ProductPerksListProductPerksByProductId500 = ApiProductPerkServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type SdkGetPersonParamsXIsBackgrounded = "false"

export type SdkGetPersonParamsXIsDebugBuild = "true" | "false"

export type SdkGetPersonParamsXObserverMode = "true" | "false"

export type SdkGetPersonParamsXPlatformFlavor = "native" | "browser"

export type SdkGetPersonParamsXSdk = "react-native" | "web" | "ios" | "android"

export type SdkGetPersonParamsXEnvironmentEnum = "production" | "development" | "all"

export interface SdkGetPersonParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkGetPersonParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkGetPersonParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkGetPersonParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkGetPersonParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkGetPersonParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkGetPersonParamsXEnvironmentEnum | null | undefined
}

export type SdkPurchaseHistoryEntryJsonEncodingType = "one_time" | "subscription"

export interface SdkPurchaseHistoryEntryJsonEncoding {
  readonly "createdAt": string;
  readonly "productId": string | null;
  readonly "providerKey": string;
  readonly "purchaseId": string;
  readonly "sourcePersonId": string;
  readonly "type": SdkPurchaseHistoryEntryJsonEncodingType
}

export type SdkPersonJsonEncodingSnapshotContextMode = "persisted" | "temporary_pending_transfer"

export type SdkCurrentSubscriptionJsonEncodingStatus = "none" | "active" | "canceled" | "past_due" | "trialing"

export interface SdkCurrentSubscriptionJsonEncoding {
  readonly "expiresAt": string | null;
  readonly "productId": string | null;
  readonly "status": SdkCurrentSubscriptionJsonEncodingStatus;
  readonly "subscriptionId": string | null
}

export type SdkSubscriptionHistoryEntryJsonEncodingStatus = "active" | "canceled" | "expired" | "trialing" | "past_due"

export interface SdkSubscriptionHistoryEntryJsonEncoding {
  readonly "canceledAt": string | null;
  readonly "expiresAt": string | null;
  readonly "isTrial": boolean;
  readonly "productId": string | null;
  readonly "sourcePersonId": string;
  readonly "startsAt": string;
  readonly "status": SdkSubscriptionHistoryEntryJsonEncodingStatus;
  readonly "subscriptionId": string
}

export interface SdkPersonJsonEncoding {
  readonly "distinctId": string;
  readonly "email": string | null;
  readonly "entitlements": {
  readonly "grants": ReadonlyArray<SdkEntitlementGrantJsonEncoding>
};
  readonly "name": string | null;
  readonly "personId": string;
  readonly "purchases": {
  readonly "history": ReadonlyArray<SdkPurchaseHistoryEntryJsonEncoding>
};
  readonly "snapshotContext": {
  readonly "includedPersonIds": ReadonlyArray<string>;
  readonly "migrationJobId": string | null;
  readonly "mode": SdkPersonJsonEncodingSnapshotContextMode
};
  readonly "subscriptions": {
  readonly "current": SdkCurrentSubscriptionJsonEncoding | null;
  readonly "history": ReadonlyArray<SdkSubscriptionHistoryEntryJsonEncoding>
}
}

export type ApiSdkValidationErrorJsonEncodingTag = "Api/SdkValidationError"

export interface ApiSdkValidationErrorJsonEncoding {
  readonly "_tag": ApiSdkValidationErrorJsonEncodingTag;
  readonly "message": string
}

export type ApiSdkPersonNotFoundErrorJsonEncodingTag = "Api/SdkPersonNotFoundError"

export interface ApiSdkPersonNotFoundErrorJsonEncoding {
  readonly "_tag": ApiSdkPersonNotFoundErrorJsonEncodingTag;
  readonly "message": string
}

export type ApiSdkServiceErrorJsonEncodingTag = "Api/SdkServiceError"

export interface ApiSdkServiceErrorJsonEncoding {
  readonly "_tag": ApiSdkServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type SdkGetPerson500 = ApiAuthenticationErrorJsonEncoding | ApiSdkServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type SdkIdentifyPersonParamsXIsBackgrounded = "false"

export type SdkIdentifyPersonParamsXIsDebugBuild = "true" | "false"

export type SdkIdentifyPersonParamsXObserverMode = "true" | "false"

export type SdkIdentifyPersonParamsXPlatformFlavor = "native" | "browser"

export type SdkIdentifyPersonParamsXSdk = "react-native" | "web" | "ios" | "android"

export type SdkIdentifyPersonParamsXEnvironmentEnum = "production" | "development" | "all"

export interface SdkIdentifyPersonParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkIdentifyPersonParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkIdentifyPersonParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkIdentifyPersonParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkIdentifyPersonParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkIdentifyPersonParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkIdentifyPersonParamsXEnvironmentEnum | null | undefined
}

export interface SdkIdentifyBodyJsonEncoding {
  readonly "distinctId": string;
  readonly "email"?: string | null | undefined;
  readonly "name"?: string | null | undefined;
  readonly "traits"?: Objects | null | undefined
}

export type ApiSdkPersonAlreadyIdentifiedErrorJsonEncodingTag = "Api/SdkPersonAlreadyIdentifiedError"

export interface ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding {
  readonly "_tag": ApiSdkPersonAlreadyIdentifiedErrorJsonEncodingTag;
  readonly "distinctId": string
}

export type SdkIdentifyPerson500 = ApiAuthenticationErrorJsonEncoding | ApiSdkServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type SdkSyncPersonAttributesParamsXIsBackgrounded = "false"

export type SdkSyncPersonAttributesParamsXIsDebugBuild = "true" | "false"

export type SdkSyncPersonAttributesParamsXObserverMode = "true" | "false"

export type SdkSyncPersonAttributesParamsXPlatformFlavor = "native" | "browser"

export type SdkSyncPersonAttributesParamsXSdk = "react-native" | "web" | "ios" | "android"

export type SdkSyncPersonAttributesParamsXEnvironmentEnum = "production" | "development" | "all"

export interface SdkSyncPersonAttributesParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkSyncPersonAttributesParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkSyncPersonAttributesParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkSyncPersonAttributesParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkSyncPersonAttributesParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkSyncPersonAttributesParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkSyncPersonAttributesParamsXEnvironmentEnum | null | undefined
}

export interface SdkSyncPersonAttributesBodyJsonEncoding {
  readonly "email"?: string | null | undefined;
  readonly "name"?: string | null | undefined;
  readonly "traits"?: Objects | null | undefined;
  readonly "setOnce"?: Objects | null | undefined;
  readonly "clientEventId"?: string | null | undefined
}

export type SdkSyncPersonAttributes500 = ApiAuthenticationErrorJsonEncoding | ApiSdkServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type SdkSyncTransactionParamsXIsBackgrounded = "false"

export type SdkSyncTransactionParamsXIsDebugBuild = "true" | "false"

export type SdkSyncTransactionParamsXObserverMode = "true" | "false"

export type SdkSyncTransactionParamsXPlatformFlavor = "native" | "browser"

export type SdkSyncTransactionParamsXSdk = "react-native" | "web" | "ios" | "android"

export type SdkSyncTransactionParamsXEnvironmentEnum = "production" | "development" | "all"

export interface SdkSyncTransactionParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkSyncTransactionParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkSyncTransactionParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkSyncTransactionParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkSyncTransactionParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkSyncTransactionParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkSyncTransactionParamsXEnvironmentEnum | null | undefined
}

export type SdkSyncTransactionRequestPlatform = "ios" | "android"

export type SdkSyncTransactionRequestPurchaseDateEnum = "Infinity" | "-Infinity" | "NaN"

export type SdkSyncTransactionRequestQuantityEnum = "Infinity" | "-Infinity" | "NaN"

export interface SdkSyncTransactionRequest {
  readonly "appAccountToken"?: string | null | undefined;
  readonly "platform": SdkSyncTransactionRequestPlatform;
  readonly "providerProductId"?: string | null | undefined;
  readonly "productSlug": string;
  readonly "purchaseDate": number | SdkSyncTransactionRequestPurchaseDateEnum;
  readonly "purchaseToken"?: string | null | undefined;
  readonly "quantity": number | SdkSyncTransactionRequestQuantityEnum;
  readonly "receipt"?: string | null | undefined;
  readonly "transactionId": string
}

export interface SdkSyncTransactionResponseJsonEncoding {
  readonly "accepted": boolean
}

export type SdkSyncTransaction500 = ApiAuthenticationErrorJsonEncoding | ApiSdkServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type SdkDevelopmentPurchaseParamsXIsBackgrounded = "false"

export type SdkDevelopmentPurchaseParamsXIsDebugBuild = "true" | "false"

export type SdkDevelopmentPurchaseParamsXObserverMode = "true" | "false"

export type SdkDevelopmentPurchaseParamsXPlatformFlavor = "native" | "browser"

export type SdkDevelopmentPurchaseParamsXSdk = "react-native" | "web" | "ios" | "android"

export type SdkDevelopmentPurchaseParamsXEnvironmentEnum = "production" | "development" | "all"

export interface SdkDevelopmentPurchaseParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkDevelopmentPurchaseParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkDevelopmentPurchaseParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkDevelopmentPurchaseParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkDevelopmentPurchaseParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkDevelopmentPurchaseParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkDevelopmentPurchaseParamsXEnvironmentEnum | null | undefined
}

export type SdkDevelopmentPurchaseBodyJsonEncodingPurchaseDateEnum = "Infinity" | "-Infinity" | "NaN"

export type SdkDevelopmentPurchaseBodyJsonEncodingQuantityEnum = "Infinity" | "-Infinity" | "NaN"

export interface SdkDevelopmentPurchaseBodyJsonEncoding {
  readonly "devTransactionId": string;
  readonly "productSlug": string;
  readonly "purchaseDate": number | SdkDevelopmentPurchaseBodyJsonEncodingPurchaseDateEnum;
  readonly "quantity"?: number | SdkDevelopmentPurchaseBodyJsonEncodingQuantityEnum | null | undefined
}

export interface SdkDevelopmentPurchaseResponseJsonEncoding {
  readonly "accepted": boolean;
  readonly "warning": string | null
}

export type SdkDevelopmentPurchase500 = ApiAuthenticationErrorJsonEncoding | ApiSdkServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type SdkEvaluateFeatureFlagsParamsXIsBackgrounded = "false"

export type SdkEvaluateFeatureFlagsParamsXIsDebugBuild = "true" | "false"

export type SdkEvaluateFeatureFlagsParamsXObserverMode = "true" | "false"

export type SdkEvaluateFeatureFlagsParamsXPlatformFlavor = "native" | "browser"

export type SdkEvaluateFeatureFlagsParamsXSdk = "react-native" | "web" | "ios" | "android"

export type SdkEvaluateFeatureFlagsParamsXEnvironmentEnum = "production" | "development" | "all"

export interface SdkEvaluateFeatureFlagsParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkEvaluateFeatureFlagsParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkEvaluateFeatureFlagsParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkEvaluateFeatureFlagsParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkEvaluateFeatureFlagsParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkEvaluateFeatureFlagsParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkEvaluateFeatureFlagsParamsXEnvironmentEnum | null | undefined
}

export interface EvaluateFeatureFlagsBodyJsonEncoding {
  readonly "flagKeys"?: ReadonlyArray<string> | null | undefined
}

export interface SdkFeatureFlagResultJsonEncoding {
  readonly "enabled": boolean;
  readonly "key": string;
  readonly "variantKey": string | null
}

export interface SdkFeatureFlagsResponseJsonEncoding {
  readonly "flags": ReadonlyArray<SdkFeatureFlagResultJsonEncoding>
}

export type SdkEvaluateFeatureFlags500 = ApiAuthenticationErrorJsonEncoding | ApiSdkServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type SdkResolvePaywallParamsXIsBackgrounded = "false"

export type SdkResolvePaywallParamsXIsDebugBuild = "true" | "false"

export type SdkResolvePaywallParamsXObserverMode = "true" | "false"

export type SdkResolvePaywallParamsXPlatformFlavor = "native" | "browser"

export type SdkResolvePaywallParamsXSdk = "react-native" | "web" | "ios" | "android"

export type SdkResolvePaywallParamsXEnvironmentEnum = "production" | "development" | "all"

export interface SdkResolvePaywallParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkResolvePaywallParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkResolvePaywallParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkResolvePaywallParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkResolvePaywallParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkResolvePaywallParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkResolvePaywallParamsXEnvironmentEnum | null | undefined
}

export interface SdkResolvePaywallBodyJsonEncoding {
  readonly "locationSlug": string
}

export type SdkResolvedPaywallShowingJsonEncodingPaywallReleaseEnumVersionEnum = "Infinity" | "-Infinity" | "NaN"

export type SdkResolvedPaywallShowingJsonEncodingType = "paywall_release" | "feature_flag"

export interface SdkResolvedPaywallShowingJsonEncoding {
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
  readonly "runtime": {
  readonly "contentHash": string;
  readonly "productSlugs": ReadonlyArray<string>;
  readonly "variables": Record<string, unknown>
} | null;
  readonly "version": number | "Infinity" | "-Infinity" | "NaN"
} | null;
  readonly "paywallReleaseId": string | null;
  readonly "startedAt": string;
  readonly "type": SdkResolvedPaywallShowingJsonEncodingType
}

export interface SdkResolvedPaywallJsonEncoding {
  readonly "location": {
  readonly "id": string;
  readonly "name": string;
  readonly "slug": string
};
  readonly "showing": SdkResolvedPaywallShowingJsonEncoding
}

export type SdkResolvePaywall200 = SdkResolvedPaywallJsonEncoding | null

export type SdkResolvePaywall500 = ApiAuthenticationErrorJsonEncoding | ApiSdkServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type SdkGetSchemaParamsXIsBackgrounded = "false"

export type SdkGetSchemaParamsXIsDebugBuild = "true" | "false"

export type SdkGetSchemaParamsXObserverMode = "true" | "false"

export type SdkGetSchemaParamsXPlatformFlavor = "native" | "browser"

export type SdkGetSchemaParamsXSdk = "react-native" | "web" | "ios" | "android"

export type SdkGetSchemaParamsXEnvironmentEnum = "production" | "development" | "all"

export interface SdkGetSchemaParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkGetSchemaParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkGetSchemaParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkGetSchemaParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkGetSchemaParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkGetSchemaParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkGetSchemaParamsXEnvironmentEnum | null | undefined
}

export interface SdkSchemaJsonEncoding {
  readonly "locations": Record<string, unknown>;
  readonly "perks": Record<string, unknown>;
  readonly "products": Record<string, unknown>;
  readonly "version": string
}

export type SdkGetSchema500 = ApiAuthenticationErrorJsonEncoding | ApiSchemaServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type SdkRegisterDeviceParamsXIsBackgrounded = "false"

export type SdkRegisterDeviceParamsXIsDebugBuild = "true" | "false"

export type SdkRegisterDeviceParamsXObserverMode = "true" | "false"

export type SdkRegisterDeviceParamsXPlatformFlavor = "native" | "browser"

export type SdkRegisterDeviceParamsXSdk = "react-native" | "web" | "ios" | "android"

export type SdkRegisterDeviceParamsXEnvironmentEnum = "production" | "development" | "all"

export interface SdkRegisterDeviceParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkRegisterDeviceParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkRegisterDeviceParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkRegisterDeviceParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkRegisterDeviceParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkRegisterDeviceParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkRegisterDeviceParamsXEnvironmentEnum | null | undefined
}

export type RegisterDeviceBodyJsonEncodingPlatform = "ios" | "android"

export type RegisterDeviceBodyJsonEncodingProvider = "fcm" | "apns"

export type RegisterDeviceBodyJsonEncodingEnvironmentEnum = "sandbox" | "production"

export interface RegisterDeviceBodyJsonEncoding {
  readonly "platform": RegisterDeviceBodyJsonEncodingPlatform;
  readonly "provider": RegisterDeviceBodyJsonEncodingProvider;
  readonly "platformToken": string;
  readonly "bundleId"?: string | null | undefined;
  readonly "environment"?: RegisterDeviceBodyJsonEncodingEnvironmentEnum | null | undefined;
  readonly "previousPushDeviceTokenId"?: string | null | undefined
}

export interface RegisterDeviceResponseJsonEncoding {
  readonly "pushDeviceTokenId": string
}

export type ApiPushDeviceNotFoundErrorJsonEncodingTag = "Api/PushDeviceNotFoundError"

export interface ApiPushDeviceNotFoundErrorJsonEncoding {
  readonly "_tag": ApiPushDeviceNotFoundErrorJsonEncodingTag;
  readonly "message": string
}

export type ApiPushDeviceServiceErrorJsonEncodingTag = "Api/PushDeviceServiceError"

export interface ApiPushDeviceServiceErrorJsonEncoding {
  readonly "_tag": ApiPushDeviceServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type SdkRegisterDevice500 = ApiAuthenticationErrorJsonEncoding | ApiPushDeviceServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type SdkRefreshDeviceParamsXIsBackgrounded = "false"

export type SdkRefreshDeviceParamsXIsDebugBuild = "true" | "false"

export type SdkRefreshDeviceParamsXObserverMode = "true" | "false"

export type SdkRefreshDeviceParamsXPlatformFlavor = "native" | "browser"

export type SdkRefreshDeviceParamsXSdk = "react-native" | "web" | "ios" | "android"

export type SdkRefreshDeviceParamsXEnvironmentEnum = "production" | "development" | "all"

export interface SdkRefreshDeviceParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkRefreshDeviceParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkRefreshDeviceParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkRefreshDeviceParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkRefreshDeviceParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkRefreshDeviceParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkRefreshDeviceParamsXEnvironmentEnum | null | undefined
}

export interface RefreshDeviceBodyJsonEncoding {
  readonly "pushDeviceTokenId": string;
  readonly "platformToken": string
}

export type SdkRefreshDevice500 = ApiAuthenticationErrorJsonEncoding | ApiPushDeviceServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type SdkUnregisterDeviceParamsXIsBackgrounded = "false"

export type SdkUnregisterDeviceParamsXIsDebugBuild = "true" | "false"

export type SdkUnregisterDeviceParamsXObserverMode = "true" | "false"

export type SdkUnregisterDeviceParamsXPlatformFlavor = "native" | "browser"

export type SdkUnregisterDeviceParamsXSdk = "react-native" | "web" | "ios" | "android"

export type SdkUnregisterDeviceParamsXEnvironmentEnum = "production" | "development" | "all"

export interface SdkUnregisterDeviceParams {
  readonly "x-distinct-id": string;
  readonly "x-publishable-key": string;
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string | null | undefined;
  readonly "x-client-version"?: string | null | undefined;
  readonly "x-is-backgrounded": SdkUnregisterDeviceParamsXIsBackgrounded;
  readonly "x-is-debug-build": SdkUnregisterDeviceParamsXIsDebugBuild;
  readonly "x-nonce"?: string | null | undefined;
  readonly "x-observer-mode": SdkUnregisterDeviceParamsXObserverMode;
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string | null | undefined;
  readonly "x-platform-device"?: string | null | undefined;
  readonly "x-platform-flavor": SdkUnregisterDeviceParamsXPlatformFlavor;
  readonly "x-platform-flavor-version"?: string | null | undefined;
  readonly "x-platform-version"?: string | null | undefined;
  readonly "x-preferred-locales"?: string | null | undefined;
  readonly "x-sdk": SdkUnregisterDeviceParamsXSdk;
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string | null | undefined;
  readonly "x-environment"?: SdkUnregisterDeviceParamsXEnvironmentEnum | null | undefined
}

export interface UnregisterDeviceBodyJsonEncoding {
  readonly "pushDeviceTokenId": string
}

export type SdkUnregisterDevice500 = ApiAuthenticationErrorJsonEncoding | ApiPushDeviceServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface UserJsonEncoding {
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
  readonly "slug": string;
  readonly "workosOrganizationId": string | null
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

export type ApiUserServiceErrorJsonEncodingTag = "Api/UserServiceError"

export interface ApiUserServiceErrorJsonEncoding {
  readonly "_tag": ApiUserServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type UsersGetUser500 = ApiAuthenticationErrorJsonEncoding | ApiUserServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface PaymentProviderConfigurationJsonEncoding {
  readonly "enabled": boolean;
  readonly "id": string;
  readonly "name": string;
  readonly "projectId": string;
  readonly "providerId": string
}

export type PaymentProviderConfigurationsListPaymentProviderConfigurations200 = ReadonlyArray<PaymentProviderConfigurationJsonEncoding>

export type ApiPaymentProviderConfigurationServiceErrorJsonEncodingTag = "Api/PaymentProviderConfigurationServiceError"

export interface ApiPaymentProviderConfigurationServiceErrorJsonEncoding {
  readonly "_tag": ApiPaymentProviderConfigurationServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type PaymentProviderConfigurationsListPaymentProviderConfigurations500 = ApiPaymentProviderConfigurationServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface PaymentProviderProductJsonEncoding {
  readonly "configuration": Record<string, unknown>;
  readonly "id": string;
  readonly "paymentProviderConfigurationId": string;
  readonly "productId": string;
  readonly "providerId": string
}

export type PaymentProviderProductsListPaymentProviderProducts200 = ReadonlyArray<PaymentProviderProductJsonEncoding>

export type ApiPaymentProviderProductServiceErrorJsonEncodingTag = "Api/PaymentProviderProductServiceError"

export interface ApiPaymentProviderProductServiceErrorJsonEncoding {
  readonly "_tag": ApiPaymentProviderProductServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type PaymentProviderProductsListPaymentProviderProducts500 = ApiPaymentProviderProductServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type WebhookEndpointJsonEncodingConsecutiveFailuresEnum = "Infinity" | "-Infinity" | "NaN"

export type WebhookEndpointJsonEncodingStatus = "active" | "disabled" | "failed"

export interface WebhookEndpointJsonEncoding {
  readonly "consecutiveFailures": number | WebhookEndpointJsonEncodingConsecutiveFailuresEnum;
  readonly "createdAt": string | null;
  readonly "description": string | null;
  readonly "events": ReadonlyArray<"person.created" | "person.updated" | "person.deleted" | "subscription.created" | "subscription.renewed" | "subscription.cancelled" | "subscription.expired" | "purchase.completed" | "purchase.refunded">;
  readonly "id": string;
  readonly "lastSuccessAt": string | null;
  readonly "name": string;
  readonly "projectId": string;
  readonly "secret": string;
  readonly "status": WebhookEndpointJsonEncodingStatus;
  readonly "url": string
}

export type WebhooksListWebhookEndpoints200 = ReadonlyArray<WebhookEndpointJsonEncoding>

export type ApiWebhookServiceErrorJsonEncodingTag = "Api/WebhookServiceError"

export interface ApiWebhookServiceErrorJsonEncoding {
  readonly "_tag": ApiWebhookServiceErrorJsonEncodingTag;
  readonly "cause": string
}

export type WebhooksListWebhookEndpoints500 = ApiWebhookServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export interface CreateWebhookEndpointBodyJsonEncoding {
  readonly "description"?: string | null | undefined;
  readonly "events": ReadonlyArray<string>;
  readonly "name": string;
  readonly "url": string
}

export type ApiWebhookValidationErrorJsonEncodingTag = "Api/WebhookValidationError"

export interface ApiWebhookValidationErrorJsonEncoding {
  readonly "_tag": ApiWebhookValidationErrorJsonEncodingTag;
  readonly "message": string
}

export type WebhooksCreateWebhookEndpoint500 = ApiWebhookServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type ApiWebhookEndpointNotFoundErrorJsonEncodingTag = "Api/WebhookEndpointNotFoundError"

export interface ApiWebhookEndpointNotFoundErrorJsonEncoding {
  readonly "_tag": ApiWebhookEndpointNotFoundErrorJsonEncodingTag;
  readonly "endpointId": string
}

export type WebhooksGetWebhookEndpoint500 = ApiWebhookServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type WebhooksDeleteWebhookEndpoint500 = ApiWebhookServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type UpdateWebhookEndpointBodyJsonEncodingStatusEnum = "active" | "disabled"

export interface UpdateWebhookEndpointBodyJsonEncoding {
  readonly "description"?: string | null | null | undefined;
  readonly "events"?: ReadonlyArray<string> | null | undefined;
  readonly "name"?: string | null | undefined;
  readonly "status"?: UpdateWebhookEndpointBodyJsonEncodingStatusEnum | null | undefined;
  readonly "url"?: string | null | undefined
}

export type WebhooksUpdateWebhookEndpoint500 = ApiWebhookServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type WebhooksRotateWebhookSecret500 = ApiWebhookServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type WebhookDeliveryJsonEncodingAttemptCountEnum = "Infinity" | "-Infinity" | "NaN"

export type WebhookDeliveryJsonEncodingMaxAttemptsEnum = "Infinity" | "-Infinity" | "NaN"

export type WebhookDeliveryJsonEncodingStatus = "pending" | "in_progress" | "succeeded" | "failed" | "exhausted"

export interface WebhookDeliveryJsonEncoding {
  readonly "attemptCount": number | WebhookDeliveryJsonEncodingAttemptCountEnum;
  readonly "completedAt": string | null;
  readonly "createdAt": string | null;
  readonly "eventOccurredAt": string;
  readonly "eventType": string;
  readonly "id": string;
  readonly "maxAttempts": number | WebhookDeliveryJsonEncodingMaxAttemptsEnum;
  readonly "nextAttemptAt": string | null;
  readonly "projectId": string;
  readonly "status": WebhookDeliveryJsonEncodingStatus;
  readonly "webhookEndpointId": string
}

export type WebhooksTestWebhookEndpoint500 = ApiWebhookServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type WebhooksListWebhookDeliveries200 = ReadonlyArray<WebhookDeliveryJsonEncoding>

export type WebhooksListWebhookDeliveries500 = ApiWebhookServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type WebhookDeliveryWithAttemptsJsonEncodingAttemptCountEnum = "Infinity" | "-Infinity" | "NaN"

export type WebhookDeliveryAttemptJsonEncodingAttemptNumberEnum = "Infinity" | "-Infinity" | "NaN"

export type WebhookDeliveryAttemptJsonEncodingDurationMsEnum = "Infinity" | "-Infinity" | "NaN"

export type WebhookDeliveryAttemptJsonEncodingStatusCodeEnum = "Infinity" | "-Infinity" | "NaN"

export interface WebhookDeliveryAttemptJsonEncoding {
  readonly "attemptNumber": number | WebhookDeliveryAttemptJsonEncodingAttemptNumberEnum;
  readonly "createdAt": string | null;
  readonly "durationMs": number | WebhookDeliveryAttemptJsonEncodingDurationMsEnum | null;
  readonly "errorMessage": string | null;
  readonly "id": string;
  readonly "responseBody": string | null;
  readonly "statusCode": number | WebhookDeliveryAttemptJsonEncodingStatusCodeEnum | null;
  readonly "succeeded": boolean
}

export type WebhookDeliveryWithAttemptsJsonEncodingMaxAttemptsEnum = "Infinity" | "-Infinity" | "NaN"

export type WebhookDeliveryWithAttemptsJsonEncodingStatus = "pending" | "in_progress" | "succeeded" | "failed" | "exhausted"

export interface WebhookDeliveryWithAttemptsJsonEncoding {
  readonly "attemptCount": number | WebhookDeliveryWithAttemptsJsonEncodingAttemptCountEnum;
  readonly "attempts": ReadonlyArray<WebhookDeliveryAttemptJsonEncoding>;
  readonly "completedAt": string | null;
  readonly "createdAt": string | null;
  readonly "eventOccurredAt": string;
  readonly "eventType": string;
  readonly "id": string;
  readonly "maxAttempts": number | WebhookDeliveryWithAttemptsJsonEncodingMaxAttemptsEnum;
  readonly "nextAttemptAt": string | null;
  readonly "projectId": string;
  readonly "status": WebhookDeliveryWithAttemptsJsonEncodingStatus;
  readonly "webhookEndpointId": string
}

export type ApiWebhookDeliveryNotFoundErrorJsonEncodingTag = "Api/WebhookDeliveryNotFoundError"

export interface ApiWebhookDeliveryNotFoundErrorJsonEncoding {
  readonly "_tag": ApiWebhookDeliveryNotFoundErrorJsonEncodingTag;
  readonly "deliveryId": string
}

export type WebhooksGetWebhookDelivery500 = ApiWebhookServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

export type WebhooksRetryWebhookDelivery500 = ApiWebhookServiceErrorJsonEncoding | ApiAuthenticationErrorJsonEncoding

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
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"ApiAuthenticationErrorJsonEncoding"})
  ),
  "apiKeysListApiKeys": () => HttpClientRequest.get(`/api/v1/api-keys`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"ApiKeysListApiKeys500"})
  ),
  "apiKeysCreateSecretKey": (options) => HttpClientRequest.post(`/api/v1/api-keys`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"ApiKeysCreateSecretKey500"})
  ),
  "apiKeysGetApiKeyById": (apiKeyId) => HttpClientRequest.get(`/api/v1/api-keys/${apiKeyId}`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiApiKeyNotFoundErrorJsonEncoding","500":"ApiKeysGetApiKeyById500"})
  ),
  "apiKeysDeleteApiKey": (apiKeyId) => HttpClientRequest.delete(`/api/v1/api-keys/${apiKeyId}`).pipe(
    onRequest([], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiApiKeyNotFoundErrorJsonEncoding","500":"ApiKeysDeleteApiKey500"})
  ),
  "apiKeysRotateSecretKey": (apiKeyId) => HttpClientRequest.post(`/api/v1/api-keys/${apiKeyId}/rotate`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiApiKeyNotFoundErrorJsonEncoding","500":"ApiKeysRotateSecretKey500"})
  ),
  "personsListPersons": () => HttpClientRequest.get(`/api/v1/persons`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"PersonsListPersons500"})
  ),
  "personsCreatePerson": (options) => HttpClientRequest.post(`/api/v1/persons`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"ApiPersonInvalidAnonymousIdErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"PersonsCreatePerson500"})
  ),
  "personsGetPersonById": (personId) => HttpClientRequest.get(`/api/v1/persons/${personId}`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiPersonNotFoundErrorJsonEncoding","500":"PersonsGetPersonById500"})
  ),
  "personsGetPersonByDistinctId": (distinctId) => HttpClientRequest.get(`/api/v1/persons/by-distinct-id/${distinctId}`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiPersonNotFoundErrorJsonEncoding","500":"PersonsGetPersonByDistinctId500"})
  ),
  "personsGetPersonEntitlements": (personId) => HttpClientRequest.get(`/api/v1/persons/${personId}/entitlements`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiPersonNotFoundErrorJsonEncoding","500":"PersonsGetPersonEntitlements500"})
  ),
  "personsSetPersonAttributes": (options) => HttpClientRequest.post(`/api/v1/persons/attributes`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"PersonsSetPersonAttributes500"})
  ),
  "notificationsSendNotification": (options) => HttpClientRequest.post(`/api/v1/notifications/send`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"ApiPushDeviceValidationErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","409":"ApiPushSendNotEnabledErrorJsonEncoding","500":"NotificationsSendNotification500"})
  ),
  "organizationsCreateOrganization": (options) => HttpClientRequest.post(`/api/v1/organizations`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","500":"OrganizationsCreateOrganization500"})
  ),
  "perksListPerks": () => HttpClientRequest.get(`/api/v1/perks`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"PerksListPerks500"})
  ),
  "paywallDeploysCreateDeploy": (options) => HttpClientRequest.post(`/api/v1/paywall-deploys`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"ApiPaywallDeployUpgradeRequiredErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","422":"ApiPaywallDeployValidationErrorJsonEncoding","500":"PaywallDeploysCreateDeploy500"})
  ),
  "paywallDeploysUploadBlob": (deployId, sha256) => HttpClientRequest.put(`/api/v1/paywall-deploys/${deployId}/blobs/${sha256}`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"PaywallDeploysUploadBlob404","409":"ApiPaywallDeployNotPendingErrorJsonEncoding","422":"PaywallDeploysUploadBlob422","500":"PaywallDeploysUploadBlob500"})
  ),
  "paywallDeploysFinalizeDeploy": (deployId) => HttpClientRequest.post(`/api/v1/paywall-deploys/${deployId}/finalize`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiPaywallDeployNotFoundErrorJsonEncoding","409":"ApiIncompleteDeployErrorJsonEncoding","422":"ApiPaywallDeployValidationErrorJsonEncoding","500":"PaywallDeploysFinalizeDeploy500"})
  ),
  "paywallLocationsListPaywallLocations": () => HttpClientRequest.get(`/api/v1/paywall-locations`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"PaywallLocationsListPaywallLocations500"})
  ),
  "schemaGetSchema": () => HttpClientRequest.get(`/api/v1/schema`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"SchemaGetSchema500"})
  ),
  "schemaGetSchemaVersion": () => HttpClientRequest.get(`/api/v1/schema/version`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"SchemaGetSchemaVersion500"})
  ),
  "projectsCreateProject": (options) => HttpClientRequest.post(`/api/v1/projects`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"ProjectsCreateProject500"})
  ),
  "projectsListProjects": (organizationId) => HttpClientRequest.get(`/api/v1/projects/${organizationId}`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"ProjectsListProjects500"})
  ),
  "productsListProducts": () => HttpClientRequest.get(`/api/v1/products`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"ProductsListProducts500"})
  ),
  "productPerksListProductPerksByProductId": (productId) => HttpClientRequest.get(`/api/v1/product-perks/by-product-id/${productId}`).pipe(
    onRequest(["2xx"], {"400":"ApiProductPerkValidationErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"ProductPerksListProductPerksByProductId500"})
  ),
  "sdkGetPerson": (options) => HttpClientRequest.get(`/api/v1/sdk/person`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options?.["x-distinct-id"] ?? undefined, "x-publishable-key": options?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options?.["x-client-locale"] ?? undefined, "x-client-version": options?.["x-client-version"] ?? undefined, "x-is-backgrounded": options?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options?.["x-is-debug-build"] ?? undefined, "x-nonce": options?.["x-nonce"] ?? undefined, "x-observer-mode": options?.["x-observer-mode"] ?? undefined, "x-platform": options?.["x-platform"] ?? undefined, "x-platform-brand": options?.["x-platform-brand"] ?? undefined, "x-platform-device": options?.["x-platform-device"] ?? undefined, "x-platform-flavor": options?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options?.["x-platform-version"] ?? undefined, "x-preferred-locales": options?.["x-preferred-locales"] ?? undefined, "x-sdk": options?.["x-sdk"] ?? undefined, "x-sdk-version": options?.["x-sdk-version"] ?? undefined, "x-storefront": options?.["x-storefront"] ?? undefined, "x-environment": options?.["x-environment"] ?? undefined }),
    onRequest(["2xx"], {"400":"ApiSdkValidationErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","404":"ApiSdkPersonNotFoundErrorJsonEncoding","500":"SdkGetPerson500"})
  ),
  "sdkIdentifyPerson": (options) => HttpClientRequest.post(`/api/v1/sdk/identify`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined, "x-environment": options.params?.["x-environment"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"400":"ApiSdkValidationErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","404":"ApiSdkPersonNotFoundErrorJsonEncoding","409":"ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding","500":"SdkIdentifyPerson500"})
  ),
  "sdkSyncPersonAttributes": (options) => HttpClientRequest.post(`/api/v1/sdk/person/traits`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined, "x-environment": options.params?.["x-environment"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"400":"ApiSdkValidationErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","404":"ApiSdkPersonNotFoundErrorJsonEncoding","500":"SdkSyncPersonAttributes500"})
  ),
  "sdkSyncTransaction": (options) => HttpClientRequest.post(`/api/v1/sdk/sync-transaction`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined, "x-environment": options.params?.["x-environment"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"400":"ApiSdkValidationErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","500":"SdkSyncTransaction500"})
  ),
  "sdkDevelopmentPurchase": (options) => HttpClientRequest.post(`/api/v1/sdk/development/purchase`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined, "x-environment": options.params?.["x-environment"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"400":"ApiSdkValidationErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","500":"SdkDevelopmentPurchase500"})
  ),
  "sdkEvaluateFeatureFlags": (options) => HttpClientRequest.post(`/api/v1/sdk/evaluate-flags`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined, "x-environment": options.params?.["x-environment"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","500":"SdkEvaluateFeatureFlags500"})
  ),
  "sdkResolvePaywall": (options) => HttpClientRequest.post(`/api/v1/sdk/resolve-paywall`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined, "x-environment": options.params?.["x-environment"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"400":"ApiSdkValidationErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","500":"SdkResolvePaywall500"})
  ),
  "sdkGetSchema": (options) => HttpClientRequest.get(`/api/v1/sdk/schema`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options?.["x-distinct-id"] ?? undefined, "x-publishable-key": options?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options?.["x-client-locale"] ?? undefined, "x-client-version": options?.["x-client-version"] ?? undefined, "x-is-backgrounded": options?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options?.["x-is-debug-build"] ?? undefined, "x-nonce": options?.["x-nonce"] ?? undefined, "x-observer-mode": options?.["x-observer-mode"] ?? undefined, "x-platform": options?.["x-platform"] ?? undefined, "x-platform-brand": options?.["x-platform-brand"] ?? undefined, "x-platform-device": options?.["x-platform-device"] ?? undefined, "x-platform-flavor": options?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options?.["x-platform-version"] ?? undefined, "x-preferred-locales": options?.["x-preferred-locales"] ?? undefined, "x-sdk": options?.["x-sdk"] ?? undefined, "x-sdk-version": options?.["x-sdk-version"] ?? undefined, "x-storefront": options?.["x-storefront"] ?? undefined, "x-environment": options?.["x-environment"] ?? undefined }),
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","500":"SdkGetSchema500"})
  ),
  "sdkRegisterDevice": (options) => HttpClientRequest.post(`/api/v1/sdk/push-devices/register`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined, "x-environment": options.params?.["x-environment"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest(["2xx"], {"400":"ApiPushDeviceValidationErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiPushDeviceNotFoundErrorJsonEncoding","500":"SdkRegisterDevice500"})
  ),
  "sdkRefreshDevice": (options) => HttpClientRequest.post(`/api/v1/sdk/push-devices/refresh`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined, "x-environment": options.params?.["x-environment"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest([], {"400":"ApiPushDeviceValidationErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiPushDeviceNotFoundErrorJsonEncoding","500":"SdkRefreshDevice500"})
  ),
  "sdkUnregisterDevice": (options) => HttpClientRequest.post(`/api/v1/sdk/push-devices/unregister`).pipe(
    HttpClientRequest.setHeaders({ "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined, "x-publishable-key": options.params?.["x-publishable-key"] ?? undefined, "x-client-bundle-id": options.params?.["x-client-bundle-id"] ?? undefined, "x-client-locale": options.params?.["x-client-locale"] ?? undefined, "x-client-version": options.params?.["x-client-version"] ?? undefined, "x-is-backgrounded": options.params?.["x-is-backgrounded"] ?? undefined, "x-is-debug-build": options.params?.["x-is-debug-build"] ?? undefined, "x-nonce": options.params?.["x-nonce"] ?? undefined, "x-observer-mode": options.params?.["x-observer-mode"] ?? undefined, "x-platform": options.params?.["x-platform"] ?? undefined, "x-platform-brand": options.params?.["x-platform-brand"] ?? undefined, "x-platform-device": options.params?.["x-platform-device"] ?? undefined, "x-platform-flavor": options.params?.["x-platform-flavor"] ?? undefined, "x-platform-flavor-version": options.params?.["x-platform-flavor-version"] ?? undefined, "x-platform-version": options.params?.["x-platform-version"] ?? undefined, "x-preferred-locales": options.params?.["x-preferred-locales"] ?? undefined, "x-sdk": options.params?.["x-sdk"] ?? undefined, "x-sdk-version": options.params?.["x-sdk-version"] ?? undefined, "x-storefront": options.params?.["x-storefront"] ?? undefined, "x-environment": options.params?.["x-environment"] ?? undefined }),
    HttpClientRequest.bodyJsonUnsafe(options.payload),
    onRequest([], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiPushDeviceNotFoundErrorJsonEncoding","500":"SdkUnregisterDevice500"})
  ),
  "usersGetUser": () => HttpClientRequest.get(`/api/v1/users/current`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","500":"UsersGetUser500"})
  ),
  "paymentProviderConfigurationsListPaymentProviderConfigurations": () => HttpClientRequest.get(`/api/v1/payment-provider-configurations`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"PaymentProviderConfigurationsListPaymentProviderConfigurations500"})
  ),
  "paymentProviderProductsListPaymentProviderProducts": () => HttpClientRequest.get(`/api/v1/payment-provider-products`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"PaymentProviderProductsListPaymentProviderProducts500"})
  ),
  "webhooksListWebhookEndpoints": () => HttpClientRequest.get(`/api/v1/webhooks/endpoints`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"WebhooksListWebhookEndpoints500"})
  ),
  "webhooksCreateWebhookEndpoint": (options) => HttpClientRequest.post(`/api/v1/webhooks/endpoints`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"ApiWebhookValidationErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"WebhooksCreateWebhookEndpoint500"})
  ),
  "webhooksGetWebhookEndpoint": (endpointId) => HttpClientRequest.get(`/api/v1/webhooks/endpoints/${endpointId}`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiWebhookEndpointNotFoundErrorJsonEncoding","500":"WebhooksGetWebhookEndpoint500"})
  ),
  "webhooksDeleteWebhookEndpoint": (endpointId) => HttpClientRequest.delete(`/api/v1/webhooks/endpoints/${endpointId}`).pipe(
    onRequest([], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiWebhookEndpointNotFoundErrorJsonEncoding","500":"WebhooksDeleteWebhookEndpoint500"})
  ),
  "webhooksUpdateWebhookEndpoint": (endpointId, options) => HttpClientRequest.patch(`/api/v1/webhooks/endpoints/${endpointId}`).pipe(
    HttpClientRequest.bodyJsonUnsafe(options),
    onRequest(["2xx"], {"400":"ApiWebhookValidationErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiWebhookEndpointNotFoundErrorJsonEncoding","500":"WebhooksUpdateWebhookEndpoint500"})
  ),
  "webhooksRotateWebhookSecret": (endpointId) => HttpClientRequest.post(`/api/v1/webhooks/endpoints/${endpointId}/rotate-secret`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiWebhookEndpointNotFoundErrorJsonEncoding","500":"WebhooksRotateWebhookSecret500"})
  ),
  "webhooksTestWebhookEndpoint": (endpointId) => HttpClientRequest.post(`/api/v1/webhooks/endpoints/${endpointId}/test`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiWebhookEndpointNotFoundErrorJsonEncoding","500":"WebhooksTestWebhookEndpoint500"})
  ),
  "webhooksListWebhookDeliveries": () => HttpClientRequest.get(`/api/v1/webhooks/deliveries`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","500":"WebhooksListWebhookDeliveries500"})
  ),
  "webhooksGetWebhookDelivery": (deliveryId) => HttpClientRequest.get(`/api/v1/webhooks/deliveries/${deliveryId}`).pipe(
    onRequest(["2xx"], {"401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiWebhookDeliveryNotFoundErrorJsonEncoding","500":"WebhooksGetWebhookDelivery500"})
  ),
  "webhooksRetryWebhookDelivery": (deliveryId) => HttpClientRequest.post(`/api/v1/webhooks/deliveries/${deliveryId}/retry`).pipe(
    onRequest(["2xx"], {"400":"ApiWebhookValidationErrorJsonEncoding","401":"ApiNotAuthenticatedErrorJsonEncoding","403":"ApiActionForbiddenErrorJsonEncoding","404":"ApiWebhookDeliveryNotFoundErrorJsonEncoding","500":"WebhooksRetryWebhookDelivery500"})
  )
  }
}

export interface VoidhashCoreClient {
  readonly httpClient: HttpClient.HttpClient
  readonly "authSession": () => Effect.Effect<AuthSession200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiAuthenticationErrorJsonEncoding", ApiAuthenticationErrorJsonEncoding>>
  readonly "apiKeysListApiKeys": () => Effect.Effect<ApiKeysListApiKeys200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiKeysListApiKeys500", ApiKeysListApiKeys500>>
  readonly "apiKeysCreateSecretKey": (options: CreateSecretKeyBodyJsonEncoding) => Effect.Effect<ApiKeyWithRawKeyJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiKeysCreateSecretKey500", ApiKeysCreateSecretKey500>>
  readonly "apiKeysGetApiKeyById": (apiKeyId: string) => Effect.Effect<ApiKeyJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiApiKeyNotFoundErrorJsonEncoding", ApiApiKeyNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"ApiKeysGetApiKeyById500", ApiKeysGetApiKeyById500>>
  readonly "apiKeysDeleteApiKey": (apiKeyId: string) => Effect.Effect<void, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiApiKeyNotFoundErrorJsonEncoding", ApiApiKeyNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"ApiKeysDeleteApiKey500", ApiKeysDeleteApiKey500>>
  readonly "apiKeysRotateSecretKey": (apiKeyId: string) => Effect.Effect<ApiKeyWithRawKeyJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiApiKeyNotFoundErrorJsonEncoding", ApiApiKeyNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"ApiKeysRotateSecretKey500", ApiKeysRotateSecretKey500>>
  readonly "personsListPersons": () => Effect.Effect<PersonsListPersons200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"PersonsListPersons500", PersonsListPersons500>>
  readonly "personsCreatePerson": (options: CreatePersonBodyJsonEncoding) => Effect.Effect<PersonJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiPersonInvalidAnonymousIdErrorJsonEncoding", ApiPersonInvalidAnonymousIdErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"PersonsCreatePerson500", PersonsCreatePerson500>>
  readonly "personsGetPersonById": (personId: string) => Effect.Effect<PersonJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiPersonNotFoundErrorJsonEncoding", ApiPersonNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"PersonsGetPersonById500", PersonsGetPersonById500>>
  readonly "personsGetPersonByDistinctId": (distinctId: string) => Effect.Effect<PersonJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiPersonNotFoundErrorJsonEncoding", ApiPersonNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"PersonsGetPersonByDistinctId500", PersonsGetPersonByDistinctId500>>
  readonly "personsGetPersonEntitlements": (personId: string) => Effect.Effect<PersonEntitlementsResponseJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiPersonNotFoundErrorJsonEncoding", ApiPersonNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"PersonsGetPersonEntitlements500", PersonsGetPersonEntitlements500>>
  readonly "personsSetPersonAttributes": (options: SetPersonAttributesBodyJsonEncoding) => Effect.Effect<PersonJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"PersonsSetPersonAttributes500", PersonsSetPersonAttributes500>>
  readonly "notificationsSendNotification": (options: SendNotificationBodyJsonEncoding) => Effect.Effect<SendNotificationResponseJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiPushDeviceValidationErrorJsonEncoding", ApiPushDeviceValidationErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiPushSendNotEnabledErrorJsonEncoding", ApiPushSendNotEnabledErrorJsonEncoding> | VoidhashCoreClientError<"NotificationsSendNotification500", NotificationsSendNotification500>>
  readonly "organizationsCreateOrganization": (options: CreateOrganizationBodyJsonEncoding) => Effect.Effect<OrganizationJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"OrganizationsCreateOrganization500", OrganizationsCreateOrganization500>>
  readonly "perksListPerks": () => Effect.Effect<PerksListPerks200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"PerksListPerks500", PerksListPerks500>>
  readonly "paywallDeploysCreateDeploy": (options: PaywallDeploysCreateDeployRequest) => Effect.Effect<CreatePaywallDeployResponseJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiPaywallDeployUpgradeRequiredErrorJsonEncoding", ApiPaywallDeployUpgradeRequiredErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiPaywallDeployValidationErrorJsonEncoding", ApiPaywallDeployValidationErrorJsonEncoding> | VoidhashCoreClientError<"PaywallDeploysCreateDeploy500", PaywallDeploysCreateDeploy500>>
  readonly "paywallDeploysUploadBlob": (deployId: string, sha256: string) => Effect.Effect<UploadPaywallDeployBlobResponseJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"PaywallDeploysUploadBlob404", PaywallDeploysUploadBlob404> | VoidhashCoreClientError<"ApiPaywallDeployNotPendingErrorJsonEncoding", ApiPaywallDeployNotPendingErrorJsonEncoding> | VoidhashCoreClientError<"PaywallDeploysUploadBlob422", PaywallDeploysUploadBlob422> | VoidhashCoreClientError<"PaywallDeploysUploadBlob500", PaywallDeploysUploadBlob500>>
  readonly "paywallDeploysFinalizeDeploy": (deployId: string) => Effect.Effect<FinalizePaywallDeployResponseJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiPaywallDeployNotFoundErrorJsonEncoding", ApiPaywallDeployNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"ApiIncompleteDeployErrorJsonEncoding", ApiIncompleteDeployErrorJsonEncoding> | VoidhashCoreClientError<"ApiPaywallDeployValidationErrorJsonEncoding", ApiPaywallDeployValidationErrorJsonEncoding> | VoidhashCoreClientError<"PaywallDeploysFinalizeDeploy500", PaywallDeploysFinalizeDeploy500>>
  readonly "paywallLocationsListPaywallLocations": () => Effect.Effect<PaywallLocationsListPaywallLocations200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"PaywallLocationsListPaywallLocations500", PaywallLocationsListPaywallLocations500>>
  readonly "schemaGetSchema": () => Effect.Effect<ProjectSchemaResponseJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"SchemaGetSchema500", SchemaGetSchema500>>
  readonly "schemaGetSchemaVersion": () => Effect.Effect<SchemaVersionJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"SchemaGetSchemaVersion500", SchemaGetSchemaVersion500>>
  readonly "projectsCreateProject": (options: CreateProjectBodyJsonEncoding) => Effect.Effect<ProjectJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ProjectsCreateProject500", ProjectsCreateProject500>>
  readonly "projectsListProjects": (organizationId: string) => Effect.Effect<ProjectsListProjects200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ProjectsListProjects500", ProjectsListProjects500>>
  readonly "productsListProducts": () => Effect.Effect<ProductsListProducts200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ProductsListProducts500", ProductsListProducts500>>
  readonly "productPerksListProductPerksByProductId": (productId: string) => Effect.Effect<ProductPerksListProductPerksByProductId200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiProductPerkValidationErrorJsonEncoding", ApiProductPerkValidationErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ProductPerksListProductPerksByProductId500", ProductPerksListProductPerksByProductId500>>
  readonly "sdkGetPerson": (options: SdkGetPersonParams) => Effect.Effect<SdkPersonJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiSdkPersonNotFoundErrorJsonEncoding", ApiSdkPersonNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"SdkGetPerson500", SdkGetPerson500>>
  readonly "sdkIdentifyPerson": (options: { readonly params: SdkIdentifyPersonParams; readonly payload: SdkIdentifyBodyJsonEncoding }) => Effect.Effect<SdkPersonJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiSdkPersonNotFoundErrorJsonEncoding", ApiSdkPersonNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding", ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding> | VoidhashCoreClientError<"SdkIdentifyPerson500", SdkIdentifyPerson500>>
  readonly "sdkSyncPersonAttributes": (options: { readonly params: SdkSyncPersonAttributesParams; readonly payload: SdkSyncPersonAttributesBodyJsonEncoding }) => Effect.Effect<SdkPersonJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiSdkPersonNotFoundErrorJsonEncoding", ApiSdkPersonNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"SdkSyncPersonAttributes500", SdkSyncPersonAttributes500>>
  readonly "sdkSyncTransaction": (options: { readonly params: SdkSyncTransactionParams; readonly payload: SdkSyncTransactionRequest }) => Effect.Effect<SdkSyncTransactionResponseJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"SdkSyncTransaction500", SdkSyncTransaction500>>
  readonly "sdkDevelopmentPurchase": (options: { readonly params: SdkDevelopmentPurchaseParams; readonly payload: SdkDevelopmentPurchaseBodyJsonEncoding }) => Effect.Effect<SdkDevelopmentPurchaseResponseJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"SdkDevelopmentPurchase500", SdkDevelopmentPurchase500>>
  readonly "sdkEvaluateFeatureFlags": (options: { readonly params: SdkEvaluateFeatureFlagsParams; readonly payload: EvaluateFeatureFlagsBodyJsonEncoding }) => Effect.Effect<SdkFeatureFlagsResponseJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"SdkEvaluateFeatureFlags500", SdkEvaluateFeatureFlags500>>
  readonly "sdkResolvePaywall": (options: { readonly params: SdkResolvePaywallParams; readonly payload: SdkResolvePaywallBodyJsonEncoding }) => Effect.Effect<SdkResolvePaywall200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"SdkResolvePaywall500", SdkResolvePaywall500>>
  readonly "sdkGetSchema": (options: SdkGetSchemaParams) => Effect.Effect<SdkSchemaJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"SdkGetSchema500", SdkGetSchema500>>
  readonly "sdkRegisterDevice": (options: { readonly params: SdkRegisterDeviceParams; readonly payload: RegisterDeviceBodyJsonEncoding }) => Effect.Effect<RegisterDeviceResponseJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiPushDeviceValidationErrorJsonEncoding", ApiPushDeviceValidationErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiPushDeviceNotFoundErrorJsonEncoding", ApiPushDeviceNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"SdkRegisterDevice500", SdkRegisterDevice500>>
  readonly "sdkRefreshDevice": (options: { readonly params: SdkRefreshDeviceParams; readonly payload: RefreshDeviceBodyJsonEncoding }) => Effect.Effect<void, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiPushDeviceValidationErrorJsonEncoding", ApiPushDeviceValidationErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiPushDeviceNotFoundErrorJsonEncoding", ApiPushDeviceNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"SdkRefreshDevice500", SdkRefreshDevice500>>
  readonly "sdkUnregisterDevice": (options: { readonly params: SdkUnregisterDeviceParams; readonly payload: UnregisterDeviceBodyJsonEncoding }) => Effect.Effect<void, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiPushDeviceNotFoundErrorJsonEncoding", ApiPushDeviceNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"SdkUnregisterDevice500", SdkUnregisterDevice500>>
  readonly "usersGetUser": () => Effect.Effect<UserJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"UsersGetUser500", UsersGetUser500>>
  readonly "paymentProviderConfigurationsListPaymentProviderConfigurations": () => Effect.Effect<PaymentProviderConfigurationsListPaymentProviderConfigurations200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"PaymentProviderConfigurationsListPaymentProviderConfigurations500", PaymentProviderConfigurationsListPaymentProviderConfigurations500>>
  readonly "paymentProviderProductsListPaymentProviderProducts": () => Effect.Effect<PaymentProviderProductsListPaymentProviderProducts200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"PaymentProviderProductsListPaymentProviderProducts500", PaymentProviderProductsListPaymentProviderProducts500>>
  readonly "webhooksListWebhookEndpoints": () => Effect.Effect<WebhooksListWebhookEndpoints200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"WebhooksListWebhookEndpoints500", WebhooksListWebhookEndpoints500>>
  readonly "webhooksCreateWebhookEndpoint": (options: CreateWebhookEndpointBodyJsonEncoding) => Effect.Effect<WebhookEndpointJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiWebhookValidationErrorJsonEncoding", ApiWebhookValidationErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"WebhooksCreateWebhookEndpoint500", WebhooksCreateWebhookEndpoint500>>
  readonly "webhooksGetWebhookEndpoint": (endpointId: string) => Effect.Effect<WebhookEndpointJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiWebhookEndpointNotFoundErrorJsonEncoding", ApiWebhookEndpointNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"WebhooksGetWebhookEndpoint500", WebhooksGetWebhookEndpoint500>>
  readonly "webhooksDeleteWebhookEndpoint": (endpointId: string) => Effect.Effect<void, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiWebhookEndpointNotFoundErrorJsonEncoding", ApiWebhookEndpointNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"WebhooksDeleteWebhookEndpoint500", WebhooksDeleteWebhookEndpoint500>>
  readonly "webhooksUpdateWebhookEndpoint": (endpointId: string, options: UpdateWebhookEndpointBodyJsonEncoding) => Effect.Effect<WebhookEndpointJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiWebhookValidationErrorJsonEncoding", ApiWebhookValidationErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiWebhookEndpointNotFoundErrorJsonEncoding", ApiWebhookEndpointNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"WebhooksUpdateWebhookEndpoint500", WebhooksUpdateWebhookEndpoint500>>
  readonly "webhooksRotateWebhookSecret": (endpointId: string) => Effect.Effect<WebhookEndpointJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiWebhookEndpointNotFoundErrorJsonEncoding", ApiWebhookEndpointNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"WebhooksRotateWebhookSecret500", WebhooksRotateWebhookSecret500>>
  readonly "webhooksTestWebhookEndpoint": (endpointId: string) => Effect.Effect<WebhookDeliveryJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiWebhookEndpointNotFoundErrorJsonEncoding", ApiWebhookEndpointNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"WebhooksTestWebhookEndpoint500", WebhooksTestWebhookEndpoint500>>
  readonly "webhooksListWebhookDeliveries": () => Effect.Effect<WebhooksListWebhookDeliveries200, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"WebhooksListWebhookDeliveries500", WebhooksListWebhookDeliveries500>>
  readonly "webhooksGetWebhookDelivery": (deliveryId: string) => Effect.Effect<WebhookDeliveryWithAttemptsJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiWebhookDeliveryNotFoundErrorJsonEncoding", ApiWebhookDeliveryNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"WebhooksGetWebhookDelivery500", WebhooksGetWebhookDelivery500>>
  readonly "webhooksRetryWebhookDelivery": (deliveryId: string) => Effect.Effect<WebhookDeliveryJsonEncoding, HttpClientError.HttpClientError | VoidhashCoreClientError<"ApiWebhookValidationErrorJsonEncoding", ApiWebhookValidationErrorJsonEncoding> | VoidhashCoreClientError<"ApiNotAuthenticatedErrorJsonEncoding", ApiNotAuthenticatedErrorJsonEncoding> | VoidhashCoreClientError<"ApiActionForbiddenErrorJsonEncoding", ApiActionForbiddenErrorJsonEncoding> | VoidhashCoreClientError<"ApiWebhookDeliveryNotFoundErrorJsonEncoding", ApiWebhookDeliveryNotFoundErrorJsonEncoding> | VoidhashCoreClientError<"WebhooksRetryWebhookDelivery500", WebhooksRetryWebhookDelivery500>>
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
