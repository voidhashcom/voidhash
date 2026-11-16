/** A person trait value: a flat scalar, or `null` to clear the trait. */
// oxlint-disable-next-line effect/prefer-option-over-null -- `null` mirrors the JSON value that clears a trait.
export type VoidhashTraitValue = string | number | boolean | null;

export type VoidhashTraits = Record<string, VoidhashTraitValue>;

/** A group property's value: text, a number or a boolean. */
export type VoidhashGroupPropertyValue = string | number | boolean;

/** A group's properties, such as a company's `name`, `plan` or `seats`. */
export type VoidhashGroupProperties = Record<string, VoidhashGroupPropertyValue>;

/**
 * A group as `setGroups()` takes it: its `id`, with the group's properties beside it, such as
 * `{ id: "acme", name: "Acme", plan: "pro" }`. A group cannot have a property called `id`.
 */
export type VoidhashGroup = { readonly id: string | number } & Readonly<
  Record<string, VoidhashGroupPropertyValue>
>;

/**
 * Person attributes accepted by `setPersonAttributes` /
 * `setPersonAttributesSync`. `email` and `name` are reserved fields; every
 * other key is treated as a free-form person trait.
 */
export type VoidhashPersonAttributes = {
  readonly email?: string;
  readonly name?: string;
} & Readonly<Record<string, VoidhashTraitValue>>;

/** The person behind the current distinct id, as Voidhash stores it. */
export interface VoidhashPerson {
  readonly distinctId: string;
  // oxlint-disable-next-line effect/prefer-option-over-null -- mirrors the JSON person; `null` means no value is stored.
  readonly email: string | null;
  // oxlint-disable-next-line effect/prefer-option-over-null -- mirrors the JSON person; `null` means no value is stored.
  readonly name: string | null;
  readonly personId: string;
}

/**
 * The project's feature flags, as the declaration file `voidhash-cli types
 * generate` writes teaches them to the SDK. That file augments this interface
 * with `schema: { flags: ... }` (the flag keys) and `flagValues: { ... }` (the
 * text values of each flag's variants). Without it, flag keys and variant
 * values are typed as `string`.
 */
// intentional - the generated declaration file augments this
export interface VoidhashRegister {}

/** The literal union of the project's feature flag keys (archived ones left out), or `string` without a generated declaration file. */
export type FeatureFlagKey = VoidhashRegister extends {
  schema: { flags: infer Keys extends string };
}
  ? // A project without flags declares `never`; keep accepting any key.
    [Keys] extends [never]
    ? string
    : Keys
  : string;

/**
 * The text values flag `K`'s variants had when the declaration file was
 * generated, which editors suggest, or any other text: a variant added since
 * is not in the file until it is generated again, so code that matches on the
 * value keeps a branch for other values. Any text without the file
 * or the flag's variants had none.
 */
export type FeatureFlagValue<K extends string> =
  // oxlint-disable-next-line typescript/no-redundant-type-constituents -- `never` only in the SDK's own build; an app's generated file fills in the listed values.
  | ListedFlagValue<K>
  // Any other text, without hiding the listed values from autocomplete.
  | (string & Record<never, never>);

/** The text values the declaration file lists for flag `K`; none without them. */
type ListedFlagValue<K extends string> = VoidhashRegister extends { flagValues: infer Values }
  ? K extends keyof Values
    ? Values[K]
    : never
  : never;

export interface FeatureFlagEntry {
  readonly enabled: boolean;
  readonly key: string;
  readonly payload: unknown;
  /** The assigned variant, or `null` for a flag without variants. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- the public API takes and returns plain values, so callers do not need Effect.
  readonly variantKey: string | null;
}

export interface FeatureFlagsResult {
  readonly flags: ReadonlyArray<FeatureFlagEntry>;
  /** `true` when the value was served past its hard TTL. */
  readonly isExpired: boolean;
  /** `true` when the value was served from cache without a successful refresh. */
  readonly isStale: boolean;
}

/** Category of a diagnostic, so hosts can route to logging vs. alerting. */
export type VoidhashDiagnosticKind =
  | "auth"
  | "breaker"
  | "cache"
  | "consent"
  | "eviction"
  | "transport";

export interface VoidhashDiagnostic {
  /** Stable, machine-readable identifier, for example `TRANSPORT_FAILED`. */
  readonly code: string;
  /** Status of the response that produced the diagnostic, when there was one. */
  readonly httpStatus?: number;
  /** Category, so hosts can route to logging vs. alerting without matching codes. */
  readonly kind: VoidhashDiagnosticKind;
  /** Human-readable description, safe to log. */
  readonly message: string;
  /** SDK operation that produced it, for example `analytics.flush`. */
  readonly operation: string;
  /** `true` when the SDK will try the same work again on its own. */
  readonly retryable: boolean;
}

export interface VoidhashFeatureFlagsOptions {
  /**
   * What a flag reads as through `isFeatureEnabled()` and the React hook's
   * `isEnabled()` while it has no evaluated value: before the first
   * evaluation, and when Voidhash cannot be reached and nothing is cached.
   * Flags without a default read as `false`. Use `true` for a flag whose
   * feature must stay on when Voidhash is unreachable.
   */
  readonly defaults?: Readonly<Record<string, boolean>>;
  /**
   * How long a read with nothing cached waits for Voidhash before it answers
   * with no flags, in milliseconds. Defaults to 2000. The evaluation carries
   * on in the background, and its answer is cached and announced with
   * `feature-flags-updated`. A cached value never waits more than 500 ms.
   */
  readonly maxWaitMs?: number;
  readonly persist?: boolean;
  readonly prefetchOnInit?: boolean;
  readonly refreshOnOnline?: boolean;
  readonly refreshOnVisibility?: boolean;
  readonly ttlMs?: number;
}

/**
 * The end user's choice about usage analytics: whether the SDK may record what
 * they do. `denied` and `pending` behave the same: no events, page views,
 * sessions, or campaigns are recorded, stored, or sent, and agreeing to ad data
 * sharing does nothing. What your app says about the person is not analytics,
 * and is sent either way, marked as made without analytics consent: `identify()`
 * links with their email, name, and traits, the attributes of
 * `setPersonAttributes()`, and the groups of `group()` and `setGroups()` with
 * their properties, as feature flags and cohorts depend on them. Feature flags
 * are still evaluated, and the anonymous id, the consent choice, and cached
 * feature flags are still stored. A
 * campaign seen while `pending` waits in `sessionStorage` for the session, or,
 * with `storeBeforeConsent: false`, in memory for the page. With
 * `analyticsWhilePending: "buffer"`, events recorded while `pending` wait in
 * memory for the answer as well.
 */
export type AnalyticsConsent = "granted" | "denied" | "pending";

/**
 * Who keeps the end user's analytics consent.
 *
 * - `sdk`: a choice set with `setAnalyticsConsent` is stored on the device
 *   and takes precedence over the `analyticsConsent` option on later visits.
 * - `app`: the app, usually relaying a consent tool, is the only source. The
 *   `analyticsConsent` option, `pending` by default, is in effect when the
 *   page starts, whatever an earlier visit stored, and `pending` only waits
 *   for the app's answer: it keeps what earlier pages queued and stored.
 */
export type AnalyticsConsentSource = "sdk" | "app";

/**
 * What happens to events recorded while analytics consent is `pending`.
 *
 * - `drop`: they are not recorded.
 * - `buffer`: up to 100 are held in memory, the oldest giving way, with the
 *   time and the page they happened on. Nothing is stored or sent. A grant
 *   records them in order, under the identity, groups and session of that
 *   moment; a denial, or leaving the page, discards them. Person attributes
 *   and group descriptions are never held: they are sent whatever the consent.
 */
export type AnalyticsWhilePending = "drop" | "buffer";

/**
 * Page context the SDK records with an event. Every field is optional: a
 * private page has no `url_*` or `page_title`, and a visit without a referrer
 * has no `referrer_*`.
 */
export interface VoidhashEventContext {
  [key: string]: unknown;
  page_title?: string;
  referrer_origin?: string;
  referrer_path?: string;
  screen_height?: number;
  screen_width?: number;
  url_origin?: string;
  url_path?: string;
  viewport_height?: number;
  viewport_width?: number;
}

/**
 * An analytics event as it will be queued and sent, given to
 * `analytics.beforeSend`. `properties` and `context` are the event's own
 * copies, so they can be changed in place.
 */
export interface VoidhashAnalyticsEvent {
  /** Page context: the page's origin, path and title, the referrer, and the screen size. */
  context: VoidhashEventContext;
  readonly distinctId: string;
  /** The event's name, such as `$pageview`, `$set`, `$sign_out`, or one you track. */
  readonly event: string;
  readonly eventId: string;
  /**
   * Your properties with the SDK's `$` properties. A `$set` event carries the
   * person traits it writes in `$set` and `$set_once`, campaign traits
   * included.
   */
  properties: Record<string, unknown>;
  readonly sessionId?: string;
  /** When the event happened, in ISO-8601. */
  readonly timestamp: string;
}

/**
 * Sees every analytics event before it is queued, and returns it, changed or
 * not, or `null` to drop it. Changes to `properties` and `context` are kept;
 * the other fields are read only.
 */
// oxlint-disable-next-line effect/prefer-option-over-null -- `null` drops the event, as in other analytics SDKs; callers need no Effect.
export type VoidhashBeforeSend = (event: VoidhashAnalyticsEvent) => VoidhashAnalyticsEvent | null;

/**
 * Rewrites or hides an address before the SDK records it. Returns the address
 * to record, a `URL` or a string read relative to `url`, or `null` to record
 * none.
 */
// oxlint-disable-next-line effect/prefer-option-over-null -- `null` hides the address; callers need no Effect.
export type VoidhashSanitizeUrl = (url: URL) => URL | string | null;

export interface VoidhashAnalyticsOptions {
  /**
   * Origin that receives analytics events. Defaults to `baseUrl`; set it only
   * for a dedicated ingest origin.
   */
  readonly baseUrl?: string;
  /**
   * Runs on every analytics event before it is queued or stored: page views,
   * `$set` and `$sign_out` events, and the events you track. A list runs in
   * order, and the first `null` drops the event. A function that throws, or
   * returns something else than an event or `null`, drops it too, and is
   * reported as a `BEFORE_SEND_FAILED` diagnostic.
   */
  readonly beforeSend?: VoidhashBeforeSend | ReadonlyArray<VoidhashBeforeSend>;
  /**
   * Records a `$pageview` on load and after every client-side navigation that
   * changes the path (History API). Defaults to `true`. Campaign attribution
   * is captured either way.
   */
  readonly capturePageViews?: boolean;
  /**
   * Records a `$pageleave` when a page view ends, with the page's visible time,
   * how far it was scrolled, and its Web Vitals. Defaults to `capturePageViews`.
   */
  readonly capturePageLeaves?: boolean;
  /**
   * Records an `$outbound_click` when a link to another origin is clicked, with
   * the origin it leads to and not its path or query. Defaults to `true`.
   */
  readonly captureOutboundClicks?: boolean;
  /**
   * Called with every address of a page the SDK is about to record: the page's,
   * with its query, and the referrer's, which can be another site's. Return the
   * address to record instead, or `null` to keep it out.
   *
   * A page whose address is kept out is private: it gets no automatic page
   * view, page leave or outbound click and no campaign touch, and events
   * recorded on it carry no URL or title. A referrer kept out is not recorded.
   * A function that throws keeps the address out and is reported as a
   * `SANITIZE_URL_FAILED` diagnostic.
   */
  readonly sanitizeUrl?: VoidhashSanitizeUrl;
  /**
   * Turns analytics off for this client. When `false` the client behaves as if
   * analytics consent were `denied`, without storing a consent value.
   */
  readonly enabled?: boolean;
  readonly flushIntervalMs?: number;
  readonly maxBatchBytes?: number;
  readonly maxBatchSize?: number;
  readonly maxQueueSize?: number;
}

export interface VoidhashClientOptions {
  readonly analytics?: VoidhashAnalyticsOptions;
  /**
   * Analytics consent to start with. Defaults to `granted`, or to `pending`
   * when `analyticsConsentSource` is `app`. A value stored by
   * `setAnalyticsConsent` on an earlier visit takes precedence, unless
   * `analyticsConsentSource` is `app`.
   */
  readonly analyticsConsent?: AnalyticsConsent;
  /**
   * Who keeps the end user's analytics consent: the SDK, the default, or the
   * app, for a consent tool such as Cookiebot or OneTrust. See
   * {@link AnalyticsConsentSource}.
   */
  readonly analyticsConsentSource?: AnalyticsConsentSource;
  /**
   * What happens to events recorded while analytics consent is `pending`:
   * dropped, the default, or held in memory until the answer. See
   * {@link AnalyticsWhilePending}.
   */
  readonly analyticsWhilePending?: AnalyticsWhilePending;
  /**
   * Whether `identify()` grants analytics consent that is still `pending`, for
   * an app whose terms cover analytics for signed-in users. Defaults to
   * `false`. A `denied` consent is never changed. The grant is remembered as
   * implied: `signOut()` and `reset()` return it to `pending`, unless
   * `setAnalyticsConsent()` was called since, which makes the choice the end
   * user's own.
   */
  readonly grantConsentOnIdentify?: boolean;
  /**
   * Called for every SDK diagnostic (transport failures, evictions, circuit
   * breaker transitions, auth pauses, cache faults). Exceptions thrown by the
   * handler are swallowed.
   */
  readonly onDiagnostic?: (diagnostic: VoidhashDiagnostic) => void;
  readonly baseUrl?: string;
  readonly distinctId?: string;
  readonly featureFlags?: VoidhashFeatureFlagsOptions;
  /**
   * The project's `vh_pk_` publishable key. Without one, `null`, `undefined`
   * or blank, the client is inert, for an environment that has no project: it
   * sends, stores and listens to nothing, records no analytics, reads every
   * flag as its `featureFlags.defaults` entry, and its methods resolve with
   * empty values instead of failing.
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- an unset environment variable or a missing setting is passed as is; callers need no Effect.
  readonly publishableKey?: string | null;
  /**
   * Whether the SDK may keep its state in the browser's storage while
   * analytics consent is not granted: the anonymous id, cached feature flags,
   * queued `identify()` links, and campaign touches. Defaults to `true`.
   *
   * Set it to `false` where storing an identifier on the device needs the end
   * user's consent, as in the EU. Until consent is granted, that state is
   * kept in memory for the page only, so each page load starts a new anonymous
   * visitor, and a campaign touch is held in memory until consent is answered,
   * across client-side navigations but not a page load. Granting consent
   * stores the state of the current page, and other
   * open tabs take on its identity; revoking it removes the state from the
   * device again. What is stored follows the end user's choice also in a
   * client with `analytics.enabled: false`. The consent choice itself is
   * always stored, as is a `setAdDataSharing(false)` until Voidhash has written
   * it, or for 48 hours while Voidhash has no such person.
   */
  readonly storeBeforeConsent?: boolean;
  /**
   * Shares the anonymous id across the subdomains of your site, so a visitor
   * who moves from `www.example.com` to `app.example.com` stays one visitor
   * before they sign in. Defaults to `false`.
   *
   * Turn it on only when every subdomain of your registrable domain is trusted:
   * each can read and set the first-party cookie this adds, and the id in it
   * gives access to that person's subscriptions and perks.
   *
   * The cookie only ever holds an anonymous id, and is read and written only
   * while analytics consent is granted; withdrawing consent deletes it. A device
   * with a recorded campaign keeps its id and leaves another in the cookie alone,
   * as does one whose id the app read with `getDistinctId()`, which may be on a payment.
   * A device writes its own id only if it never used the cookie, as another
   * subdomain may have linked it to a user since, and only renews the cookie
   * while it holds that id. Identifying a visitor rewrites the cookie with a
   * fresh id and a digest of the id they had, and a device holding that id gives
   * it up, campaign included; an identified device never takes an id from it.
   */
  readonly crossSubdomainIdentity?: boolean;
}

export interface VoidhashTrackOptions {
  readonly eventId?: string;
  readonly sessionId?: string;
  readonly timestamp?: string;
}

export interface AnalyticsFlushResult {
  readonly accepted: number;
  readonly rejected: number;
  readonly requestId?: string;
}

/**
 * Outcome of a flush attempt. `flushed` counts events accepted by the server
 * during this call, `pending` is how many events remain queued afterwards, and
 * `lastError` describes the most recent transport or server failure, if any.
 */
export interface AnalyticsFlushStatus {
  readonly flushed: number;
  readonly lastError?: string;
  readonly pending: number;
}

export interface InitializedEvent {
  readonly distinctId: string;
}

export interface IdentityChangedEvent {
  readonly distinctId: string;
  // oxlint-disable-next-line effect/prefer-option-over-null -- the public API takes and returns plain values, so callers do not need Effect.
  readonly previousDistinctId: string | undefined;
}

export interface FeatureFlagsUpdatedEvent {
  /** The person the flags were evaluated for. */
  readonly distinctId: string;
  readonly keys?: ReadonlyArray<string>;
  readonly result: FeatureFlagsResult;
}

export interface AnalyticsFlushedEvent extends AnalyticsFlushResult {}

export interface AnalyticsPartialRejectionEvent extends AnalyticsFlushResult {}

export interface AnalyticsConsentChangedEvent {
  /** Consent now in effect. */
  readonly consent: AnalyticsConsent;
}

export interface VoidhashErrorEvent {
  readonly error?: unknown;
  readonly message: string;
  readonly source: "analytics" | "client" | "feature-flags" | "identity" | "storage";
}

export interface VoidhashEventMap {
  readonly "analytics-consent-changed": AnalyticsConsentChangedEvent;
  readonly diagnostic: VoidhashDiagnostic;
  readonly "analytics-flushed": AnalyticsFlushedEvent;
  readonly "analytics-partial-rejection": AnalyticsPartialRejectionEvent;
  readonly error: VoidhashErrorEvent;
  readonly "feature-flags-updated": FeatureFlagsUpdatedEvent;
  readonly "identity-changed": IdentityChangedEvent;
  readonly initialized: InitializedEvent;
}

export type VoidhashEventName = keyof VoidhashEventMap;

export interface ResolvedVoidhashConfig {
  readonly onDiagnostic?: (diagnostic: VoidhashDiagnostic) => void;
  readonly analytics: {
    readonly baseUrl: string;
    readonly beforeSend: ReadonlyArray<VoidhashBeforeSend>;
    readonly captureOutboundClicks: boolean;
    readonly capturePageLeaves: boolean;
    readonly capturePageViews: boolean;
    readonly enabled: boolean;
    readonly flushIntervalMs: number;
    readonly maxBatchBytes: number;
    readonly maxBatchSize: number;
    readonly maxQueueSize: number;
    readonly sanitizeUrl?: VoidhashSanitizeUrl;
  };
  readonly analyticsConsent: AnalyticsConsent;
  readonly analyticsConsentSource: AnalyticsConsentSource;
  readonly analyticsWhilePending: AnalyticsWhilePending;
  readonly baseUrl: string;
  readonly grantConsentOnIdentify: boolean;
  readonly featureFlags: {
    readonly defaults: Readonly<Record<string, boolean>>;
    readonly maxWaitMs: number;
    readonly persist: boolean;
    readonly prefetchOnInit: boolean;
    readonly refreshOnOnline: boolean;
    readonly refreshOnVisibility: boolean;
    readonly ttlMs: number;
  };
  readonly crossSubdomainIdentity: boolean;
  readonly distinctId?: string;
  /** Empty for an inert client, which was given no key. */
  readonly publishableKey: string;
  readonly storeBeforeConsent: boolean;
}
