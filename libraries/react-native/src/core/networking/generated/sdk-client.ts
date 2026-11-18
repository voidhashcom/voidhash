import type * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

/**
 * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
 */
export type SdkGetPersonParamsXDistinctIdEncoding = "percent";

/**
 * `true` when the app sent the request from the background, otherwise `false`.
 */
export type SdkGetPersonParamsXIsBackgrounded = "true" | "false";

/**
 * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
 */
export type SdkGetPersonParamsXIsDebugBuild = "true" | "false";

/**
 * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
 */
export type SdkGetPersonParamsXObserverMode = "true" | "false";

/**
 * `native` in an app, `browser` in a web page.
 */
export type SdkGetPersonParamsXPlatformFlavor = "native" | "browser";

/**
 * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
 */
export type SdkGetPersonParamsXSdk = "react-native" | "web" | "ios" | "android";

export interface SdkGetPersonParams {
  /**
   * The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
   */
  readonly "x-distinct-id": string;
  /**
   * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
   */
  readonly "x-distinct-id-encoding"?: SdkGetPersonParamsXDistinctIdEncoding | undefined;
  /**
   * The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
   */
  readonly "x-publishable-key": string;
  /**
   * The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
   */
  readonly "x-client-bundle-id": string;
  /**
   * The end user's most preferred locale, such as `en-US`.
   */
  readonly "x-client-locale"?: string | undefined;
  /**
   * The app's version, such as `2.4.1`.
   */
  readonly "x-client-version"?: string | undefined;
  /**
   * `true` when the app sent the request from the background, otherwise `false`.
   */
  readonly "x-is-backgrounded": SdkGetPersonParamsXIsBackgrounded;
  /**
   * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
   */
  readonly "x-is-debug-build": SdkGetPersonParamsXIsDebugBuild;
  /**
   * A random id, new for every request, such as a lowercase UUID.
   */
  readonly "x-nonce"?: string | undefined;
  /**
   * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
   */
  readonly "x-observer-mode": SdkGetPersonParamsXObserverMode;
  /**
   * The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
   */
  readonly "x-platform": string;
  /**
   * The device's manufacturer, such as `Apple` or `Google`.
   */
  readonly "x-platform-brand"?: string | undefined;
  /**
   * The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
   */
  readonly "x-platform-device"?: string | undefined;
  /**
   * `native` in an app, `browser` in a web page.
   */
  readonly "x-platform-flavor": SdkGetPersonParamsXPlatformFlavor;
  /**
   * The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
   */
  readonly "x-platform-flavor-version"?: string | undefined;
  /**
   * The operating system's version, such as `17.4`; in a browser, its user agent.
   */
  readonly "x-platform-version"?: string | undefined;
  /**
   * The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
   */
  readonly "x-preferred-locales"?: string | undefined;
  /**
   * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
   */
  readonly "x-sdk": SdkGetPersonParamsXSdk;
  /**
   * The version of the SDK making the request, such as `1.4.0`.
   */
  readonly "x-sdk-version": string;
  /**
   * The app store storefront (country) the end user buys from, when the SDK knows it.
   */
  readonly "x-storefront"?: string | undefined;
}

/**
 * What granted the perk: a `subscription`, a one-time `purchase`, or a `manual` grant.
 */
export type SdkEntitlementGrantJsonEncodingSource = "subscription" | "purchase" | "manual";

/**
 * `active` while the person has access, `expired` once it ended.
 */
export type SdkEntitlementGrantJsonEncodingStatus = "active" | "expired";

export interface SdkEntitlementGrantJsonEncoding {
  /**
   * When the access ends, as an ISO 8601 timestamp; null when it does not expire.
   */
  readonly expiresAt: string | null;
  /**
   * The id of the perk granted.
   */
  readonly perkId: string;
  /**
   * The slug of the perk granted, which apps check access by; absent when the perk was deleted.
   */
  readonly perkSlug?: string | null | undefined;
  /**
   * What granted the perk: a `subscription`, a one-time `purchase`, or a `manual` grant.
   */
  readonly source: SdkEntitlementGrantJsonEncodingSource;
  /**
   * The id of the subscription or purchase that granted the perk; null for a manual grant.
   */
  readonly sourceId: string | null;
  /**
   * The id of the person who owns it: the calling person, a person merged into them, or one who shares it with them.
   */
  readonly sourcePersonId: string;
  /**
   * `active` while the person has access, `expired` once it ended.
   */
  readonly status: SdkEntitlementGrantJsonEncodingStatus;
}

/**
 * `one_time` for a one-time product, `consumable` for a consumable one, `subscription` for a subscription's purchase.
 */
export type SdkPurchaseHistoryEntryJsonEncodingType = "one_time" | "consumable" | "subscription";

export interface SdkPurchaseHistoryEntryJsonEncoding {
  /**
   * When the purchase was recorded, as an ISO 8601 timestamp.
   */
  readonly createdAt: string;
  /**
   * The id of the product bought; null when its store product is not linked to one.
   */
  readonly productId: string | null;
  /**
   * The slug of the product bought; null when its store product is not linked to one.
   */
  readonly productSlug: string | null;
  /**
   * The store's id for the transaction, such as an App Store transaction id.
   */
  readonly providerKey: string;
  /**
   * The purchase's id.
   */
  readonly purchaseId: string;
  /**
   * When the purchase was refunded, as an ISO 8601 timestamp; null when it was not.
   */
  readonly refundedAt: string | null;
  /**
   * When the store withdrew the purchase without a refund, as for Family Sharing, as an ISO 8601 timestamp; null when it did not.
   */
  readonly revokedAt: string | null;
  /**
   * The id of the person who owns it: the calling person, a person merged into them, or one who shares it with them.
   */
  readonly sourcePersonId: string;
  /**
   * `one_time` for a one-time product, `consumable` for a consumable one, `subscription` for a subscription's purchase.
   */
  readonly type: SdkPurchaseHistoryEntryJsonEncodingType;
}

/**
 * `persisted` when the response shows only this person; `temporary_pending_transfer` when an identify is still moving the anonymous person's purchases over, and both are shown together until it finishes.
 */
export type SdkPersonJsonEncodingSnapshotContextMode = "persisted" | "temporary_pending_transfer";

/**
 * Where the purchase was made: `production`, a store `sandbox`, or `test` for simulated purchases.
 */
export type SdkSubscriptionJsonEncodingEnvironment = "production" | "sandbox" | "test";

export type SdkSubscriptionPendingPriceJsonEncodingAmountMicrosEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export type SdkSubscriptionPendingPriceJsonEncodingConsentEnum = "pending" | "accepted";

export interface SdkSubscriptionPendingPriceJsonEncoding {
  readonly amountMicros: number | SdkSubscriptionPendingPriceJsonEncodingAmountMicrosEnum;
  /**
   * `pending` while the store waits for the customer to agree to the new price, `accepted` once they did or when the change needs no consent; null when the store did not say.
   */
  readonly consent: SdkSubscriptionPendingPriceJsonEncodingConsentEnum | null;
  /**
   * The ISO 4217 code of the new price's currency.
   */
  readonly currency: string;
  /**
   * When the new price is first charged, as an ISO 8601 timestamp; null when the store did not say, which means at the next renewal.
   */
  readonly effectiveAt: string | null;
}

/**
 * How the current period is priced: `trial` (free), `intro` (an offer's discounted price) or `regular`.
 */
export type SdkSubscriptionJsonEncodingPeriodType = "trial" | "intro" | "regular";

/**
 * Where the subscription stands: `active`, `trialing` in a free trial, `in_grace_period` while the store retries a failed payment and access continues, `in_billing_retry` while it retries without access, `on_hold` while Google Play holds it after a failed payment, `paused` while Google Play pauses it, `expired` once it ended, or `revoked` once the store withdrew access, as for a refund. Access comes from `entitlements`, never from this.
 */
export type SdkSubscriptionJsonEncodingStatus =
  | "active"
  | "trialing"
  | "in_grace_period"
  | "in_billing_retry"
  | "on_hold"
  | "paused"
  | "expired"
  | "revoked";

/**
 * Where the subscription was bought: `app_store`, `google_play`, `stripe`, or `other` for any other payment source.
 */
export type SdkSubscriptionJsonEncodingStore = "app_store" | "google_play" | "stripe" | "other";

export interface SdkSubscriptionJsonEncoding {
  /**
   * When the store first failed to charge a renewal, as an ISO 8601 timestamp; null without a billing issue.
   */
  readonly billingIssueDetectedAt: string | null;
  /**
   * When auto-renew was turned off or the subscription was canceled, as an ISO 8601 timestamp; null while it renews.
   */
  readonly canceledAt: string | null;
  /**
   * Where the purchase was made: `production`, a store `sandbox`, or `test` for simulated purchases.
   */
  readonly environment: SdkSubscriptionJsonEncodingEnvironment;
  /**
   * When the current period ends, as an ISO 8601 timestamp; null when the store reported none.
   */
  readonly expiresAt: string | null;
  /**
   * When the store's billing grace period ends, as an ISO 8601 timestamp; null outside one. Google Play does not report the end of a grace period, so for Google Play this is the latest it can end; Google ends it sooner by putting the subscription on hold, ending it, or recovering the payment.
   */
  readonly gracePeriodExpiresAt: string | null;
  /**
   * Whether the person has access through App Store Family Sharing rather than their own purchase.
   */
  readonly isFamilyShared: boolean;
  /**
   * The store's id of the offer the current period was bought with; null without one. Google Play keeps naming the offer a subscription was bought with after its offer phases end.
   */
  readonly offerId: string | null;
  /**
   * A new price the store charges from a coming renewal; null when none is pending.
   */
  readonly pendingPrice: SdkSubscriptionPendingPriceJsonEncoding | null;
  /**
   * How the current period is priced: `trial` (free), `intro` (an offer's discounted price) or `regular`.
   */
  readonly periodType: SdkSubscriptionJsonEncodingPeriodType;
  /**
   * The id of the subscription's product; null when its store product is not linked to one.
   */
  readonly productId: string | null;
  /**
   * The slug of the subscription's product; null when its store product is not linked to one.
   */
  readonly productSlug: string | null;
  /**
   * When the charge of the current period was refunded, as an ISO 8601 timestamp; null when it was not. A Google Play refund alone does not end access.
   */
  readonly refundedAt: string | null;
  /**
   * The slug of the product the subscription renews into, after a downgrade or crossgrade the store applies at renewal; null when it renews as it is.
   */
  readonly renewsToProductSlug: string | null;
  /**
   * When a paused subscription resumes on its own, as an ISO 8601 timestamp; null when it is not paused or the store did not say.
   */
  readonly resumesAt: string | null;
  /**
   * When the store withdrew access before the period ended, as an ISO 8601 timestamp; null when it did not.
   */
  readonly revokedAt: string | null;
  /**
   * When the current period started, as an ISO 8601 timestamp.
   */
  readonly startsAt: string;
  /**
   * Where the subscription stands: `active`, `trialing` in a free trial, `in_grace_period` while the store retries a failed payment and access continues, `in_billing_retry` while it retries without access, `on_hold` while Google Play holds it after a failed payment, `paused` while Google Play pauses it, `expired` once it ended, or `revoked` once the store withdrew access, as for a refund. Access comes from `entitlements`, never from this.
   */
  readonly status: SdkSubscriptionJsonEncodingStatus;
  /**
   * Where the subscription was bought: `app_store`, `google_play`, `stripe`, or `other` for any other payment source.
   */
  readonly store: SdkSubscriptionJsonEncodingStore;
  /**
   * The subscription's id.
   */
  readonly subscriptionId: string;
  /**
   * Whether the store renews the subscription at the end of the current period, into `renewsToProductSlug` when set.
   */
  readonly willRenew: boolean;
}

/**
 * Where the subscription stands: `active`, `trialing` in a free trial, `in_grace_period` while the store retries a failed payment and access continues, `in_billing_retry` while it retries without access, `on_hold` while Google Play holds it after a failed payment, `paused` while Google Play pauses it, `expired` once it ended, or `revoked` once the store withdrew access, as for a refund. Access comes from `entitlements`, never from this.
 */
export type SdkSubscriptionHistoryEntryJsonEncodingStatus =
  | "active"
  | "trialing"
  | "in_grace_period"
  | "in_billing_retry"
  | "on_hold"
  | "paused"
  | "expired"
  | "revoked";

/**
 * Where the subscription was bought: `app_store`, `google_play`, `stripe`, or `other` for any other payment source.
 */
export type SdkSubscriptionHistoryEntryJsonEncodingStore =
  | "app_store"
  | "google_play"
  | "stripe"
  | "other";

export interface SdkSubscriptionHistoryEntryJsonEncoding {
  /**
   * When the subscription was canceled, as an ISO 8601 timestamp; null when it was not.
   */
  readonly canceledAt: string | null;
  /**
   * When the subscription's period ends or ended, as an ISO 8601 timestamp; null when the store reported none.
   */
  readonly expiresAt: string | null;
  /**
   * Whether the subscription is in a free trial period.
   */
  readonly isTrial: boolean;
  /**
   * The id of the subscription's product; null when its store product is not linked to one.
   */
  readonly productId: string | null;
  /**
   * The slug of the subscription's product; null when its store product is not linked to one.
   */
  readonly productSlug: string | null;
  /**
   * When the charge of the current period was refunded, as an ISO 8601 timestamp; null when it was not. A Google Play refund alone does not end access.
   */
  readonly refundedAt: string | null;
  /**
   * The id of the person who owns it: the calling person, a person merged into them, or one who shares it with them.
   */
  readonly sourcePersonId: string;
  /**
   * When the subscription's current period started, as an ISO 8601 timestamp.
   */
  readonly startsAt: string;
  /**
   * Where the subscription stands: `active`, `trialing` in a free trial, `in_grace_period` while the store retries a failed payment and access continues, `in_billing_retry` while it retries without access, `on_hold` while Google Play holds it after a failed payment, `paused` while Google Play pauses it, `expired` once it ended, or `revoked` once the store withdrew access, as for a refund. Access comes from `entitlements`, never from this.
   */
  readonly status: SdkSubscriptionHistoryEntryJsonEncodingStatus;
  /**
   * Where the subscription was bought: `app_store`, `google_play`, `stripe`, or `other` for any other payment source.
   */
  readonly store: SdkSubscriptionHistoryEntryJsonEncodingStore;
  /**
   * The subscription's id.
   */
  readonly subscriptionId: string;
}

export interface SdkPersonJsonEncoding {
  /**
   * The distinct id the person is known by.
   */
  readonly distinctId: string;
  /**
   * The person's email address; null when unknown.
   */
  readonly email: string | null;
  /**
   * The person's access to perks.
   */
  readonly entitlements: {
    /**
     * The perks the person has or had, one entry per perk.
     */
    readonly grants: ReadonlyArray<SdkEntitlementGrantJsonEncoding>;
  };
  /**
   * The person's name; null when unknown.
   */
  readonly name: string | null;
  /**
   * The person's id, `person_...`.
   */
  readonly personId: string;
  /**
   * The person's purchases.
   */
  readonly purchases: {
    /**
     * Every purchase the person owns or shares, one entry per store transaction.
     */
    readonly history: ReadonlyArray<SdkPurchaseHistoryEntryJsonEncoding>;
  };
  /**
   * Which persons this response is built from.
   */
  readonly snapshotContext: {
    /**
     * The ids of the persons whose access and history this response includes.
     */
    readonly includedPersonIds: ReadonlyArray<string>;
    /**
     * The id of the transfer still moving another person's purchases to this one; null when none is running.
     */
    readonly migrationJobId: string | null;
    /**
     * `persisted` when the response shows only this person; `temporary_pending_transfer` when an identify is still moving the anonymous person's purchases over, and both are shown together until it finishes.
     */
    readonly mode: SdkPersonJsonEncodingSnapshotContextMode;
  };
  /**
   * The person's subscriptions.
   */
  readonly subscriptions: {
    /**
     * Every subscription that has not ended (neither `expired` nor `revoked`), including those in a grace period, billing retry, on hold or paused, best first as for `current`. What a screen to manage subscriptions lists; access comes from `entitlements`, never from this list.
     */
    readonly all: ReadonlyArray<SdkSubscriptionJsonEncoding>;
    /**
     * The subscription that matters most right now, the first of `all`: `active`, then `trialing`, `in_grace_period`, `in_billing_retry`, `on_hold` and `paused`, the latest to expire first; null when none has not ended.
     */
    readonly current: SdkSubscriptionJsonEncoding | null;
    /**
     * Every subscription the person owns or shares, ended ones included.
     */
    readonly history: ReadonlyArray<SdkSubscriptionHistoryEntryJsonEncoding>;
  };
}

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiSdkValidationErrorJsonEncodingTag = "Api/SdkValidationError";

export interface ApiSdkValidationErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiSdkValidationErrorJsonEncodingTag;
  /**
   * What went wrong, written for a developer reading logs. It can change, so do not parse it.
   */
  readonly message: string;
}

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiAuthenticationErrorJsonEncodingTag = "Api/AuthenticationError";

export interface ApiAuthenticationErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiAuthenticationErrorJsonEncodingTag;
  /**
   * Why the credential was refused: a code such as `invalid_api_key`, `expired_api_key` or `credential_not_accepted`, or the same text as `message`.
   */
  readonly cause: string;
  /**
   * What went wrong, written for a developer reading logs. It can change, so do not parse it.
   */
  readonly message: string;
}

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiNotAuthenticatedErrorJsonEncodingTag = "Api/NotAuthenticatedError";

export interface ApiNotAuthenticatedErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiNotAuthenticatedErrorJsonEncodingTag;
  /**
   * What went wrong, written for a developer reading logs. It can change, so do not parse it.
   */
  readonly message: string;
}

export type SdkGetPerson401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiSdkPersonNotFoundErrorJsonEncodingTag = "Api/SdkPersonNotFoundError";

export interface ApiSdkPersonNotFoundErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiSdkPersonNotFoundErrorJsonEncodingTag;
  /**
   * What went wrong, written for a developer reading logs. It can change, so do not parse it.
   */
  readonly message: string;
}

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiSdkServiceErrorJsonEncodingTag = "Api/SdkServiceError";

export interface ApiSdkServiceErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiSdkServiceErrorJsonEncodingTag;
  /**
   * A short reason, usually `Internal server error`; the details are logged on our side. Retry with backoff.
   */
  readonly cause: string;
}

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiAuthServiceErrorJsonEncodingTag = "Api/AuthServiceError";

export interface ApiAuthServiceErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiAuthServiceErrorJsonEncodingTag;
  /**
   * Why the credential could not be checked.
   */
  readonly cause: string;
  /**
   * What went wrong, written for a developer reading logs. It can change, so do not parse it.
   */
  readonly message: string;
}

export type SdkGetPerson500 = ApiSdkServiceErrorJsonEncoding | ApiAuthServiceErrorJsonEncoding;

/**
 * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
 */
export type SdkIdentifyPersonParamsXDistinctIdEncoding = "percent";

/**
 * `true` when the app sent the request from the background, otherwise `false`.
 */
export type SdkIdentifyPersonParamsXIsBackgrounded = "true" | "false";

/**
 * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
 */
export type SdkIdentifyPersonParamsXIsDebugBuild = "true" | "false";

/**
 * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
 */
export type SdkIdentifyPersonParamsXObserverMode = "true" | "false";

/**
 * `native` in an app, `browser` in a web page.
 */
export type SdkIdentifyPersonParamsXPlatformFlavor = "native" | "browser";

/**
 * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
 */
export type SdkIdentifyPersonParamsXSdk = "react-native" | "web" | "ios" | "android";

export interface SdkIdentifyPersonParams {
  /**
   * The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
   */
  readonly "x-distinct-id": string;
  /**
   * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
   */
  readonly "x-distinct-id-encoding"?: SdkIdentifyPersonParamsXDistinctIdEncoding | undefined;
  /**
   * The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
   */
  readonly "x-publishable-key": string;
  /**
   * The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
   */
  readonly "x-client-bundle-id": string;
  /**
   * The end user's most preferred locale, such as `en-US`.
   */
  readonly "x-client-locale"?: string | undefined;
  /**
   * The app's version, such as `2.4.1`.
   */
  readonly "x-client-version"?: string | undefined;
  /**
   * `true` when the app sent the request from the background, otherwise `false`.
   */
  readonly "x-is-backgrounded": SdkIdentifyPersonParamsXIsBackgrounded;
  /**
   * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
   */
  readonly "x-is-debug-build": SdkIdentifyPersonParamsXIsDebugBuild;
  /**
   * A random id, new for every request, such as a lowercase UUID.
   */
  readonly "x-nonce"?: string | undefined;
  /**
   * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
   */
  readonly "x-observer-mode": SdkIdentifyPersonParamsXObserverMode;
  /**
   * The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
   */
  readonly "x-platform": string;
  /**
   * The device's manufacturer, such as `Apple` or `Google`.
   */
  readonly "x-platform-brand"?: string | undefined;
  /**
   * The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
   */
  readonly "x-platform-device"?: string | undefined;
  /**
   * `native` in an app, `browser` in a web page.
   */
  readonly "x-platform-flavor": SdkIdentifyPersonParamsXPlatformFlavor;
  /**
   * The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
   */
  readonly "x-platform-flavor-version"?: string | undefined;
  /**
   * The operating system's version, such as `17.4`; in a browser, its user agent.
   */
  readonly "x-platform-version"?: string | undefined;
  /**
   * The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
   */
  readonly "x-preferred-locales"?: string | undefined;
  /**
   * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
   */
  readonly "x-sdk": SdkIdentifyPersonParamsXSdk;
  /**
   * The version of the SDK making the request, such as `1.4.0`.
   */
  readonly "x-sdk-version": string;
  /**
   * The app store storefront (country) the end user buys from, when the SDK knows it.
   */
  readonly "x-storefront"?: string | undefined;
}

/**
 * A person's traits: names mapped to a string, number, boolean or null.
 */
export type PersonAttributeValues = Record<string, unknown>;

export interface SdkIdentifyBodyJsonEncoding {
  /**
   * The distinct id to identify the end user as, such as your own user id. It cannot start with the anonymous prefix `vh_anon_`.
   */
  readonly distinctId: string;
  /**
   * The person's email address.
   */
  readonly email?: string | null | undefined;
  /**
   * The person's name.
   */
  readonly name?: string | null | undefined;
  /**
   * Traits to set on the person; the newest write of each trait wins.
   */
  readonly traits?: PersonAttributeValues | null | undefined;
}

export type SdkIdentifyPerson401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiSdkPersonAlreadyIdentifiedErrorJsonEncodingTag =
  "Api/SdkPersonAlreadyIdentifiedError";

export interface ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiSdkPersonAlreadyIdentifiedErrorJsonEncodingTag;
  /**
   * The distinct id the request identified as, which already belongs to another identified person; the two are not merged.
   */
  readonly distinctId: string;
}

export type SdkIdentifyPerson500 = ApiSdkServiceErrorJsonEncoding | ApiAuthServiceErrorJsonEncoding;

/**
 * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
 */
export type SdkSyncPersonAttributesParamsXDistinctIdEncoding = "percent";

/**
 * `true` when the app sent the request from the background, otherwise `false`.
 */
export type SdkSyncPersonAttributesParamsXIsBackgrounded = "true" | "false";

/**
 * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
 */
export type SdkSyncPersonAttributesParamsXIsDebugBuild = "true" | "false";

/**
 * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
 */
export type SdkSyncPersonAttributesParamsXObserverMode = "true" | "false";

/**
 * `native` in an app, `browser` in a web page.
 */
export type SdkSyncPersonAttributesParamsXPlatformFlavor = "native" | "browser";

/**
 * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
 */
export type SdkSyncPersonAttributesParamsXSdk = "react-native" | "web" | "ios" | "android";

export interface SdkSyncPersonAttributesParams {
  /**
   * The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
   */
  readonly "x-distinct-id": string;
  /**
   * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
   */
  readonly "x-distinct-id-encoding"?: SdkSyncPersonAttributesParamsXDistinctIdEncoding | undefined;
  /**
   * The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
   */
  readonly "x-publishable-key": string;
  /**
   * The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
   */
  readonly "x-client-bundle-id": string;
  /**
   * The end user's most preferred locale, such as `en-US`.
   */
  readonly "x-client-locale"?: string | undefined;
  /**
   * The app's version, such as `2.4.1`.
   */
  readonly "x-client-version"?: string | undefined;
  /**
   * `true` when the app sent the request from the background, otherwise `false`.
   */
  readonly "x-is-backgrounded": SdkSyncPersonAttributesParamsXIsBackgrounded;
  /**
   * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
   */
  readonly "x-is-debug-build": SdkSyncPersonAttributesParamsXIsDebugBuild;
  /**
   * A random id, new for every request, such as a lowercase UUID.
   */
  readonly "x-nonce"?: string | undefined;
  /**
   * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
   */
  readonly "x-observer-mode": SdkSyncPersonAttributesParamsXObserverMode;
  /**
   * The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
   */
  readonly "x-platform": string;
  /**
   * The device's manufacturer, such as `Apple` or `Google`.
   */
  readonly "x-platform-brand"?: string | undefined;
  /**
   * The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
   */
  readonly "x-platform-device"?: string | undefined;
  /**
   * `native` in an app, `browser` in a web page.
   */
  readonly "x-platform-flavor": SdkSyncPersonAttributesParamsXPlatformFlavor;
  /**
   * The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
   */
  readonly "x-platform-flavor-version"?: string | undefined;
  /**
   * The operating system's version, such as `17.4`; in a browser, its user agent.
   */
  readonly "x-platform-version"?: string | undefined;
  /**
   * The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
   */
  readonly "x-preferred-locales"?: string | undefined;
  /**
   * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
   */
  readonly "x-sdk": SdkSyncPersonAttributesParamsXSdk;
  /**
   * The version of the SDK making the request, such as `1.4.0`.
   */
  readonly "x-sdk-version": string;
  /**
   * The app store storefront (country) the end user buys from, when the SDK knows it.
   */
  readonly "x-storefront"?: string | undefined;
}

export interface SdkSyncPersonAttributesBodyJsonEncoding {
  /**
   * The person's email address.
   */
  readonly email?: string | null | undefined;
  /**
   * The person's name.
   */
  readonly name?: string | null | undefined;
  /**
   * Traits to set; the newest write of each trait wins.
   */
  readonly traits?: PersonAttributeValues | null | undefined;
  /**
   * Traits to set only when the person has none of that name yet; the earliest write wins, and a `traits` write still wins over them.
   */
  readonly setOnce?: PersonAttributeValues | null | undefined;
  /**
   * A stable id the SDK gives this write, so a retried or echoed copy of it is applied only once.
   */
  readonly clientEventId?: string | null | undefined;
}

export type SdkSyncPersonAttributes401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkSyncPersonAttributes500 =
  | ApiSdkServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

/**
 * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
 */
export type SdkSyncTransactionParamsXDistinctIdEncoding = "percent";

export interface SdkSyncTransactionParams {
  /**
   * The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
   */
  readonly "x-distinct-id": string;
  /**
   * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
   */
  readonly "x-distinct-id-encoding"?: SdkSyncTransactionParamsXDistinctIdEncoding | undefined;
  /**
   * The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
   */
  readonly "x-publishable-key": string;
  /**
   * The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers. At most 255 characters.
   */
  readonly "x-client-bundle-id": string;
  /**
   * The end user's most preferred locale, such as `en-US`.
   */
  readonly "x-client-locale"?: string | undefined;
  /**
   * The app's version, such as `2.4.1`.
   */
  readonly "x-client-version"?: string | undefined;
  /**
   * `true` when the app sent the request from the background, otherwise `false`.
   */
  readonly "x-is-backgrounded"?: string | undefined;
  /**
   * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
   */
  readonly "x-is-debug-build"?: string | undefined;
  /**
   * A random id, new for every request, such as a lowercase UUID.
   */
  readonly "x-nonce"?: string | undefined;
  /**
   * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
   */
  readonly "x-observer-mode"?: string | undefined;
  /**
   * The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
   */
  readonly "x-platform"?: string | undefined;
  /**
   * The device's manufacturer, such as `Apple` or `Google`.
   */
  readonly "x-platform-brand"?: string | undefined;
  /**
   * The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
   */
  readonly "x-platform-device"?: string | undefined;
  /**
   * `native` in an app, `browser` in a web page.
   */
  readonly "x-platform-flavor"?: string | undefined;
  /**
   * The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
   */
  readonly "x-platform-flavor-version"?: string | undefined;
  /**
   * The operating system's version, such as `17.4`; in a browser, its user agent.
   */
  readonly "x-platform-version"?: string | undefined;
  /**
   * The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
   */
  readonly "x-preferred-locales"?: string | undefined;
  /**
   * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
   */
  readonly "x-sdk"?: string | undefined;
  /**
   * The version of the SDK making the request, such as `1.4.0`.
   */
  readonly "x-sdk-version"?: string | undefined;
  /**
   * The app store storefront (country) the end user buys from, when the SDK knows it.
   */
  readonly "x-storefront"?: string | undefined;
}

/**
 * An App Store transaction.
 */
export type SdkSyncIosTransactionBodyPlatform = "ios";

export type SdkSyncIosTransactionBodyIntentEnum = "sync" | "restore";

/**
 * The paywall a purchase was made on. The server checks the showing and derives the rest; a context it cannot use is dropped and the purchase still records.
 */
export interface SdkPurchasePaywallContext {
  /**
   * The id of the showing `POST /sdk/resolve-paywall` returned, which credits the purchase to the paywall that sold it.
   */
  readonly showingId: string;
  /**
   * The slug of the location the paywall was shown at; informational.
   */
  readonly placement?: string | null | undefined;
  /**
   * The id of the paywall shown; informational.
   */
  readonly paywallId?: string | null | undefined;
  /**
   * The id of the paywall release shown; informational.
   */
  readonly paywallReleaseId?: string | null | undefined;
}

/**
 * An App Store transaction for the server to verify with Apple and record.
 */
export interface SdkSyncIosTransactionBody {
  /**
   * An App Store transaction.
   */
  readonly platform: SdkSyncIosTransactionBodyPlatform;
  /**
   * StoreKit's transaction id, a decimal integer.
   */
  readonly transactionId: string;
  /**
   * Why the SDK reports the transaction: `restore` for a restore the end user asked for, which may share or move a purchase another user owns as the project's paid access sharing setting allows; `sync` (the default) for anything else, which records it for this user.
   */
  readonly intent?: SdkSyncIosTransactionBodyIntentEnum | null | undefined;
  /**
   * The paywall the purchase was made on, when the SDK started it from one.
   */
  readonly paywallContext?: SdkPurchasePaywallContext | null | undefined;
}

/**
 * A Google Play purchase.
 */
export type SdkSyncAndroidTransactionBodyPlatform = "android";

export type SdkSyncAndroidTransactionBodyIntentEnum = "sync" | "restore";

/**
 * A Google Play purchase for the server to verify with Google and record.
 */
export interface SdkSyncAndroidTransactionBody {
  /**
   * A Google Play purchase.
   */
  readonly platform: SdkSyncAndroidTransactionBodyPlatform;
  /**
   * Google Play's opaque purchase token, up to 1024 characters.
   */
  readonly purchaseToken: string;
  /**
   * Why the SDK reports the transaction: `restore` for a restore the end user asked for, which may share or move a purchase another user owns as the project's paid access sharing setting allows; `sync` (the default) for anything else, which records it for this user.
   */
  readonly intent?: SdkSyncAndroidTransactionBodyIntentEnum | null | undefined;
  /**
   * Whether the SDK started this purchase itself, so the server acknowledges it with Google Play once it is recorded. Leave out or `false` for a purchase the app's own billing integration made: the server never acknowledges those.
   */
  readonly isStartedBySdk?: boolean | null | undefined;
  /**
   * The paywall the purchase was made on, when the SDK started it from one.
   */
  readonly paywallContext?: SdkPurchasePaywallContext | null | undefined;
}

export type SdkSyncTransactionRequest = SdkSyncIosTransactionBody | SdkSyncAndroidTransactionBody;

export interface SdkSyncTransactionResponseJsonEncoding {
  /**
   * Always `true`: the transaction was verified and recorded.
   */
  readonly accepted: boolean;
  /**
   * Whether the store product is not linked to a product yet. The purchase is kept and grants its perks once the store product is linked.
   */
  readonly pendingProductLink?: boolean | undefined;
}

export type SdkSyncTransaction401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiSdkTransactionRejectedErrorJsonEncodingTag = "Api/SdkTransactionRejectedError";

export interface ApiSdkTransactionRejectedErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiSdkTransactionRejectedErrorJsonEncodingTag;
  /**
   * Why the store transaction was refused, for diagnostics. Sending it again cannot succeed.
   */
  readonly reason: string;
}

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiSdkRateLimitedErrorJsonEncodingTag = "Api/SdkRateLimitedError";

export interface ApiSdkRateLimitedErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiSdkRateLimitedErrorJsonEncodingTag;
  /**
   * What went wrong, written for a developer reading logs. It can change, so do not parse it.
   */
  readonly message: string;
}

export type SdkSyncTransaction500 =
  | ApiSdkServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

/**
 * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
 */
export type SdkSignPromotionalOfferParamsXDistinctIdEncoding = "percent";

/**
 * `true` when the app sent the request from the background, otherwise `false`.
 */
export type SdkSignPromotionalOfferParamsXIsBackgrounded = "true" | "false";

/**
 * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
 */
export type SdkSignPromotionalOfferParamsXIsDebugBuild = "true" | "false";

/**
 * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
 */
export type SdkSignPromotionalOfferParamsXObserverMode = "true" | "false";

/**
 * `native` in an app, `browser` in a web page.
 */
export type SdkSignPromotionalOfferParamsXPlatformFlavor = "native" | "browser";

/**
 * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
 */
export type SdkSignPromotionalOfferParamsXSdk = "react-native" | "web" | "ios" | "android";

export interface SdkSignPromotionalOfferParams {
  /**
   * The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
   */
  readonly "x-distinct-id": string;
  /**
   * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
   */
  readonly "x-distinct-id-encoding"?: SdkSignPromotionalOfferParamsXDistinctIdEncoding | undefined;
  /**
   * The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
   */
  readonly "x-publishable-key": string;
  /**
   * The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
   */
  readonly "x-client-bundle-id": string;
  /**
   * The end user's most preferred locale, such as `en-US`.
   */
  readonly "x-client-locale"?: string | undefined;
  /**
   * The app's version, such as `2.4.1`.
   */
  readonly "x-client-version"?: string | undefined;
  /**
   * `true` when the app sent the request from the background, otherwise `false`.
   */
  readonly "x-is-backgrounded": SdkSignPromotionalOfferParamsXIsBackgrounded;
  /**
   * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
   */
  readonly "x-is-debug-build": SdkSignPromotionalOfferParamsXIsDebugBuild;
  /**
   * A random id, new for every request, such as a lowercase UUID.
   */
  readonly "x-nonce"?: string | undefined;
  /**
   * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
   */
  readonly "x-observer-mode": SdkSignPromotionalOfferParamsXObserverMode;
  /**
   * The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
   */
  readonly "x-platform": string;
  /**
   * The device's manufacturer, such as `Apple` or `Google`.
   */
  readonly "x-platform-brand"?: string | undefined;
  /**
   * The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
   */
  readonly "x-platform-device"?: string | undefined;
  /**
   * `native` in an app, `browser` in a web page.
   */
  readonly "x-platform-flavor": SdkSignPromotionalOfferParamsXPlatformFlavor;
  /**
   * The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
   */
  readonly "x-platform-flavor-version"?: string | undefined;
  /**
   * The operating system's version, such as `17.4`; in a browser, its user agent.
   */
  readonly "x-platform-version"?: string | undefined;
  /**
   * The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
   */
  readonly "x-preferred-locales"?: string | undefined;
  /**
   * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
   */
  readonly "x-sdk": SdkSignPromotionalOfferParamsXSdk;
  /**
   * The version of the SDK making the request, such as `1.4.0`.
   */
  readonly "x-sdk-version": string;
  /**
   * The app store storefront (country) the end user buys from, when the SDK knows it.
   */
  readonly "x-storefront"?: string | undefined;
}

export interface SdkPromotionalOfferSignatureBodyJsonEncoding {
  /**
   * The App Store product identifier the offer belongs to.
   */
  readonly productId: string;
  /**
   * The promotional offer's identifier, as the product's App Store mapping names it.
   */
  readonly offerId: string;
  /**
   * The id of any App Store transaction of the customer, such as their `appTransactionID`, which binds `signatureJws` to them. Apple recommends it; without it the JWS names no customer. Leave it out rather than sending an empty string.
   */
  readonly transactionId?: string | undefined;
}

export type SdkPromotionalOfferSignatureJsonEncodingTimestampEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export interface SdkPromotionalOfferSignatureJsonEncoding {
  /**
   * The offer's identifier in App Store Connect.
   */
  readonly offerIdentifier: string;
  /**
   * The id of the In-App Purchase key that signed the offer.
   */
  readonly keyIdentifier: string;
  /**
   * A lowercase UUID, new for every signature.
   */
  readonly nonce: string;
  /**
   * The Base64 DER ECDSA signature.
   */
  readonly signature: string;
  /**
   * When the offer was signed, in milliseconds since the Unix epoch.
   */
  readonly timestamp: number | SdkPromotionalOfferSignatureJsonEncodingTimestampEnum;
  /**
   * The lowercase app account token the signature was made for; the purchase must set it.
   */
  readonly appAccountToken: string;
  /**
   * The offer signed as the compact JWS StoreKit's `Product.PurchaseOption.promotionalOffer(_:compactJWS:)` takes, preferred over the legacy fields. Absent when the server cannot sign one, such as when the In-App Purchase key's issuer id is missing.
   */
  readonly signatureJws?: string | undefined;
}

export type SdkSignPromotionalOffer401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiSdkPromotionalOfferUnavailableErrorJsonEncodingTag =
  "Api/SdkPromotionalOfferUnavailableError";

export interface ApiSdkPromotionalOfferUnavailableErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiSdkPromotionalOfferUnavailableErrorJsonEncodingTag;
  /**
   * What went wrong, written for a developer reading logs. It can change, so do not parse it.
   */
  readonly message: string;
}

export type SdkSignPromotionalOffer500 =
  | ApiSdkServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

/**
 * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
 */
export type SdkDevelopmentPurchaseParamsXDistinctIdEncoding = "percent";

/**
 * `true` when the app sent the request from the background, otherwise `false`.
 */
export type SdkDevelopmentPurchaseParamsXIsBackgrounded = "true" | "false";

/**
 * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
 */
export type SdkDevelopmentPurchaseParamsXIsDebugBuild = "true" | "false";

/**
 * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
 */
export type SdkDevelopmentPurchaseParamsXObserverMode = "true" | "false";

/**
 * `native` in an app, `browser` in a web page.
 */
export type SdkDevelopmentPurchaseParamsXPlatformFlavor = "native" | "browser";

/**
 * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
 */
export type SdkDevelopmentPurchaseParamsXSdk = "react-native" | "web" | "ios" | "android";

export interface SdkDevelopmentPurchaseParams {
  /**
   * The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
   */
  readonly "x-distinct-id": string;
  /**
   * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
   */
  readonly "x-distinct-id-encoding"?: SdkDevelopmentPurchaseParamsXDistinctIdEncoding | undefined;
  /**
   * The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
   */
  readonly "x-publishable-key": string;
  /**
   * The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
   */
  readonly "x-client-bundle-id": string;
  /**
   * The end user's most preferred locale, such as `en-US`.
   */
  readonly "x-client-locale"?: string | undefined;
  /**
   * The app's version, such as `2.4.1`.
   */
  readonly "x-client-version"?: string | undefined;
  /**
   * `true` when the app sent the request from the background, otherwise `false`.
   */
  readonly "x-is-backgrounded": SdkDevelopmentPurchaseParamsXIsBackgrounded;
  /**
   * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
   */
  readonly "x-is-debug-build": SdkDevelopmentPurchaseParamsXIsDebugBuild;
  /**
   * A random id, new for every request, such as a lowercase UUID.
   */
  readonly "x-nonce"?: string | undefined;
  /**
   * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
   */
  readonly "x-observer-mode": SdkDevelopmentPurchaseParamsXObserverMode;
  /**
   * The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
   */
  readonly "x-platform": string;
  /**
   * The device's manufacturer, such as `Apple` or `Google`.
   */
  readonly "x-platform-brand"?: string | undefined;
  /**
   * The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
   */
  readonly "x-platform-device"?: string | undefined;
  /**
   * `native` in an app, `browser` in a web page.
   */
  readonly "x-platform-flavor": SdkDevelopmentPurchaseParamsXPlatformFlavor;
  /**
   * The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
   */
  readonly "x-platform-flavor-version"?: string | undefined;
  /**
   * The operating system's version, such as `17.4`; in a browser, its user agent.
   */
  readonly "x-platform-version"?: string | undefined;
  /**
   * The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
   */
  readonly "x-preferred-locales"?: string | undefined;
  /**
   * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
   */
  readonly "x-sdk": SdkDevelopmentPurchaseParamsXSdk;
  /**
   * The version of the SDK making the request, such as `1.4.0`.
   */
  readonly "x-sdk-version": string;
  /**
   * The app store storefront (country) the end user buys from, when the SDK knows it.
   */
  readonly "x-storefront"?: string | undefined;
}

export type SdkDevelopmentPurchaseBodyJsonEncodingPurchaseDateEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export type SdkDevelopmentPurchaseBodyJsonEncodingQuantityEnum = "Infinity" | "-Infinity" | "NaN";

export interface SdkDevelopmentPurchaseBodyJsonEncoding {
  /**
   * An id the SDK gives the simulated purchase; sending the same id again records it only once.
   */
  readonly devTransactionId: string;
  /**
   * The slug of the product bought.
   */
  readonly productSlug: string;
  /**
   * When the purchase was made, in milliseconds since the Unix epoch.
   */
  readonly purchaseDate: number | SdkDevelopmentPurchaseBodyJsonEncodingPurchaseDateEnum;
  /**
   * How many units were bought, a positive whole number; more than 1 only for consumable products. Defaults to 1.
   */
  readonly quantity?:
    | number
    | SdkDevelopmentPurchaseBodyJsonEncodingQuantityEnum
    | null
    | undefined;
}

export interface SdkDevelopmentPurchaseResponseJsonEncoding {
  /**
   * Always `true`: the simulated purchase was recorded.
   */
  readonly accepted: boolean;
  /**
   * A note about how the purchase was simulated, such as a subscription without a duration billed monthly; null when there is none.
   */
  readonly warning: string | null;
}

export type SdkDevelopmentPurchase401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkDevelopmentPurchase500 =
  | ApiSdkServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

/**
 * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
 */
export type SdkEvaluateFeatureFlagsParamsXDistinctIdEncoding = "percent";

/**
 * `true` when the app sent the request from the background, otherwise `false`.
 */
export type SdkEvaluateFeatureFlagsParamsXIsBackgrounded = "true" | "false";

/**
 * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
 */
export type SdkEvaluateFeatureFlagsParamsXIsDebugBuild = "true" | "false";

/**
 * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
 */
export type SdkEvaluateFeatureFlagsParamsXObserverMode = "true" | "false";

/**
 * `native` in an app, `browser` in a web page.
 */
export type SdkEvaluateFeatureFlagsParamsXPlatformFlavor = "native" | "browser";

/**
 * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
 */
export type SdkEvaluateFeatureFlagsParamsXSdk = "react-native" | "web" | "ios" | "android";

export interface SdkEvaluateFeatureFlagsParams {
  /**
   * The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
   */
  readonly "x-distinct-id": string;
  /**
   * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
   */
  readonly "x-distinct-id-encoding"?: SdkEvaluateFeatureFlagsParamsXDistinctIdEncoding | undefined;
  /**
   * The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
   */
  readonly "x-publishable-key": string;
  /**
   * The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
   */
  readonly "x-client-bundle-id": string;
  /**
   * The end user's most preferred locale, such as `en-US`.
   */
  readonly "x-client-locale"?: string | undefined;
  /**
   * The app's version, such as `2.4.1`.
   */
  readonly "x-client-version"?: string | undefined;
  /**
   * `true` when the app sent the request from the background, otherwise `false`.
   */
  readonly "x-is-backgrounded": SdkEvaluateFeatureFlagsParamsXIsBackgrounded;
  /**
   * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
   */
  readonly "x-is-debug-build": SdkEvaluateFeatureFlagsParamsXIsDebugBuild;
  /**
   * A random id, new for every request, such as a lowercase UUID.
   */
  readonly "x-nonce"?: string | undefined;
  /**
   * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
   */
  readonly "x-observer-mode": SdkEvaluateFeatureFlagsParamsXObserverMode;
  /**
   * The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
   */
  readonly "x-platform": string;
  /**
   * The device's manufacturer, such as `Apple` or `Google`.
   */
  readonly "x-platform-brand"?: string | undefined;
  /**
   * The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
   */
  readonly "x-platform-device"?: string | undefined;
  /**
   * `native` in an app, `browser` in a web page.
   */
  readonly "x-platform-flavor": SdkEvaluateFeatureFlagsParamsXPlatformFlavor;
  /**
   * The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
   */
  readonly "x-platform-flavor-version"?: string | undefined;
  /**
   * The operating system's version, such as `17.4`; in a browser, its user agent.
   */
  readonly "x-platform-version"?: string | undefined;
  /**
   * The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
   */
  readonly "x-preferred-locales"?: string | undefined;
  /**
   * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
   */
  readonly "x-sdk": SdkEvaluateFeatureFlagsParamsXSdk;
  /**
   * The version of the SDK making the request, such as `1.4.0`.
   */
  readonly "x-sdk-version": string;
  /**
   * The app store storefront (country) the end user buys from, when the SDK knows it.
   */
  readonly "x-storefront"?: string | undefined;
}

export interface EvaluateFeatureFlagsBodyJsonEncoding {
  /**
   * The keys of the flags to evaluate; absent or empty evaluates every flag of the project. Unknown keys are left out of the answer.
   */
  readonly flagKeys?: ReadonlyArray<string> | null | undefined;
}

export interface SdkFeatureFlagResultJsonEncoding {
  /**
   * Whether the flag is on for the person.
   */
  readonly enabled: boolean;
  /**
   * The flag's key.
   */
  readonly key: string;
  /**
   * The key of the variant the person is assigned; null when the flag has no variant for them.
   */
  readonly variantKey: string | null;
}

export interface SdkFeatureFlagsResponseJsonEncoding {
  /**
   * One entry per evaluated flag.
   */
  readonly flags: ReadonlyArray<SdkFeatureFlagResultJsonEncoding>;
}

export type SdkEvaluateFeatureFlags401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkEvaluateFeatureFlags500 =
  | ApiSdkServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

/**
 * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
 */
export type SdkResolvePaywallParamsXDistinctIdEncoding = "percent";

/**
 * `true` when the app sent the request from the background, otherwise `false`.
 */
export type SdkResolvePaywallParamsXIsBackgrounded = "true" | "false";

/**
 * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
 */
export type SdkResolvePaywallParamsXIsDebugBuild = "true" | "false";

/**
 * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
 */
export type SdkResolvePaywallParamsXObserverMode = "true" | "false";

/**
 * `native` in an app, `browser` in a web page.
 */
export type SdkResolvePaywallParamsXPlatformFlavor = "native" | "browser";

/**
 * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
 */
export type SdkResolvePaywallParamsXSdk = "react-native" | "web" | "ios" | "android";

export interface SdkResolvePaywallParams {
  /**
   * The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
   */
  readonly "x-distinct-id": string;
  /**
   * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
   */
  readonly "x-distinct-id-encoding"?: SdkResolvePaywallParamsXDistinctIdEncoding | undefined;
  /**
   * The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
   */
  readonly "x-publishable-key": string;
  /**
   * The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
   */
  readonly "x-client-bundle-id": string;
  /**
   * The end user's most preferred locale, such as `en-US`.
   */
  readonly "x-client-locale"?: string | undefined;
  /**
   * The app's version, such as `2.4.1`.
   */
  readonly "x-client-version"?: string | undefined;
  /**
   * `true` when the app sent the request from the background, otherwise `false`.
   */
  readonly "x-is-backgrounded": SdkResolvePaywallParamsXIsBackgrounded;
  /**
   * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
   */
  readonly "x-is-debug-build": SdkResolvePaywallParamsXIsDebugBuild;
  /**
   * A random id, new for every request, such as a lowercase UUID.
   */
  readonly "x-nonce"?: string | undefined;
  /**
   * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
   */
  readonly "x-observer-mode": SdkResolvePaywallParamsXObserverMode;
  /**
   * The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
   */
  readonly "x-platform": string;
  /**
   * The device's manufacturer, such as `Apple` or `Google`.
   */
  readonly "x-platform-brand"?: string | undefined;
  /**
   * The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
   */
  readonly "x-platform-device"?: string | undefined;
  /**
   * `native` in an app, `browser` in a web page.
   */
  readonly "x-platform-flavor": SdkResolvePaywallParamsXPlatformFlavor;
  /**
   * The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
   */
  readonly "x-platform-flavor-version"?: string | undefined;
  /**
   * The operating system's version, such as `17.4`; in a browser, its user agent.
   */
  readonly "x-platform-version"?: string | undefined;
  /**
   * The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
   */
  readonly "x-preferred-locales"?: string | undefined;
  /**
   * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
   */
  readonly "x-sdk": SdkResolvePaywallParamsXSdk;
  /**
   * The version of the SDK making the request, such as `1.4.0`.
   */
  readonly "x-sdk-version": string;
  /**
   * The app store storefront (country) the end user buys from, when the SDK knows it.
   */
  readonly "x-storefront"?: string | undefined;
  /**
   * The newest flow package format version the SDK's paywall engine reads.
   */
  readonly "x-ui-package-abi"?: string | undefined;
  /**
   * The newest component guest ABI version the SDK's paywall engine runs. Without it the other engine headers are ignored and only releases a guest ABI 1 engine without native components can show are served.
   */
  readonly "x-ui-guest-abi"?: string | undefined;
  /**
   * The native components the SDK's paywall engine provides, as comma-separated `id@version` entries.
   */
  readonly "x-ui-native-components"?: string | undefined;
  /**
   * The newest runtime bridge version the SDK's paywall engine hosts, sent only when it runs the flow runtime as a downloaded module. Such an engine reads no package format itself: a release is served when a runtime module for it exists on a bridge the engine hosts, and `x-ui-package-abi` is not checked.
   */
  readonly "x-ui-runtime-bridge"?: string | undefined;
}

export interface SdkResolvePaywallBodyJsonEncoding {
  /**
   * The slug of the location to show a paywall at.
   */
  readonly locationSlug: string;
  /**
   * The revision of the location's interface the app was built against. A flow that calls an app action or ends with an outcome the location added later is not served: the person gets the newest earlier release the app can answer, or nothing. Absent means 0, an app that handles nothing a flow asks of it.
   */
  readonly interfaceRevision?: number | null | undefined;
}

export type SdkResolvedPaywallJsonEncodingLocationInterfaceRevisionEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export type SdkResolvedPaywallShowingJsonEncodingPaywallReleaseEnumFlowPackageAbiVersionEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

export type SdkResolvedPaywallShowingJsonEncodingPaywallReleaseEnumVersionEnum =
  | "Infinity"
  | "-Infinity"
  | "NaN";

/**
 * How the showing was chosen: always `paywall_release`, also when an experiment picked the release.
 */
export type SdkResolvedPaywallShowingJsonEncodingType = "paywall_release" | "feature_flag";

/**
 * What the location shows the person now.
 */
export interface SdkResolvedPaywallShowingJsonEncoding {
  /**
   * The showing's id; send it as `paywallContext.showingId` with a purchase made on this paywall.
   */
  readonly id: string;
  /**
   * The paywall shown.
   */
  readonly paywall: {
    /**
     * The paywall's id.
     */
    readonly id: string;
    /**
     * The paywall's name.
     */
    readonly name: string;
    /**
     * The paywall's slug.
     */
    readonly slug: string;
  } | null;
  /**
   * The id of the paywall shown.
   */
  readonly paywallId: string | null;
  /**
   * The paywall release shown.
   */
  readonly paywallRelease: {
    /**
     * The release's compiled flow package.
     */
    readonly flowPackage: {
      /**
       * The package's format version.
       */
      readonly abiVersion: number | "Infinity" | "-Infinity" | "NaN";
      /**
       * What the flow is for, such as `paywall` or `onboarding`.
       */
      readonly kind: string;
      /**
       * The store product ids the package can offer, for prefetching their prices.
       */
      readonly productIds: ReadonlyArray<string>;
      /**
       * Whether a successful purchase closes the flow, as on a paywall, rather than letting it continue, as in onboarding.
       */
      readonly shouldEndFlowOnPurchase: boolean;
      /**
       * The SHA-256 hash of the package's bytes, as hex; verify the download against it.
       */
      readonly sha256: string;
      /**
       * Where to download the package; its content never changes, so cache it by `sha256`.
       */
      readonly url: string;
      /**
       * The flow runtime module the release needs, for SDKs that run the flow runtime as a downloaded module; null when none is offered for it. Other SDKs ignore it.
       */
      readonly runtime: {
        /**
         * The flow runtime version the release was built for, as `major.minor.patch`; a runtime module of the same major version and not older also runs it.
         */
        readonly version: string;
        /**
         * The SHA-256 hash of the runtime module's bytes, as hex; verify the download against it.
         */
        readonly sha256: string;
        /**
         * Where to download the runtime module; its content never changes, so cache it by `sha256`.
         */
        readonly url: string;
      } | null;
    };
    /**
     * When the release was published, as an ISO 8601 timestamp; null when it was not.
     */
    readonly publishedAt: string | null;
    /**
     * The release's id.
     */
    readonly releaseId: string;
    /**
     * The release's version number within its paywall.
     */
    readonly version: number | "Infinity" | "-Infinity" | "NaN";
  } | null;
  /**
   * The id of the paywall release shown.
   */
  readonly paywallReleaseId: string | null;
  /**
   * When the location started showing it, as an ISO 8601 timestamp.
   */
  readonly startedAt: string;
  /**
   * How the showing was chosen: always `paywall_release`, also when an experiment picked the release.
   */
  readonly type: SdkResolvedPaywallShowingJsonEncodingType;
}

export interface SdkResolvedPaywallJsonEncoding {
  /**
   * The location the paywall is shown at.
   */
  readonly location: {
    /**
     * The location's id.
     */
    readonly id: string;
    readonly interfaceRevision:
      | number
      | SdkResolvedPaywallJsonEncodingLocationInterfaceRevisionEnum;
    /**
     * The location's display name.
     */
    readonly name: string;
    /**
     * The location's slug, which the app shows paywalls by.
     */
    readonly slug: string;
  };
  readonly showing: SdkResolvedPaywallShowingJsonEncoding;
}

export type SdkResolvePaywall200 = SdkResolvedPaywallJsonEncoding | null;

export type SdkResolvePaywall401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkResolvePaywall500 = ApiSdkServiceErrorJsonEncoding | ApiAuthServiceErrorJsonEncoding;

/**
 * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
 */
export type SdkGetSdkSchemaParamsXDistinctIdEncoding = "percent";

/**
 * `true` when the app sent the request from the background, otherwise `false`.
 */
export type SdkGetSdkSchemaParamsXIsBackgrounded = "true" | "false";

/**
 * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
 */
export type SdkGetSdkSchemaParamsXIsDebugBuild = "true" | "false";

/**
 * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
 */
export type SdkGetSdkSchemaParamsXObserverMode = "true" | "false";

/**
 * `native` in an app, `browser` in a web page.
 */
export type SdkGetSdkSchemaParamsXPlatformFlavor = "native" | "browser";

/**
 * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
 */
export type SdkGetSdkSchemaParamsXSdk = "react-native" | "web" | "ios" | "android";

export interface SdkGetSdkSchemaParams {
  /**
   * The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
   */
  readonly "x-distinct-id": string;
  /**
   * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
   */
  readonly "x-distinct-id-encoding"?: SdkGetSdkSchemaParamsXDistinctIdEncoding | undefined;
  /**
   * The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
   */
  readonly "x-publishable-key": string;
  /**
   * The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
   */
  readonly "x-client-bundle-id": string;
  /**
   * The end user's most preferred locale, such as `en-US`.
   */
  readonly "x-client-locale"?: string | undefined;
  /**
   * The app's version, such as `2.4.1`.
   */
  readonly "x-client-version"?: string | undefined;
  /**
   * `true` when the app sent the request from the background, otherwise `false`.
   */
  readonly "x-is-backgrounded": SdkGetSdkSchemaParamsXIsBackgrounded;
  /**
   * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
   */
  readonly "x-is-debug-build": SdkGetSdkSchemaParamsXIsDebugBuild;
  /**
   * A random id, new for every request, such as a lowercase UUID.
   */
  readonly "x-nonce"?: string | undefined;
  /**
   * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
   */
  readonly "x-observer-mode": SdkGetSdkSchemaParamsXObserverMode;
  /**
   * The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
   */
  readonly "x-platform": string;
  /**
   * The device's manufacturer, such as `Apple` or `Google`.
   */
  readonly "x-platform-brand"?: string | undefined;
  /**
   * The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
   */
  readonly "x-platform-device"?: string | undefined;
  /**
   * `native` in an app, `browser` in a web page.
   */
  readonly "x-platform-flavor": SdkGetSdkSchemaParamsXPlatformFlavor;
  /**
   * The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
   */
  readonly "x-platform-flavor-version"?: string | undefined;
  /**
   * The operating system's version, such as `17.4`; in a browser, its user agent.
   */
  readonly "x-platform-version"?: string | undefined;
  /**
   * The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
   */
  readonly "x-preferred-locales"?: string | undefined;
  /**
   * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
   */
  readonly "x-sdk": SdkGetSdkSchemaParamsXSdk;
  /**
   * The version of the SDK making the request, such as `1.4.0`.
   */
  readonly "x-sdk-version": string;
  /**
   * The app store storefront (country) the end user buys from, when the SDK knows it.
   */
  readonly "x-storefront"?: string | undefined;
}

export interface SdkSchemaJsonEncoding {
  /**
   * The project's paywall locations, keyed by slug.
   */
  readonly locations: Record<string, unknown>;
  /**
   * The project's perks, keyed by slug.
   */
  readonly perks: Record<string, unknown>;
  /**
   * The project's products, keyed by slug.
   */
  readonly products: Record<string, unknown>;
  /**
   * The schema's version, `sha256:<hex>`, which changes whenever code generated from the schema would: its perks, products, store mappings, locations or native component contracts. Enabling a store or another paywall using a component leaves it as it is.
   */
  readonly version: string;
}

export type SdkGetSdkSchema401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiSchemaServiceErrorJsonEncodingTag = "Api/SchemaServiceError";

export interface ApiSchemaServiceErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiSchemaServiceErrorJsonEncodingTag;
  /**
   * Always `Internal server error`; the details are logged on our side. Retry with backoff.
   */
  readonly cause: string;
}

export type SdkGetSdkSchema500 =
  | ApiSchemaServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

/**
 * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
 */
export type SdkRegisterDeviceParamsXDistinctIdEncoding = "percent";

/**
 * `true` when the app sent the request from the background, otherwise `false`.
 */
export type SdkRegisterDeviceParamsXIsBackgrounded = "true" | "false";

/**
 * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
 */
export type SdkRegisterDeviceParamsXIsDebugBuild = "true" | "false";

/**
 * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
 */
export type SdkRegisterDeviceParamsXObserverMode = "true" | "false";

/**
 * `native` in an app, `browser` in a web page.
 */
export type SdkRegisterDeviceParamsXPlatformFlavor = "native" | "browser";

/**
 * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
 */
export type SdkRegisterDeviceParamsXSdk = "react-native" | "web" | "ios" | "android";

export interface SdkRegisterDeviceParams {
  /**
   * The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
   */
  readonly "x-distinct-id": string;
  /**
   * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
   */
  readonly "x-distinct-id-encoding"?: SdkRegisterDeviceParamsXDistinctIdEncoding | undefined;
  /**
   * The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
   */
  readonly "x-publishable-key": string;
  /**
   * The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
   */
  readonly "x-client-bundle-id": string;
  /**
   * The end user's most preferred locale, such as `en-US`.
   */
  readonly "x-client-locale"?: string | undefined;
  /**
   * The app's version, such as `2.4.1`.
   */
  readonly "x-client-version"?: string | undefined;
  /**
   * `true` when the app sent the request from the background, otherwise `false`.
   */
  readonly "x-is-backgrounded": SdkRegisterDeviceParamsXIsBackgrounded;
  /**
   * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
   */
  readonly "x-is-debug-build": SdkRegisterDeviceParamsXIsDebugBuild;
  /**
   * A random id, new for every request, such as a lowercase UUID.
   */
  readonly "x-nonce"?: string | undefined;
  /**
   * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
   */
  readonly "x-observer-mode": SdkRegisterDeviceParamsXObserverMode;
  /**
   * The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
   */
  readonly "x-platform": string;
  /**
   * The device's manufacturer, such as `Apple` or `Google`.
   */
  readonly "x-platform-brand"?: string | undefined;
  /**
   * The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
   */
  readonly "x-platform-device"?: string | undefined;
  /**
   * `native` in an app, `browser` in a web page.
   */
  readonly "x-platform-flavor": SdkRegisterDeviceParamsXPlatformFlavor;
  /**
   * The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
   */
  readonly "x-platform-flavor-version"?: string | undefined;
  /**
   * The operating system's version, such as `17.4`; in a browser, its user agent.
   */
  readonly "x-platform-version"?: string | undefined;
  /**
   * The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
   */
  readonly "x-preferred-locales"?: string | undefined;
  /**
   * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
   */
  readonly "x-sdk": SdkRegisterDeviceParamsXSdk;
  /**
   * The version of the SDK making the request, such as `1.4.0`.
   */
  readonly "x-sdk-version": string;
  /**
   * The app store storefront (country) the end user buys from, when the SDK knows it.
   */
  readonly "x-storefront"?: string | undefined;
}

/**
 * The device's platform.
 */
export type RegisterDeviceBodyJsonEncodingPlatform = "ios" | "android";

/**
 * The push service that delivers to the device: `fcm` (Firebase) or `apns` (Apple).
 */
export type RegisterDeviceBodyJsonEncodingProvider = "fcm" | "apns";

export type RegisterDeviceBodyJsonEncodingEnvironmentEnum = "sandbox" | "production";

export interface RegisterDeviceBodyJsonEncoding {
  /**
   * The device's platform.
   */
  readonly platform: RegisterDeviceBodyJsonEncodingPlatform;
  /**
   * The push service that delivers to the device: `fcm` (Firebase) or `apns` (Apple).
   */
  readonly provider: RegisterDeviceBodyJsonEncodingProvider;
  /**
   * The device's push credential: an FCM registration token, or the APNs device token as hex.
   */
  readonly platformToken: string;
  /**
   * The app's bundle id, which APNs delivers to; required with `apns`.
   */
  readonly bundleId?: string | null | undefined;
  /**
   * The APNs environment the token belongs to: `sandbox` for development builds, `production` otherwise. Required with `apns`, ignored by FCM.
   */
  readonly environment?: RegisterDeviceBodyJsonEncodingEnvironmentEnum | null | undefined;
  /**
   * The device-token id an earlier install of the app registered, which is removed now that it is replaced.
   */
  readonly previousPushDeviceTokenId?: string | null | undefined;
}

export interface RegisterDeviceResponseJsonEncoding {
  /**
   * The device's id, `push_tok_…`. Registering the same credential again returns the same id.
   */
  readonly pushDeviceTokenId: string;
}

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiPushDeviceValidationErrorJsonEncodingTag = "Api/PushDeviceValidationError";

export interface ApiPushDeviceValidationErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiPushDeviceValidationErrorJsonEncodingTag;
  /**
   * What went wrong, written for a developer reading logs. It can change, so do not parse it.
   */
  readonly message: string;
}

export type SdkRegisterDevice400 =
  | ApiPushDeviceValidationErrorJsonEncoding
  | ApiSdkValidationErrorJsonEncoding;

export type SdkRegisterDevice401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiActionForbiddenErrorJsonEncodingTag = "Api/ActionForbiddenError";

export interface ApiActionForbiddenErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiActionForbiddenErrorJsonEncodingTag;
  /**
   * What went wrong, written for a developer reading logs. It can change, so do not parse it.
   */
  readonly message: string;
}

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiPushDeviceNotFoundErrorJsonEncodingTag = "Api/PushDeviceNotFoundError";

export interface ApiPushDeviceNotFoundErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiPushDeviceNotFoundErrorJsonEncodingTag;
  /**
   * What went wrong, written for a developer reading logs. It can change, so do not parse it.
   */
  readonly message: string;
}

/**
 * The error's machine-readable code. Branch on it, never on the message.
 */
export type ApiPushDeviceServiceErrorJsonEncodingTag = "Api/PushDeviceServiceError";

export interface ApiPushDeviceServiceErrorJsonEncoding {
  /**
   * The error's machine-readable code. Branch on it, never on the message.
   */
  readonly _tag: ApiPushDeviceServiceErrorJsonEncodingTag;
  /**
   * A short reason; the details are logged on our side. Retry with backoff.
   */
  readonly cause: string;
}

export type SdkRegisterDevice500 =
  | ApiPushDeviceServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

/**
 * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
 */
export type SdkRefreshDeviceParamsXDistinctIdEncoding = "percent";

/**
 * `true` when the app sent the request from the background, otherwise `false`.
 */
export type SdkRefreshDeviceParamsXIsBackgrounded = "true" | "false";

/**
 * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
 */
export type SdkRefreshDeviceParamsXIsDebugBuild = "true" | "false";

/**
 * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
 */
export type SdkRefreshDeviceParamsXObserverMode = "true" | "false";

/**
 * `native` in an app, `browser` in a web page.
 */
export type SdkRefreshDeviceParamsXPlatformFlavor = "native" | "browser";

/**
 * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
 */
export type SdkRefreshDeviceParamsXSdk = "react-native" | "web" | "ios" | "android";

export interface SdkRefreshDeviceParams {
  /**
   * The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
   */
  readonly "x-distinct-id": string;
  /**
   * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
   */
  readonly "x-distinct-id-encoding"?: SdkRefreshDeviceParamsXDistinctIdEncoding | undefined;
  /**
   * The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
   */
  readonly "x-publishable-key": string;
  /**
   * The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
   */
  readonly "x-client-bundle-id": string;
  /**
   * The end user's most preferred locale, such as `en-US`.
   */
  readonly "x-client-locale"?: string | undefined;
  /**
   * The app's version, such as `2.4.1`.
   */
  readonly "x-client-version"?: string | undefined;
  /**
   * `true` when the app sent the request from the background, otherwise `false`.
   */
  readonly "x-is-backgrounded": SdkRefreshDeviceParamsXIsBackgrounded;
  /**
   * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
   */
  readonly "x-is-debug-build": SdkRefreshDeviceParamsXIsDebugBuild;
  /**
   * A random id, new for every request, such as a lowercase UUID.
   */
  readonly "x-nonce"?: string | undefined;
  /**
   * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
   */
  readonly "x-observer-mode": SdkRefreshDeviceParamsXObserverMode;
  /**
   * The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
   */
  readonly "x-platform": string;
  /**
   * The device's manufacturer, such as `Apple` or `Google`.
   */
  readonly "x-platform-brand"?: string | undefined;
  /**
   * The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
   */
  readonly "x-platform-device"?: string | undefined;
  /**
   * `native` in an app, `browser` in a web page.
   */
  readonly "x-platform-flavor": SdkRefreshDeviceParamsXPlatformFlavor;
  /**
   * The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
   */
  readonly "x-platform-flavor-version"?: string | undefined;
  /**
   * The operating system's version, such as `17.4`; in a browser, its user agent.
   */
  readonly "x-platform-version"?: string | undefined;
  /**
   * The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
   */
  readonly "x-preferred-locales"?: string | undefined;
  /**
   * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
   */
  readonly "x-sdk": SdkRefreshDeviceParamsXSdk;
  /**
   * The version of the SDK making the request, such as `1.4.0`.
   */
  readonly "x-sdk-version": string;
  /**
   * The app store storefront (country) the end user buys from, when the SDK knows it.
   */
  readonly "x-storefront"?: string | undefined;
}

export interface RefreshDeviceBodyJsonEncoding {
  /**
   * The device-token id registration returned; it must belong to the calling person.
   */
  readonly pushDeviceTokenId: string;
  /**
   * The device's new push credential, which replaces the registered one.
   */
  readonly platformToken: string;
}

export type SdkRefreshDevice400 =
  | ApiPushDeviceValidationErrorJsonEncoding
  | ApiSdkValidationErrorJsonEncoding;

export type SdkRefreshDevice401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkRefreshDevice500 =
  | ApiPushDeviceServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

/**
 * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
 */
export type SdkUnregisterDeviceParamsXDistinctIdEncoding = "percent";

/**
 * `true` when the app sent the request from the background, otherwise `false`.
 */
export type SdkUnregisterDeviceParamsXIsBackgrounded = "true" | "false";

/**
 * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
 */
export type SdkUnregisterDeviceParamsXIsDebugBuild = "true" | "false";

/**
 * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
 */
export type SdkUnregisterDeviceParamsXObserverMode = "true" | "false";

/**
 * `native` in an app, `browser` in a web page.
 */
export type SdkUnregisterDeviceParamsXPlatformFlavor = "native" | "browser";

/**
 * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
 */
export type SdkUnregisterDeviceParamsXSdk = "react-native" | "web" | "ios" | "android";

export interface SdkUnregisterDeviceParams {
  /**
   * The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
   */
  readonly "x-distinct-id": string;
  /**
   * `percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
   */
  readonly "x-distinct-id-encoding"?: SdkUnregisterDeviceParamsXDistinctIdEncoding | undefined;
  /**
   * The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
   */
  readonly "x-publishable-key": string;
  /**
   * The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
   */
  readonly "x-client-bundle-id": string;
  /**
   * The end user's most preferred locale, such as `en-US`.
   */
  readonly "x-client-locale"?: string | undefined;
  /**
   * The app's version, such as `2.4.1`.
   */
  readonly "x-client-version"?: string | undefined;
  /**
   * `true` when the app sent the request from the background, otherwise `false`.
   */
  readonly "x-is-backgrounded": SdkUnregisterDeviceParamsXIsBackgrounded;
  /**
   * `true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
   */
  readonly "x-is-debug-build": SdkUnregisterDeviceParamsXIsDebugBuild;
  /**
   * A random id, new for every request, such as a lowercase UUID.
   */
  readonly "x-nonce"?: string | undefined;
  /**
   * `true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
   */
  readonly "x-observer-mode": SdkUnregisterDeviceParamsXObserverMode;
  /**
   * The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
   */
  readonly "x-platform": string;
  /**
   * The device's manufacturer, such as `Apple` or `Google`.
   */
  readonly "x-platform-brand"?: string | undefined;
  /**
   * The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
   */
  readonly "x-platform-device"?: string | undefined;
  /**
   * `native` in an app, `browser` in a web page.
   */
  readonly "x-platform-flavor": SdkUnregisterDeviceParamsXPlatformFlavor;
  /**
   * The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
   */
  readonly "x-platform-flavor-version"?: string | undefined;
  /**
   * The operating system's version, such as `17.4`; in a browser, its user agent.
   */
  readonly "x-platform-version"?: string | undefined;
  /**
   * The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
   */
  readonly "x-preferred-locales"?: string | undefined;
  /**
   * The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
   */
  readonly "x-sdk": SdkUnregisterDeviceParamsXSdk;
  /**
   * The version of the SDK making the request, such as `1.4.0`.
   */
  readonly "x-sdk-version": string;
  /**
   * The app store storefront (country) the end user buys from, when the SDK knows it.
   */
  readonly "x-storefront"?: string | undefined;
}

export interface UnregisterDeviceBodyJsonEncoding {
  /**
   * The device-token id registration returned; it must belong to the calling person.
   */
  readonly pushDeviceTokenId: string;
}

export type SdkUnregisterDevice401 =
  | ApiAuthenticationErrorJsonEncoding
  | ApiNotAuthenticatedErrorJsonEncoding;

export type SdkUnregisterDevice500 =
  | ApiPushDeviceServiceErrorJsonEncoding
  | ApiAuthServiceErrorJsonEncoding;

export const make = (
  httpClient: HttpClient.HttpClient,
  options: {
    readonly transformClient?:
      | ((client: HttpClient.HttpClient) => Effect.Effect<HttpClient.HttpClient>)
      | undefined;
  } = {},
): VoidhashSdkClient => {
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
    ): Effect.Effect<never, VoidhashSdkClientError<Tag, E> | HttpClientError.HttpClientError> =>
      Effect.flatMap(response.json as Effect.Effect<E, HttpClientError.HttpClientError>, (cause) =>
        Effect.fail(VoidhashSdkClientError(tag, cause, response)),
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
    sdkGetPerson: (options) =>
      HttpClientRequest.get(`/api/v1/sdk/person`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options?.["x-distinct-id"] ?? undefined,
          "x-distinct-id-encoding": options?.["x-distinct-id-encoding"] ?? undefined,
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
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkGetPerson401",
          "404": "ApiSdkPersonNotFoundErrorJsonEncoding",
          "500": "SdkGetPerson500",
        }),
      ),
    sdkIdentifyPerson: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/identify`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-distinct-id-encoding": options.params?.["x-distinct-id-encoding"] ?? undefined,
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
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkIdentifyPerson401",
          "404": "ApiSdkPersonNotFoundErrorJsonEncoding",
          "409": "ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding",
          "500": "SdkIdentifyPerson500",
        }),
      ),
    sdkSyncPersonAttributes: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/person/traits`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-distinct-id-encoding": options.params?.["x-distinct-id-encoding"] ?? undefined,
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
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkSyncPersonAttributes401",
          "404": "ApiSdkPersonNotFoundErrorJsonEncoding",
          "500": "SdkSyncPersonAttributes500",
        }),
      ),
    sdkSyncTransaction: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/sync-transaction`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-distinct-id-encoding": options.params?.["x-distinct-id-encoding"] ?? undefined,
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
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkSyncTransaction401",
          "422": "ApiSdkTransactionRejectedErrorJsonEncoding",
          "429": "ApiSdkRateLimitedErrorJsonEncoding",
          "500": "SdkSyncTransaction500",
        }),
      ),
    sdkSignPromotionalOffer: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/promotional-offer-signature`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-distinct-id-encoding": options.params?.["x-distinct-id-encoding"] ?? undefined,
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
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkSignPromotionalOffer401",
          "422": "ApiSdkPromotionalOfferUnavailableErrorJsonEncoding",
          "500": "SdkSignPromotionalOffer500",
        }),
      ),
    sdkDevelopmentPurchase: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/development/purchase`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-distinct-id-encoding": options.params?.["x-distinct-id-encoding"] ?? undefined,
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
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkDevelopmentPurchase401",
          "500": "SdkDevelopmentPurchase500",
        }),
      ),
    sdkEvaluateFeatureFlags: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/evaluate-flags`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-distinct-id-encoding": options.params?.["x-distinct-id-encoding"] ?? undefined,
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
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkEvaluateFeatureFlags401",
          "500": "SdkEvaluateFeatureFlags500",
        }),
      ),
    sdkResolvePaywall: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/resolve-paywall`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-distinct-id-encoding": options.params?.["x-distinct-id-encoding"] ?? undefined,
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
          "x-ui-package-abi": options.params?.["x-ui-package-abi"] ?? undefined,
          "x-ui-guest-abi": options.params?.["x-ui-guest-abi"] ?? undefined,
          "x-ui-native-components": options.params?.["x-ui-native-components"] ?? undefined,
          "x-ui-runtime-bridge": options.params?.["x-ui-runtime-bridge"] ?? undefined,
        }),
        HttpClientRequest.bodyJsonUnsafe(options.payload),
        onRequest(["2xx"], {
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkResolvePaywall401",
          "500": "SdkResolvePaywall500",
        }),
      ),
    sdkGetSdkSchema: (options) =>
      HttpClientRequest.get(`/api/v1/sdk/schema`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options?.["x-distinct-id"] ?? undefined,
          "x-distinct-id-encoding": options?.["x-distinct-id-encoding"] ?? undefined,
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
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkGetSdkSchema401",
          "500": "SdkGetSdkSchema500",
        }),
      ),
    sdkRegisterDevice: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/push-devices/register`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-distinct-id-encoding": options.params?.["x-distinct-id-encoding"] ?? undefined,
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
          "400": "SdkRegisterDevice400",
          "401": "SdkRegisterDevice401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPushDeviceNotFoundErrorJsonEncoding",
          "500": "SdkRegisterDevice500",
        }),
      ),
    sdkRefreshDevice: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/push-devices/refresh`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-distinct-id-encoding": options.params?.["x-distinct-id-encoding"] ?? undefined,
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
        onRequest([], {
          "400": "SdkRefreshDevice400",
          "401": "SdkRefreshDevice401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPushDeviceNotFoundErrorJsonEncoding",
          "500": "SdkRefreshDevice500",
        }),
      ),
    sdkUnregisterDevice: (options) =>
      HttpClientRequest.post(`/api/v1/sdk/push-devices/unregister`).pipe(
        HttpClientRequest.setHeaders({
          "x-distinct-id": options.params?.["x-distinct-id"] ?? undefined,
          "x-distinct-id-encoding": options.params?.["x-distinct-id-encoding"] ?? undefined,
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
        onRequest([], {
          "400": "ApiSdkValidationErrorJsonEncoding",
          "401": "SdkUnregisterDevice401",
          "403": "ApiActionForbiddenErrorJsonEncoding",
          "404": "ApiPushDeviceNotFoundErrorJsonEncoding",
          "500": "SdkUnregisterDevice500",
        }),
      ),
  };
};

export interface VoidhashSdkClient {
  readonly httpClient: HttpClient.HttpClient;
  /**
   * Reads the person `x-distinct-id` names, with the perks they can use and their subscriptions and purchases. Fails with `Api/SdkPersonNotFoundError` when no person has the distinct id. The SDKs call the client API for you; prefer them.
   */
  readonly sdkGetPerson: (
    options: SdkGetPersonParams,
  ) => Effect.Effect<
    SdkPersonJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashSdkClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding>
    | VoidhashSdkClientError<"SdkGetPerson401", SdkGetPerson401>
    | VoidhashSdkClientError<
        "ApiSdkPersonNotFoundErrorJsonEncoding",
        ApiSdkPersonNotFoundErrorJsonEncoding
      >
    | VoidhashSdkClientError<"SdkGetPerson500", SdkGetPerson500>
  >;
  /**
   * Identifies the anonymous person `x-distinct-id` names as `distinctId`, your id for the user, merging the two, and returns the identified person. From an identified distinct id it merges nothing and returns the person `distinctId` names, or fails with `Api/SdkPersonNotFoundError` when there is none. Fails with `Api/SdkPersonAlreadyIdentifiedError` when `distinctId` belongs to another identified person.
   */
  readonly sdkIdentifyPerson: (options: {
    readonly params: SdkIdentifyPersonParams;
    readonly payload: SdkIdentifyBodyJsonEncoding;
  }) => Effect.Effect<
    SdkPersonJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashSdkClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding>
    | VoidhashSdkClientError<"SdkIdentifyPerson401", SdkIdentifyPerson401>
    | VoidhashSdkClientError<
        "ApiSdkPersonNotFoundErrorJsonEncoding",
        ApiSdkPersonNotFoundErrorJsonEncoding
      >
    | VoidhashSdkClientError<
        "ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding",
        ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding
      >
    | VoidhashSdkClientError<"SdkIdentifyPerson500", SdkIdentifyPerson500>
  >;
  /**
   * Writes the email, name and traits of the person `x-distinct-id` names, and returns the person. A retried write with the same `clientEventId` is applied once.
   */
  readonly sdkSyncPersonAttributes: (options: {
    readonly params: SdkSyncPersonAttributesParams;
    readonly payload: SdkSyncPersonAttributesBodyJsonEncoding;
  }) => Effect.Effect<
    SdkPersonJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashSdkClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding>
    | VoidhashSdkClientError<"SdkSyncPersonAttributes401", SdkSyncPersonAttributes401>
    | VoidhashSdkClientError<
        "ApiSdkPersonNotFoundErrorJsonEncoding",
        ApiSdkPersonNotFoundErrorJsonEncoding
      >
    | VoidhashSdkClientError<"SdkSyncPersonAttributes500", SdkSyncPersonAttributes500>
  >;
  /**
   * Reports a store transaction from the device. Voidhash verifies it with the store, records the purchase and grants its perks. One client address may send 300 a minute per project; past that the answer is 429 with a `Retry-After` header. Fails with `Api/SdkTransactionRejectedError` when the store can never accept the transaction as sent.
   */
  readonly sdkSyncTransaction: (options: {
    readonly params: SdkSyncTransactionParams;
    readonly payload: SdkSyncTransactionRequest;
  }) => Effect.Effect<
    SdkSyncTransactionResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashSdkClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding>
    | VoidhashSdkClientError<"SdkSyncTransaction401", SdkSyncTransaction401>
    | VoidhashSdkClientError<
        "ApiSdkTransactionRejectedErrorJsonEncoding",
        ApiSdkTransactionRejectedErrorJsonEncoding
      >
    | VoidhashSdkClientError<
        "ApiSdkRateLimitedErrorJsonEncoding",
        ApiSdkRateLimitedErrorJsonEncoding
      >
    | VoidhashSdkClientError<"SdkSyncTransaction500", SdkSyncTransaction500>
  >;
  /**
   * Signs an App Store promotional offer for the person, so the app can buy the product at the offer's price. Fails with `Api/SdkPromotionalOfferUnavailableError` when the App Store is not set up for the app or the product's mapping lists no such offer; do not sell the product at its regular price instead.
   */
  readonly sdkSignPromotionalOffer: (options: {
    readonly params: SdkSignPromotionalOfferParams;
    readonly payload: SdkPromotionalOfferSignatureBodyJsonEncoding;
  }) => Effect.Effect<
    SdkPromotionalOfferSignatureJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashSdkClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding>
    | VoidhashSdkClientError<"SdkSignPromotionalOffer401", SdkSignPromotionalOffer401>
    | VoidhashSdkClientError<
        "ApiSdkPromotionalOfferUnavailableErrorJsonEncoding",
        ApiSdkPromotionalOfferUnavailableErrorJsonEncoding
      >
    | VoidhashSdkClientError<"SdkSignPromotionalOffer500", SdkSignPromotionalOffer500>
  >;
  /**
   * Records a simulated purchase from a debug build in development mode, at the product's development price, as a test purchase. Use the test publishable key.
   */
  readonly sdkDevelopmentPurchase: (options: {
    readonly params: SdkDevelopmentPurchaseParams;
    readonly payload: SdkDevelopmentPurchaseBodyJsonEncoding;
  }) => Effect.Effect<
    SdkDevelopmentPurchaseResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashSdkClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding>
    | VoidhashSdkClientError<"SdkDevelopmentPurchase401", SdkDevelopmentPurchase401>
    | VoidhashSdkClientError<"SdkDevelopmentPurchase500", SdkDevelopmentPurchase500>
  >;
  /**
   * Evaluates feature flags for the person `x-distinct-id` names: whether each flag is on, its variant and its value (`payload`).
   */
  readonly sdkEvaluateFeatureFlags: (options: {
    readonly params: SdkEvaluateFeatureFlagsParams;
    readonly payload: EvaluateFeatureFlagsBodyJsonEncoding;
  }) => Effect.Effect<
    SdkFeatureFlagsResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashSdkClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding>
    | VoidhashSdkClientError<"SdkEvaluateFeatureFlags401", SdkEvaluateFeatureFlags401>
    | VoidhashSdkClientError<"SdkEvaluateFeatureFlags500", SdkEvaluateFeatureFlags500>
  >;
  /**
   * Resolves what a paywall location shows the person: the paywall and its deployed build (`paywallRelease`), with where to download it. Answers null when the location does not exist, shows nothing, or shows a build this version of the SDK cannot display.
   */
  readonly sdkResolvePaywall: (options: {
    readonly params: SdkResolvePaywallParams;
    readonly payload: SdkResolvePaywallBodyJsonEncoding;
  }) => Effect.Effect<
    SdkResolvePaywall200,
    | HttpClientError.HttpClientError
    | VoidhashSdkClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding>
    | VoidhashSdkClientError<"SdkResolvePaywall401", SdkResolvePaywall401>
    | VoidhashSdkClientError<"SdkResolvePaywall500", SdkResolvePaywall500>
  >;
  /**
   * Reads the project's products, perks and paywall locations, keyed by slug, in the shape the SDKs use, with the schema's version. The `ETag` is a `sha256:<hex>` hash of the response, which changes with anything in it, including the products' ids, which the version leaves out. Answers `304` without a body when `If-None-Match` names the current `ETag`. `schema.get` serves the same schema to the management API.
   */
  readonly sdkGetSdkSchema: (
    options: SdkGetSdkSchemaParams,
  ) => Effect.Effect<
    SdkSchemaJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashSdkClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding>
    | VoidhashSdkClientError<"SdkGetSdkSchema401", SdkGetSdkSchema401>
    | VoidhashSdkClientError<"SdkGetSdkSchema500", SdkGetSdkSchema500>
  >;
  /**
   * Registers the device's push credential for the person `x-distinct-id` names, creating an anonymous person when there is none, and returns the device's id. Fails with `Api/ActionForbiddenError` when push notifications are not turned on for the team.
   */
  readonly sdkRegisterDevice: (options: {
    readonly params: SdkRegisterDeviceParams;
    readonly payload: RegisterDeviceBodyJsonEncoding;
  }) => Effect.Effect<
    RegisterDeviceResponseJsonEncoding,
    | HttpClientError.HttpClientError
    | VoidhashSdkClientError<"SdkRegisterDevice400", SdkRegisterDevice400>
    | VoidhashSdkClientError<"SdkRegisterDevice401", SdkRegisterDevice401>
    | VoidhashSdkClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashSdkClientError<
        "ApiPushDeviceNotFoundErrorJsonEncoding",
        ApiPushDeviceNotFoundErrorJsonEncoding
      >
    | VoidhashSdkClientError<"SdkRegisterDevice500", SdkRegisterDevice500>
  >;
  /**
   * Replaces the push credential of a device the person registered, keeping its id. Fails with `Api/PushDeviceNotFoundError` when the id is unknown or another person's.
   */
  readonly sdkRefreshDevice: (options: {
    readonly params: SdkRefreshDeviceParams;
    readonly payload: RefreshDeviceBodyJsonEncoding;
  }) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashSdkClientError<"SdkRefreshDevice400", SdkRefreshDevice400>
    | VoidhashSdkClientError<"SdkRefreshDevice401", SdkRefreshDevice401>
    | VoidhashSdkClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashSdkClientError<
        "ApiPushDeviceNotFoundErrorJsonEncoding",
        ApiPushDeviceNotFoundErrorJsonEncoding
      >
    | VoidhashSdkClientError<"SdkRefreshDevice500", SdkRefreshDevice500>
  >;
  /**
   * Stops push notifications to a device the person registered. Fails with `Api/PushDeviceNotFoundError` when the id is unknown or another person's.
   */
  readonly sdkUnregisterDevice: (options: {
    readonly params: SdkUnregisterDeviceParams;
    readonly payload: UnregisterDeviceBodyJsonEncoding;
  }) => Effect.Effect<
    void,
    | HttpClientError.HttpClientError
    | VoidhashSdkClientError<"ApiSdkValidationErrorJsonEncoding", ApiSdkValidationErrorJsonEncoding>
    | VoidhashSdkClientError<"SdkUnregisterDevice401", SdkUnregisterDevice401>
    | VoidhashSdkClientError<
        "ApiActionForbiddenErrorJsonEncoding",
        ApiActionForbiddenErrorJsonEncoding
      >
    | VoidhashSdkClientError<
        "ApiPushDeviceNotFoundErrorJsonEncoding",
        ApiPushDeviceNotFoundErrorJsonEncoding
      >
    | VoidhashSdkClientError<"SdkUnregisterDevice500", SdkUnregisterDevice500>
  >;
}

export interface VoidhashSdkClientError<Tag extends string, E> extends Error {
  readonly _tag: Tag;
  readonly request: HttpClientRequest.HttpClientRequest;
  readonly response: HttpClientResponse.HttpClientResponse;
  readonly data: E;
  readonly message: string;
}

class VoidhashSdkClientErrorImpl extends Data.Error<{
  _tag: string;
  data: any;
  message: string;
  request: HttpClientRequest.HttpClientRequest;
  response: HttpClientResponse.HttpClientResponse;
}> {
  name = "VoidhashSdkClientError";
}

export const VoidhashSdkClientError = <Tag extends string, E>(
  tag: Tag,
  data: E,
  response: HttpClientResponse.HttpClientResponse,
): VoidhashSdkClientError<Tag, E> =>
  new VoidhashSdkClientErrorImpl({
    _tag: tag,
    data,
    message: JSON.stringify(data),
    response,
    request: response.request,
  }) as any;
