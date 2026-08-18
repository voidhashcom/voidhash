/** A value that can be represented losslessly as JSON. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue };

/** Platforms which can originate measurement evidence. */
export type MeasurementPlatform = "ios" | "android" | "core";

/** Stable source categories for evidence records. */
export type MeasurementSource =
  | "native"
  | "javascript"
  | "store"
  | "push"
  | "server-correlation";

/** Priority used by the durable outbox. */
export type MeasurementPriority = "critical" | "high" | "normal" | "low";

/** Immutable identity state captured with an evidence record. */
export interface IdentitySnapshot {
  readonly distinctId: string;
  readonly anonymousId?: string;
  readonly personId?: string;
  readonly revision: number;
}

/** Application state captured with an evidence record. */
export interface AppSnapshot {
  readonly bundleId?: string;
  readonly build?: string;
  readonly version?: string;
}

/** Device state safe for ordinary event context. */
export interface DeviceSnapshot {
  readonly locale?: string;
  readonly platform: "ios" | "android" | "unknown";
  readonly platformVersion?: string;
}

/** Current ATT authorization state. */
export type AttStatus = "notDetermined" | "restricted" | "denied" | "authorized";

/** A revisioned consent decision. Omitted fields remain unknown. */
export interface ConsentSnapshot {
  readonly revision: number;
  readonly decidedAt: string;
  readonly source: "cmp" | "system" | "application" | "unknown";
  readonly gdprApplies?: boolean;
  readonly dataUsage?: boolean;
  readonly adsPersonalization?: boolean;
  readonly adStorage?: boolean;
  readonly tcf?: { readonly string: string; readonly version: "2.2" | "2.3" | string };
  readonly att?: AttStatus;
  readonly collectionOptOut?: boolean;
  readonly partnerSharingOptOut?: boolean;
}

/** Effective consent state returned by the consent namespace. */
export interface ConsentState {
  readonly snapshot: ConsentSnapshot;
  readonly effective: {
    readonly analytics: boolean;
    readonly attribution: boolean;
    readonly partnerSharing: boolean;
    readonly upload: boolean;
  };
}

/** Session captured at the time an evidence record is created. */
export interface SessionSnapshot {
  readonly id: string;
  readonly sequence: number;
  readonly startedAt: string;
  readonly reason: SessionStartReason;
}

/** Reason a measurement session began. */
export type SessionStartReason = "coldStart" | "foreground" | "deepLink" | "push" | "manual";

/** The canonical immutable measurement envelope. */
export interface MeasurementEnvelopeV1<TType extends string = string, TPayload = JsonValue> {
  readonly schemaVersion: 1;
  readonly recordId: string;
  readonly type: TType;
  readonly occurredAt: string;
  readonly monotonicTimeNs?: string;
  readonly queuedAt: string;
  readonly installationId: string;
  readonly installationSequence: number;
  readonly session?: SessionSnapshot;
  readonly identity: IdentitySnapshot;
  readonly consent: ConsentSnapshot;
  readonly app: AppSnapshot;
  readonly device: DeviceSnapshot;
  readonly source: MeasurementSource;
  readonly publicPayload: TPayload;
  readonly protectedPayloadRef?: string;
}

/** Collection controls evaluated independently for every input category. */
export interface CollectionPolicy {
  readonly analytics: "enabled" | "disabled";
  readonly attribution: "enabled" | "disabled";
  readonly advertisingIdentifiers: "allowed" | "denied" | "consent-dependent";
  readonly vendorIdentifiers: "allowed" | "denied" | "consent-dependent";
  readonly networkMetadata: "allowed" | "denied";
  readonly location: "manual-only" | "denied";
  readonly upload: "enabled" | "paused";
}

/** Partner sharing rules, evaluated at send time. */
export interface PartnerSharingPolicy {
  readonly mode: "enabled" | "disabled";
  readonly excludedPartners?: ReadonlyArray<string>;
  readonly excludedFields?: Readonly<Record<string, ReadonlyArray<string>>>;
}

/** Runtime purchase-observation controls. */
export interface PurchaseMeasurementConfiguration {
  readonly enabled?: boolean;
  readonly subscriptions?: boolean;
  readonly inAppPurchases?: boolean;
  readonly environment?: "production" | "sandbox";
  readonly enrichment?: {
    readonly ios?: (transaction: ObservedPurchaseTransaction) => Readonly<Record<string, JsonValue>> | Promise<Readonly<Record<string, JsonValue>>>;
    readonly android?: Partial<Record<"subscription" | "inApp", (transaction: ObservedPurchaseTransaction) => Readonly<Record<string, JsonValue>> | Promise<Readonly<Record<string, JsonValue>>>>>;
  };
}

/** Normalized store transaction supplied to purchase observation and enrichment callbacks. */
export interface ObservedPurchaseTransaction {
  readonly appAccountToken?: string;
  readonly expirationDate?: number;
  readonly isAcknowledged: boolean;
  readonly isAutoRenewing?: boolean;
  readonly originalTransactionId?: string;
  readonly platform: "ios" | "android";
  readonly productId: string;
  readonly purchaseDate: number;
  readonly purchaseState: "purchased" | "pending" | "unspecified";
  readonly purchaseToken?: string;
  readonly quantity: number;
  readonly receipt?: string;
  readonly transactionId: string;
}

/** Android-specific collection settings. */
export interface AndroidMeasurementConfiguration {
  readonly collectAppSetId?: boolean;
  readonly collectAdvertisingId?: boolean;
  readonly collectNetworkMetadata?: boolean;
  readonly outOfStore?: string;
  readonly collectOaid?: boolean;
}

/** iOS-specific collection settings. */
export interface IosMeasurementConfiguration {
  readonly collectIdfv?: boolean;
  readonly collectAppleAds?: boolean;
  readonly disableSKAD?: boolean;
}

/** Explicit opt-in configuration for protected email and phone identity traits. */
export interface ProtectedIdentityConfiguration {
  readonly enabled?: boolean;
  readonly email?: boolean;
  readonly phone?: boolean;
}

/** Full measurement configuration accepted at client construction. */
export interface MeasurementConfiguration {
  readonly startMode?: "automatic" | "manual" | "consent-gated";
  readonly sessionTimeoutMs?: number;
  readonly context?: Readonly<Record<string, JsonValue>>;
  readonly defaultCurrency?: string;
  readonly localeOverride?: string;
  readonly collection?: Partial<CollectionPolicy>;
  readonly partnerSharing?: PartnerSharingPolicy;
  readonly partnerData?: Readonly<Record<string, Readonly<Record<string, JsonValue>>>>;
  readonly purchases?: PurchaseMeasurementConfiguration;
  readonly android?: AndroidMeasurementConfiguration;
  readonly ios?: IosMeasurementConfiguration;
  readonly protectedIdentity?: ProtectedIdentityConfiguration;
}

/** Validated partial update accepted by `measurement.configure`. */
export type MeasurementConfigurationPatch = MeasurementConfiguration;

/** Current effective measurement configuration and revision. */
export interface MeasurementState {
  readonly revision: number;
  readonly configuration: Readonly<Required<Pick<MeasurementConfiguration, "startMode" | "sessionTimeoutMs">> & MeasurementConfiguration>;
}

/** Explicit stop scopes. */
export interface MeasurementStopOptions {
  readonly collection?: boolean;
  readonly upload?: boolean;
  readonly partnerSharing?: boolean;
  readonly persist?: boolean;
}

/** Public manual measurement inputs. */
export type MeasurementInput =
  | { readonly type: "location"; readonly latitude: number; readonly longitude: number; readonly occurredAt?: string }
  | { readonly type: "attStatus"; readonly status: AttStatus; readonly source: "system" | "application" }
  | { readonly type: "identifier"; readonly kind: "oaid" | "amazonAaid" | "metaAttributionId"; readonly value: string };

/** Result of handling a manual input. */
export interface MeasurementHandleResult {
  readonly recordId: string;
  readonly accepted: true;
}

/** Per-record delivery result exposed by `flush` and diagnostics. */
export interface DeliveryDiagnostic {
  readonly recordId: string;
  readonly requestId: string;
  readonly outcome: "accepted" | "rejected" | "retryScheduled" | "quarantined" | "policyBlocked";
  readonly reason?: string;
  readonly attemptCount: number;
  readonly occurredAt: string;
}

/** Aggregate drain result for the native outbox. */
export interface MeasurementFlushResult {
  readonly accepted: number;
  readonly scheduled: number;
  readonly quarantined: number;
  readonly policyBlocked: number;
}

/** Closed capability-state vocabulary used by diagnostics and build manifests. */
export type CollectorCapabilityState =
  | "available"
  | "notConfigured"
  | "notImplemented"
  | "notInstalled"
  | "unsupported"
  | "timeout"
  | "permissionDenied"
  | "invalidSignature"
  | "collected"
  | "noRules"
  | "disabled"
  | "error";

/** Known collector keys always present in the state inspector. */
export type CollectorCapability =
  | "links"
  | "referrer"
  | "push"
  | "purchases"
  | "advertisingIdentifiers"
  | "vendorIdentifiers"
  | "networkMetadata"
  | "appleAds"
  | "skan"
  | "adAttributionKit";

/** Redacted runtime state intended for support and integration tooling. */
export interface MeasurementDebugState {
  readonly versions: {
    readonly sdk: string;
    readonly native: string;
    readonly envelopeSchema: 1;
    readonly configSchema: 1;
  };
  readonly installation: { readonly id: string; readonly sequence: number; readonly firstOpenedAt: string };
  readonly session: {
    readonly current?: SessionSnapshot;
    readonly readiness: "uninitialized" | "nativeInitialized" | "collectorsReady" | "sdkReady" | "appGatesReady" | "sessionStarted" | "backgrounded";
    readonly stopped: Readonly<MeasurementStopOptions>;
  };
  readonly outbox: {
    readonly counts: Readonly<Record<MeasurementPriority, number>>;
    readonly total: number;
    readonly oldestAgeMs?: number;
    readonly lastDelivery?: DeliveryDiagnostic;
  };
  readonly consent: ConsentState;
  readonly configuration: {
    readonly revision: number;
    readonly startMode: "automatic" | "manual" | "consent-gated";
    readonly sessionTimeoutMs: number;
    readonly defaultCurrency?: string;
    readonly localeOverride?: string;
    readonly contextKeys: ReadonlyArray<string>;
    readonly endpoints: {
      readonly api: string;
      readonly ingest: string;
      readonly links: string;
      readonly trustedConfigKeyIds: ReadonlyArray<string>;
    };
    readonly signed?: {
      readonly keyId: string;
      readonly version: number;
      readonly source: "network" | "persisted";
    };
    readonly lastSignedConfigurationRejection?: string;
  };
  readonly collectors: Readonly<Record<CollectorCapability, CollectorCapabilityState>>;
  readonly manifest: { readonly present: boolean; readonly version?: number };
  readonly deletion: { readonly requested: boolean; readonly completed: boolean };
  readonly testDevice: boolean;
}

/** Safe campaign fields that may cross the public bridge. */
export interface SafeCampaignContext {
  readonly campaign?: string;
  readonly channel?: string;
  readonly mediaSource?: string;
  readonly ad?: string;
  readonly adSet?: string;
}

/** Sources accepted by the link pipeline. */
export type UrlSource = "appLink" | "universalLink" | "customScheme" | "push" | "manual" | "deferred" | "esp";

/** Unified result emitted for direct and deferred links. */
export type DeepLinkResult =
  | {
      readonly status: "found";
      readonly resolutionId: string;
      readonly direct: boolean;
      readonly deferred: boolean;
      readonly linkId?: string;
      readonly route: { readonly value: string; readonly subvalues: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10, string>> };
      readonly campaign?: SafeCampaignContext;
      readonly receivedAt: string;
      readonly resolvedAt: string;
    }
  | { readonly status: "notFound"; readonly resolutionId: string; readonly reason: string }
  | { readonly status: "error"; readonly resolutionId: string; readonly error: import("./errors").MeasurementError };

/** Deep-link routing and redirect-resolution configuration. */
export interface LinkConfiguration {
  readonly templateId?: string;
  readonly allowedCustomParameters?: ReadonlyArray<string>;
  readonly allowedDomains?: ReadonlyArray<string>;
  readonly allowedSchemes?: ReadonlyArray<string>;
  readonly allowedRouteParameters?: ReadonlyArray<string>;
  readonly resolveWrappedDomains?: ReadonlyArray<string>;
  readonly pushPayloadPaths?: ReadonlyArray<ReadonlyArray<string>>;
  readonly resolutionTimeoutMs?: number;
  readonly maxRedirects?: number;
  readonly wrappedRetryDelayMs?: number;
  readonly allowInsecureRedirects?: boolean;
  readonly dedupeWindowMs?: number;
  readonly parameterRules?: ReadonlyArray<{
    readonly id: string;
    readonly match: { readonly domains?: ReadonlyArray<string>; readonly contains?: string };
    readonly parameters?: Readonly<Record<string, string>>;
    readonly overwrite?: boolean;
    readonly requiredPid?: "reject" | "flag";
    readonly reengagement?: boolean;
  }>;
  /** Supplies sensitive request headers for one wrapped-domain origin at request time. */
  readonly wrappedDomainHeaderProvider?: (
    origin: string,
  ) => Promise<Readonly<Record<string, string>>>;
}

/** Push-notification runtime configuration. */
export interface NotificationsConfiguration {
  readonly registration?: "automatic" | "manual";
  readonly iosForegroundPresentation?: ReadonlyArray<"banner" | "list" | "sound" | "badge">;
}

/** Permission values shared across APNs and Android notification permission. */
export type PushPermissionStatus = "notDetermined" | "denied" | "authorized" | "provisional" | "ephemeral" | "notRequired";

/** Options for a permission request. */
export interface PushPermissionOptions {
  readonly provisional?: boolean;
}

/** Opaque server registration state; raw platform tokens are deliberately absent. */
export interface PushRegistration {
  readonly pushDeviceTokenId: string;
  readonly provider: "apns" | "fcm";
  readonly environment: "development" | "production";
  readonly registeredAt: string;
}

/** Safe notification projection emitted on foreground receipt. */
export interface IncomingNotification {
  readonly id: string;
  readonly title?: string;
  readonly body?: string;
  readonly receivedAt: string;
  readonly pushNotificationSendId?: string;
}

/** Safe notification projection emitted when the user opens a notification. */
export interface OpenedNotification extends IncomingNotification {
  readonly openedAt: string;
  readonly link?: string;
}

/** Notification event stream values. */
export interface NotificationEventMap {
  readonly received: IncomingNotification;
  readonly opened: OpenedNotification;
  readonly tokenChanged: PushRegistration;
  readonly registrationError: import("./errors").MeasurementError;
}

/** Notification event names. */
export type NotificationEventName = keyof NotificationEventMap;

/** Ad-impression revenue accepted by the canonical revenue route. */
export interface AdRevenueInput {
  readonly impressionId: string;
  readonly monetizationNetwork: string;
  readonly mediationNetwork:
    | "ironsource" | "applovin_max" | "google_admob" | "fyber" | "appodeal"
    | "admost" | "topon" | "tradplus" | "yandex" | "chartboost" | "unity"
    | "topon_pte" | "custom_mediation" | "direct_monetization_network";
  readonly currency: string;
  readonly revenue: string;
  readonly country?: string;
  readonly adUnit?: string;
  readonly adType?: string;
  readonly placement?: string;
  readonly additionalParameters?: Readonly<Record<string, JsonValue>>;
}

/** Normalized reference used for explicit validation. */
export interface PurchaseValidationInput {
  readonly transactionId: string;
  readonly platform: "ios" | "android";
  readonly protectedEvidenceId: string;
  readonly environment?: "production" | "sandbox";
  readonly idempotencyKey?: string;
}

/** Cross-store lifecycle projection returned by validation. */
export interface NormalizedStorePurchaseState {
  readonly state: "purchased" | "pending" | "cancelled" | "refunded" | "expired" | "paused" | "grace";
  readonly productId?: string;
  readonly subscriptionState?: string;
  readonly test?: boolean;
  readonly lineItems?: ReadonlyArray<{ readonly productId: string; readonly quantity: number }>;
  readonly cancellation?: {
    readonly at?: string;
    readonly reason: "customer" | "billing" | "developer" | "price-change" | "unknown";
  };
  readonly pause?: { readonly startsAt: string; readonly resumesAt?: string };
  readonly offer?: { readonly id?: string; readonly type: "introductory" | "promotional" | "offer-code" | "base-plan" };
  readonly replacement?: {
    readonly mode: "immediate" | "deferred" | "prorated";
    readonly replacedProductId: string;
  };
  readonly prepaid?: { readonly expiresAt?: string; readonly topUpEligible: boolean };
  readonly priceChange?: {
    readonly currency?: string;
    readonly price?: string;
    readonly state: "pending" | "accepted" | "rejected";
  };
}

/** Correlated normalized validation result. */
export interface PurchaseValidationResult {
  readonly requestId: string;
  readonly transactionId: string;
  readonly outcome: "valid" | "invalid" | "indeterminate";
  readonly storeState?: NormalizedStorePurchaseState;
  readonly failure?: { readonly kind: "network" | "store" | "configuration" | "server"; readonly message: string };
}

/** Input accepted by the invite-link service. */
export interface InviteLinkInput {
  readonly channel?: string;
  readonly campaign?: string;
  readonly referrerCustomerId?: string;
  readonly referrerUid?: string;
  readonly referrerName?: string;
  readonly referrerImageUrl?: string;
  readonly deepLinkValue: string;
  readonly deepLinkSubvalues?: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10, string>>;
  readonly baseDeepLink?: string;
  readonly brandedDomain?: string;
  readonly appleAppId?: string;
  readonly customParameters?: Readonly<Record<string, JsonValue>>;
}

/** Signed link returned to the application. */
export interface GeneratedLink {
  readonly linkId: string;
  readonly url: string;
  readonly expiresAt?: string;
}

/** Cross-promotion tracking input. */
export interface CrossPromotionInput {
  readonly action: "impression" | "openStore";
  readonly promotedAppId: string;
  readonly campaign?: string;
  readonly parameters?: Readonly<Record<string, JsonValue>>;
}

/** Result of a cross-promotion action. */
export interface CrossPromotionResult {
  readonly recordId: string;
  readonly opened?: boolean;
  readonly link?: GeneratedLink;
}

/** Safe attribution decision exposed to an SDK client. */
export interface AttributionDecision {
  readonly decisionId: string;
  readonly modelVersion: string;
  readonly kind: "install" | "reengagement" | "organic";
  readonly campaign?: SafeCampaignContext;
  readonly direct?: boolean;
  readonly deterministic: boolean;
  readonly reason: string;
}

/** Initial client-side conversion projection. */
export interface InstallConversionResult {
  readonly installationId: string;
  readonly attributed: boolean;
  readonly campaign?: SafeCampaignContext;
  readonly deferred: boolean;
}

/** Events emitted by the measurement namespace. */
export interface MeasurementEventMap {
  readonly error: import("./errors").MeasurementError;
  readonly attribution: AttributionDecision;
  readonly attributionError: import("./errors").MeasurementError;
  readonly conversion: InstallConversionResult;
  readonly delivery: DeliveryDiagnostic;
  readonly purchaseValidation: PurchaseValidationResult;
  readonly session: SessionSnapshot;
}

/** Measurement event names. */
export type MeasurementEventName = keyof MeasurementEventMap;

/** Public measurement namespace. */
export interface MeasurementClient {
  configure(patch: MeasurementConfigurationPatch): Promise<MeasurementState>;
  start(options?: { readonly reason?: SessionStartReason }): Promise<SessionSnapshot>;
  stop(options?: MeasurementStopOptions): Promise<void>;
  handle(input: MeasurementInput): Promise<MeasurementHandleResult>;
  on<E extends MeasurementEventName>(event: E, listener: (value: MeasurementEventMap[E]) => void): () => void;
  getState(): Promise<MeasurementDebugState>;
  createSupportBundle(): Promise<import("./support-bundle").MeasurementSupportBundle>;
  getInstallationId(): Promise<string>;
  createInviteLink(input: InviteLinkInput): Promise<GeneratedLink>;
  trackInviteShare(input: { readonly linkId: string; readonly channel: string }): Promise<void>;
  trackCrossPromotion(input: CrossPromotionInput): Promise<CrossPromotionResult>;
  trackAdRevenue(input: AdRevenueInput): Promise<void>;
  validatePurchase(input: PurchaseValidationInput): Promise<PurchaseValidationResult>;
  deleteData(): Promise<{ readonly requestId: string; readonly status: "accepted" }>;
  setTestDevice(enabled: boolean): Promise<void>;
}

/** Public link namespace. */
export interface LinksClient {
  handle(input: { readonly url: string; readonly source: UrlSource; readonly receivedAt?: string }): Promise<DeepLinkResult>;
  on(event: "deepLink", listener: (value: DeepLinkResult) => void): () => void;
}

/** Public consent namespace. */
export interface ConsentClient {
  set(consent: ConsentSnapshot): Promise<ConsentState>;
  get(): Promise<ConsentState>;
}

/** Public notification namespace. */
export interface NotificationsClient {
  getPermissionStatus(): Promise<PushPermissionStatus>;
  requestPermission(options?: PushPermissionOptions): Promise<PushPermissionStatus>;
  register(): Promise<PushRegistration>;
  unregister(): Promise<void>;
  getRegistration(): Promise<PushRegistration | undefined>;
  setBadgeCount(count: number): Promise<void>;
  on<E extends NotificationEventName>(event: E, listener: (value: NotificationEventMap[E]) => void): () => void;
}
