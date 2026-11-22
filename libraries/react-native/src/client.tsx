import { Result } from "better-result";
import * as Arr from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as EffectResult from "effect/Result";
import * as Schema from "effect/Schema";
import type { AtomRegistry } from "effect/reactivity";

import {
  AUTOMATIC_EVENTS,
  PUSH_SEND_ID_DATA_KEY,
  PUSH_SEND_ID_PROPERTY,
  SCREEN_PROPERTIES,
} from "./core/analytics/constants";
import { buildCacheNamespace } from "./core/caching/namespace";
import { SDK_VERSION } from "./core/constants";
import {
  makeDiagnosticEmitter,
  type VoidhashDiagnostic,
  type VoidhashDiagnosticHandler,
} from "./core/diagnostics/diagnostics";
import type {
  AppStorePurchaseIntent,
  AppStoreSubscriptionStatus,
  AppTransaction,
  RefundRequestStatus,
} from "./core/entities/app-store";
import type {
  GooglePlayBillingFeature,
  GooglePlayInAppMessageResult,
} from "./core/entities/google-play";
import type { EntitlementGrant, Person } from "./core/entities/person";
import type {
  Offer,
  OfferKind,
  Product,
  ProductsForSlugs,
  SubscriptionReplacement,
  SubscriptionReplacementMode,
} from "./core/entities/product";
import {
  fromReportedTransaction,
  type StoreReport,
  type StoreTransaction,
} from "./core/entities/reported-transaction";
import type { Transaction, TransactionUpdate } from "./core/entities/transaction";
import type {
  FeatureFlagsResult,
  Group,
  GroupProperties,
  GroupPropertyValue,
  Groups,
  PersonAttributes,
  ResolvedPaywall,
} from "./core/facade-types";
import {
  type FlowCapability,
  flowError,
  type FlowResult,
  type FlowLoading,
  type FlowRuntime,
  type PresentFlowArguments,
  type PresentFlowOptions,
} from "./core/flows/flows";
import {
  makeNativeClientAdapter,
  type NativeClientAdapter,
  type NativeClientPort,
} from "./core/native/native-client";
import { invalidPersonAttributes } from "./core/person-attributes";
import { clientRunAtom, schemaAtom } from "./core/reactivity/client-state";
import type {
  FeatureFlagKey,
  FeatureFlagValue,
  FlowInput,
  FlowValues,
  LocationSlug,
  PerkSlug,
  ProductSlug,
} from "./core/schema/registry";
import { RuntimeSchemaValue, type RuntimeSchema } from "./core/schema/runtime";
import {
  createScreenTracker,
  type ScreenTracker,
  type ScreenView,
} from "./core/screens/screen-tracker";
import {
  type AnalyticsConsent,
  type AnalyticsWhilePending,
  isAnalyticsConsent,
} from "./core/sdk-configuration";
import {
  InvalidArgumentError,
  NotInitializedError,
  PurchaseInProgressError,
  ReadOnlyModePurchaseNotAllowedError,
  UnsupportedPlatformError,
  VoidhashError,
} from "./errors";
import type {
  NativeClientConfiguration,
  NativePurchaseOptions,
  NativeReportedTransaction,
  NativeSubscriptionReplacement,
} from "./specs/VoidhashNativeClient.nitro";

export type {
  FeatureFlagsResult,
  Group,
  GroupProperties,
  GroupPropertyValue,
  Groups,
  PersonAttributes,
  ResolvedPaywall,
};

/**
 * The native flow module as earlier releases drove it from JavaScript.
 * @deprecated No longer used: the native client presents flows itself. Kept
 * so code that imports the type still compiles; removed in a future release.
 */
export interface VoidhashFlowsPort {
  readonly isRendererAvailable: boolean;
  engineCapabilities?(): string;
  present(
    requestJson: string,
    purchase: (productId: string, offerId: string) => Promise<void>,
    restore: () => Promise<void>,
    setAttribute: (name: string, valueJson: string) => Promise<void>,
    loadState: (key: string) => Promise<string>,
    saveState: (key: string, variablesJson: string) => Promise<void>,
    clearState: (key: string) => Promise<void>,
    track: (name: string, propertiesJson: string) => void,
    screen: (name: string, propertiesJson: string) => void,
  ): Promise<string>;
  preload(requestJson: string): Promise<void>;
  dismiss(): Promise<void>;
}

/**
 * A reachability source as the `connectivity` option took it: a subscribe
 * function returning an unsubscribe callback.
 */
export interface ConnectivityPort {
  readonly subscribe: (listener: (online: boolean) => void) => () => void;
}

/** Controls the built-in `$screen` event. */
export interface ScreenTrackingOptions {
  /** Default `true`. `false` makes every integration and `screen()` a no-op. */
  enabled?: boolean;
  /** Default `false`. Adds `$screen_params` (route params, string-coerced, max 20 keys). */
  includeParams?: boolean;
  /**
   * Rewrites or drops a screen before capture. Return `null` to skip it. A
   * throw, or a result whose `identity`, `name` or `path` is not a string,
   * tracks the screen unmapped and is reported as `HOST_CALLBACK_FAILED`.
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK option consumed by non-Effect app code; `null` is the documented "drop this screen" answer and mirrors the iOS and Android SDKs.
  mapScreen?: (view: ScreenView) => ScreenView | null;
}

/** How feature flag reads behave before Voidhash has answered them. */
export interface FeatureFlagsOptions {
  /**
   * What a flag reads as while it has no evaluated value: before its first
   * evaluation arrives, and when Voidhash cannot be reached and nothing is
   * cached. `useFeatureFlags().isEnabled()` answers it, on a disabled client
   * too, and `getFeatureFlags()` answers each requested key that has one as
   * a flag without a variant. Flags without a default read as `false`. Use
   * `true` for a flag whose feature must stay on when Voidhash is unreachable.
   */
  readonly defaults?: Readonly<Record<string, boolean>>;
  /**
   * How long a flag read with nothing cached waits for Voidhash before it
   * answers with no flags, in milliseconds (default 2000). The evaluation
   * carries on in the background, and the hooks update when it lands. A
   * cached value never waits more than 500 ms. A request gives up after 10
   * seconds, so a longer wait ends there.
   */
  readonly maxWaitMs?: number;
}

export interface VoidhashClientOptions {
  /**
   * The end user's consent to usage analytics (default `"granted"`). While it
   * is `"denied"` or `"pending"` the SDK captures, stores and sends no
   * analytics: no custom events, screens, lifecycle or install events or
   * paywall impressions. What the app says about the end user is not
   * analytics: `identify()`, person attributes and groups are sent whatever
   * the consent, and purchases, restores, entitlements, feature flags and
   * paywalls work as usual.
   * A consent set later with `client.setAnalyticsConsent()` is stored on the
   * device and takes precedence over this option on the next launch.
   */
  analyticsConsent?: AnalyticsConsent;
  /**
   * What happens to analytics captured while consent is `"pending"` (default
   * `"drop"`). `"buffer"` holds up to 100 events in memory, with the time
   * each happened, and records them once consent is granted; a denial
   * discards them. Nothing is sent or stored while they are held. Person
   * attributes and groups are never held: they are sent whatever the consent.
   */
  analyticsWhilePending?: AnalyticsWhilePending;
  /**
   * `true` makes `identify()` grant a `"pending"` consent, for apps whose
   * sign-in accepts their terms (default `false`). A `"denied"` consent is
   * never overridden. `signOut()` and `reset()` send what was recorded and
   * return that consent to `"pending"`; a consent set with
   * `setAnalyticsConsent()` is the app's own decision and stays.
   */
  grantConsentOnIdentify?: boolean;
  /**
   * Captures `$app_installed`, `$app_updated`, `$app_opened`,
   * `$app_backgrounded`, `$app_became_active`, `$app_crashed` and `$sign_out`
   * automatically (default `true`). Turn it off when the app reports these
   * events itself.
   */
  automaticLifecycleEvents?: boolean;
  baseUrl?: string;
  debug?: boolean;
  /** Enables isolated test purchases in debug builds. Release builds always ignore this option. */
  dev?: boolean;
  distinctId?: string;
  /**
   * Reads which ad brought this install and records it on the person as a
   * touch (default `true`): Apple Ads on iOS, the Google Play install referrer
   * and, with `metaAppId`, Meta's apps on Android. Runs once per install, in
   * the background, only with analytics consent. An install that predates this
   * option is not read.
   */
  installAttribution?: boolean;
  /**
   * The app's Meta (Facebook) app id. On Android, `installAttribution` then also
   * asks the Facebook, Instagram and Facebook Lite apps on the device for the ad
   * behind the install, which is preferred over the Play referrer. iOS ignores it.
   */
  metaAppId?: string;
  /**
   * When StoreKit shows its own messages, such as a price increase to agree
   * to or a billing issue (default `"deferWhileFlowPresented"`): at once
   * (`"automatic"`), or held while a Voidhash flow is on screen and shown once
   * it closes. Google Play ignores it.
   */
  appStoreMessages?: "automatic" | "deferWhileFlowPresented";
  /**
   * What happens to a purchase the end user starts on the App Store, such as
   * a promoted in-app purchase or a win-back offer (default
   * `"purchaseWhenReady"`). `"purchaseWhenReady"` buys it once `init()` has
   * finished, never before. `"manual"` hands it to the listeners of
   * `client.appStore.addPurchaseIntentListener()`, to complete with
   * `purchase()` when the app is ready; one that arrives before a listener
   * is added waits for the first. Google Play ignores it.
   */
  purchaseIntents?: "purchaseWhenReady" | "manual";
  /**
   * Ships the SDK fully disabled (default `true`). A disabled client never
   * connects to the native store, never talks to the network and never
   * registers listeners: `init()` and every side-effect method resolve as
   * no-ops, and reads answer with their empty shape. Intended for
   * feature-flagged rollouts, where mounting the provider unconditionally
   * avoids hook-order violations.
   *
   * Fixed at construction. Enabling the SDK later means creating a new client
   * — cheap, because a disabled client never builds its Effect runtime and so
   * holds no store connection, timers or listeners.
   */
  enabled?: boolean;
  /**
   * What flows may do in this app (default `["links"]`). Purchases, restores,
   * closing and analytics need no grant. `notifications` and `tracking` let a
   * flow ask for those system permissions, `attributes` lets it set person
   * attributes and `links` lets it open links outside the app. A flow action
   * needing a capability that is not granted is ignored.
   */
  flowCapabilities?: ReadonlyArray<FlowCapability>;
  /**
   * Which flow runtime draws flows (default `linked`, the one built into the
   * SDK). `module` draws them with the flow runtime module each flow names,
   * downloaded once, verified and cached. It applies to the whole app process
   * from the first `init()`, on iOS and Android, and needs the native flow
   * renderer; `linked` leaves the renderer as native code set it.
   */
  flowRuntime?: FlowRuntime;
  /**
   * What a paywall shows while it waits for the network (default `standard`):
   * the native SDK's loading screen, shown 0.4 seconds after `presentFlow` until
   * the paywall takes its place, which the end user can close (`presentFlow`
   * then resolves with the outcome `dismissed` and `wasShown: false`). `none`
   * keeps the app's screen as it is until the paywall is shown. A paywall
   * already on the device appears before then either way.
   */
  flowLoading?: FlowLoading;
  /** How feature flag reads behave before Voidhash has answered them; see {@link FeatureFlagsOptions}. */
  featureFlags?: FeatureFlagsOptions;
  ingestUrl?: string;
  /**
   * @deprecated No longer needed: the SDK observes reachability and the app
   * lifecycle natively and recovers on its own when the device comes back
   * online or to the foreground. Still accepted, and ignored.
   */
  connectivity?: ConnectivityPort;
  /**
   * Called for every non-fatal event the SDK handled itself — a request that
   * failed and will be retried, an event evicted from a full queue, a rejected
   * publishable key. Purely informational; exceptions thrown here are
   * swallowed. Prefer this over `unstable_swallowErrors`.
   */
  onDiagnostic?: VoidhashDiagnosticHandler;
  /**
   * Locations whose flows are downloaded at boot, so their first
   * `presentFlow()` shows without a round trip. Locations the device has
   * presented before are preloaded anyway. Nothing is preloaded when the app
   * does not include the flow renderer.
   */
  preloadLocations?: string[];
  /**
   * The interface revision the app was built against, by location slug. Pass
   * the `flowRevisions` constant of the generated declarations: a location's
   * revision is then used to preload its flow and by every `presentFlow()`
   * that names none. A location that is not listed counts as revision 0.
   */
  flowRevisions?: Readonly<Record<string, number>>;
  /**
   * Starts the SDK in observer mode: transactions are reported to Voidhash but
   * never finished/acknowledged with the store, and purchases are blocked, so
   * another billing integration can own them. Off by default. Can be flipped
   * later with `client.setReadOnly()`.
   */
  readOnly?: boolean;
  scheme?: string;
  /**
   * Automatic screen tracking (`$screen`). On by default; the Expo Router and
   * React Navigation integrations under `@voidhash/react-native/expo-router`
   * and `@voidhash/react-native/react-navigation` feed it, as does
   * `client.screen()`.
   */
  screenTracking?: ScreenTrackingOptions;
  /**
   * @deprecated Transport failures no longer surface as errors, so there is
   * nothing left for this to swallow. Use `onDiagnostic` to observe recovered
   * failures instead. Removed in a future release.
   */
  unstable_swallowErrors?: boolean;
  /**
   * Test/internal escape hatch — inject a known runtime schema instead of
   * letting the SDK fetch from the server on init. Not part of the public
   * API; production code should rely on the server-side schema endpoint.
   */
  unstable_internalSchema?: RuntimeSchema;
  /**
   * @deprecated No longer has an effect: the SDK always runs on its native client.
   * Still accepted; development builds log a one-time notice when it is set.
   */
  unstable_nativeEngine?: boolean;
}

/**
 * How a {@link VoidhashClient.purchase} call ended. Every failure is the
 * `Err` of the returned `Result`.
 *
 * - `purchased`: the store charged. `synced` is `true` once Voidhash
 *   accepted the receipt; `false` while it waits on the device, sent again
 *   at launch, in the foreground and when the device is back online, and
 *   access arrives once it lands. Either way the purchase is done: do not
 *   offer it again.
 * - `pending`: the store needs outside action first, such as Ask to Buy
 *   approval or a pending payment. It completes later, as a transaction
 *   update (`addTransactionListener()`), and access arrives with it.
 * - `cancelled`: the end user dismissed the store sheet.
 * - `disabled`: the client was created with `enabled: false`; nothing was bought.
 */
export type PurchaseResult =
  | { readonly status: "purchased"; readonly transaction: Transaction; readonly synced: boolean }
  | { readonly status: "pending" }
  | { readonly status: "cancelled" }
  | { readonly status: "disabled" };

/**
 * Which offer a purchase buys:
 *
 * - `"automatic"` (default): a subscription's `introOffer` when the end user
 *   is eligible for one, otherwise the regular price.
 * - `"none"`: the regular price. The App Store may still apply an
 *   introductory offer the end user is eligible for.
 * - an `Offer` from `product.offers` or `product.subscription.introOffer`.
 * - an offer's `id`, looked up in the same offers.
 *
 * An offer that cannot be bought fails the purchase with `OFFER_UNAVAILABLE`;
 * the product is never bought at its regular price instead.
 */
// `string & Record<never, never>` keeps the two words above suggested next to any offer id.
export type OfferSelection = "automatic" | "none" | Offer | (string & Record<never, never>);

/** What a {@link VoidhashClient.purchase} call may ask for beyond the product. */
export interface PurchaseOptions {
  /** The offer to buy; see {@link OfferSelection}. Default `"automatic"`. */
  readonly offer?: OfferSelection;
  /**
   * How many to buy, default 1. Only App Store consumables can be bought
   * several at once; on Google Play the end user picks the quantity in the
   * store's sheet. Anything but 1 elsewhere is an `INVALID_ARGUMENT` error.
   * The transaction reports the quantity the store charged.
   */
  readonly quantity?: number;
  /**
   * The subscription the user has now, which this purchase replaces: an
   * upgrade, a downgrade or a change of plan. Google Play only. Without it,
   * buying another subscription product there adds a second subscription
   * next to the first, and Google Play bills both.
   *
   * Nothing is bought when the replacement cannot be made. The purchase
   * fails with `REPLACED_SUBSCRIPTION_NOT_OWNED` when the signed-in Google
   * Play account does not own the named subscription, with
   * `INVALID_ARGUMENT` when either product is not a subscription, both are
   * the same product, or the option names no product or an unknown mode, and
   * with `SUBSCRIPTION_REPLACEMENT_REFUSED` when Google Play rejects the
   * replacement before its sheet opens.
   *
   * Ignored on iOS, where the App Store moves a subscriber between the
   * products of one subscription group by itself.
   */
  readonly replacing?: SubscriptionReplacement;
  /** App Store options; Google Play ignores them. */
  readonly appStore?: {
    /** Simulates Ask to Buy in the sandbox, so the purchase ends `pending`. */
    readonly simulatesAskToBuyInSandbox?: boolean;
  };
  /** Google Play options; the App Store ignores them. */
  readonly googlePlay?: {
    /** Tells Google Play the price was personalized for the end user (an EU disclosure). */
    readonly isOfferPersonalized?: boolean;
    /** Google Play's obfuscated profile id, for apps with several profiles per account. */
    readonly obfuscatedProfileId?: string;
    /**
     * Buys exactly this Google Play offer token, from
     * `product.googlePlay.subscriptionOffers` or `oneTimeOffers`, instead of
     * what `offer` selects.
     */
    readonly offerToken?: string;
  };
}

/** The storefront the end user buys from. */
export interface Storefront {
  /** ISO 3166-1 alpha-2 country code, such as `US`. */
  readonly countryCode: string;
  /** ISO 4217 currency code, when the store says. */
  readonly currencyCode?: string;
}

/** Outcome of an identity switch reported by {@link VoidhashClient.identifySync}. */
export type IdentifyResult =
  | {
      /** The server confirmed the identity and returned the person. */
      status: "confirmed";
      person: Person;
    }
  | {
      /**
       * The server has not confirmed the switch yet (it was unreachable, or
       * the key was rejected). The device already runs under the new distinct
       * id, and the link from the previous identity is queued on the device
       * and delivered once the server can be reached.
       */
      status: "deferred";
      // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK answer consumed by non-Effect app code.
      person: Person | null;
    }
  | {
      /** The client was created with `enabled: false`, so nothing was recorded. */
      status: "disabled";
      person: null;
    };

/** Answer to an entitlement check for one perk. */
export interface HasPerkResult {
  /** The active grant behind `hasAccess`, when one exists. */
  grant?: EntitlementGrant;
  hasAccess: boolean;
  /**
   * The answer came from a cached snapshot that is past its refresh window,
   * either because a refresh is still running or because the server could not
   * be reached.
   */
  isStale: boolean;
  /**
   * The cached snapshot is past its two-day TTL. Access is still reported as
   * the snapshot recorded it; apps gating high-value content can decide to
   * treat this as untrusted.
   */
  isExpired: boolean;
  /**
   * Why the answer has the freshness it has.
   *
   * - `fresh`: confirmed by the server just now.
   * - `refresh-in-flight`: served from cache while a refresh is still running;
   *   its result lands for the next read.
   * - `refresh-failed`: served from cache because the refresh could not
   *   complete.
   * - `no-cache`: the SDK has never seen a snapshot for this identity, so
   *   `hasAccess` is `false` for lack of evidence rather than because access
   *   was denied.
   */
  reason: "fresh" | "refresh-in-flight" | "refresh-failed" | "no-cache";
}

/** Person snapshot together with how much to trust it. */
export interface CurrentPersonResult {
  /** The snapshot, or `null` before the SDK has ever seen one. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK answer consumed by non-Effect app code.
  person: Person | null;
  /** Served from cache past its refresh window. */
  isStale: boolean;
  /** Served from cache past its TTL. */
  isExpired: boolean;
  /** Why the snapshot has the freshness it has; see {@link HasPerkResult.reason}. */
  reason: "fresh" | "refresh-in-flight" | "refresh-failed" | "no-cache";
}

/** Outcome of a synchronous person-attribute update. */
export type SetPersonAttributesResult =
  | {
      /** The server accepted and returned the updated snapshot. */
      status: "confirmed";
      person: Person;
    }
  | {
      /** The server was unreachable; the update is queued and will be retried. */
      status: "deferred";
      // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK answer consumed by non-Effect app code.
      person: Person | null;
    }
  | {
      /** The client was created with `enabled: false`, so nothing was recorded. */
      status: "disabled";
      person: null;
    }
  | {
      /**
       * Nothing was left to write: the only attribute was an agreement to ad
       * data sharing, which waits for analytics consent.
       */
      status: "skipped";
      person: null;
    };

/** Outcome of an analytics flush. */
export interface FlushResult {
  /** Events the server accepted during this flush. */
  flushed: number;
  /** Events still queued, waiting for their next attempt. */
  pending: number;
  /** The failure that stopped the flush, when one did. */
  lastError?: VoidhashError;
}

/** Feature flag answer of a disabled client: no flags were ever evaluated. */
const DISABLED_FEATURE_FLAGS: FeatureFlagsResult = { flags: [], isStale: false };

/**
 * The client that owns each storage namespace (publishable key and base URL)
 * right now. A client that initializes ends the one it replaces first, so two
 * native clients never write the same queues. Where the platform runs one
 * native client per process, every client shares {@link PROCESS_SLOT} instead,
 * so a client of another project is ended as well: its native client stops
 * when the next one starts.
 */
const liveClients = MutableHashMap.empty<string, VoidhashClient>();

/** The key in {@link liveClients} of the one client a process can run. */
const PROCESS_SLOT = "process";

/** How many purchase intents a client holds while no listener is registered; older ones are dropped. */
const MAX_HELD_PURCHASE_INTENTS = 10;

/**
 * How many events and screens a client holds while an identity change called
 * before them has not switched the identity yet; older ones are dropped. The
 * same number the native client holds before it starts.
 */
const MAX_EVENTS_HELD_FOR_IDENTITY = 100;

/**
 * Whether a value is a string with something besides whitespace. A blank
 * distinct id cannot identify anyone (HTTP trims header values, so it would
 * reach the server as a missing one).
 */
const isNonBlankString = (value: unknown): value is string =>
  P.isString(value) && value.trim() !== "";

const encodeProjectSchemaJson = Schema.encodeSync(Schema.fromJsonString(RuntimeSchemaValue));
const encodeJson = Schema.encodeUnknownOption(Schema.fromJsonString(Schema.Unknown));

/**
 * Whether a screen, as an integration, `screen()` or `mapScreen` handed it
 * over, has the strings it is tracked by. Types do not guarantee it: a
 * `mapScreen` that looks a title up yields `undefined` for a missing key.
 */
const isTrackableScreen = (view: unknown): view is ScreenView =>
  P.hasProperty(view, "identity") &&
  P.isString(view.identity) &&
  P.hasProperty(view, "name") &&
  P.isString(view.name) &&
  P.hasProperty(view, "path") &&
  P.isString(view.path);

const REPLACEMENT_MODES: ReadonlyArray<SubscriptionReplacementMode> = [
  "withTimeProration",
  "chargeProratedPrice",
  "chargeFullPrice",
  "withoutProration",
  "deferred",
];

const isReplacementMode = (value: unknown): value is SubscriptionReplacementMode =>
  REPLACEMENT_MODES.some((mode) => mode === value);

/**
 * The subscription `purchase()` was asked to replace, as the native client
 * takes it, or an argument error when it names no product or a mode the SDK
 * does not have. Types do not guarantee either.
 */
const toNativeReplacement = (
  replacing: SubscriptionReplacement,
): EffectResult.Result<NativeSubscriptionReplacement, InvalidArgumentError> => {
  const product: unknown = P.hasProperty(replacing, "product") ? replacing.product : undefined;
  const productSlug: unknown = P.hasProperty(product, "slug") ? product.slug : undefined;
  if (!isNonBlankString(productSlug)) {
    return EffectResult.fail(
      new InvalidArgumentError(
        "purchase() needs `replacing.product` to be the product being replaced, from getProducts()",
      ),
    );
  }
  const mode: unknown =
    (P.hasProperty(replacing, "mode") ? replacing.mode : undefined) ?? "withTimeProration";
  return isReplacementMode(mode)
    ? EffectResult.succeed({ mode, productSlug })
    : EffectResult.fail(
        new InvalidArgumentError(
          `purchase() needs \`replacing.mode\` to be one of ${REPLACEMENT_MODES.join(", ")}${P.isString(mode) ? `, got "${mode}"` : ""}`,
        ),
      );
};

/** The offer `purchase()` was asked for, as the native client takes it. */
const toNativeOfferSelection = (
  offer: unknown,
): EffectResult.Result<
  Pick<NativePurchaseOptions, "offerSelection" | "offerId" | "offerKind">,
  InvalidArgumentError
> => {
  if (offer === undefined || offer === "automatic") {
    return EffectResult.succeed({ offerSelection: "automatic" });
  }
  if (offer === "none") return EffectResult.succeed({ offerSelection: "regularPrice" });
  if (isNonBlankString(offer))
    return EffectResult.succeed({ offerId: offer, offerSelection: "offer" });
  // An offer from the product names itself by its kind as well: the App Store's introductory
  // offer has no id of its own, so its `id` may be empty.
  const kind: unknown = P.hasProperty(offer, "kind") ? offer.kind : undefined;
  const offerKind = Option.filter(
    Option.some(kind),
    (value): value is Exclude<OfferKind, "unknown"> =>
      value === "introductory" ||
      value === "promotional" ||
      value === "winBack" ||
      value === "oneTime",
  );
  const id: unknown = P.hasProperty(offer, "id") ? offer.id : undefined;
  if (P.isString(id) && (Option.isSome(offerKind) || isNonBlankString(id))) {
    return EffectResult.succeed({
      offerId: id,
      offerSelection: "offer",
      ...Option.match(offerKind, { onNone: () => ({}), onSome: (value) => ({ offerKind: value }) }),
    });
  }
  return EffectResult.fail(
    new InvalidArgumentError(
      'purchase() needs `offer` to be "automatic", "none", an offer of the product or its id',
    ),
  );
};

/**
 * A purchase's options as the native client takes them, or an argument error
 * for options no store could honour: a quantity that is not a whole number of
 * at least 1, several of anything but an App Store consumable, an offer or a
 * replacement that names nothing. They come from app code, so types guarantee
 * none of it.
 */
const toNativePurchaseOptions = (
  product: Product,
  options: PurchaseOptions,
): EffectResult.Result<NativePurchaseOptions, InvalidArgumentError> => {
  const quantity: unknown = options.quantity ?? 1;
  if (!P.isNumber(quantity) || !Number.isInteger(quantity) || quantity < 1) {
    return EffectResult.fail(
      new InvalidArgumentError("purchase() needs `quantity` to be a whole number of at least 1"),
    );
  }
  if (quantity !== 1 && !(product.store === "appStore" && product.type === "consumable")) {
    return EffectResult.fail(
      new InvalidArgumentError(
        `purchase() can buy several only of an App Store consumable; "${product.slug}" is bought one at a time`,
      ),
    );
  }
  const offer = toNativeOfferSelection(options.offer);
  if (EffectResult.isFailure(offer)) return EffectResult.fail(offer.failure);
  const replacing = Option.map(Option.fromNullishOr(options.replacing), toNativeReplacement);
  if (Option.isSome(replacing) && EffectResult.isFailure(replacing.value)) {
    return EffectResult.fail(replacing.value.failure);
  }
  const { appStore, googlePlay } = options;
  return EffectResult.succeed({
    ...offer.success,
    quantity,
    ...(Option.isSome(replacing) && EffectResult.isSuccess(replacing.value)
      ? { replacing: replacing.value.success }
      : {}),
    ...(appStore?.simulatesAskToBuyInSandbox === undefined
      ? {}
      : { appStore: { simulatesAskToBuyInSandbox: appStore.simulatesAskToBuyInSandbox } }),
    ...(googlePlay === undefined
      ? {}
      : {
          googlePlay: {
            ...(googlePlay.isOfferPersonalized === undefined
              ? {}
              : { isOfferPersonalized: googlePlay.isOfferPersonalized }),
            ...(googlePlay.obfuscatedProfileId === undefined
              ? {}
              : { obfuscatedProfileId: googlePlay.obfuscatedProfileId }),
            ...(googlePlay.offerToken === undefined ? {} : { offerToken: googlePlay.offerToken }),
          },
        }),
  });
};

/**
 * Why `groups` cannot be set, or `None` when they can: a group's id is a
 * string or a finite number, as the web SDK takes it. Types do not guarantee
 * it, and an id read as text would put the end user in a group named
 * `"undefined"`. A type given as `null` or `undefined` is not in the set.
 */
const invalidGroups = (groups: Groups): Option.Option<InvalidArgumentError> => {
  const invalidTypes = R.keys(
    R.filter(groups, (group: unknown) => {
      if (P.isNullish(group)) return false;
      const id: unknown = P.hasProperty(group, "id") ? group.id : group;
      return !(P.isString(id) || (P.isNumber(id) && Number.isFinite(id)));
    }),
  );
  return Arr.match(invalidTypes, {
    onEmpty: () => Option.none(),
    onNonEmpty: (types) =>
      Option.some(
        new InvalidArgumentError(
          `setGroups() needs each group's id to be a string or a finite number (${types.join(", ")})`,
        ),
      ),
  });
};

/** A host report as the native client takes it: the store identifier and, on iOS, its JWS. */
const toNativeReport = (report: StoreReport): NativeReportedTransaction =>
  report.platform === "ios"
    ? {
        platform: "appStore",
        transactionId: report.transactionId,
        ...(report.signedTransaction === undefined
          ? {}
          : { signedTransaction: report.signedTransaction }),
      }
    : {
        platform: "googlePlay",
        purchaseToken: report.purchaseToken,
        ...(report.purchaseState === undefined ? {} : { purchaseState: report.purchaseState }),
      };

/**
 * What {@link VoidhashClient} is built from: the options `createVoidhashClient`
 * validated, and where the native client comes from.
 * @internal
 */
export interface VoidhashClientSetup {
  readonly publishableKey: string;
  readonly baseUrl: string;
  readonly ingestUrl: Option.Option<string>;
  readonly distinctId: Option.Option<string>;
  readonly scheme: string;
  readonly readOnly: boolean;
  readonly debug: boolean;
  /** `dev: true` in a debug build. */
  readonly developmentMode: boolean;
  readonly enabled: boolean;
  readonly analyticsConsent: AnalyticsConsent;
  readonly analyticsWhilePending: AnalyticsWhilePending;
  readonly grantConsentOnIdentify: boolean;
  readonly automaticLifecycleEvents: boolean;
  readonly installAttribution: boolean;
  readonly metaAppId: Option.Option<string>;
  readonly flowCapabilities: ReadonlyArray<FlowCapability>;
  /** The validated `featureFlags.maxWaitMs`; `None` keeps the native client's default. */
  readonly featureFlagMaxWaitMs: Option.Option<number>;
  /** The validated `featureFlags.defaults`. */
  readonly featureFlagDefaults: Readonly<Record<string, boolean>>;
  readonly flowRuntime: FlowRuntime;
  readonly flowLoading: FlowLoading;
  readonly preloadLocations: ReadonlyArray<string>;
  readonly flowRevisions: Readonly<Record<string, number>>;
  readonly screenTracking: ScreenTrackingOptions;
  readonly internalSchema: Option.Option<RuntimeSchema>;
  readonly unstableSwallowErrors: boolean;
  readonly onDiagnostic: Option.Option<VoidhashDiagnosticHandler>;
  readonly atomRegistry: AtomRegistry.AtomRegistry;
  /** A new native client for this facade, or `None` where the binary has none. */
  readonly createNativeClient: () => Option.Option<NativeClientPort>;
  /**
   * Whether the platform runs one native client per process (Android): starting
   * a client there stops the one running, whatever project it belongs to.
   */
  readonly oneNativeClientPerProcess: boolean;
  /** `Platform.OS`: the `appStore` actions run on `ios` only, the `googlePlay` ones on `android`. */
  readonly platform: string;
  readonly appStoreMessages: "automatic" | "deferWhileFlowPresented";
  readonly purchaseIntents: "purchaseWhenReady" | "manual";
}

/**
 * App Store actions, on `client.appStore`. On any other platform each one
 * answers `UNSUPPORTED_PLATFORM`. While the client is disabled the reads
 * answer empty and `beginRefundRequest()` and `appTransaction()`, which have
 * no empty answer, `VOIDHASH_CLIENT_NOT_INITIALIZED`.
 */
export interface AppStoreActions {
  /**
   * Shows Apple's refund request sheet for a transaction, by its App Store
   * transaction id (`transaction.id`). `success` means Apple received the
   * request, not that it refunded anything: a refund arrives later and
   * reaches the person's subscriptions and entitlements.
   */
  readonly beginRefundRequest: (
    transactionId: string,
  ) => Promise<Result<RefundRequestStatus, VoidhashError>>;
  /**
   * Every status the Apple account has in an App Store subscription group
   * (`subscription.groupId`), as StoreKit reports them on this device: state,
   * latest transaction and renewal info. The current person's comes first (the
   * one bought for them), then the account's others, ones shared through
   * Family Sharing included. For what the person can use, read their
   * entitlements; the server knows subscriptions across devices and stores,
   * see `useSubscriptions()`.
   */
  readonly subscriptionStatus: (
    groupId: string,
  ) => Promise<Result<ReadonlyArray<AppStoreSubscriptionStatus>, VoidhashError>>;
  /** StoreKit's verified current entitlements on this device. */
  readonly currentEntitlements: () => Promise<Result<ReadonlyArray<Transaction>, VoidhashError>>;
  /** How the end user got the app: StoreKit's verified `AppTransaction`. */
  readonly appTransaction: () => Promise<Result<AppTransaction, VoidhashError>>;
  /**
   * Calls `listener` with each purchase the end user starts on the App Store
   * (a promoted in-app purchase, a win-back offer) while the
   * `purchaseIntents` option is `"manual"`; complete it with `purchase()`.
   * Intents that arrived while no listener was registered (they can arrive
   * as soon as `init()` starts) are held, the 10 latest, and handed to the
   * first listener added, at once. Returns the function that removes the
   * listener. Never called on another platform.
   */
  readonly addPurchaseIntentListener: (
    listener: (intent: AppStorePurchaseIntent) => void,
  ) => () => void;
}

/**
 * Google Play actions, on `client.googlePlay`. On any other platform each one
 * answers `UNSUPPORTED_PLATFORM`. While the client is disabled each answers
 * empty: `noActionNeeded`, no purchases, `false`.
 */
export interface GooglePlayActions {
  /**
   * Shows Google Play's in-app messages for the end user's subscriptions,
   * such as a prompt to fix a declined payment. When they fixed it, the
   * answer names the purchase token, and the SDK has synced purchases and
   * refreshed the person.
   */
  readonly showInAppMessages: () => Promise<Result<GooglePlayInAppMessageResult, VoidhashError>>;
  /**
   * The Google Play account's purchases on this device, suspended
   * subscriptions included unless `includeSuspended` is `false`
   * (`transaction.googlePlay.isSuspended`). For what the person can use, read
   * their entitlements.
   */
  readonly queryPurchases: (options?: {
    readonly includeSuspended?: boolean;
  }) => Promise<Result<ReadonlyArray<Transaction>, VoidhashError>>;
  /** Whether Google Play supports a billing feature on this device. */
  readonly isFeatureSupported: (
    feature: GooglePlayBillingFeature,
  ) => Promise<Result<boolean, VoidhashError>>;
}

/**
 * The Voidhash client: the public facade over the native Voidhash client.
 * Every method answers with a `Result` carrying a coded `VoidhashError`
 * instead of throwing, and a client created with `enabled: false` never
 * touches the native client and answers every read with its empty shape.
 */
export class VoidhashClient {
  private readonly setup: VoidhashClientSetup;
  private readonly atomRegistry: AtomRegistry.AtomRegistry;
  private readonly namespace: string;
  /** What this client holds in `liveClients` while it runs: its namespace, or the process. */
  private readonly slot: string;
  private readonly emitDiagnostic: (diagnostic: VoidhashDiagnostic) => void;
  private readonly screenTracker: ScreenTracker;
  private manualScreenCounter = 0;
  /** The send id `trackPushOpened()` reported last. */
  private lastPushOpenedSendId = Option.none<string>();
  /** The native client and its adapter, made on first use. */
  private native = Option.none<NativeClientAdapter>();
  /** Seeds the first `init()` of the process; cleared once applied or by an identity change. */
  private initialDistinctId: Option.Option<string>;
  /** The consent in effect, mirrored from the native client once it runs. */
  private analyticsConsent: AnalyticsConsent;
  /** A consent `setAnalyticsConsent()` chose before `init()`; it wins over the stored one. */
  private chosenAnalyticsConsent = Option.none<AnalyticsConsent>();
  private analyticsConsentDeniedReported = false;
  private readOnly: boolean;
  private _isInitialized = false;
  /** Set by `end()` until the next `init()`. */
  private ended = false;
  /**
   * The `init()` or `end()` called last, until it settles. A call for the
   * same transition joins it and a call for the other one runs after it, so
   * the client ends up in the state asked for last.
   */
  private transition = Option.none<{
    readonly to: "initialized" | "ended";
    readonly settled: Promise<Result<void, VoidhashError>>;
  }>();
  private flushInFlight = Option.none<Promise<Result<FlushResult, VoidhashError>>>();
  /** The purchase this client runs, until it settles; a second one fails `PURCHASE_IN_PROGRESS`. */
  private purchaseInFlight = Option.none<Promise<Result<PurchaseResult, VoidhashError>>>();
  private identityChangeTail: Promise<void> = Promise.resolve();
  /**
   * The `identify()`, `reset()` and `signOut()` calls made, and how many of
   * them, in call order, have switched the identity or settled without doing
   * so. An event, a screen or a purchase report waits for the ones called
   * before it, so it is recorded for the person the app switched to; see
   * {@link identityChangeSwitched}.
   */
  private identityChangesCalled = 0;
  private identityChangesSwitched = 0;
  /** The identity change the native client is running now, by its number among those called. */
  private identityChangeRunning = Option.none<number>();
  private readonly eventsHeldForIdentity: Array<{
    readonly after: number;
    readonly name: string;
    readonly operation: "capture" | "screen";
    readonly send: () => void;
  }> = [];
  private readonly reportsHeldForIdentity: Array<{
    readonly after: number;
    readonly proceed: () => void;
  }> = [];
  /**
   * One entry per `addTransactionListener()` call, each its own function, so
   * adding a listener twice calls it twice.
   */
  private readonly transactionListeners =
    MutableHashSet.empty<(update: TransactionUpdate) => void>();
  private readonly purchaseIntentListeners =
    MutableHashSet.empty<(intent: AppStorePurchaseIntent) => void>();
  /**
   * Purchase intents that arrived while no listener was registered (they
   * arrive from `init()` on, before the app may have added one), oldest
   * first, for the first listener the app adds.
   */
  private heldPurchaseIntents: Array<AppStorePurchaseIntent> = [];

  /**
   * @internal Not part of the public API: create clients with
   * `createVoidhashClient()`, which validates the options and builds the
   * provider and hooks. The parameters change between releases.
   */
  constructor(setup: VoidhashClientSetup) {
    this.setup = setup;
    this.atomRegistry = setup.atomRegistry;
    this.namespace = buildCacheNamespace(setup.publishableKey, setup.baseUrl);
    this.slot = setup.oneNativeClientPerProcess ? PROCESS_SLOT : this.namespace;
    this.emitDiagnostic = makeDiagnosticEmitter(setup.onDiagnostic);
    this.initialDistinctId = setup.distinctId;
    this.analyticsConsent = setup.analyticsConsent;
    this.readOnly = setup.readOnly;
    const mapScreen = setup.screenTracking.mapScreen;
    this.screenTracker = createScreenTracker({
      enabled: setup.enabled && (setup.screenTracking.enabled ?? true),
      includeParams: setup.screenTracking.includeParams ?? false,
      mapScreen: mapScreen
        ? (view) => {
            // oxlint-disable-next-line effect/avoid-try-catch -- boundary with host application code: `mapScreen` is a plain function the app supplies and may throw anything; the throw must not escape into the navigation listener that reported the screen.
            try {
              const mapped: unknown = mapScreen(view);
              if (P.isNullish(mapped)) return Option.none();
              if (isTrackableScreen(mapped)) return Option.some(mapped);
              this.emitDiagnostic({
                code: "HOST_CALLBACK_FAILED",
                kind: "configuration",
                message:
                  "screenTracking.mapScreen returned a screen whose identity, name or path is not a string; the screen was tracked unmapped",
                operation: "screenTracking.mapScreen",
                retryable: false,
              });
              return Option.some(view);
            } catch (error) {
              this.reportHostCallbackFailure("screenTracking.mapScreen", error);
              return Option.some(view);
            }
          }
        : undefined,
    });
  }

  /** The adapter over this client's native client, created on first use. */
  private nativeClient(): Option.Option<NativeClientAdapter> {
    if (Option.isSome(this.native)) return this.native;
    this.native = Option.map(this.setup.createNativeClient(), (native) =>
      makeNativeClientAdapter({
        atomRegistry: this.atomRegistry,
        native,
        onAnalyticsConsentChanged: (consent) => {
          this.analyticsConsent = consent;
          if (consent === "granted") this.analyticsConsentDeniedReported = false;
        },
        // The switch a running identity change made: what waited for it goes on
        // now, not once Voidhash answered the call.
        onIdentitySwitched: () => {
          Option.map(this.identityChangeRunning, (change) => this.identityChangeSwitched(change));
        },
        onDiagnostic: this.emitDiagnostic,
        onPurchaseIntent: (intent) => this.receivePurchaseIntent(intent),
        onTransaction: (update) =>
          this.notify("addTransactionListener", this.transactionListeners, update),
      }),
    );
    return this.native;
  }

  /** The configuration the next `start()` runs with. */
  private configuration(): NativeClientConfiguration {
    const setup = this.setup;
    return {
      analyticsConsent: setup.analyticsConsent,
      analyticsWhilePending: setup.analyticsWhilePending,
      appStoreMessages: setup.appStoreMessages,
      automaticLifecycleEvents: setup.automaticLifecycleEvents,
      baseUrl: setup.baseUrl,
      grantConsentOnIdentify: setup.grantConsentOnIdentify,
      debug: setup.debug,
      developmentMode: setup.developmentMode,
      featureFlagDefaults: { ...setup.featureFlagDefaults },
      flowCapabilities: [...setup.flowCapabilities],
      flowRuntime: setup.flowRuntime,
      flowLoading: setup.flowLoading,
      installAttribution: setup.installAttribution,
      flowRevisions: R.collect(setup.flowRevisions, (location, revision) => ({
        location,
        revision,
      })),
      preloadLocations: [...setup.preloadLocations],
      publishableKey: setup.publishableKey,
      purchaseIntents: setup.purchaseIntents,
      readOnly: this.readOnly,
      screenTrackingEnabled: setup.screenTracking.enabled ?? true,
      sdkVersion: SDK_VERSION,
      ...Option.match(this.initialDistinctId, {
        onNone: () => ({}),
        onSome: (distinctId) => ({ distinctId }),
      }),
      ...Option.match(setup.metaAppId, {
        onNone: () => ({}),
        onSome: (metaAppId) => ({ metaAppId }),
      }),
      ...Option.match(this.chosenAnalyticsConsent, {
        onNone: () => ({}),
        onSome: (chosenAnalyticsConsent) => ({ chosenAnalyticsConsent }),
      }),
      ...Option.match(setup.ingestUrl, {
        onNone: () => ({}),
        onSome: (ingestUrl) => ({ ingestUrl }),
      }),
      ...Option.match(setup.featureFlagMaxWaitMs, {
        onNone: () => ({}),
        onSome: (featureFlagMaxWaitMs) => ({ featureFlagMaxWaitMs }),
      }),
      ...Option.match(setup.internalSchema, {
        onNone: () => ({}),
        onSome: (schema) => ({ internalSchemaJson: encodeProjectSchemaJson(schema) }),
      }),
    };
  }

  /**
   * The answer of a side-effect call, unless `unstable_swallowErrors` asks for
   * failures to be logged and answered as success.
   */
  private swallowed(
    operation: string,
    result: Result<void, VoidhashError>,
  ): Result<void, VoidhashError> {
    if (result.isErr() && this.setup.unstableSwallowErrors) {
      // oxlint-disable-next-line effect/use-console-service -- the deprecated escape hatch logs what it swallows, outside any runtime.
      console.warn(`[voidhash] swallowed error in ${operation}`, result.error);
      return Result.ok(undefined);
    }
    return result;
  }

  /** The started adapter, or `NOT_INITIALIZED`. */
  private started(): Result<NativeClientAdapter, VoidhashError> {
    return this._isInitialized && Option.isSome(this.native)
      ? Result.ok(this.native.value)
      : Result.err(new NotInitializedError());
  }

  /**
   * Joins an `init()` in progress or starts one — after `end()` and behind an
   * `end()` still running too — the way identity calls do, so a purchase
   * reported during launch or teardown is not refused.
   */
  private async whenInitialized(): Promise<Result<NativeClientAdapter, VoidhashError>> {
    await this.init();
    return this.started();
  }

  /** Runs an `init()` or `end()` as the transition called last. */
  private runTransition(
    to: "initialized" | "ended",
    run: () => Promise<Result<void, VoidhashError>>,
  ): Promise<Result<void, VoidhashError>> {
    const settled = run().finally(() => {
      if (Option.exists(this.transition, (current) => current.settled === settled)) {
        this.transition = Option.none();
      }
    });
    this.transition = Option.some({ settled, to });
    return settled;
  }

  /**
   * The client that took over this client's storage namespace while this one
   * is not running. Identity and purchase calls on a replaced instance go to
   * it: starting this instance again would end the live one. A live client of
   * another project is never a replacement: nothing made for one project is
   * handed to another.
   */
  private replacement(): Option.Option<VoidhashClient> {
    const starting = Option.exists(this.transition, (current) => current.to === "initialized");
    if (this._isInitialized || starting) return Option.none();
    return Option.filter(
      MutableHashMap.get(liveClients, this.slot),
      (owner) => owner !== this && owner.namespace === this.namespace,
    );
  }

  /**
   * Runs an identity change in call order. Events, screens and purchase
   * reports made after it wait until it switched the identity, which the
   * native client announces at once, before it waits for Voidhash. A change
   * that switches nothing lets them go on when it starts (an `identify()` of
   * `target`, already the identity) or when it settles.
   */
  private enqueueIdentityChange<T>(
    operation: () => Promise<Result<T, VoidhashError>>,
    target: Option.Option<string> = Option.none(),
  ): Promise<Result<T, VoidhashError>> {
    this.initialDistinctId = Option.none();
    this.identityChangesCalled += 1;
    const change = this.identityChangesCalled;
    const settled = this.enqueueInIdentityOrder(() => {
      this.identityChangeRunning = Option.some(change);
      const current = Option.flatMap(this.native, (native) => native.currentDistinctId());
      // With a consent the identify() may still grant, events wait for it to settle.
      if (
        Option.isSome(target) &&
        Option.contains(current, target.value) &&
        this.analyticsConsent === "granted"
      ) {
        this.identityChangeSwitched(change);
      }
      return operation();
    });
    const switched = () => {
      // An identity announced from here on is not this change's switch.
      if (Option.contains(this.identityChangeRunning, change)) {
        this.identityChangeRunning = Option.none();
      }
      this.identityChangeSwitched(change);
    };
    void settled.then(switched, switched);
    return settled;
  }

  /**
   * Identity change number `change` switched the identity, or will not: sends
   * the events and screens held for it and lets the purchase reports go on.
   * Changes run one at a time, so the ones before it have switched too.
   */
  private identityChangeSwitched(change: number) {
    if (change <= this.identityChangesSwitched) return;
    this.identityChangesSwitched = change;
    const isDue = (held: { readonly after: number }) => held.after <= change;
    const events = this.eventsHeldForIdentity.splice(
      0,
      this.eventsHeldForIdentity.filter(isDue).length,
    );
    events.forEach((event) => event.send());
    const reports = this.reportsHeldForIdentity.splice(
      0,
      this.reportsHeldForIdentity.filter(isDue).length,
    );
    reports.forEach((report) => report.proceed());
  }

  /** Whether an identity change called before now has not switched the identity yet. */
  private awaitsIdentityChange() {
    return this.identityChangesSwitched < this.identityChangesCalled;
  }

  /**
   * Keeps an event or a screen until the identity changes called before it
   * switched the identity, then calls `send` with the time it was captured
   * at. In memory, as the native client holds events before it starts: past
   * {@link MAX_EVENTS_HELD_FOR_IDENTITY} the oldest is dropped and reported.
   */
  private holdEventForIdentity(
    operation: "capture" | "screen",
    name: string,
    send: (capturedAt: number) => void,
  ) {
    // oxlint-disable-next-line effect/use-clock-service -- the time of the app's call, outside any Effect, as the native client stamps an event it is handed.
    const capturedAt = Date.now();
    this.eventsHeldForIdentity.push({
      after: this.identityChangesCalled,
      name,
      operation,
      // Whether it may be recorded is settled as it is sent: the consent may
      // have changed since, and an `identify()` can grant a pending one.
      send: () => {
        if (Option.isSome(this.analyticsIntake(operation, name))) send(capturedAt);
      },
    });
    if (this.eventsHeldForIdentity.length <= MAX_EVENTS_HELD_FOR_IDENTITY) return;
    Option.map(Option.fromUndefinedOr(this.eventsHeldForIdentity.shift()), (dropped) =>
      this.emitDiagnostic({
        code: "ANALYTICS_EVENT_DROPPED",
        kind: "eviction",
        message: `Dropped "${dropped.name}": more than ${MAX_EVENTS_HELD_FOR_IDENTITY} events were captured while identify(), reset() or signOut() was switching the identity`,
        operation: dropped.operation,
        retryable: false,
      }),
    );
  }

  /** Resolves once the identity changes called before now switched the identity. */
  private afterIdentityChanges(): Promise<void> {
    if (!this.awaitsIdentityChange()) return Promise.resolve();
    return new Promise((proceed) => {
      this.reportsHeldForIdentity.push({ after: this.identityChangesCalled, proceed });
    });
  }

  /**
   * Runs `operation` once `init()` has settled, after every identity change
   * and group call made before it.
   */
  private enqueueInIdentityOrder<T>(
    operation: () => Promise<Result<T, VoidhashError>>,
  ): Promise<Result<T, VoidhashError>> {
    const next = this.identityChangeTail.then(async () => {
      const initialized = await this.init();
      if (initialized.isErr()) return Result.err(initialized.error);
      return operation();
    });
    this.identityChangeTail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  /**
   * Starts the native client from local state: identity, caches and queues
   * are loaded without waiting for the network, and the refreshes, store
   * observation and delivery continue in the background. Resolves
   * immediately without touching the native client when the client was
   * created with `enabled: false`.
   *
   * An app launched in the background before the device has been unlocked
   * since it started (on Android, only an app with a `directBootAware`
   * component) cannot read anything the SDK stored, so this waits for that
   * first unlock; events captured meanwhile are kept.
   *
   * Idempotent: a call that overlaps a running `init()` joins it, and a call
   * on an initialized client resolves at once. A call made while `end()` is
   * still running waits for it and then starts the client again, unless
   * another client took over its storage meanwhile: then this one stays ended
   * and the call answers `VOIDHASH_CLIENT_NOT_INITIALIZED`.
   */
  async init(): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const pending = this.transition;
    if (Option.isSome(pending) && pending.value.to === "initialized") {
      return pending.value.settled;
    }
    if (Option.isNone(pending) && this._isInitialized) return Result.ok(undefined);
    return this.runTransition("initialized", async () => {
      if (Option.isSome(pending)) {
        await pending.value.settled;
        // A client that took the namespace over meanwhile has asked this one
        // to end, and waits for that. Starting here would in turn wait for
        // that client to end, so neither would ever finish.
        const takenOver = Option.exists(
          MutableHashMap.get(liveClients, this.slot),
          (owner) => owner !== this,
        );
        if (takenOver && Option.exists(this.transition, (current) => current.to === "ended")) {
          return Result.err(new NotInitializedError());
        }
      }
      return this.runInit();
    });
  }

  private async runInit(): Promise<Result<void, VoidhashError>> {
    await this.claimNamespace();
    const native = this.nativeClient();
    if (Option.isNone(native)) {
      this.releaseNamespace();
      return this.swallowed(
        "init",
        Result.err(
          new VoidhashError(
            "FAILED_TO_INITIALIZE_VOIDHASH_CLIENT",
            "FAILED_TO_INITIALIZE_VOIDHASH_CLIENT: the Voidhash native module is missing. Rebuild the app after installing @voidhash/react-native.",
          ),
        ),
      );
    }
    const started = await native.value.start(this.configuration());
    if (started.isErr()) {
      this.releaseNamespace();
      return this.swallowed("init", started);
    }
    this.initialDistinctId = Option.none();
    this.chosenAnalyticsConsent = Option.none();
    // A native client that cannot say leaves the consent this facade configured.
    this.analyticsConsent = Option.getOrElse(
      native.value.getAnalyticsConsent(),
      () => this.analyticsConsent,
    );
    this.ended = false;
    this._isInitialized = true;
    // Hooks that loaded for the previous run (an `end()` dropped what it loaded) load again.
    this.atomRegistry.update(clientRunAtom, (runs) => runs + 1);
    return Result.ok(undefined);
  }

  /**
   * Makes this client the owner of its storage namespace (of the process,
   * where it runs one native client), ending the client that owned it until
   * now. It is the owner before that client has ended, so identity and
   * purchase calls made on a replaced client of the same namespace meanwhile
   * already go to this one instead of starting the replaced one again.
   */
  private async claimNamespace(): Promise<void> {
    const owner = MutableHashMap.get(liveClients, this.slot);
    MutableHashMap.set(liveClients, this.slot, this);
    if (Option.isNone(owner) || owner.value === this) return;
    if (__DEV__) {
      // oxlint-disable-next-line effect/use-console-service -- development-only guidance for a misconfigured integration, outside any SDK runtime.
      console.warn(
        owner.value.namespace === this.namespace
          ? "[voidhash] A second client for the same publishable key and base URL replaced the first one. Create the client once, at module scope."
          : "[voidhash] A client for another publishable key or base URL ended the one that was running: Android runs one Voidhash client at a time.",
      );
    }
    await owner.value.end();
  }

  /** Gives up this client's storage namespace, if it still owns it. */
  private releaseNamespace() {
    if (Option.exists(MutableHashMap.get(liveClients, this.slot), (owner) => owner === this)) {
      MutableHashMap.remove(liveClients, this.slot);
    }
  }

  /**
   * Ends the client: flushes for at most about two seconds, persists what is
   * still queued and stops every observer, timer and listener. Whatever was
   * not delivered goes out after the next `init()`. An `init()` still running
   * is waited for first. The client stops being initialized as soon as the
   * teardown begins: reads answer `VOIDHASH_CLIENT_NOT_INITIALIZED` from then
   * on. Afterwards `capture()` drops events with a diagnostic and `init()`
   * starts the client again. Overlapping calls share one teardown. No-ops on
   * a disabled client.
   */
  async end(): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const pending = this.transition;
    if (Option.isSome(pending) && pending.value.to === "ended") return pending.value.settled;
    return this.runTransition("ended", async () => {
      if (Option.isSome(pending)) await pending.value.settled;
      const started = this.started();
      if (started.isErr()) {
        this.releaseNamespace();
        return Result.err(started.error);
      }
      // Events still waiting for an identity change were captured before this
      // call: the native client takes them now, under the identity in effect,
      // and its shutdown stores them with the rest.
      this.eventsHeldForIdentity.splice(0).forEach((event) => event.send());
      // Not initialized while the native client shuts down: it refuses calls
      // from here on, and an `init()` made meanwhile has to start it again.
      this._isInitialized = false;
      const shutdown = await started.value.shutdown().finally(() => {
        // Torn down whatever the native client answered: a client left
        // half-running would keep owning its storage namespace.
        this.ended = true;
        this.releaseNamespace();
      });
      return shutdown.map(() => undefined);
    });
  }

  /** Whether the client is initialized. Always false while the client is disabled. */
  get isInitialized() {
    return this._isInitialized;
  }

  /** Whether this client does anything at all, fixed at construction by the `enabled` option. */
  get isEnabled() {
    return this.setup.enabled;
  }

  /** Whether the SDK currently runs in observer ("read-only") mode. */
  get isReadOnly() {
    return this.readOnly;
  }

  /**
   * Switches observer mode at runtime, so an app migrating onto Voidhash can
   * flip from watching another SDK's purchases to owning them without
   * recreating the client. A purchase that already started keeps the mode it
   * started with. No-ops in effect on a disabled client.
   */
  setReadOnly(readOnly: boolean) {
    this.readOnly = readOnly;
    Option.map(this.native, (native) => native.setReadOnly(readOnly));
  }

  /**
   * The end user's analytics consent in effect: the last
   * {@link setAnalyticsConsent} value, else (once `init()` has read it) the
   * stored one, else the `analyticsConsent` option.
   */
  getAnalyticsConsent(): AnalyticsConsent {
    return this.analyticsConsent;
  }

  /**
   * Records whether the end user consents to usage analytics. Takes effect
   * immediately and is stored on the device, where it takes precedence over
   * the `analyticsConsent` option on later launches; `reset()` and
   * `signOut()` keep it.
   *
   * `"denied"` and `"pending"` stop all analytics: events, screens, lifecycle
   * and install events and paywall impressions are dropped, and every event
   * still queued on the device is discarded together with the analytics
   * session. Purchases, restores, entitlements, `identify()`, person
   * attributes, groups, feature flags and paywalls are unaffected. `"granted"`
   * resumes analytics for what is captured from then on.
   *
   * Called before `init()` the consent applies at once and is stored when
   * `init()` runs. An `Err` with `FAILED_TO_SET_ANALYTICS_CONSENT` means the
   * consent applies to this process but could not be stored; an invalid value
   * is an `INVALID_ARGUMENT` error and changes nothing.
   */
  async setAnalyticsConsent(consent: AnalyticsConsent): Promise<Result<void, VoidhashError>> {
    if (!isAnalyticsConsent(consent)) {
      return Result.err(
        new InvalidArgumentError(
          `setAnalyticsConsent() needs "granted", "denied" or "pending", got ${String(consent)}`,
        ),
      );
    }
    this.analyticsConsent = consent;
    if (consent === "granted") this.analyticsConsentDeniedReported = false;
    if (!this.setup.enabled) return Result.ok(undefined);
    if (Option.isSome(this.transition)) await this.transition.value.settled;
    const started = this.started();
    if (started.isErr()) {
      // Stored by the next start, and told to a native client that already
      // holds events captured before it, so a consent other than granted
      // discards them.
      this.chosenAnalyticsConsent = Option.some(consent);
      await Option.match(this.native, {
        onNone: () => Promise.resolve(),
        onSome: (native) => native.setAnalyticsConsent(consent),
      });
      return Result.ok(undefined);
    }
    const stored = await started.value.setAnalyticsConsent(consent);
    if (stored.isErr()) return Result.err(stored.error);
    return stored.value
      ? Result.ok(undefined)
      : Result.err(
          new VoidhashError(
            "FAILED_TO_SET_ANALYTICS_CONSENT",
            "FAILED_TO_SET_ANALYTICS_CONSENT: the consent applies now but could not be stored on the device",
          ),
        );
  }

  /**
   * Returns the current person snapshot together with how much to trust it.
   * The answer comes from cache whenever one exists — a stale entry is served
   * while a refresh runs behind the read — so this never waits long on the
   * network and never fails because the server is unreachable. Pass
   * `{ forceFetch: true }` to prefer the server. Answers an empty snapshot
   * while disabled.
   */
  async getCurrentPerson(
    options: { forceFetch?: boolean } = {},
  ): Promise<Result<CurrentPersonResult, VoidhashError>> {
    if (!this.setup.enabled) {
      return Result.ok({ isExpired: false, isStale: false, person: null, reason: "no-cache" });
    }
    const started = this.started();
    if (started.isErr()) return Result.err(started.error);
    return started.value.getCurrentPerson(options);
  }

  /**
   * Checks whether the current person holds an active grant for a perk.
   *
   * Cache-first: a fresh snapshot answers immediately, a stale one is served
   * while a refresh runs behind the read, and an entitlement granted before
   * the device went offline keeps answering `true`. The result always says how
   * fresh it is (`isStale`, `isExpired`, `reason`) — it never fails because
   * the server is unreachable. Pass `{ forceFetch: true }` to prefer the
   * server.
   */
  async hasPerk(
    perkSlug: PerkSlug,
    options: {
      /**
       * @deprecated No longer read. A stale answer beats no answer, so the
       * cached grant is always served. Branch on `isStale`/`isExpired` in the
       * result instead. Removed in a future release.
       */
      allowStale?: boolean;
      /** Prefer the server, waiting for it before answering. */
      forceFetch?: boolean;
    } = {},
  ): Promise<Result<HasPerkResult, VoidhashError>> {
    if (!this.setup.enabled) {
      return Result.ok({
        hasAccess: false,
        isExpired: false,
        isStale: false,
        reason: "no-cache",
      });
    }
    const started = this.started();
    if (started.isErr()) return Result.err(started.error);
    return started.value.hasPerk(perkSlug, { forceFetch: options.forceFetch });
  }

  /**
   * Sets person attributes without waiting on the network. Reserved
   * `email`/`name` keys map to the dedicated server fields (strings); any
   * other key is a custom trait whose value must be a string, a number, a
   * boolean or `null`. Anything else is an `INVALID_ARGUMENT` error and
   * nothing is written. The update is stored on the device and sent right
   * away, then retried until the server applies it; `flush()` waits for it.
   * Attributes are written whatever the analytics consent, except that the
   * native SDK leaves `$ad_data_sharing` set to anything but `false` out until
   * it is granted: see {@link setAdDataSharing}.
   *
   * Like identity calls, it waits for initialization and runs in call order
   * with `identify()`, `reset()` and `signOut()`, so the attributes belong to
   * the person identified when this was called. Called right after an
   * `identify()` that wasn't awaited, it resolves once that identify settles.
   */
  async setPersonAttributes(attributes: PersonAttributes): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const invalid = invalidPersonAttributes(attributes);
    if (Option.isSome(invalid)) return Result.err(invalid.value);
    const replacement = this.replacement();
    if (Option.isSome(replacement)) return replacement.value.setPersonAttributes(attributes);
    return this.enqueueInIdentityOrder(async () => {
      const started = this.started();
      if (started.isErr()) return this.swallowed("setPersonAttributes", Result.err(started.error));
      return this.swallowed(
        "setPersonAttributes",
        await started.value.setPersonAttributes(attributes),
      );
    });
  }

  /**
   * Records whether the end user agreed to you sharing their purchases with ad
   * platforms, as the person trait `$ad_data_sharing`. Voidhash sends a
   * person's purchases to a Conversions API you turned on only when it is
   * `true`.
   *
   * `true` needs analytics consent: it does nothing while that is not
   * granted. Once written, it also drops a revocation
   * still queued for the person. `false` is a revocation, which analytics
   * consent neither blocks nor discards: the native SDK stores it on the device
   * and retries it until Voidhash has written it, or for 48 hours while Voidhash
   * has no such person, and it records no analytics. When someone rejects
   * everything, call it next to `setAnalyticsConsent("denied")`. Withdrawing
   * analytics consent does not take this back by itself.
   *
   * Waits for initialization and runs in call order with identity changes, as
   * {@link setPersonAttributes} does.
   */
  async setAdDataSharing(granted: boolean): Promise<Result<void, VoidhashError>> {
    return this.setPersonAttributes({ $ad_data_sharing: granted === true });
  }

  /**
   * Sets person attributes and reports whether the server confirmed them.
   * When the server cannot confirm the update now (it is unreachable, the key
   * was rejected, or an earlier write for this person is still queued) the
   * update is queued and the result is `deferred` with the last known
   * snapshot, rather than an error. Values, ordering and observer mode follow
   * {@link setPersonAttributes}: attributes are written whatever the analytics
   * consent and whether or not the client is read-only. The result is
   * `skipped` only when the one attribute was an agreement to ad data sharing
   * made without analytics consent: see {@link setAdDataSharing}.
   */
  async setPersonAttributesSync(
    attributes: PersonAttributes,
  ): Promise<Result<SetPersonAttributesResult, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok({ person: null, status: "disabled" });
    const invalid = invalidPersonAttributes(attributes);
    if (Option.isSome(invalid)) return Result.err(invalid.value);
    const replacement = this.replacement();
    if (Option.isSome(replacement)) return replacement.value.setPersonAttributesSync(attributes);
    return this.enqueueInIdentityOrder(async () => {
      const started = this.started();
      if (started.isErr()) return Result.err(started.error);
      return started.value.setPersonAttributesSync(attributes);
    });
  }

  /**
   * Returns the active analytics session id, or `undefined` before `init()`,
   * while disabled, or once the session has been idle past the inactivity
   * timeout. Reading does not extend the session.
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK method consumed by non-Effect app code; `undefined` is the documented "no active session" answer and mirrors the iOS and Android SDKs.
  getSessionId(): string | undefined {
    const started = this.started();
    return this.setup.enabled && started.isOk() ? started.value.getSessionId() : undefined;
  }

  /** Returns the current distinct id, or `Ok(null)` while disabled. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK method consumed by non-Effect app code; `null` is the documented answer of a disabled client.
  async getDistinctId(): Promise<Result<string | null, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(null);
    const started = this.started();
    if (started.isErr()) return Result.err(started.error);
    return started.value.getDistinctId();
  }

  /**
   * Identifies the user by switching the current distinct id. The switch
   * happens locally first, and the link from the previous (anonymous)
   * identity is stored on the device before it is sent; when the server
   * cannot confirm it now, the link is retried until it lands rather than
   * failing, and an anonymous purchaser keeps their cached access meanwhile.
   * Use {@link identifySync} to learn which of the two happened. Identity
   * calls wait for initialization and run in invocation order. Repeating the
   * same ID without profile changes preserves the session and cached state.
   * A blank ID is an `INVALID_ARGUMENT` error and leaves the identity alone.
   */
  async identify(
    externalUserId: string,
    options: { email?: string; name?: string } = {},
  ): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    if (!isNonBlankString(externalUserId)) {
      return Result.err(new InvalidArgumentError("identify() needs a non-blank distinct id"));
    }
    const replacement = this.replacement();
    if (Option.isSome(replacement)) return replacement.value.identify(externalUserId, options);
    return this.enqueueIdentityChange(async () => {
      const started = this.started();
      if (started.isErr()) return Result.err(started.error);
      return this.swallowed("identify", await started.value.identify(externalUserId, options));
    }, Option.some(externalUserId));
  }

  /**
   * Identifies the user and reports whether the server confirmed the switch
   * (`confirmed`, with the person) or the device switched locally and queued
   * the link for later delivery (`deferred`, with the last known snapshot
   * for that identity, if any). Only a verdict the Voidhash API will not
   * change — which also restores the previous identity — or a blank ID
   * (`INVALID_ARGUMENT`) is an `Err`.
   */
  async identifySync(
    externalUserId: string,
    options: { email?: string; name?: string } = {},
  ): Promise<Result<IdentifyResult, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok({ person: null, status: "disabled" });
    if (!isNonBlankString(externalUserId)) {
      return Result.err(new InvalidArgumentError("identifySync() needs a non-blank distinct id"));
    }
    const replacement = this.replacement();
    if (Option.isSome(replacement)) {
      return replacement.value.identifySync(externalUserId, options);
    }
    return this.enqueueIdentityChange(async () => {
      const started = this.started();
      if (started.isErr()) return Result.err(started.error);
      return started.value.identifySync(externalUserId, options);
    }, Option.some(externalUserId));
  }

  /**
   * Starts a fresh visitor: a new anonymous distinct id and analytics session,
   * with no groups. When someone is signed in this is exactly `signOut()`;
   * when nobody is, `signOut()` does nothing and this still starts over, with
   * no event recorded. Use it for a shared device, or a guest starting over.
   */
  async reset(): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const replacement = this.replacement();
    if (Option.isSome(replacement)) return replacement.value.reset();
    return this.enqueueIdentityChange(async () => {
      const started = this.started();
      if (started.isErr()) return Result.err(started.error);
      return this.swallowed("reset", await started.value.reset());
    });
  }

  /**
   * Signs the current user out: captures the built-in `$sign_out` event
   * (unless automatic lifecycle events are off or analytics consent is not
   * granted), flushes it under the signing-out identity, then resets to a
   * fresh anonymous distinct id and starts a new analytics session. Does
   * nothing when nobody is signed in, so it is safe to call whenever the app
   * finds no session; `reset()` is the call for a fresh anonymous visitor.
   */
  async signOut(): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const replacement = this.replacement();
    if (Option.isSome(replacement)) return replacement.value.signOut();
    return this.enqueueIdentityChange(async () => {
      const started = this.started();
      if (started.isErr()) return Result.err(started.error);
      return this.swallowed("signOut", await started.value.signOut());
    });
  }

  /**
   * Puts the end user in a group, such as the company or workspace they use
   * your app as part of. Every event captured after the returned promise
   * resolves carries it in `$groups`, until `resetGroups()`, `reset()` or
   * `signOut()`; the native SDK stores it on the device with the distinct id,
   * one group per type.
   *
   * `properties` set the group's own properties, such as its `name` and
   * `plan`: strings, numbers or booleans. They are sent as a `$groupidentify`
   * event when given, or when the end user's group of that type changed.
   * Groups and their properties are sent whatever the analytics consent;
   * without it the `$groupidentify` goes out at once, on its own, and is not
   * retried if it fails.
   *
   * A group type is a lower-case letter followed by up to 63 lower-case
   * letters, digits or underscores, such as `company`, and a key has 1 to 256
   * characters; a number is kept as text. Any other is an `INVALID_ARGUMENT`
   * error. `null` properties count as none. Like identity calls, it waits for initialization and runs in call
   * order with `identify()`, `reset()` and `signOut()`.
   */
  async group(
    groupType: string,
    groupKey: string | number,
    // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK input from non-Effect app code, where a group without properties is naturally passed as null.
    properties?: GroupProperties | null,
  ): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const key = String(groupKey);
    const replacement = this.replacement();
    if (Option.isSome(replacement)) return replacement.value.group(groupType, key, properties);
    return this.enqueueInIdentityOrder(async () => {
      const started = this.started();
      if (started.isErr()) return Result.err(started.error);
      return this.swallowed(
        "group",
        await started.value.group(groupType, key, Option.fromNullishOr(properties)),
      );
    });
  }

  /**
   * Replaces every group the end user is in, in one call: the groups to be in
   * by type, each an id or `{ id, ...properties }`. A type left out, or given
   * as `null` or `undefined`, is dropped. Safe to call whenever the groups
   * might have changed: a `$groupidentify` is sent only for a group whose id
   * or properties differ from what was last sent, so repeating a call sends
   * nothing. An empty object behaves like `resetGroups()`.
   *
   * An id is a string or a finite number. A group given with any other id, or
   * with none, is an `INVALID_ARGUMENT` error for the whole call, and nothing
   * changes. Types and ids otherwise follow the rules of `group()`: a group
   * whose type or id those refuse is left out. Runs in call order with `identify()`, `reset()` and `signOut()`.
   */
  async setGroups(groups: Groups): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const replacement = this.replacement();
    if (Option.isSome(replacement)) return replacement.value.setGroups(groups);
    const invalid = invalidGroups(groups);
    if (Option.isSome(invalid)) return Result.err(invalid.value);
    return this.enqueueInIdentityOrder(async () => {
      const started = this.started();
      if (started.isErr()) return Result.err(started.error);
      return this.swallowed("setGroups", await started.value.setGroups(groups));
    });
  }

  /** Takes the end user out of every group; later events carry no `$groups`. */
  async resetGroups(): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const replacement = this.replacement();
    if (Option.isSome(replacement)) return replacement.value.resetGroups();
    return this.enqueueInIdentityOrder(async () => {
      const started = this.started();
      if (started.isErr()) return Result.err(started.error);
      return this.swallowed("resetGroups", await started.value.resetGroups());
    });
  }

  /**
   * The groups the end user belongs to, by group type, as `group()` set them:
   * `{}` before `init()` resolves, while disabled, and when they belong to none.
   */
  getGroups(): Readonly<Record<string, string>> {
    const started = this.started();
    return this.setup.enabled && started.isOk() ? started.value.getGroups() : {};
  }

  /**
   * Evaluates feature flags for the current person, cache-first: `flagKeys`
   * (every flag when omitted), each with its enabled state, variant key
   * (`null` without a variant) and payload. Returns no flags while disabled.
   */
  async getFeatureFlags(
    flagKeys?: ReadonlyArray<FeatureFlagKey>,
  ): Promise<Result<FeatureFlagsResult, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(DISABLED_FEATURE_FLAGS);
    const started = this.started();
    if (started.isErr()) return Result.err(started.error);
    return started.value.getFeatureFlags(flagKeys);
  }

  /**
   * The value of the variant flag `key` selected for the current person: the
   * variant's value when the flag is enabled and evaluated, `null` when it is
   * off, has no variant (or one whose value is not text), is unknown, or was
   * not evaluated within `featureFlags.maxWaitMs`. Evaluates `key`
   * cache-first, as `getFeatureFlags([key])` does. Answers `Ok(null)` while
   * disabled. Typed by the variant values `voidhash.gen.d.ts` lists for the
   * flag; a variant added since generation is not in that union.
   */
  async getVariantValue<K extends FeatureFlagKey>(
    key: K,
    // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK method consumed by non-Effect app code; `null` is the documented "no variant" answer.
  ): Promise<Result<FeatureFlagValue<K> | null, VoidhashError>> {
    const evaluation = await this.getFeatureFlags([key]);
    return evaluation.map(({ flags }) => {
      const flag = flags.find((candidate) => candidate.key === key);
      return flag?.enabled === true && P.isString(flag.payload) ? flag.payload : null;
    });
  }

  /**
   * Resolves the currently assigned paywall showing for a location slug.
   * Answers `Ok(null)` while disabled.
   */
  async getPaywallForLocation(
    locationSlug: LocationSlug,
  ): Promise<Result<ResolvedPaywall, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(null);
    const started = this.started();
    if (started.isErr()) return Result.err(started.error);
    return started.value.getPaywallForLocation(String(locationSlug));
  }

  /**
   * The products the store sells this end user, sorted by slug, with the
   * offers they can buy them with. With `slugs`, the products those slugs
   * name, in that order: `undefined` where the store has none, which the
   * `onDiagnostic` handler hears about as `PRODUCT_NOT_FOUND`. With the types
   * `voidhash-cli types generate` writes, each is typed by its slug, so a
   * subscription's slug is a `SubscriptionProduct`.
   *
   * One load serves every caller and every `useProducts()`; it runs again
   * after an identity change, a completed purchase or new product
   * definitions. Answers no products while disabled.
   */
  getProducts(): Promise<Result<ReadonlyArray<Product>, VoidhashError>>;
  getProducts<const Slugs extends ReadonlyArray<ProductSlug>>(
    slugs: Slugs,
  ): Promise<Result<ProductsForSlugs<Slugs>, VoidhashError>>;
  async getProducts(
    slugs?: ReadonlyArray<ProductSlug>,
    // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK answer consumed by non-Effect app code.
  ): Promise<Result<ReadonlyArray<Product | undefined>, VoidhashError>> {
    if (!this.setup.enabled) {
      return Result.ok(slugs === undefined ? [] : slugs.map(() => undefined));
    }
    const started = this.started();
    if (started.isErr()) return Result.err(started.error);
    return (await started.value.loadProducts()).map((products) =>
      slugs === undefined
        ? products
        : slugs.map((slug) => products.find((product) => product.slug === slug)),
    );
  }

  /**
   * Buys a product from `getProducts()` or `useProducts()`. By default a
   * subscription comes with the free trial or introductory price the end
   * user is eligible for; `options.offer` picks another offer or the regular
   * price. Resolves to a `Result`: `purchased`, `pending` and `cancelled` are
   * outcomes, every failure is an `Err` carrying a coded
   * {@link VoidhashError}. Answers `Ok({ status: "disabled" })` while
   * disabled.
   *
   * Waits for `init()`. One purchase runs at a time: another started while
   * it runs fails with `PURCHASE_IN_PROGRESS` and buys nothing. Blocked in
   * observer mode; the mode in effect when the purchase starts decides, so a
   * `setReadOnly()` landing later doesn't abandon it. Options no store could
   * honour are an `INVALID_ARGUMENT` error, and nothing is bought.
   */
  async purchase(
    product: Product,
    options: PurchaseOptions = {},
  ): Promise<Result<PurchaseResult, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok({ status: "disabled" });
    const slug: unknown = P.hasProperty(product, "slug") ? product.slug : undefined;
    if (!isNonBlankString(slug)) {
      return Result.err(
        new InvalidArgumentError("purchase() needs a product from getProducts() or useProducts()"),
      );
    }
    const nativeOptions = toNativePurchaseOptions(product, options);
    if (EffectResult.isFailure(nativeOptions)) return Result.err(nativeOptions.failure);
    const replacement = this.replacement();
    if (Option.isSome(replacement)) return replacement.value.purchase(product, options);
    if (Option.isSome(this.purchaseInFlight)) return Result.err(new PurchaseInProgressError());
    const purchased = (async (): Promise<Result<PurchaseResult, VoidhashError>> => {
      const initialized = await this.whenInitialized();
      if (initialized.isErr()) return Result.err(initialized.error);
      if (this.readOnly) return Result.err(new ReadOnlyModePurchaseNotAllowedError());
      return initialized.value.purchase(slug, nativeOptions.success);
    })().finally(() => {
      this.purchaseInFlight = Option.none();
    });
    this.purchaseInFlight = Option.some(purchased);
    return purchased;
  }

  /**
   * Revalidates restorable purchases for the user who requested the restore,
   * and answers the refreshed person, `null` when there is none, so a
   * "nothing to restore" needs no second read: check the person's
   * entitlements. Call from a user action: iOS may prompt for App Store
   * authentication. Known consumables are excluded. Waits for `init()`;
   * answers `Ok(null)` while disabled.
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK answer consumed by non-Effect app code.
  async restorePurchases(): Promise<Result<Person | null, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(null);
    const replacement = this.replacement();
    if (Option.isSome(replacement)) return replacement.value.restorePurchases();
    const initialized = await this.whenInitialized();
    if (initialized.isErr()) return Result.err(initialized.error);
    const restored = await initialized.value.restorePurchases();
    return restored.isOk()
      ? restored
      : this.swallowed("restorePurchases", Result.err(restored.error)).map(() => null);
  }

  /**
   * Calls `listener` with each purchase that completes outside `purchase()`:
   * an approved Ask to Buy, a pending payment that went through, a redeemed
   * offer code, a promoted purchase, and on iOS a renewal seen on the device
   * (`transaction.isRenewal`; Google Play does not report renewals to the
   * device). A purchase or restore made in a flow is not one: `presentFlow()`
   * answers it. It is called once the SDK handled the purchase; `synced`
   * says whether Voidhash already accepted it. A signal for the UI, not a
   * delivery guarantee: access always comes from the person's entitlements,
   * which hooks re-render with. Returns the function that removes the
   * listener. Never called while disabled.
   */
  addTransactionListener(listener: (update: TransactionUpdate) => void): () => void {
    const entry = (update: TransactionUpdate) => listener(update);
    MutableHashSet.add(this.transactionListeners, entry);
    return () => {
      MutableHashSet.remove(this.transactionListeners, entry);
    };
  }

  /**
   * Opens the store's subscription management: the App Store's sheet (for
   * `product`'s subscription group, on iOS 17 and later) or Google Play's
   * subscriptions page (for `product`, when given). No-op while disabled.
   */
  async showManageSubscriptions(product?: Product): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const started = this.started();
    if (started.isErr()) return Result.err(started.error);
    return this.swallowed(
      "showManageSubscriptions",
      await started.value.showManageSubscriptions(product?.slug),
    );
  }

  /**
   * Lets the end user redeem an offer code: Apple's redemption sheet (where
   * they type the code; `code` is ignored), or Google Play's redeem page
   * filled in with `code`. A redeemed code arrives as a transaction update.
   * No-op while disabled.
   */
  async presentCodeRedemption(code?: string): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const started = this.started();
    if (started.isErr()) return Result.err(started.error);
    return this.swallowed("presentCodeRedemption", await started.value.presentCodeRedemption(code));
  }

  /**
   * The storefront the end user buys from: its ISO 3166-1 alpha-2 country,
   * and currency where the store says. `undefined` when the store has none to
   * give, and while disabled.
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK answer consumed by non-Effect app code.
  async getStorefront(): Promise<Result<Storefront | undefined, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const started = this.started();
    if (started.isErr()) return Result.err(started.error);
    return started.value.getStorefront();
  }

  /**
   * Whether this device can make purchases: payments are not restricted (App
   * Store) and billing is available (Google Play). `false` while disabled.
   */
  async canMakePayments(): Promise<Result<boolean, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(false);
    const started = this.started();
    if (started.isErr()) return Result.err(started.error);
    return started.value.canMakePayments();
  }

  /**
   * Hands a purchase intent to the listeners, or holds it for the first one
   * while there is none: the native client sends intents from `init()` on,
   * possibly before the app added its listener.
   */
  private receivePurchaseIntent(intent: AppStorePurchaseIntent) {
    if (MutableHashSet.size(this.purchaseIntentListeners) > 0) {
      this.notify("appStore.addPurchaseIntentListener", this.purchaseIntentListeners, intent);
      return;
    }
    this.heldPurchaseIntents.push(intent);
    if (this.heldPurchaseIntents.length <= MAX_HELD_PURCHASE_INTENTS) return;
    const dropped = this.heldPurchaseIntents.shift();
    this.emitDiagnostic({
      code: "PURCHASE_INTENT_DROPPED",
      kind: "eviction",
      message: `Dropped the purchase intent for "${dropped?.productSlug}": ${MAX_HELD_PURCHASE_INTENTS} are held until a listener is added`,
      operation: "appStore.addPurchaseIntentListener",
      retryable: false,
    });
  }

  /** App Store actions; see {@link AppStoreActions}. */
  readonly appStore: AppStoreActions = {
    addPurchaseIntentListener: (listener) => {
      const entry = (intent: AppStorePurchaseIntent) => listener(intent);
      MutableHashSet.add(this.purchaseIntentListeners, entry);
      const held = this.heldPurchaseIntents.splice(0);
      held.forEach((intent) => this.notify("appStore.addPurchaseIntentListener", [entry], intent));
      return () => {
        MutableHashSet.remove(this.purchaseIntentListeners, entry);
      };
    },
    appTransaction: () =>
      this.storeAction(
        "appStore",
        "appTransaction",
        () => Result.err(new NotInitializedError()),
        (native) => native.appStoreAppTransaction(),
      ),
    beginRefundRequest: (transactionId) =>
      this.storeAction(
        "appStore",
        "beginRefundRequest",
        () => Result.err(new NotInitializedError()),
        (native) => native.appStoreBeginRefundRequest(transactionId),
      ),
    currentEntitlements: () =>
      this.storeAction(
        "appStore",
        "currentEntitlements",
        () => Result.ok([]),
        (native) => native.appStoreCurrentEntitlements(),
      ),
    subscriptionStatus: (groupId) =>
      this.storeAction(
        "appStore",
        "subscriptionStatus",
        () => Result.ok([]),
        (native) => native.appStoreSubscriptionStatus(groupId),
      ),
  };

  /** Google Play actions; see {@link GooglePlayActions}. */
  readonly googlePlay: GooglePlayActions = {
    isFeatureSupported: (feature) =>
      this.storeAction(
        "googlePlay",
        "isFeatureSupported",
        () => Result.ok(false),
        (native) => native.googlePlayIsFeatureSupported(feature),
      ),
    queryPurchases: (options = {}) =>
      this.storeAction(
        "googlePlay",
        "queryPurchases",
        () => Result.ok([]),
        (native) => native.googlePlayQueryPurchases(options.includeSuspended ?? true),
      ),
    showInAppMessages: () =>
      this.storeAction(
        "googlePlay",
        "showInAppMessages",
        () => Result.ok({ status: "noActionNeeded" }),
        (native) => native.googlePlayShowInAppMessages(),
      ),
  };

  /**
   * Runs an action of one store: `UNSUPPORTED_PLATFORM` on the other
   * platform, `whileDisabled` on a disabled client, and
   * `VOIDHASH_CLIENT_NOT_INITIALIZED` before `init()`.
   */
  private async storeAction<A>(
    store: "appStore" | "googlePlay",
    operation: string,
    whileDisabled: () => Result<A, VoidhashError>,
    run: (native: NativeClientAdapter) => Promise<Result<A, VoidhashError>>,
  ): Promise<Result<A, VoidhashError>> {
    const platform = store === "appStore" ? "ios" : "android";
    if (this.setup.platform !== platform) {
      return Result.err(
        new UnsupportedPlatformError(
          this.setup.platform,
          `${store}.${operation}() is available on ${store === "appStore" ? "iOS" : "Android"} only`,
        ),
      );
    }
    if (!this.setup.enabled) return whileDisabled();
    const started = this.started();
    if (started.isErr()) return Result.err(started.error);
    return run(started.value);
  }

  /** Calls every listener with `value`; one that throws is reported and the others still run. */
  private notify<A>(operation: string, listeners: Iterable<(value: A) => void>, value: A) {
    Array.from(listeners).forEach((listener) => {
      // oxlint-disable-next-line effect/avoid-try-catch -- boundary with host application code: the listener is a plain function the app supplies and may throw anything.
      try {
        listener(value);
      } catch (error) {
        this.reportHostCallbackFailure(operation, error);
      }
    });
  }

  /**
   * Presents the flow assigned to a location and resolves once it ends, with
   * its `outcome` (`purchased`, `restored`, `dismissed`, or the outcome the
   * flow finished with), its `output` and the `productId` of a purchase.
   *
   * `options.input` are the flow's inputs and `options.actions` a handler per
   * app action the flow can call; a handler that throws or rejects makes the
   * flow run that action's failure path. `options.revision` is the interface
   * revision the app was built against, by default the one the
   * `flowRevisions` option sets for the location.
   *
   * Rejects with a {@link VoidhashError} when the flow cannot be shown; its
   * `code` says why (`FLOW_NOT_ASSIGNED`, `FLOW_UNAVAILABLE`,
   * `FLOW_RENDERER_MISSING`, …).
   *
   * The location's assignment is served from cache when the server cannot be
   * reached. Purchases started from the flow go through the SDK's purchase
   * path, so observer mode blocks them and the flow shows the failure. A flow
   * already on screen is closed first and resolves as `dismissed`.
   */
  presentFlow<const L extends LocationSlug>(
    location: L,
    ...args: PresentFlowArguments<L>
  ): Promise<FlowResult<L>>;
  async presentFlow(location: string, options?: PresentFlowOptions): Promise<FlowResult> {
    if (!this.setup.enabled) throw flowError("FLOW_DISABLED", "Voidhash is disabled");
    const replacement = this.replacement();
    if (Option.isSome(replacement)) return replacement.value.presentFlow(location, options);
    const initialized = await this.whenInitialized();
    if (initialized.isErr()) throw flowError("FLOW_UNAVAILABLE", initialized.error.message);
    return initialized.value.presentFlow(location, options);
  }

  /**
   * Changes inputs of the flow on screen; inputs that are not named keep
   * their values. No-op when no flow is shown and while disabled.
   */
  updateFlowInput<L extends string = string>(values: Partial<FlowInput<L>>): Promise<void>;
  async updateFlowInput(values: FlowValues): Promise<void> {
    const started = this.started();
    if (!this.setup.enabled || started.isErr()) return;
    await started.value.updateFlowInput(values);
  }

  /**
   * Closes the flow on screen, if any; its `presentFlow()` resolves as
   * `dismissed`. No-op while disabled.
   */
  async dismissFlow(): Promise<void> {
    const started = this.started();
    if (!this.setup.enabled || started.isErr()) return;
    await started.value.dismissFlow();
  }

  /**
   * Reports a purchase your own billing integration completed: its Apple
   * transaction (ID or JWS) or its Google Play token. Other purchase metadata
   * is optional and discarded. On iOS, a JWS is sent as the device's proof of
   * the purchase; with an ID only, the native SDK reads the JWS from the
   * device's purchase history.
   *
   * The report is a purchase the user just made: it goes to the current
   * user, even when an earlier purchase of the Apple Account or Google account
   * belongs to another user. Voidhash moves a purchase only when the store
   * shows it was made in the last 24 hours, and on iOS only with the JWS;
   * otherwise it is recorded for its current owner. A purchase is claimed
   * once from a device: reporting it again, also after another user signed
   * in, cannot move it.
   *
   * A report made after an `identify()`, `reset()` or `signOut()` that was
   * not awaited goes to the user that call switches to: it waits until the
   * device has switched, not for Voidhash to answer.
   *
   * Does not query, finish, acknowledge or consume the purchase. Pending
   * Android purchases are ignored; report them again when purchased.
   * Delivery failures remain queued for retry, so success does not imply
   * server acceptance.
   */
  async reportTransaction(
    transaction: StoreTransaction,
    options?: {
      /**
       * Reports a transaction your own restore flow returned after the user
       * asked to restore purchases. It is sent as an explicit restore, like
       * `restorePurchases()`, even when Voidhash accepted it before, and
       * keeps that intent across retries and relaunches: the project's paid
       * access sharing setting then decides whether a purchase another user
       * has is shared, moved or kept.
       */
      readonly isRestore?: boolean;
    },
  ): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const replacement = this.replacement();
    if (Option.isSome(replacement)) {
      return replacement.value.reportTransaction(transaction, options);
    }
    const report = EffectResult.try({
      catch: (error) =>
        new VoidhashError(
          "FAILED_TO_REPORT_TRANSACTION",
          `FAILED_TO_REPORT_TRANSACTION: ${P.isError(error) ? error.message : String(error)}`,
          { cause: error },
        ),
      try: () => toNativeReport(fromReportedTransaction(transaction)),
    });
    if (EffectResult.isFailure(report)) {
      return this.swallowed("reportTransaction", Result.err(report.failure));
    }
    await this.afterIdentityChanges();
    const initialized = await this.whenInitialized();
    if (initialized.isErr()) return Result.err(initialized.error);
    return this.swallowed(
      "reportTransaction",
      await initialized.value.reportTransaction(report.success, options?.isRestore === true),
    );
  }

  /**
   * Reports pending purchases and current store entitlements to Voidhash.
   * Recovery fallback when a host callback exposes no transaction values. Prefer
   * reportTransaction for purchase results, especially consumables already finalized.
   * In observer mode transactions are never finished. Delivery failures stay
   * queued and emit diagnostics; success does not imply server acceptance.
   */
  async syncPurchases(): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const replacement = this.replacement();
    if (Option.isSome(replacement)) return replacement.value.syncPurchases();
    await this.afterIdentityChanges();
    const initialized = await this.whenInitialized();
    if (initialized.isErr()) return Result.err(initialized.error);
    return this.swallowed("syncPurchases", await initialized.value.syncPurchases());
  }

  /**
   * Captures a product analytics event.
   * Events are batched and delivered on size/time thresholds. Dropped — not
   * buffered — while disabled or while analytics consent is not granted
   * (unless `analyticsWhilePending` holds them for a pending one).
   * Events captured before `init()` resolves are kept and sent once it has,
   * provided the analytics consent `init()` settles on (the one chosen with
   * `setAnalyticsConsent()`, else the stored one, else the option) is
   * `"granted"`; a consent other than `"granted"` chosen meanwhile discards them.
   *
   * An event captured after an `identify()`, `reset()` or `signOut()` that
   * was not awaited is recorded for the person that call switches to: it
   * waits, in memory, until the device has switched, not for Voidhash to
   * answer, and keeps the time it was captured at. That is a moment after
   * `identify()`, and up to about two seconds after a `signOut()` or
   * `reset()` of a signed-in user, whose last events are sent first. An
   * identity call runs after the identity, group and person calls made
   * before it have settled, so behind several of those the wait is as long
   * as they take, which on a slow network is seconds each. Past 100 events
   * waiting, the oldest is dropped and reported as `ANALYTICS_EVENT_DROPPED`;
   * `end()` hands the waiting ones over as they are.
   *
   * Property values are copied as the event is captured, into what JSON can
   * hold: a `bigint` is sent as its decimal string, a `Date` as its ISO
   * string, a non-finite number as `null`, and functions, symbols,
   * `undefined` and circular references are left out. An event whose
   * properties cannot be copied at all (more than 10,000 values, or a getter
   * that throws) is dropped and reported as `ANALYTICS_EVENT_DROPPED`. Never
   * throws.
   */
  capture(eventName: string, properties: Record<string, unknown> = {}) {
    if (!this.setup.enabled) return;
    const normalized = P.isString(eventName) ? eventName.trim() : "";
    if (!normalized) return;
    if (!this.awaitsIdentityChange()) {
      Option.map(this.analyticsIntake("capture", normalized), (native) =>
        native.capture(normalized, properties),
      );
      return;
    }
    // Copied now and queued once the identity switched.
    const native = this.ended ? Option.none<NativeClientAdapter>() : this.nativeClient();
    if (Option.isNone(native)) {
      this.analyticsIntake("capture", normalized);
      return;
    }
    Option.map(native.value.holdEvent("capture", normalized, properties), (send) =>
      this.holdEventForIdentity("capture", normalized, send),
    );
  }

  /**
   * Reports that the end user opened a notification, as `$push_opened` naming
   * its send. Call it from your notification library's opened-notification
   * handler, with the notification's data: the SDK has no notification handling
   * of its own. A notification not sent through Voidhash is ignored, and so is
   * one reported again right after its first report, as a handler that reads
   * the last opened notification on every mount does. Dropped while disabled or
   * while analytics consent is not granted. Never throws.
   */
  trackPushOpened(data?: Readonly<Record<string, unknown>>) {
    const sendId = data?.[PUSH_SEND_ID_DATA_KEY];
    if (!P.isString(sendId) || sendId.trim() === "") return;
    if (Option.contains(this.lastPushOpenedSendId, sendId)) return;
    this.lastPushOpenedSendId = Option.some(sendId);
    this.capture(AUTOMATIC_EVENTS.PUSH_OPENED, { [PUSH_SEND_ID_PROPERTY]: sendId });
  }

  /**
   * The native client an event for `name` can be handed to, or `None` when it
   * is dropped: without consent (reported once) unless the native client
   * holds it for a pending one, after `end()`, or without
   * the native module (each reported).
   *
   * Before the client has started only the native client can know the consent
   * stored on the device, so the event is handed over for it to keep or
   * discard at start, whatever the `analyticsConsent` option says. A consent
   * `setAnalyticsConsent()` chose in this process is the exception: it wins
   * over the stored one, so it decides here already.
   */
  private analyticsIntake(
    operation: "capture" | "screen",
    name: string,
  ): Option.Option<NativeClientAdapter> {
    const known = this._isInitialized
      ? Option.some(this.analyticsConsent)
      : this.chosenAnalyticsConsent;
    const isRefused = Option.exists(
      known,
      (consent) =>
        consent !== "granted" &&
        !(consent === "pending" && this.setup.analyticsWhilePending === "buffer"),
    );
    if (isRefused) {
      this.reportAnalyticsConsentDenied(operation);
      return Option.none();
    }
    const native = this.ended ? Option.none<NativeClientAdapter>() : this.nativeClient();
    if (Option.isNone(native)) {
      this.emitDiagnostic({
        code: "ANALYTICS_EVENT_DROPPED",
        kind: "eviction",
        message: this.ended
          ? `Dropped "${name}" — captured after end()`
          : `Dropped "${name}" — the Voidhash native module is missing`,
        operation,
        retryable: false,
      });
    }
    return native;
  }

  /**
   * Captures a `$screen` event for a screen the SDK cannot observe itself
   * (custom navigation, onboarding steps, pager pages). Every call is a new
   * screen instance, so calling it twice with the same name emits twice.
   * No-op while disabled or when `screenTracking.enabled` is `false`. Never
   * throws: a screen whose name is not a string, or that cannot be read, is
   * dropped and reported as `ANALYTICS_EVENT_DROPPED`.
   */
  screen(name: string, properties: Record<string, unknown> = {}) {
    this.manualScreenCounter += 1;
    // A name that is not a string is dropped below; it is kept out of the
    // identity because not every value has a text form.
    const identity = `${P.isString(name) ? name : ""}#${this.manualScreenCounter}`;
    this.trackScreenView({ identity, name, path: name, source: "manual" }, properties);
  }

  /**
   * Feeds a screen arrival observed by an integration through the screen
   * tracker and captures `$screen` when it is a new screen instance. Whether
   * the event may be recorded is settled first: a screen seen without consent
   * neither runs `mapScreen` nor becomes the previous screen of a later one.
   * Never throws: it runs inside the host's navigation listeners and effects, so a
   * screen that cannot be tracked is dropped and reported instead.
   * @internal
   */
  trackScreenView(view: ScreenView, properties: Record<string, unknown> = {}) {
    if (!this.setup.enabled || this.setup.screenTracking.enabled === false) return;
    const failure = isTrackableScreen(view)
      ? Option.map(
          EffectResult.getFailure(
            EffectResult.try(() => {
              const native = this.analyticsIntake("screen", view.name);
              if (Option.isNone(native)) return;
              const screenProperties = this.screenTracker.transition(view);
              if (Option.isNone(screenProperties)) return;
              // The tracker applied `mapScreen` and the include-params rule; the native
              // client records `$screen` with these properties as they are.
              const mappedName = screenProperties.value[SCREEN_PROPERTIES.NAME];
              const screenName = P.isString(mappedName) ? mappedName : view.name;
              const recorded = { ...properties, ...screenProperties.value };
              if (!this.awaitsIdentityChange()) {
                native.value.screen(screenName, recorded);
                return;
              }
              Option.map(native.value.holdEvent("screen", screenName, recorded), (send) =>
                this.holdEventForIdentity("screen", screenName, send),
              );
            }),
          ),
          (error) => (P.isError(error) ? error.message : "it could not be read"),
        )
      : Option.some("its identity, name or path is not a string");
    if (Option.isSome(failure)) {
      this.emitDiagnostic({
        code: "ANALYTICS_EVENT_DROPPED",
        kind: "eviction",
        message: `Dropped a screen: ${failure.value}`,
        operation: "screen",
        retryable: false,
      });
    }
  }

  /**
   * Sends everything queued now: person writes (`identify()` links and
   * attributes) first, then store receipts and analytics events, and reports
   * the analytics outcome. Waits at most about two seconds; delivery goes on
   * past that. Events still waiting for an identity change to switch the
   * person are sent too: the flush starts once it has. Nothing is ever queued
   * while disabled, so this no-ops.
   */
  async flush(): Promise<Result<FlushResult, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok({ flushed: 0, pending: 0 });
    if (this.awaitsIdentityChange()) await this.afterIdentityChanges();
    if (Option.isSome(this.flushInFlight)) return this.flushInFlight.value;
    const started = this.started();
    if (started.isErr()) return Result.ok({ flushed: 0, pending: 0 });
    const inFlight = started.value.flush().finally(() => {
      this.flushInFlight = Option.none();
    });
    this.flushInFlight = Option.some(inFlight);
    return inFlight;
  }

  /** Clears the cached person snapshot. The next read refetches from the server. */
  async resetCache(): Promise<Result<void, VoidhashError>> {
    if (!this.setup.enabled) return Result.ok(undefined);
    const started = this.started();
    if (started.isErr()) return this.swallowed("resetCache", Result.err(started.error));
    return this.swallowed("resetCache", await started.value.resetCache());
  }

  /**
   * Internal surface used by the SDK's React bindings.
   * Not part of the public API — may change or disappear at any time.
   */
  readonly internal = {
    getAtomRegistry: () => this.atomRegistry,
    /** What flag `key` reads as while it has no evaluated value: its `featureFlags.defaults` entry, or `false`. */
    isFeatureEnabledByDefault: (key: string): boolean =>
      Option.getOrElse(R.get(this.setup.featureFlagDefaults, key), () => false),
    /**
     * What a purchase of `product` with `options` buys, as text: two
     * purchases with the same key buy the same product the same way. `None`
     * for options `purchase()` refuses.
     */
    purchaseKey: (product: Product, options: PurchaseOptions): Option.Option<string> =>
      Option.flatMap(EffectResult.getSuccess(toNativePurchaseOptions(product, options)), (native) =>
        encodeJson({ ...native, productSlug: product.slug }),
      ),
    getSchema: (): Option.Option<RuntimeSchema> =>
      this._isInitialized ? this.atomRegistry.get(schemaAtom) : Option.none(),
    getSuccessCallbackBaseUrl: () => `${this.setup.scheme}://voidhash/callback/success`,
    getErrorCallbackBaseUrl: () => `${this.setup.scheme}://voidhash/callback/error`,
    reportHostCallbackFailure: (operation: string, error: unknown) =>
      this.reportHostCallbackFailure(operation, error),
  };

  /** Reports an exception a callback the app supplied threw; the SDK carried on without it. */
  private reportHostCallbackFailure(operation: string, error: unknown) {
    this.emitDiagnostic({
      code: "HOST_CALLBACK_FAILED",
      kind: "configuration",
      message: `${operation} threw: ${P.isError(error) ? error.message : String(error)}`,
      operation,
      retryable: false,
    });
  }

  /**
   * Reports, once until consent is granted again, that analytics work was
   * skipped for lack of consent.
   */
  private reportAnalyticsConsentDenied(operation: string) {
    if (this.analyticsConsentDeniedReported) return;
    this.analyticsConsentDeniedReported = true;
    this.emitDiagnostic({
      code: "ANALYTICS_CONSENT_DENIED",
      kind: "consent",
      message: `Skipped ${operation}: analytics consent is "${this.analyticsConsent}", so no analytics are captured or sent until it is granted`,
      operation,
      retryable: false,
    });
  }
}

/** Convenience re-export to keep `ProductSlug` reachable from this module. */
export type { ProductSlug };
export type { AnalyticsConsent };
