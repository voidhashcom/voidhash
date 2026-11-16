import type { HybridObject } from "react-native-nitro-modules";

/*
 * The contract between the React Native facade and the native Voidhash client
 * (the Swift `VoidhashClient` and the Kotlin `com.voidhash.sdk.VoidhashClient`)
 * it is moving onto. The facade keeps its public surface: option validation,
 * the `Result` and `VoidhashError` shapes, the provider and the hooks stay in
 * TypeScript; identity, purchases, analytics, flags, the schema and paywalls
 * are the native client's.
 *
 * Shapes the SDK defines are Nitro structs. Payloads the Voidhash API defines
 * (a person snapshot, a paywall, a schema, a flag payload, event properties)
 * cross as JSON strings, so a server that adds a field needs no new binary.
 *
 * Errors: every promise rejects with an error whose message is
 * `"<CODE>: <detail>"`; the detail may be empty. On Android the message
 * reaches JavaScript as the throwable's printed stack trace and on both
 * platforms a synchronous throw gets the method's name in front; the facade
 * reads the code through all of that. Use a facade `VoidhashErrorCode` where
 * one fits (`AUTHENTICATION_FAILED`, `INVALID_ARGUMENT`, `OFFER_UNAVAILABLE`,
 * `PAYWALL_UNAVAILABLE`, `PURCHASE_IN_PROGRESS`,
 * `READ_ONLY_PURCHASE_NOT_ALLOWED`, `REPLACED_SUBSCRIPTION_NOT_OWNED`,
 * `SUBSCRIPTION_REPLACEMENT_REFUSED`, `UNSUPPORTED_PLATFORM`, a `FLOW_*`
 * code), `NOT_INITIALIZED` before `start()`, after `shutdown()` and from a
 * native client the native SDK made inert (nothing was done), and
 * `NOT_IMPLEMENTED` for a member a build does not support yet. A purchase the
 * store refused for a reason it named rejects with that reason's code:
 * `PAYMENT_DECLINED` (Android only: Play
 * `PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS`; StoreKit 2 has no declined
 * payment error) or `INELIGIBLE_FOR_OFFER` (Play `USER_INELIGIBLE`, StoreKit
 * `Product.PurchaseError.ineligibleForOffer`); the facade reports both as
 * `FAILED_TO_PURCHASE` with `reason` set. Each facade method keeps the codes it reports today: a code it
 * does not report reaches the app under that method's `FAILED_TO_*` code, its
 * native message kept.
 *
 * Store-specific members (`appStore*`, `googlePlay*`) exist on both
 * platforms, as Nitro requires; on the other platform they reject
 * `UNSUPPORTED_PLATFORM` without doing anything. The facade checks the
 * platform first, so that path is a safety net.
 *
 * Products and transactions: the fields every store has are the structs
 * below, filled from the native SDK's `VoidhashProduct` and
 * `VoidhashTransaction` field for field. Their `appStore` and `googlePlay`
 * parts cross as JSON (`appStoreJson`, `googlePlayJson`), shaped exactly as
 * the facade's `AppStoreProductInfo`, `GooglePlayProductInfo`,
 * `AppStoreTransactionInfo` and `GooglePlayTransactionInfo` types in
 * `src/core/entities/app-store.ts` and `google-play.ts` declare them, with the
 * stores' own field names: dates as milliseconds since the epoch, a `Price`
 * as `{ amount, amountMicros, currencyCode, formatted }`, a `Period` as
 * `{ unit, count, iso8601 }`, an absent value left out or `null`. Every enum
 * here has an `unknown` case: send it for a native case this contract does
 * not list.
 *
 * Rejected publishable key: while API requests are paused because the key
 * was rejected (`401`/`403`), the first `getPersonState`, `getFeatureFlags`
 * or `getPaywall` call that has nothing cached to answer with rejects
 * `AUTHENTICATION_FAILED`. That happens once per pause, shared across the
 * three reads; a request the pause lets through that succeeds, or a new
 * `start()`, ends the pause. Every later read answers as it would offline:
 * from its cache, with an empty answer marked stale, or for a paywall with
 * nothing cached `PAYWALL_UNAVAILABLE`. A read that can answer from its cache
 * never rejects with it. The rejection is reported through the `diagnostic`
 * event either way.
 *
 * Threading and ordering: methods may be called from the JS thread at any
 * time; promises and the event listener settle on the JS thread, in the order
 * the native client produced them. A call that emits events returns a pending
 * promise and settles it only after those events were dispatched to the
 * listener: a promise already settled when it is returned resolves in the
 * JavaScript microtask queue, ahead of any event the call emitted.
 *
 * Identity generations: every identity a client adopts gets the next
 * number of one counter that only grows for the life of the process, across
 * every instance and every `start()`/`shutdown()` (a re-init, another
 * project). Person and flag answers carry the generation they were read
 * under; the facade publishes only the current generation's, so a late answer
 * from an identity switched away from (or from a previous run) is never
 * published, even after a switch back to the same distinct id.
 */

/** The end user's analytics consent, as `setAnalyticsConsent()` takes it. */
export type NativeAnalyticsConsent = "granted" | "denied" | "pending";

/** What happens to events captured while analytics consent is `pending`. */
export type NativePendingAnalytics = "drop" | "buffer";

/**
 * Why a person answer has the freshness it has: confirmed by the server just
 * now, served from cache while a refresh still runs, served from cache
 * because the refresh failed, or nothing was ever cached for this identity.
 */
export type NativeFreshnessReason = "fresh" | "refreshInFlight" | "refreshFailed" | "noCache";

/**
 * How a person write ended: the server confirmed it, it waits in the
 * person-write outbox, or nothing was left to write (`skipped`). Person
 * attributes are written whatever the analytics consent, so `skipped` means
 * one thing only: the write held nothing but an agreement to ad data sharing
 * (`$ad_data_sharing` other than `false`), which is left out while consent is
 * not granted.
 */
export type NativeWriteStatus = "confirmed" | "deferred" | "skipped";

/**
 * What Google Play charges when a purchase replaces a subscription; the
 * native SDK's replacement mode and the facade's
 * `SubscriptionReplacementMode`, value for value.
 */
export type NativeSubscriptionReplacementMode =
  | "withTimeProration"
  | "chargeProratedPrice"
  | "chargeFullPrice"
  | "withoutProration"
  | "deferred";

/** The subscription a purchase replaces instead of adding a second one next to it. */
export interface NativeSubscriptionReplacement {
  /** Slug of the subscription product the end user has now. */
  readonly productSlug: string;
  readonly mode: NativeSubscriptionReplacementMode;
}

/** The store a reported transaction comes from. */
export type NativeStorePlatform = "appStore" | "googlePlay";

/** The state another billing integration reported a Google Play purchase in. */
export type NativeReportedPurchaseState = "purchased" | "pending" | "unspecified";

/** What a flow may do beyond purchases, restores, closing and analytics. */
export type NativeFlowCapability = "links" | "notifications" | "tracking" | "attributes";

/** Which payload a {@link NativeClientEvent} carries. */
export type NativeClientEventType =
  | "person"
  | "identity"
  | "flags"
  | "schema"
  | "consent"
  | "diagnostic"
  | "transaction"
  | "purchaseIntent";

/**
 * When StoreKit shows its messages (price increase consent, billing issues,
 * win-back offers): at once (`automatic`), or held while a Voidhash flow is
 * on screen and shown once it closes (`deferWhileFlowPresented`). Google Play
 * ignores it.
 */
export type NativeAppStoreMessages = "automatic" | "deferWhileFlowPresented";

/**
 * What happens to a purchase the end user started on the App Store (a
 * promoted in-app purchase, a win-back offer): bought through the normal
 * purchase path once `start()` has resolved its identity
 * (`purchaseWhenReady`), never before; or handed to the app as a
 * `purchaseIntent` event (`manual`). Google Play ignores it.
 */
export type NativePurchaseIntents = "purchaseWhenReady" | "manual";

/** Coarse category of a diagnostic, the facade's `VoidhashDiagnosticKind`. */
export type NativeDiagnosticKind =
  | "transport"
  | "eviction"
  | "breaker"
  | "auth"
  | "cache"
  | "configuration"
  | "consent";

/**
 * The facade's options after validation, as `configure()` receives them.
 * Native automatic screen tracking stays off under React Native: the facade's
 * navigation integrations report screens through `screen()`.
 */
export interface NativeClientConfiguration {
  readonly publishableKey: string;
  /** Absolute `http(s)` origin of the API, already validated. */
  readonly baseUrl: string;
  /** Origin of analytics ingest; `baseUrl` when absent. */
  readonly ingestUrl?: string;
  readonly debug: boolean;
  /** Development purchases: `dev: true` in a debug build. Always `false` in release builds. */
  readonly developmentMode: boolean;
  /** Adopted on the first `start()` of the process; later starts resume the stored identity. */
  readonly distinctId?: string;
  /** Observer mode at start; `setReadOnly()` changes it later. */
  readonly readOnly: boolean;
  /**
   * The `analyticsConsent` option: applies when no consent was chosen, in this
   * process or by an earlier `setAnalyticsConsent()` stored on the device.
   */
  readonly analyticsConsent: NativeAnalyticsConsent;
  /**
   * A consent the app chose with `setAnalyticsConsent()` in this process
   * before the client started. It wins over the stored one, is stored in its
   * place, and is in effect before `start()` captures or sends anything.
   */
  readonly chosenAnalyticsConsent?: NativeAnalyticsConsent;
  /**
   * The `analyticsWhilePending` option: `buffer` holds events captured while
   * consent is `pending` in memory and records them when it is granted.
   */
  readonly analyticsWhilePending: NativePendingAnalytics;
  /** The `grantConsentOnIdentify` option: `identify()` grants a `pending` consent. */
  readonly grantConsentOnIdentify: boolean;
  readonly automaticLifecycleEvents: boolean;
  /** Reads which ad brought this install, once per install; see the facade's option. */
  readonly installAttribution: boolean;
  /** The Meta app id to ask Meta's apps about on Android; iOS ignores it. */
  readonly metaAppId?: string;
  /** Placements whose flows are downloaded at start. */
  readonly preloadPlacements: string[];
  readonly flowCapabilities: NativeFlowCapability[];
  /** `false` turns every `screen()` into a no-op. */
  readonly screenTrackingEnabled: boolean;
  /**
   * The `featureFlags.maxWaitMs` option: how long a flag read with nothing
   * cached waits for Voidhash, in milliseconds, a non-negative integer. The
   * native client's own default (2000) when absent. A binary built before
   * this field ignores it and waits its default.
   */
  readonly featureFlagMaxWaitMs?: number;
  /**
   * The `featureFlags.defaults` option: what each flag reads as while it has
   * no evaluated value. A binary built before this field ignores it; the
   * facade's hooks apply the defaults either way.
   */
  readonly featureFlagDefaults?: Record<string, boolean>;
  /** A runtime schema to use instead of fetching one (tests and previews only). */
  readonly internalSchemaJson?: string;
  /** The `appStoreMessages` option; see {@link NativeAppStoreMessages}. */
  readonly appStoreMessages: NativeAppStoreMessages;
  /** The `purchaseIntents` option; see {@link NativePurchaseIntents}. */
  readonly purchaseIntents: NativePurchaseIntents;
  /** The facade's package version, sent with every request. */
  readonly sdkVersion: string;
}

/** The identity the client adopted, and the generation it adopted it under. */
export interface NativeIdentityChange {
  readonly distinctId: string;
  /** The identity before the change; empty for the identity `start()` loaded. */
  readonly previousDistinctId: string;
  /** The adoption's identity generation; greater than every earlier one. */
  readonly generation: number;
}

/** A person snapshot with how far it can be trusted. */
export interface NativePersonState {
  /** The identity the snapshot belongs to. */
  readonly distinctId: string;
  /** The identity generation the snapshot was read under. */
  readonly generation: number;
  /** The server's person snapshot as JSON; absent when there is none. */
  readonly personJson?: string;
  /** Served from cache past its refresh window. */
  readonly isStale: boolean;
  /** Served from cache past its expiry. */
  readonly isExpired: boolean;
  readonly reason: NativeFreshnessReason;
}

/** Outcome of `identify()`. */
export interface NativeIdentifyResult {
  /** The identity in effect once the call settled: the one `identify()` switched to. */
  readonly identity: NativeIdentityChange;
  /** `confirmed` once the server linked the identities, `deferred` while the link is queued. */
  readonly status: NativeWriteStatus;
  /** The confirmed person, or the last known snapshot for a deferred switch, as JSON. */
  readonly personJson?: string;
}

/** Outcome of `setPersonAttributesState()`. */
export interface NativePersonWriteResult {
  readonly status: NativeWriteStatus;
  /** The confirmed person, or the last known snapshot for a deferred write, as JSON. */
  readonly personJson?: string;
}

/** One evaluated flag. */
export interface NativeFeatureFlag {
  readonly key: string;
  readonly enabled: boolean;
  /** The selected variant's key; absent for a flag without variants. */
  readonly variantKey?: string;
  /** The selected variant's payload as JSON; absent when it has none. */
  readonly payloadJson?: string;
}

/** A flag evaluation for one request: every flag, or the keys asked for. */
export interface NativeFeatureFlagsResult {
  /** The identity the evaluation belongs to. */
  readonly distinctId: string;
  /** The identity generation the evaluation was read under. */
  readonly generation: number;
  /**
   * The keys this evaluation answers; absent for every flag. A `flags` event
   * is stored under these; a read's answer is stored under the keys the
   * caller asked for, whatever comes back here.
   */
  readonly flagKeys?: string[];
  readonly flags: NativeFeatureFlag[];
  /** Served from cache past its refresh window, or no evaluation has ever succeeded. */
  readonly isStale: boolean;
}

/** The store a product or transaction belongs to; `development` for development-mode purchases. */
export type NativeStore = "appStore" | "googlePlay" | "development" | "unknown";

/** The native SDK's product type. */
export type NativeProductType =
  | "subscription"
  | "consumable"
  | "nonConsumable"
  | "nonRenewingSubscription"
  | "unknown";

/** The unit of a {@link NativePeriod}. */
export type NativePeriodUnit = "day" | "week" | "month" | "year" | "unknown";

/** How a pricing phase is paid. */
export type NativePaymentMode = "freeTrial" | "payAsYouGo" | "payUpFront" | "unknown";

/** The native SDK's offer kind. */
export type NativeOfferKind = "introductory" | "promotional" | "winBack" | "oneTime" | "unknown";

/** The native SDK's `Price`. */
export interface NativePrice {
  /** The amount in the currency's units (the native `Decimal`/`BigDecimal` as a double). */
  readonly amount: number;
  /** The exact amount × 1,000,000. */
  readonly amountMicros: number;
  /** ISO 4217. */
  readonly currencyCode: string;
  /** The store's localized string, never re-formatted. */
  readonly formatted: string;
}

/** The native SDK's `Period`, already normalised (7 days are 1 week). */
export interface NativePeriod {
  readonly unit: NativePeriodUnit;
  /** At least 1. */
  readonly count: number;
  /** Generated from the normalised value: `P1W`, `P3M`, `P1Y`. */
  readonly iso8601: string;
}

/** The native SDK's `PricingPhase`. */
export interface NativePricingPhase {
  readonly paymentMode: NativePaymentMode;
  /** Per cycle; zero for a free trial. */
  readonly price: NativePrice;
  /** The length of one cycle. */
  readonly period: NativePeriod;
  /** How many cycles the phase lasts, at least 1. */
  readonly cycles: number;
}

/** The native SDK's `Offer`. */
export interface NativeOffer {
  /**
   * Google Play: the Studio offer id when the offer is configured in Studio,
   * else Play's offer id. App Store: a promotional offer's Studio id (only
   * Studio-configured ones are listed), a win-back offer's App Store id, `""`
   * for the introductory offer.
   */
  readonly id: string;
  readonly kind: NativeOfferKind;
  /** Subscription offers: the phases before the regular price, in order. Empty for `oneTime`. */
  readonly phases: NativePricingPhase[];
  /** `oneTime` offers: what the product costs with it. Absent for subscription offers. */
  readonly price?: NativePrice;
}

/**
 * The native SDK's `SubscriptionInfo`. The four `pricePer*` prices are the
 * native SDK's, computed natively (rounded half-up to the currency's minor
 * units, formatted with the store's locale); never computed in JavaScript.
 */
export interface NativeSubscriptionInfo {
  readonly period: NativePeriod;
  /** The App Store subscription group id; on Google Play, the subscription's product id. */
  readonly groupId: string;
  /** The intro offer this end user is eligible for right now; absent otherwise. */
  readonly introOffer?: NativeOffer;
  readonly pricePerDay: NativePrice;
  readonly pricePerWeek: NativePrice;
  readonly pricePerMonth: NativePrice;
  readonly pricePerYear: NativePrice;
}

/** The native SDK's `VoidhashProduct`, one per Studio product slug. */
export interface NativeProduct {
  /** The Voidhash product id (the schema product's `id`). */
  readonly productId: string;
  readonly slug: string;
  readonly store: NativeStore;
  /** The App Store or Google Play product id. */
  readonly storeProductId: string;
  readonly type: NativeProductType;
  /** The Studio name. */
  readonly name: string;
  /** The store's localized title. */
  readonly displayName: string;
  /** The store's localized description. */
  readonly description: string;
  /** The regular price (Google Play: the recurring phase of the pinned base plan). */
  readonly price: NativePrice;
  /** Present exactly when `type` is `subscription`. */
  readonly subscription?: NativeSubscriptionInfo;
  /** The purchasable non-introductory offers for this end user. */
  readonly offers: NativeOffer[];
  /** The product's `appStore` part as JSON (`AppStoreProductInfo`); present exactly when `store` is `appStore`. */
  readonly appStoreJson?: string;
  /** The product's `googlePlay` part as JSON (`GooglePlayProductInfo`); present exactly when `store` is `googlePlay`. */
  readonly googlePlayJson?: string;
}

/** The kind of offer a transaction was bought with; `code` for a redeemed offer code. */
export type NativeTransactionOfferKind =
  | "introductory"
  | "promotional"
  | "winBack"
  | "oneTime"
  | "code"
  | "unknown";

/** Where a transaction was made. */
export type NativeEnvironment = "production" | "sandbox" | "xcode" | "development" | "unknown";

/** The offer of a transaction; every field absent when the store does not say. */
export interface NativeTransactionOffer {
  readonly id?: string;
  readonly kind?: NativeTransactionOfferKind;
  readonly paymentMode?: NativePaymentMode;
}

/** The native SDK's `VoidhashTransaction`. */
export interface NativeTransaction {
  /** Apple `transactionId` / Play `purchaseToken`: stable from pending to purchased. */
  readonly id: string;
  /** Apple `originalID`; absent on Google Play. */
  readonly originalId?: string;
  /** Resolved through the schema; absent when no product has the store product. */
  readonly productSlug?: string;
  readonly storeProductId: string;
  readonly store: NativeStore;
  /** Milliseconds since the epoch. */
  readonly purchasedAt: number;
  /** Milliseconds since the epoch. */
  readonly expiresAt?: number;
  /** What the store charged for (`Purchase.getQuantity()` on Google Play). */
  readonly quantity: number;
  /** Apple `reason == .renewal` (iOS 17 and later); absent where unknown (Google Play). */
  readonly isRenewal?: boolean;
  readonly offer?: NativeTransactionOffer;
  readonly environment: NativeEnvironment;
  /** The `appStore` part as JSON (`AppStoreTransactionInfo`); present exactly when `store` is `appStore`. */
  readonly appStoreJson?: string;
  /** The `googlePlay` part as JSON (`GooglePlayTransactionInfo`); present exactly when `store` is `googlePlay`. */
  readonly googlePlayJson?: string;
}

/**
 * Which offer `purchase()` buys:
 *
 * - `automatic`: a subscription's `introOffer` when it has one, else the
 *   regular price. On Google Play this passes the intro offer's token.
 * - `regularPrice`: the regular price (Play: the base plan's token; the App
 *   Store may still apply an intro offer the user is eligible for).
 * - `offer`: the offer `offerId` names, resolved against the product's
 *   current `offers` and `subscription.introOffer` (of kind `offerKind` when
 *   given). `offerKind: introductory` always means the product's current
 *   `subscription.introOffer`, whatever `offerId` says (the App Store's has
 *   no id of its own, so the app may pass an empty one). None matching
 *   rejects `OFFER_UNAVAILABLE`, never buying at the regular price instead.
 */
export type NativeOfferSelection = "automatic" | "regularPrice" | "offer";

/** App Store options of a purchase; Google Play ignores them. */
export interface NativeAppStorePurchaseOptions {
  /** StoreKit's `simulatesAskToBuyInSandbox` purchase option. */
  readonly simulatesAskToBuyInSandbox?: boolean;
}

/** Google Play options of a purchase; the App Store ignores them. */
export interface NativeGooglePlayPurchaseOptions {
  /** `BillingFlowParams.setIsOfferPersonalized`. */
  readonly isOfferPersonalized?: boolean;
  /** `BillingFlowParams.setObfuscatedProfileId`. */
  readonly obfuscatedProfileId?: string;
  /** Buys exactly this offer token, whatever `offerSelection` says. */
  readonly offerToken?: string;
}

/** What `purchase()` buys beyond the product. */
export interface NativePurchaseOptions {
  readonly offerSelection: NativeOfferSelection;
  /** With `offer`: the offer's id. */
  readonly offerId?: string;
  /** With `offer`: the offer's kind, when the app passed an offer rather than an id. */
  readonly offerKind?: NativeOfferKind;
  /**
   * At least 1. Anything but 1 is honoured for App Store consumables only;
   * elsewhere it rejects `INVALID_ARGUMENT` (the facade checks it first).
   */
  readonly quantity: number;
  readonly replacing?: NativeSubscriptionReplacement;
  readonly appStore?: NativeAppStorePurchaseOptions;
  readonly googlePlay?: NativeGooglePlayPurchaseOptions;
}

/**
 * How a purchase ended: the store charged (`purchased`), it needs outside
 * action such as Ask to Buy or a pending payment first (`pending`), or the
 * end user dismissed the sheet (`cancelled`).
 */
export type NativePurchaseOutcome = "purchased" | "pending" | "cancelled";

/** The native SDK's purchase result. */
export interface NativePurchaseResult {
  readonly outcome: NativePurchaseOutcome;
  /** With `purchased`: the transaction. With a Play `deferred` replacement it names the old product. */
  readonly transaction?: NativeTransaction;
  /** With `purchased`: `true` once Voidhash accepted the receipt, `false` while it waits on the device. */
  readonly synced?: boolean;
}

/** A transaction the native SDK handled outside `purchase()`; its transaction update stream. */
export interface NativeTransactionUpdate {
  readonly transaction: NativeTransaction;
  /** `true` once Voidhash accepted the receipt, `false` while it waits on the device. */
  readonly synced: boolean;
}

/** A purchase the end user started on the App Store, as `purchaseIntents: manual` hands it over. */
export interface NativePurchaseIntent {
  readonly productSlug: string;
  /** The offer the end user chose (a win-back offer, iOS 18 and later). */
  readonly offer?: NativeOffer;
}

/** The storefront the end user buys from. */
export interface NativeStorefront {
  /** ISO 3166-1 alpha-2 (StoreKit's alpha-3 converted). */
  readonly countryCode: string;
  /** ISO 4217, when the store says. */
  readonly currencyCode?: string;
}

/** How a refund request ended. */
export type NativeRefundRequestStatus = "success" | "userCancelled";

/** StoreKit's `RenewalState`. */
export type NativeAppStoreSubscriptionState =
  | "subscribed"
  | "expired"
  | "inBillingRetryPeriod"
  | "inGracePeriod"
  | "revoked"
  | "unknown";

/** One StoreKit `Product.SubscriptionInfo.Status`. */
export interface NativeAppStoreSubscriptionStatus {
  readonly state: NativeAppStoreSubscriptionState;
  /** The status's verified transaction. */
  readonly transaction: NativeTransaction;
  /**
   * The verified `RenewalInfo` as JSON, shaped as the facade's
   * `AppStoreRenewalInfo`: `{ willAutoRenew, autoRenewProductId?,
   * expirationReason?, gracePeriodExpiresAt?, isInBillingRetry,
   * priceIncreaseStatus?, renewalPrice?, eligibleWinBackOfferIds }`.
   */
  readonly renewalInfoJson: string;
}

/** Which Google Play in-app message outcome `googlePlayShowInAppMessages()` had. */
export type NativeInAppMessageStatus = "noActionNeeded" | "subscriptionStatusUpdated";

/** The outcome of Play's `showInAppMessages` (TRANSACTIONAL category). */
export interface NativeInAppMessageResult {
  readonly status: NativeInAppMessageStatus;
  /** With `subscriptionStatusUpdated`: the purchase token whose status changed. */
  readonly purchaseToken?: string;
}

/** A purchase another billing integration completed, by its store identifier only. */
export interface NativeReportedTransaction {
  readonly platform: NativeStorePlatform;
  /** App Store transaction id; required for `appStore`. */
  readonly transactionId?: string;
  /** Google Play purchase token; required for `googlePlay`. */
  readonly purchaseToken?: string;
  /**
   * Google Play: the state the integration reported. A `pending` or
   * `unspecified` purchase is ignored, as the facade does today; report it
   * again once it is purchased. Absent counts as purchased.
   */
  readonly purchaseState?: NativeReportedPurchaseState;
}

/** Outcome of a flush or a shutdown. */
export interface NativeFlushStatus {
  /** Events the server accepted. */
  readonly flushed: number;
  /** Events still queued. */
  readonly pending: number;
  /** Why delivery stopped, when it did. */
  readonly lastErrorMessage?: string;
}

/** A non-fatal event the native client handled on its own; the facade's `VoidhashDiagnostic`. */
export interface NativeDiagnostic {
  readonly kind: NativeDiagnosticKind;
  /** Stable code, for example `ANALYTICS_EVENT_DROPPED`. */
  readonly code: string;
  readonly operation: string;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly message?: string;
}

/**
 * One state change, delivered to the listener. `type` names the one payload
 * field that is set:
 *
 * - `identity` → `identity`: the identity `start()` loaded, and every later
 *   switch (`identify`, `reset`, `signOut`, and the switch back when the
 *   server refused an `identify`), each under a new generation. A switch's
 *   event is dispatched before the promise of the call that caused it
 *   settles, and before any `person` or `flags` event or read answer of the
 *   new generation.
 * - `person` → `person`: the current person or its freshness changed (a
 *   refresh, a purchase, a restore, a delivered identity link or attribute
 *   write).
 * - `flags` → `flags`: an evaluation was refreshed, keyed by its `flagKeys`.
 * - `schema` → `schemaJson`: a runtime schema was loaded or fetched.
 * - `consent` → `consent`: the analytics consent in effect changed, including
 *   the one `start()` settled on.
 * - `diagnostic` → `diagnostic`. Includes `PRODUCT_NOT_FOUND` and
 *   `PRODUCT_TYPE_MISMATCH` (kind `configuration`, operation `getProducts`
 *   on both platforms), once per slug per products load, its message naming
 *   the slug and the store's reason or both types. A product Studio does not
 *   sell in this store is not reported by a load of every product.
 * - `transaction` → `transaction`: every element of the native transaction
 *   update stream (purchases completed outside `purchase()`: Ask to Buy
 *   approvals, pending payments, offer codes, promoted purchases, and on the
 *   App Store renewals seen on the device; Google Play reports no renewals),
 *   after the native SDK handled it. Never one that `purchase()` itself
 *   answers with.
 * - `purchaseIntent` → `purchaseIntent`: with `purchaseIntents: manual`, each
 *   App Store purchase intent for a product the schema has; an intent for
 *   another product is dropped and reported as `PRODUCT_NOT_FOUND`. Sent
 *   from `start()` on, maybe before the app added a listener to the facade,
 *   which holds them until it does.
 */
export interface NativeClientEvent {
  readonly type: NativeClientEventType;
  readonly identity?: NativeIdentityChange;
  readonly person?: NativePersonState;
  readonly flags?: NativeFeatureFlagsResult;
  readonly schemaJson?: string;
  readonly consent?: NativeAnalyticsConsent;
  readonly diagnostic?: NativeDiagnostic;
  readonly transaction?: NativeTransactionUpdate;
  readonly purchaseIntent?: NativePurchaseIntent;
}

/**
 * The native Voidhash client behind one React Native `VoidhashClient`: one
 * hybrid object per client, owning the storage namespace of its publishable
 * key and base URL.
 */
export interface VoidhashNativeClient extends HybridObject<{
  ios: "swift";
  android: "kotlin";
}> {
  // ---- Lifecycle ----

  /**
   * The version of this contract the binary implements, the facade's
   * `NATIVE_CONTRACT_VERSION` (`src/core/native/native-client.ts`). The
   * facade reads it before anything else and starts no native client of
   * another version: a JavaScript bundle updated over the air onto a build
   * made for another version fails `init()`, asking for a new build, instead
   * of misreading the answers. A binary whose hybrid has no such member
   * implements version 0. Raise it with every change to this file that a
   * binary built before the change cannot honour. Synchronous; callable
   * before `configure()`.
   */
  contractVersion(): number;
  /**
   * Applies the configuration; touches neither storage nor the network.
   * Called before the first `start()`, and again after `shutdown()` resolved
   * to start once more (a re-init), possibly with other options.
   */
  configure(configuration: NativeClientConfiguration): void;
  /**
   * Starts the client from local state: identity, caches and queues are
   * loaded, store observation and background delivery begin, and the boot
   * refresh starts behind the call. Resolves without waiting for the network
   * (after the device's first unlock).
   *
   * Before it loads anything, it imports what earlier releases of this
   * package (its TypeScript core) stored on the device for this namespace:
   * the identity, the analytics consent and session, queued events, identity
   * links and store receipts, and the cached person, flags, schema and
   * paywalls. A queued receipt is never lost: a store is deleted only once
   * its records are in the native stores, and an import that fails is retried
   * at the next `start()`. The importers live in this module's native code
   * (`ios/` and `android/`), not in the SDKs.
   *
   * The analytics consent it settles on is the one chosen in this process
   * (`chosenAnalyticsConsent`), else the stored one, else the
   * `analyticsConsent` option. Events captured before `start()` are handed to
   * the native SDK, which records them when that consent is `granted`, holds
   * them when it is `pending` and pending events are buffered, and discards
   * them otherwise.
   *
   * Before resolving it dispatches, in this order: the loaded `identity`, the
   * `consent` in effect, the cached or injected `schema` (when there is one),
   * and the cached `person` (when there is one).
   *
   * Another instance that still owns the same storage namespace (a JavaScript
   * reload leaves the previous one running, never shut down) is retired first:
   * it persists its queues as `shutdown()` would, without waiting on the
   * network, and rejects every later call with `NOT_INITIALIZED`. A purchase
   * the retired instance had started is still recorded by it (its receipt in
   * the outbox, its SDK-started marker, on Google Play its unfinished-purchase
   * record), and this instance syncs and finishes it as its own.
   *
   * Android allows one live client per process: configuring a new instance
   * retires the previous one as above, whatever its storage namespace.
   *
   * A `start()` while another is in flight joins it and settles with it; a
   * `start()` on a started client resolves at once and changes nothing. A
   * `shutdown()` that overtakes a start waits for it: the start shuts down
   * whatever it built and rejects with `NOT_INITIALIZED` before `shutdown()`
   * resolves, so nothing it started keeps running.
   */
  start(): Promise<void>;
  /**
   * Flushes for at most about two seconds, persists what is still queued and
   * stops every observer, timer and listener. Every call still pending settles
   * (or rejects with `NOT_INITIALIZED`) before this resolves. Whatever was not
   * delivered goes out after the next `start()`.
   */
  shutdown(): Promise<NativeFlushStatus>;
  /** Registers the one listener for {@link NativeClientEvent}s, replacing any earlier one. */
  setEventListener(listener: (event: NativeClientEvent) => void): void;
  /** Removes the listener; nothing is delivered until the next `setEventListener()`. */
  removeEventListener(): void;

  // ---- Identity and person ----

  /** The current distinct id. */
  getDistinctId(): Promise<string>;
  /**
   * Switches to `externalUserId` and links the previous anonymous identity
   * onto it. Resolves `confirmed` with the person, or `deferred` with the last
   * known snapshot when the link is queued, together with the identity it
   * switched to. Rejects for an invalid id (`INVALID_ARGUMENT`) without
   * switching, or for a verdict of the API: the client then switches back to
   * the previous identity (a new generation, its `identity` dispatched before
   * the rejection), keeping what it cached for it. The facade puts back the
   * person and flag evaluations it held before the call, so nothing needs to
   * be re-sent for them.
   *
   * Identifying the current identity again adopts nothing: it resolves with
   * the current `NativeIdentityChange` and dispatches no `identity` event. A
   * profile that differs from the one last sent goes out as an identify
   * request, whatever the analytics consent; the same profile sends nothing.
   * Backs both `identify()` and `identifySync()`.
   */
  identify(externalUserId: string, email?: string, name?: string): Promise<NativeIdentifyResult>;
  /**
   * Starts a fresh visitor: a new anonymous identity and analytics session,
   * with what was cached for the previous identity dropped. When someone is
   * signed in this is `signOut()`, `$sign_out` and flush included; for an
   * anonymous identity nothing is captured or sent. Resolves with the
   * identity it switched to.
   */
  reset(): Promise<NativeIdentityChange>;
  /**
   * Signs the user out: captures `$sign_out` under the signing-out identity
   * (with automatic lifecycle events on and consent granted), switches to a
   * fresh anonymous identity, starts a new analytics
   * session, then flushes for at most about two seconds. Resolves with the
   * identity it switched to. Does nothing, and sends nothing, when nobody is
   * signed in: it resolves with the identity in effect.
   */
  signOut(): Promise<NativeIdentityChange>;
  /**
   * Puts the end user in group `groupKey` of `groupType`, which every event
   * captured after it resolves carries in `$groups`, and stores it with the
   * identity. `propertiesJson`, a JSON object of strings, numbers and
   * booleans, sets the group's properties; they go out as a `$groupidentify`
   * event, which is also sent when the group of that type changed. Rejects
   * `INVALID_ARGUMENT` for a type or key the native SDK would refuse. Runs in
   * call order with identity changes.
   */
  group(groupType: string, groupKey: string, propertiesJson?: string): Promise<void>;
  /**
   * Replaces every group the end user is in with the ones in `groupsJson`: an
   * object from group type to `{ id, properties? }`. A type it leaves out is
   * dropped. A `$groupidentify` is sent only for a group whose id or
   * properties changed since they were last sent. A type or id the native
   * SDK finds invalid is left out with a warning. Runs in call order with
   * identity changes; rejects `INVALID_ARGUMENT`, changing nothing, when
   * `groupsJson` is not such an object or an entry has no string `id`.
   */
  setGroups(groupsJson: string): Promise<void>;
  /** Takes the end user out of every group. Runs in call order with identity changes. */
  resetGroups(): Promise<void>;
  /** The groups the end user belongs to, by group type; empty before `start()`. Synchronous. */
  getGroups(): Record<string, string>;
  /**
   * Queues person attributes (`{ email?, name?, …traits }` as JSON, flat
   * values only) without waiting on the network, whatever the analytics
   * consent and in observer mode too. Only an agreement to ad data sharing is
   * left out while consent is not granted.
   */
  setPersonAttributes(attributesJson: string): Promise<void>;
  /**
   * Writes person attributes and reports whether the server confirmed them,
   * whatever the analytics consent and in observer mode too; see
   * {@link NativeWriteStatus} for `skipped`. A confirmed write's `person`
   * event is dispatched before the promise settles.
   */
  setPersonAttributesState(attributesJson: string): Promise<NativePersonWriteResult>;
  /**
   * The current person, cache-first: a fresh entry at once, a stale one after
   * at most 500 ms of waiting for its refresh. `forceFetch` prefers the server.
   * An answer read under an earlier generation still reaches the caller that
   * asked, but the facade does not publish it to the hooks.
   */
  getPersonState(forceFetch: boolean): Promise<NativePersonState>;
  /**
   * Drops the cached person snapshot; the next read asks the server. On both
   * platforms a `person` event with no person (stale, expired, `noCache`) is
   * dispatched before the promise settles.
   */
  resetPersonCache(): Promise<void>;

  // ---- Flags, paywalls and products ----

  /**
   * Evaluates `flagKeys` (every flag when absent), cache-first. With nothing
   * cached it waits at most `featureFlagMaxWaitMs` (2 s by default), then
   * answers with no flags; the evaluation goes on and lands as a `flags`
   * event. A requested key without an evaluated value is answered with its
   * `featureFlagDefaults` entry, enabled or not and without a variant, when
   * it has one.
   */
  getFeatureFlags(flagKeys?: string[]): Promise<NativeFeatureFlagsResult>;
  /**
   * The paywall assigned to `placement` as JSON, `"null"` when none is.
   * Rejects `PAYWALL_UNAVAILABLE` when nothing is cached and the server
   * cannot be reached.
   */
  getPaywall(placement: string): Promise<string>;
  /**
   * Every product the store returned, one per Studio product slug, sorted by
   * slug: the native SDK's `getProducts()`, one store query per call. A
   * product the store did not return is left out and reported once per load
   * as the `PRODUCT_NOT_FOUND` diagnostic, one it sells as another type than
   * Studio's as `PRODUCT_TYPE_MISMATCH`. Offers and intro eligibility are
   * this end user's: the facade calls it again after an identity change, a
   * completed purchase or restore (a flow's included) and a transaction
   * update other than a renewal. The products it answers are the ones
   * `purchase()` buys until the next call, a completed purchase or a restore.
   */
  getProducts(): Promise<NativeProduct[]>;

  // ---- Purchases ----

  /**
   * Buys the product with slug `productSlug` through the native SDK's
   * `purchase(product, options)`, with the product the last `getProducts()`
   * answered for that slug; one it does not hold (none loaded yet, or a
   * purchase or restore since) is asked of the store first (an unknown slug
   * rejects `INVALID_ARGUMENT`). Resolves
   * `purchased` with the transaction and whether Voidhash accepted the
   * receipt, `pending`, or `cancelled`: a cancelled sheet and a pending
   * payment are results, not rejections. A purchase in observer mode rejects
   * `READ_ONLY_PURCHASE_NOT_ALLOWED`; a second purchase while one is in
   * flight (including one a flow started) `PURCHASE_IN_PROGRESS`; an offer
   * that cannot be bought `OFFER_UNAVAILABLE`; a store refusal with a reason
   * `PAYMENT_DECLINED` (Android only) or `INELIGIBLE_FOR_OFFER` (both; the
   * products held are dropped then, and nothing is retried at the regular
   * price).
   *
   * When the purchase changed the person, its `person` event is dispatched
   * before the promise settles. A `pending` purchase stays this client's to
   * sync and finish when it completes, also after a relaunch; it later
   * arrives as a `transaction` event.
   *
   * With `replacing`, Google Play replaces that subscription and buys nothing
   * when it cannot: `REPLACED_SUBSCRIPTION_NOT_OWNED` when the account does
   * not own it, `INVALID_ARGUMENT` when either product is not a subscription
   * or both are the same, `SUBSCRIPTION_REPLACEMENT_REFUSED` when Google Play
   * refuses before its sheet opens. A `deferred` replacement resolves
   * `purchased` with the old product's transaction. The App Store ignores
   * `replacing`.
   */
  purchase(productSlug: string, options: NativePurchaseOptions): Promise<NativePurchaseResult>;
  /**
   * Revalidates the store's purchase history for the current identity and
   * resolves with the person the restore refreshed, read from the cache as
   * `getPersonState(false)` reads it: under the current generation, with
   * its real freshness (`fresh` only when the refresh after the restore
   * succeeded); with no person to answer, `personJson` absent. The person's
   * `person` event is dispatched before the promise settles.
   */
  restorePurchases(): Promise<NativePersonState>;
  /** Reports pending purchases and current store entitlements. */
  syncPurchases(): Promise<void>;
  /**
   * Reports a purchase another billing integration completed. Resolves once
   * the receipt is stored; delivery goes on in the background. `isRestore`
   * sends it as an explicit restore for the current identity.
   */
  reportTransaction(transaction: NativeReportedTransaction, isRestore: boolean): Promise<void>;

  // ---- Store actions, both stores ----

  /**
   * Opens the store's subscription management. App Store:
   * `AppStore.showManageSubscriptions(in:subscriptionGroupID:)` with the
   * group of the product `productSlug` names (iOS 17 and later), else without
   * a group. Google Play: opens
   * `https://play.google.com/store/account/subscriptions?sku=<storeProductId>&package=<package>`,
   * without `sku` when no product is named. Resolves once it was shown.
   */
  showManageSubscriptions(productSlug?: string): Promise<void>;
  /**
   * Opens offer-code redemption. App Store: the newest offer-code sheet the
   * SDK builds against (`presentOfferCodeRedeemSheet(in:)` on iOS 16 and
   * later), `code` ignored; a transaction it returns goes through the normal
   * receipt path and arrives as a `transaction` event. Google Play: opens
   * `https://play.google.com/redeem?code=<code>` (no `code` parameter without one).
   */
  presentCodeRedemption(code?: string): Promise<void>;
  /**
   * The storefront the end user buys from: StoreKit's `Storefront.current`
   * (country converted to alpha-2) or Play's `getBillingConfigAsync`.
   * Resolves `undefined` when the store has none to give; rejects when asking failed.
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- mirrors the Nitro contract, where an optional is `undefined`.
  getStorefront(): Promise<NativeStorefront | undefined>;
  /**
   * App Store: `AppStore.canMakePayments`. Google Play: the billing
   * connection is ready and billing is not unavailable.
   */
  canMakePayments(): Promise<boolean>;

  // ---- App Store (Google Play rejects UNSUPPORTED_PLATFORM) ----

  /**
   * StoreKit's refund request sheet for the transaction `transactionId`
   * (`Transaction.beginRefundRequest(for:in:)`). Rejects `INVALID_ARGUMENT`
   * for a transaction StoreKit does not know.
   */
  appStoreBeginRefundRequest(transactionId: string): Promise<NativeRefundRequestStatus>;
  /**
   * Every status of subscription group `groupId` the Apple account has
   * (`Product.SubscriptionInfo.status(for:)`), the current end user's first
   * (the one whose transaction carries their app account token), then the
   * others, Family Sharing ones included; verified ones only.
   */
  appStoreSubscriptionStatus(groupId: string): Promise<NativeAppStoreSubscriptionStatus[]>;
  /** The verified transactions of `Transaction.currentEntitlements`. */
  appStoreCurrentEntitlements(): Promise<NativeTransaction[]>;
  /**
   * The verified `AppTransaction.shared` as JSON, shaped as the facade's
   * `AppTransaction`: `{ originalAppVersion, originalPurchaseDate,
   * environment, appTransactionId?, originalPlatform?, jwsRepresentation }`,
   * the date in milliseconds since the epoch, `environment` one of
   * `production`, `sandbox`, `xcode`, `originalPlatform` one of `iOS`,
   * `macOS`, `tvOS`, `visionOS`.
   */
  appStoreAppTransaction(): Promise<string>;

  // ---- Google Play (the App Store rejects UNSUPPORTED_PLATFORM) ----

  /**
   * Play's `showInAppMessages` for the TRANSACTIONAL category, on the current
   * activity. On `subscriptionStatusUpdated` the native SDK syncs purchases
   * and refreshes the person (its `person` event before the promise settles).
   */
  googlePlayShowInAppMessages(): Promise<NativeInAppMessageResult>;
  /**
   * The account's purchases (subscriptions and one-time), suspended
   * subscriptions included when `includeSuspended`. A suspended purchase is
   * never submitted, acknowledged or consumed.
   */
  googlePlayQueryPurchases(includeSuspended: boolean): Promise<NativeTransaction[]>;
  /**
   * `BillingClient.isFeatureSupported` for the feature `feature` names:
   * `subscriptions`, `subscriptionsUpdate`, `inAppMessaging`,
   * `productDetails`, `billingConfig`, `alternativeBillingOnly`,
   * `externalOffer` (the `FeatureType` constants). Another name rejects
   * `INVALID_ARGUMENT`.
   */
  googlePlayIsFeatureSupported(feature: string): Promise<boolean>;

  // ---- Configuration at runtime ----

  /**
   * Records analytics consent; it applies at once. Resolves whether it was
   * also stored for later launches.
   *
   * Also accepted before `start()`: a consent other than `granted` then
   * discards the events captured so far, and the consent is stored by
   * `start()` (the facade also passes it as `chosenAnalyticsConsent`). It
   * resolves `false` then, as nothing is stored yet.
   */
  setAnalyticsConsent(consent: NativeAnalyticsConsent): Promise<boolean>;
  /**
   * The analytics consent in effect. Before `start()` the stored consent is
   * not loaded yet, so it answers the consent chosen through
   * `setAnalyticsConsent` or, without one, the configured
   * `analyticsConsent` option.
   */
  getAnalyticsConsent(): NativeAnalyticsConsent;
  /** Switches observer mode; a purchase already in flight keeps its mode. */
  setReadOnly(readOnly: boolean): void;
  isReadOnly(): boolean;

  // ---- Analytics ----

  /**
   * Queues an event. Synchronous and never throws: the call itself stamps the
   * event with the current identity, session and time and takes its place in
   * the queue, so events keep call order and the identity they were captured
   * under. On iOS this needs an intake outside the client's actor, called
   * synchronously from the bridge. `propertiesJson` is a JSON object the
   * facade already made safe.
   *
   * Allowed before `start()`: such events are kept in memory with their call
   * time and attributed to the identity `start()` loads; past 100 of them the
   * oldest is dropped, reported as `ANALYTICS_EVENT_DROPPED` once the listener
   * is set. What becomes of them depends on the consent `start()` settles on
   * (see `start()`); a `setAnalyticsConsent("denied")` discards them at once.
   */
  capture(eventName: string, propertiesJson: string): void;
  /**
   * Queues a `$screen` event for the screen `name`, stamped and ordered like
   * `capture`. The facade's screen tracker has already applied the app's
   * screen-tracking settings (`mapScreen`, whether route params are kept):
   * `propertiesJson` holds the `$screen_*` properties to record as they are,
   * with nothing stripped again.
   */
  screen(name: string, propertiesJson: string): void;
  /**
   * `capture` for an event the facade held back, which it does while an
   * identity change the app called before the event has not switched the
   * identity yet: recorded under the identity and session now in effect, at
   * `capturedAt` (milliseconds since the epoch), the time the app captured it.
   * A binary built before this member has none; the facade then calls
   * `capture`, and the event takes the time of that call.
   */
  captureAt(eventName: string, propertiesJson: string, capturedAt: number): void;
  /** `screen` for a screen the facade held back; see `captureAt`. */
  screenAt(name: string, propertiesJson: string, capturedAt: number): void;
  /** Sends person writes, receipts and events, waiting at most about two seconds. */
  flush(): Promise<NativeFlushStatus>;
  /** The active analytics session id; empty when there is none. Synchronous. */
  getSessionId(): string;

  // ---- Flows ----

  /**
   * Presents the flow assigned to `placement` and resolves once it ends, as
   * JSON, one of:
   *
   * - `{"status":"finished","result":"<finish action>","variables":{…}}`
   * - `{"status":"purchased","productSlug":"<product slug>"}`
   * - `{"status":"restored"}`
   * - `{"status":"closed"}` (the user or the app closed it, or another flow replaced it)
   * - `{"status":"failed","code":"<FLOW_* code>","message":"<FLOW_* code>: <detail>"}`,
   *   where the code is one of `FLOW_DISABLED`, `FLOW_NOT_ASSIGNED`,
   *   `FLOW_UNAVAILABLE`, `FLOW_RENDERER_MISSING`, `FLOW_UNSUPPORTED_PACKAGE`
   *   and `FLOW_PRESENTATION_FAILED`.
   *
   * Purchases and restores the flow starts go through this client. Never
   * rejects for a flow that cannot be shown: that is a `failed` result.
   */
  presentFlow(placement: string): Promise<string>;
  /** Closes the flow on screen, if any; its presentation resolves as closed. */
  dismissFlow(): Promise<void>;
}
