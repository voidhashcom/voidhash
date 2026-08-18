import { SDK_VERSION } from "../constants";
import { getNonce } from "../utils/crypto";
import { MEASUREMENT_RECORD_TYPES, NON_EVICTABLE_RECORD_TYPES, STANDARD_EVENTS } from "./constants";
import {
  MeasurementCapabilityUnavailable,
  MeasurementConfigurationError,
  MeasurementError,
  MeasurementInputError,
  MeasurementPolicyBlocked,
} from "./errors";
import {
  normalizeProtectedIdentityTraits,
  type ProtectedIdentityTraits,
  type ProtectedIdentityUpdateResult,
} from "./protected-identity";
import { assertSafePublicValue } from "./protected-fields";
import { buildMeasurementSupportBundle } from "./support-bundle";
import { evaluateMeasurementCollection } from "./policy";
import {
  fetchSignedMeasurementConfiguration,
  SignedConfigurationRejected,
} from "./signed-config";
import type {
  AdRevenueInput,
  AppSnapshot,
  CollectionPolicy,
  ConsentClient,
  ConsentSnapshot,
  ConsentState,
  CrossPromotionInput,
  CrossPromotionResult,
  DeepLinkResult,
  DeliveryDiagnostic,
  DeviceSnapshot,
  GeneratedLink,
  IdentitySnapshot,
  IncomingNotification,
  InviteLinkInput,
  JsonValue,
  LinkConfiguration,
  LinksClient,
  MeasurementClient,
  MeasurementConfiguration,
  MeasurementConfigurationPatch,
  MeasurementDebugState,
  MeasurementEnvelopeV1,
  MeasurementEventMap,
  MeasurementFlushResult,
  MeasurementHandleResult,
  MeasurementInput,
  NormalizedStorePurchaseState,
  MeasurementPriority,
  MeasurementState,
  MeasurementStopOptions,
  NotificationEventMap,
  NotificationsClient,
  NotificationsConfiguration,
  ObservedPurchaseTransaction,
  OpenedNotification,
  PurchaseValidationInput,
  PurchaseValidationResult,
  PushPermissionOptions,
  PushPermissionStatus,
  PushRegistration,
  SessionSnapshot,
  SessionStartReason,
  UrlSource,
} from "./types";
import type { LinksCreateLinkRequest } from "@voidhash/generated-clients/links";

const DEFAULT_COLLECTION_POLICY: CollectionPolicy = {
  analytics: "enabled",
  attribution: "enabled",
  advertisingIdentifiers: "consent-dependent",
  vendorIdentifiers: "consent-dependent",
  networkMetadata: "denied",
  location: "denied",
  upload: "enabled",
};

const DEFAULT_CONSENT: ConsentSnapshot = {
  decidedAt: "1970-01-01T00:00:00.000Z",
  revision: 0,
  source: "unknown",
};

const MAX_JSON_DEPTH = 8;
const MAX_CONTEXT_BYTES = 16 * 1024;
const MAX_LINK_LENGTH = 8 * 1024;
const MAX_LINK_VALUE_LENGTH = 1024;
const MAX_OUTBOX_RECORDS = 10_000;
const MAX_OUTBOX_BYTES = 20 * 1024 * 1024;
const ISO_4217_CODES = new Set(
  "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XAG XAU XBA XBB XBC XBD XCD XDR XOF XPD XPF XPT XSU XTS XUA XXX YER ZAR ZMW ZWG".split(
    " ",
  ),
);

interface StoredEnvelope {
  readonly envelope: MeasurementEnvelopeV1<string, unknown>;
  readonly priority: MeasurementPriority;
  readonly bytes: number;
  attempts: number;
  eligibleAt: number;
}

interface RuntimeState {
  installationId: string;
  firstOpenedAt: string;
  sequence: number;
  identity: IdentitySnapshot;
  consent: ConsentSnapshot;
  configuration: MeasurementState;
  session?: SessionSnapshot;
  sessionSequence: number;
  readiness: MeasurementDebugState["session"]["readiness"];
  stopped: MeasurementStopOptions;
  outbox: StoredEnvelope[];
  protectedEvidence: Map<string, string>;
  protectedIdentityReferences: Map<"email" | "phone", Set<string>>;
  dedupe: Map<string, { at: number; result?: DeepLinkResult }>;
  lastDelivery?: DeliveryDiagnostic;
  permission: PushPermissionStatus;
  registration?: PushRegistration;
  badgeCount: number;
  deletion: { requested: boolean; completed: boolean };
  testDevice: boolean;
  signedConfiguration?: {
    keyId: string;
    version: number;
    source: "network" | "persisted";
  };
  lastSignedConfigurationRejection?: string;
}

interface RemoteMeasurementConfiguration {
  readonly collectors: {
    readonly appleAttributionEnabled: boolean;
    readonly linkAllowedDomains: ReadonlyArray<string>;
  };
  readonly conversionRules: ReadonlyArray<{
    readonly coarseValue?: "low" | "medium" | "high";
    readonly eventName: string;
    readonly fineValue: number;
    readonly lockWindow?: boolean;
    readonly minimumCount: number;
    readonly window: number;
  }>;
  readonly schemaVersion: 1;
  readonly storage: {
    readonly maxOutboxBytes: number;
    readonly maxOutboxRecords: number;
    readonly maxProtectedBytes: number;
  };
}

interface PersistedRemoteMeasurementConfiguration {
  readonly keyId: string;
  readonly payload: RemoteMeasurementConfiguration;
}

/** Platform hooks used by the unified core. Native implementations may supply all hooks. */
export interface MeasurementRuntimeAdapter {
  readonly now?: () => Date;
  readonly monotonicNowMs?: () => number;
  readonly makeId?: (prefix: string) => string;
  readonly fetch?: typeof globalThis.fetch;
  readonly isReleaseBuild?: boolean;
  readonly getPermissionStatus?: () => Promise<PushPermissionStatus>;
  readonly requestPermission?: (options?: PushPermissionOptions) => Promise<PushPermissionStatus>;
  readonly getPushToken?: () => Promise<{ readonly token: string; readonly provider: "apns" | "fcm"; readonly environment: "development" | "production" }>;
  readonly setBadgeCount?: (count: number) => Promise<void>;
  readonly openUrl?: (url: string) => Promise<boolean>;
  readonly validatePurchase?: (input: PurchaseValidationInput & { readonly requestId: string }) => Promise<{
    readonly outcome: PurchaseValidationResult["outcome"];
    readonly storeState?: PurchaseValidationResult["storeState"];
    readonly failure?: PurchaseValidationResult["failure"];
    readonly protectedResponse?: string;
  }>;
  readonly initializeMeasurement?: (
    publishableKey: string,
    configuration: {
      readonly apiUrl: string;
      readonly ingestUrl: string;
      readonly linksUrl: string;
      readonly trustedConfigKeyIds: ReadonlyArray<string>;
    },
  ) => Promise<{
    readonly installationId: string;
    readonly firstOpenedAt: string;
    readonly installationSequence: number;
  }>;
  readonly enqueueMeasurement?: (command: {
    readonly commandId: string;
    readonly recordType: string;
    readonly occurredAt: string;
    readonly source: MeasurementEnvelopeV1["source"];
    readonly priority: MeasurementPriority;
    readonly envelope: MeasurementEnvelopeV1<string, unknown>;
    readonly protectedPayload?: string;
    readonly identity: IdentitySnapshot;
    readonly consent: ConsentSnapshot;
    readonly session?: SessionSnapshot;
  }) => Promise<void>;
  readonly flushMeasurement?: () => Promise<MeasurementFlushResult>;
  readonly putProtectedEvidence?: (input: {
    readonly blobId: string;
    readonly purpose: "advertising-identifier" | "diagnostic-authorization" | "email" | "install-referrer" | "link-capture" | "partner-context" | "phone" | "purchase-receipt" | "push-token";
    readonly consentRevision: number;
    readonly retentionClass: "ephemeral" | "installation" | "legal" | "transaction";
    readonly value: Uint8Array;
  }) => Promise<string>;
  readonly deleteProtectedEvidence?: (blobId: string) => Promise<boolean>;
  readonly deleteProtectedData?: (requestId: string) => Promise<boolean>;
  readonly getMeasurementConfigurationState?: () => Promise<{
    readonly version: number;
    readonly payload?: Uint8Array;
  }>;
  readonly persistMeasurementConfigurationState?: (
    version: number,
    payload: Uint8Array,
  ) => Promise<boolean>;
  readonly applyMeasurementStorageLimits?: (
    limits: RemoteMeasurementConfiguration["storage"],
  ) => Promise<void>;
  readonly applyMeasurementConfiguration?: (
    version: number,
    payload: RemoteMeasurementConfiguration,
  ) => Promise<void>;
  readonly getPushRegistrationState?: () => Promise<Uint8Array | undefined>;
  readonly persistPushRegistrationState?: (payload: Uint8Array) => Promise<boolean>;
  readonly clearPushRegistrationState?: () => Promise<boolean>;
  readonly getTestDeviceState?: () => Promise<boolean>;
  readonly persistTestDeviceState?: (enabled: boolean) => Promise<boolean>;
  readonly subscribeNotificationEvents?: (listener: (event: {
    readonly id: string;
    readonly kind: "received" | "opened" | "tokenChanged" | "registrationError";
    readonly occurredAt: string;
    readonly protectedPayloadRef?: string;
    readonly pushNotificationSendId?: string;
    readonly link?: string;
    readonly errorCode?: string;
  }) => void) => () => void;
  readonly subscribeNativeInbox?: (listener: (entry: {
    readonly id: string;
    readonly kind: string;
    readonly source: string;
    readonly appState: string;
    readonly receivedAt: string;
    readonly value: string;
    readonly protectedEvidenceRef: string;
  }) => Promise<void>) => () => void;
  readonly waitForPendingWrites?: () => Promise<void>;
  readonly checkAndSetDedupe?: (namespace: string, key: string, expiresAtMs: number) => Promise<boolean>;
  readonly hasDedupe?: (namespace: string, key: string) => Promise<boolean>;
}

/** Construction options for the framework-independent unified core. */
export interface UnifiedMeasurementRuntimeOptions {
  readonly publishableKey: string;
  readonly baseUrl: string;
  readonly ingestUrl?: string;
  readonly linksUrl?: string;
  readonly trustedConfigKeyIds?: ReadonlyArray<string>;
  readonly trustedConfigKeys?: ReadonlyArray<{
    readonly keyId: string;
    readonly publicKeySpki: string;
  }>;
  readonly configurationProjectId?: string;
  readonly platform: "ios" | "android";
  readonly bundleId?: string;
  readonly appVersion?: string;
  readonly appBuild?: string;
  readonly platformVersion?: string;
  readonly locale?: string;
  readonly distinctId?: string;
  readonly consent?: ConsentSnapshot;
  readonly measurement?: MeasurementConfiguration;
  readonly links?: LinkConfiguration;
  readonly notifications?: NotificationsConfiguration;
  readonly adapter?: MeasurementRuntimeAdapter;
}

class TypedEventHub<T extends object> {
  private readonly listeners = new Map<keyof T, Set<(value: never) => void>>();

  on<K extends keyof T>(event: K, listener: (value: T[K]) => void): () => void {
    const listeners = this.listeners.get(event) ?? new Set<(value: never) => void>();
    listeners.add(listener as (value: never) => void);
    this.listeners.set(event, listeners);
    return () => {
      listeners.delete(listener as (value: never) => void);
    };
  }

  emit<K extends keyof T>(event: K, value: T[K]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(value as never);
  }
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const jsonDepth = (value: JsonValue, depth = 0): number => {
  if (value === null || typeof value !== "object") return depth;
  if (Array.isArray(value)) {
    return value.reduce<number>((maximum, item) => Math.max(maximum, jsonDepth(item, depth + 1)), depth);
  }
  return Object.values(value).reduce<number>(
    (maximum, item) => Math.max(maximum, jsonDepth(item, depth + 1)),
    depth,
  );
};

const assertJsonObject = (value: Readonly<Record<string, JsonValue>>, field: string): void => {
  if (jsonDepth(value) > MAX_JSON_DEPTH) {
    throw new MeasurementConfigurationError(`${field} exceeds the maximum nesting depth`, field);
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_CONTEXT_BYTES) {
    throw new MeasurementConfigurationError(`${field} exceeds the maximum encoded size`, field);
  }
};

const assertIsoCurrency = (currency: string): string => {
  const normalized = currency.trim().toUpperCase();
  if (!ISO_4217_CODES.has(normalized)) {
    throw new MeasurementInputError("Currency must be an ISO 4217 alpha-3 code", "currency");
  }
  try {
    new Intl.NumberFormat("en", { currency: normalized, style: "currency" }).format(0);
  } catch {
    throw new MeasurementInputError("Currency must be an ISO 4217 alpha-3 code", "currency");
  }
  return normalized;
};

const assertNormalizedStoreState = (state: NormalizedStorePurchaseState | undefined): void => {
  if (!state || typeof state !== "object") return;
  const allowed = new Set([
    "state", "productId", "subscriptionState", "test", "lineItems", "cancellation",
    "pause", "offer", "replacement", "prepaid", "priceChange",
  ]);
  if (Object.keys(state).some((key) => !allowed.has(key))) throw new TypeError("Unknown normalized store state field");
  if (!new Set(["purchased", "pending", "cancelled", "refunded", "expired", "paused", "grace"]).has(state.state)) {
    throw new TypeError("Unknown normalized store purchase state");
  }
  if (state.lineItems?.some((item) => !item.productId || !Number.isSafeInteger(item.quantity) || item.quantity <= 0)) {
    throw new TypeError("Invalid normalized store line item");
  }
  if (state.priceChange?.currency) assertIsoCurrency(state.priceChange.currency);
  if (state.priceChange?.price && !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/.test(state.priceChange.price)) {
    throw new TypeError("Invalid normalized store price change");
  }
};

const mergeConfiguration = (
  current: MeasurementState,
  patch: MeasurementConfigurationPatch,
): MeasurementState => {
  const allowedKeys = new Set([
    "startMode",
    "sessionTimeoutMs",
    "context",
    "defaultCurrency",
    "localeOverride",
    "collection",
    "partnerSharing",
    "partnerData",
    "purchases",
    "android",
    "ios",
    "protectedIdentity",
  ]);
  for (const key of Object.keys(patch)) {
    if (!allowedKeys.has(key)) throw new MeasurementConfigurationError(`Unknown configuration key '${key}'`, key);
  }
  if (patch.sessionTimeoutMs !== undefined && (!Number.isInteger(patch.sessionTimeoutMs) || patch.sessionTimeoutMs < 0)) {
    throw new MeasurementConfigurationError("sessionTimeoutMs must be a non-negative integer", "sessionTimeoutMs");
  }
  if (patch.defaultCurrency !== undefined) assertIsoCurrency(patch.defaultCurrency);
  if (patch.context) {
    assertJsonObject(patch.context, "context");
    assertSafePublicValue(patch.context, "context");
  }
  if (patch.partnerData) assertJsonObject(patch.partnerData, "partnerData");
  const previous = current.configuration;
  const configuration = {
    ...previous,
    ...clone(patch),
    collection: { ...DEFAULT_COLLECTION_POLICY, ...previous.collection, ...patch.collection },
    context: patch.context === undefined ? previous.context : clone(patch.context),
    purchases: patch.purchases === undefined
      ? previous.purchases
      : { ...previous.purchases, ...clone(patch.purchases) },
  };
  if (configuration.defaultCurrency) configuration.defaultCurrency = configuration.defaultCurrency.toUpperCase();
  return { configuration, revision: current.revision + 1 };
};

const consentState = (snapshot: ConsentSnapshot, policy: CollectionPolicy): ConsentState => {
  const optedOut = snapshot.collectionOptOut === true;
  return {
    snapshot: clone(snapshot),
    effective: {
      analytics: !optedOut && policy.analytics === "enabled",
      attribution: !optedOut && policy.attribution === "enabled",
      partnerSharing: !optedOut && snapshot.partnerSharingOptOut !== true,
      upload: !optedOut && policy.upload === "enabled",
    },
  };
};

const priorityForRecord = (type: string): MeasurementPriority => {
  if (type.startsWith("installation.") || type.startsWith("consent.") || type.includes("delete")) return "critical";
  if (type.startsWith("link.") || type.startsWith("purchase.") || type.startsWith("revenue.")) return "high";
  if (type.startsWith("diagnostic.")) return "low";
  return "normal";
};

/**
 * Framework-independent implementation of the four unified SDK namespaces.
 * Native collectors feed this coordinator through the `internal*` methods;
 * application code uses only `measurement`, `links`, `consent`, and `notifications`.
 */
export class UnifiedMeasurementRuntime {
  readonly measurement: MeasurementClient;
  readonly links: LinksClient;
  readonly consent: ConsentClient;
  readonly notifications: NotificationsClient;

  private readonly measurementEvents = new TypedEventHub<MeasurementEventMap>();
  private readonly notificationEvents = new TypedEventHub<NotificationEventMap>();
  private readonly linkEvents = new TypedEventHub<{ deepLink: DeepLinkResult }>();
  private readonly adapter: MeasurementRuntimeAdapter;
  private readonly options: UnifiedMeasurementRuntimeOptions;
  private readonly linkConfiguration: LinkConfiguration;
  private state: RuntimeState;
  private lastBackgroundAt?: number;
  private notificationRegistrationInFlight?: Promise<PushRegistration>;
  private notificationSubscription?: () => void;
  private nativeInboxSubscription?: () => void;
  private pendingPartnerData?: MeasurementConfiguration["partnerData"];
  private purchaseEnrichment?: NonNullable<MeasurementConfiguration["purchases"]>["enrichment"];

  constructor(options: UnifiedMeasurementRuntimeOptions) {
    this.options = options;
    this.adapter = options.adapter ?? {};
    const { wrappedDomainHeaderProvider, ...serializableLinkConfiguration } = options.links ?? {};
    this.linkConfiguration = {
      ...clone(serializableLinkConfiguration),
      wrappedDomainHeaderProvider,
    };
    const now = this.now();
    const { partnerData, purchases, ...initialMeasurement } = options.measurement ?? {};
    this.pendingPartnerData = partnerData;
    this.purchaseEnrichment = purchases?.enrichment;
    const { enrichment: _, ...serializablePurchases } = purchases ?? {};
    const initialConfiguration: MeasurementState = {
      revision: 1,
      configuration: {
        startMode: options.measurement?.startMode ?? "automatic",
        sessionTimeoutMs: options.measurement?.sessionTimeoutMs ?? 30_000,
        ...clone(initialMeasurement),
        purchases: purchases ? clone(serializablePurchases) : undefined,
        collection: { ...DEFAULT_COLLECTION_POLICY, ...options.measurement?.collection },
      },
    };
    this.state = {
      installationId: this.makeId("install"),
      firstOpenedAt: now,
      sequence: 0,
      identity: { distinctId: options.distinctId ?? `vh:anon:${this.makeId("identity")}`, revision: 1 },
      consent: clone(options.consent ?? DEFAULT_CONSENT),
      configuration: initialConfiguration,
      sessionSequence: 0,
      readiness: "uninitialized",
      stopped: {},
      outbox: [],
      protectedEvidence: new Map(),
      protectedIdentityReferences: new Map(),
      dedupe: new Map(),
      permission: "notDetermined",
      badgeCount: 0,
      deletion: { requested: false, completed: false },
      testDevice: false,
    };

    this.measurement = {
      configure: (patch) => this.configure(patch),
      start: (startOptions) => this.start(startOptions?.reason),
      stop: (stopOptions) => this.stop(stopOptions),
      handle: (input) => this.handleMeasurementInput(input),
      on: (event, listener) => this.measurementEvents.on(event, listener),
      getState: () => this.getState(),
      createSupportBundle: async () => buildMeasurementSupportBundle(await this.getState(), this.adapter.now?.() ?? new Date()),
      getInstallationId: () => Promise.resolve(this.state.installationId),
      createInviteLink: (input) => this.createInviteLink(input),
      trackInviteShare: (input) => this.trackInviteShare(input),
      trackCrossPromotion: (input) => this.trackCrossPromotion(input),
      trackAdRevenue: (input) => this.trackAdRevenue(input),
      validatePurchase: (input) => this.validatePurchase(input),
      deleteData: () => this.deleteData(),
      setTestDevice: (enabled) => this.setTestDevice(enabled),
    };
    this.links = {
      handle: (input) => this.handleLink(input),
      on: (_event, listener) => this.linkEvents.on("deepLink", listener),
    };
    this.consent = {
      set: (snapshot) => this.setConsent(snapshot),
      get: () => Promise.resolve(this.getConsentState()),
    };
    this.notifications = {
      getPermissionStatus: () => this.getPermissionStatus(),
      requestPermission: (permissionOptions) => this.requestPermission(permissionOptions),
      register: () => this.registerNotifications(),
      unregister: () => this.unregisterNotifications(),
      getRegistration: () => Promise.resolve(this.state.registration && clone(this.state.registration)),
      setBadgeCount: (count) => this.setBadgeCount(count),
      on: (event, listener) => this.notificationEvents.on(event, listener),
    };
  }

  /** Advances readiness and records first-install evidence before app events. */
  async initialize(): Promise<void> {
    if (this.state.readiness !== "uninitialized") return;
    if (this.adapter.initializeMeasurement) {
      const nativeState = await this.adapter.initializeMeasurement(
        this.options.publishableKey,
        {
          apiUrl: this.options.baseUrl,
          ingestUrl: this.options.ingestUrl ?? this.options.baseUrl,
          linksUrl: this.options.linksUrl ?? this.options.baseUrl,
          trustedConfigKeyIds: this.options.trustedConfigKeyIds ?? [],
        },
      );
      this.state.installationId = nativeState.installationId;
      this.state.firstOpenedAt = nativeState.firstOpenedAt;
      this.state.sequence = nativeState.installationSequence;
    }
    await this.loadSignedMeasurementConfiguration();
    if (this.pendingPartnerData) {
      await this.persistPartnerData(this.pendingPartnerData);
      this.pendingPartnerData = undefined;
    }
    this.state.testDevice = await this.adapter.getTestDeviceState?.() ?? false;
    await this.hydratePushRegistration();
    if (!this.notificationSubscription && this.adapter.subscribeNotificationEvents) {
      this.notificationSubscription = this.adapter.subscribeNotificationEvents((event) => {
        void this.handleNativeNotificationEvent(event);
      });
    }
    if (!this.nativeInboxSubscription && this.adapter.subscribeNativeInbox) {
      this.nativeInboxSubscription = this.adapter.subscribeNativeInbox(async (entry) => {
        if (entry.kind !== "link") return;
        const source = this.nativeLinkSource(entry.source);
        await this.handleLink(
          { source, url: entry.value, receivedAt: entry.receivedAt },
          entry.protectedEvidenceRef,
        );
      });
    }
    this.state.readiness = "nativeInitialized";
    this.enqueue(MEASUREMENT_RECORD_TYPES.INSTALLATION_CREATED, {
      firstOpenedAt: this.state.firstOpenedAt,
      appVersion: this.options.appVersion,
      appBuild: this.options.appBuild,
      collectorCapabilities: Object.keys(this.collectorStates()),
    }, "native");
    this.state.readiness = "collectorsReady";
    this.state.readiness = "sdkReady";
    if (this.state.configuration.configuration.startMode === "automatic") await this.start("coldStart");
    if (this.state.configuration.configuration.startMode === "consent-gated" && this.getConsentState().effective.analytics) {
      await this.start("coldStart");
    }
    if (this.options.notifications?.registration === "automatic") {
      const permission = await this.getPermissionStatus();
      if (permission === "authorized" || permission === "provisional" || permission === "notRequired") {
        await this.registerNotifications().catch((error) => this.emitRegistrationError(error));
      }
    }
  }

  private async handleNativeNotificationEvent(event: {
    readonly id: string;
    readonly kind: "received" | "opened" | "tokenChanged" | "registrationError";
    readonly occurredAt: string;
    readonly protectedPayloadRef?: string;
    readonly pushNotificationSendId?: string;
    readonly link?: string;
    readonly errorCode?: string;
  }): Promise<void> {
    if (event.kind === "registrationError") {
      this.emitRegistrationError(new MeasurementError({
        code: "unknownNative",
        message: "Native push registration failed",
        detail: { reason: event.errorCode ?? "unknown" },
      }));
      return;
    }
    if (event.kind === "tokenChanged") {
      if (this.state.registration) {
        await this.refreshNotificationRegistration().catch((error) => this.emitRegistrationError(error));
      } else if (this.options.notifications?.registration === "automatic") {
        await this.registerNotifications().catch((error) => this.emitRegistrationError(error));
      }
      return;
    }
    const notification: IncomingNotification = {
      id: event.id,
      pushNotificationSendId: event.pushNotificationSendId,
      receivedAt: event.occurredAt,
    };
    if (event.kind === "received") {
      this.enqueue(MEASUREMENT_RECORD_TYPES.PUSH_RECEIVED, notification, "push", event.protectedPayloadRef, event.occurredAt);
      this.notificationEvents.emit("received", notification);
      return;
    }
    await this.internalOpenNotification(notification, event.link);
  }

  private async hydratePushRegistration(): Promise<void> {
    const payload = await this.adapter.getPushRegistrationState?.();
    if (!payload) return;
    try {
      const registration = JSON.parse(new TextDecoder().decode(payload)) as PushRegistration;
      if (
        typeof registration.pushDeviceTokenId === "string" &&
        (registration.provider === "apns" || registration.provider === "fcm") &&
        (registration.environment === "development" || registration.environment === "production") &&
        Number.isFinite(Date.parse(registration.registeredAt))
      ) {
        this.state.registration = registration;
      }
    } catch {
      await this.adapter.clearPushRegistrationState?.();
    }
  }

  private async persistPushRegistration(registration: PushRegistration): Promise<void> {
    await this.adapter.persistPushRegistrationState?.(
      new TextEncoder().encode(JSON.stringify(registration)),
    );
  }

  private async loadSignedMeasurementConfiguration(): Promise<void> {
    const trustedKeys = this.options.trustedConfigKeys ?? [];
    if (trustedKeys.length === 0) return;
    const projectId = this.options.configurationProjectId;
    if (!projectId) {
      throw new MeasurementConfigurationError(
        "configurationProjectId is required when trusted configuration keys are supplied",
        "endpoints.configurationProjectId",
      );
    }

    let persistedVersion = 0;
    const persisted = await this.adapter.getMeasurementConfigurationState?.();
    if (persisted) persistedVersion = persisted.version;
    if (persisted?.payload) {
      try {
        const decoded = JSON.parse(
          new TextDecoder().decode(persisted.payload),
        ) as PersistedRemoteMeasurementConfiguration;
        await this.applyRemoteMeasurementConfiguration(decoded.payload, persisted.version);
        this.state.signedConfiguration = {
          keyId: decoded.keyId,
          source: "persisted",
          version: persisted.version,
        };
      } catch {
        this.state.lastSignedConfigurationRejection = "persisted-config-malformed";
      }
    }

    try {
      const accepted = await fetchSignedMeasurementConfiguration<RemoteMeasurementConfiguration>({
        endpoint: this.options.baseUrl,
        expectedProjectId: projectId,
        fetch: this.adapter.fetch,
        persistedVersion,
        publishableKey: this.options.publishableKey,
        trustedKeys,
      });
      await this.applyRemoteMeasurementConfiguration(accepted.payload, accepted.version);
      const persistedPayload = new TextEncoder().encode(JSON.stringify({
        keyId: accepted.keyId,
        payload: accepted.payload,
      } satisfies PersistedRemoteMeasurementConfiguration));
      if (this.adapter.persistMeasurementConfigurationState) {
        const stored = await this.adapter.persistMeasurementConfigurationState(
          accepted.version,
          persistedPayload,
        );
        if (!stored) throw new SignedConfigurationRejected("version-replay");
      }
      this.state.signedConfiguration = {
        keyId: accepted.keyId,
        source: "network",
        version: accepted.version,
      };
      this.state.lastSignedConfigurationRejection = undefined;
    } catch (error) {
      this.state.lastSignedConfigurationRejection =
        error instanceof SignedConfigurationRejected ? error.code : "unavailable";
    }
  }

  private async applyRemoteMeasurementConfiguration(
    configuration: RemoteMeasurementConfiguration,
    version: number,
  ): Promise<void> {
    const limits = configuration.storage;
    if (
      configuration.schemaVersion !== 1 ||
      !Number.isInteger(limits.maxOutboxRecords) ||
      limits.maxOutboxRecords < 1 ||
      !Number.isInteger(limits.maxOutboxBytes) ||
      limits.maxOutboxBytes < 1 ||
      !Number.isInteger(limits.maxProtectedBytes) ||
      limits.maxProtectedBytes < 1
    ) {
      throw new SignedConfigurationRejected("malformed");
    }
    await this.adapter.applyMeasurementConfiguration?.(version, configuration);
    await this.adapter.applyMeasurementStorageLimits?.(limits);
  }

  /** Records one product event with capture-time identity, consent, session, and configuration. */
  capture(eventName: string, properties: Readonly<Record<string, unknown>> = {}): string | undefined {
    const normalized = eventName.trim();
    if (!normalized) return undefined;
    if (this.state.stopped.collection || !this.getConsentState().effective.analytics) return undefined;
    assertSafePublicValue(properties);
    return this.enqueue("analytics.capture.v1", {
      eventName: normalized,
      properties: clone(properties),
      measurementContext: clone(this.state.configuration.configuration.context ?? {}),
      currency: this.state.configuration.configuration.defaultCurrency,
      localeOverride: this.state.configuration.configuration.localeOverride,
    }, "javascript");
  }

  /** Stores explicitly enabled email and phone identity traits only through the protected vault. */
  async setProtectedIdentityTraits(traits: ProtectedIdentityTraits): Promise<ProtectedIdentityUpdateResult> {
    const configuration = this.state.configuration.configuration.protectedIdentity;
    if (configuration?.enabled !== true) {
      return { status: "disabled", references: [], cleared: [] };
    }
    const cleared: Array<"email" | "phone"> = [];
    for (const [kind, requested] of [["email", traits.clearEmails], ["phone", traits.clearPhones]] as const) {
      if (!requested) continue;
      for (const reference of this.state.protectedIdentityReferences.get(kind) ?? []) {
        this.state.protectedEvidence.delete(reference);
        await this.adapter.deleteProtectedEvidence?.(reference);
      }
      this.state.protectedIdentityReferences.delete(kind);
      cleared.push(kind);
    }
    if (this.state.consent.collectionOptOut === true || this.state.consent.dataUsage === false) {
      this.enqueue("protected_identity.policy_blocked.v1", {
        fields: [traits.emails?.length ? "email" : undefined, traits.phones?.length ? "phone" : undefined].filter(Boolean),
        consentRevision: this.state.consent.revision,
      }, "javascript");
      return { status: "policyBlocked", references: [], cleared };
    }
    const normalized = normalizeProtectedIdentityTraits(traits);
    const references: string[] = [];
    for (const [kind, values, enabled] of [
      ["email", normalized.emails, configuration.email === true],
      ["phone", normalized.phones, configuration.phone === true],
    ] as const) {
      if (!enabled && values.length > 0) continue;
      for (const value of values) {
        const reference = await this.persistProtected(
          JSON.stringify(value),
          kind,
          "legal",
        );
        const current = this.state.protectedIdentityReferences.get(kind) ?? new Set<string>();
        current.add(reference);
        this.state.protectedIdentityReferences.set(kind, current);
        references.push(reference);
        this.enqueue("protected_identity.updated.v1", {
          field: kind,
          protectedPayloadRef: reference,
          provenance: value.provenance,
        }, "javascript", reference);
      }
    }
    return { status: "stored", references, cleared };
  }

  /** Captures a sequenced identity transition without modifying prior records. */
  setIdentity(distinctId: string, personId?: string): void {
    const previous = clone(this.state.identity);
    this.state.identity = {
      distinctId,
      personId,
      anonymousId: distinctId.startsWith("vh:anon:") ? distinctId : previous.anonymousId,
      revision: previous.revision + 1,
    };
    this.enqueue(MEASUREMENT_RECORD_TYPES.IDENTITY_CHANGED, {
      previous,
      current: clone(this.state.identity),
    }, "javascript");
    if (this.state.registration) {
      void this.relinkNotificationRegistration().catch((error) => this.emitRegistrationError(error));
    }
  }

  /** Returns a defensive snapshot of queued evidence for tests and native adapters. */
  inspectOutbox(): ReadonlyArray<MeasurementEnvelopeV1<string, unknown>> {
    return this.state.outbox.map((record) => clone(record.envelope));
  }

  /** Checks the durable native dedupe registry without mutating it. */
  async hasDurableDedupe(namespace: string, key: string): Promise<boolean> {
    if (this.adapter.hasDedupe) return this.adapter.hasDedupe(namespace, key);
    return this.state.dedupe.has(`${namespace}:${key}`);
  }

  /** Atomically records a durable dedupe key and reports whether it was newly inserted. */
  async checkAndSetDurableDedupe(namespace: string, key: string): Promise<boolean> {
    const expiresAtMs = Number.MAX_SAFE_INTEGER;
    if (this.adapter.checkAndSetDedupe) return this.adapter.checkAndSetDedupe(namespace, key, expiresAtMs);
    const namespaced = `${namespace}:${key}`;
    if (this.state.dedupe.has(namespaced)) return false;
    this.state.dedupe.set(namespaced, { at: this.nowMs() });
    return true;
  }

  /** Records normalized store observation while retaining receipt material only in the protected vault. */
  async recordObservedPurchase(transaction: ObservedPurchaseTransaction): Promise<string | undefined> {
    const configuration = this.state.configuration.configuration.purchases;
    if (configuration?.enabled !== true) return undefined;
    const subscription = transaction.expirationDate !== undefined || transaction.isAutoRenewing !== undefined;
    if (subscription && configuration.subscriptions === false) return undefined;
    if (!subscription && configuration.inAppPurchases === false) return undefined;
    const dedupeKey = `${transaction.platform}:${transaction.transactionId}:${transaction.purchaseDate}`;
    if (await this.hasDurableDedupe("purchase-observed", dedupeKey)) return undefined;
    const protectedPayloadRef = await this.persistProtected(JSON.stringify({
      appAccountToken: transaction.appAccountToken,
      purchaseToken: transaction.purchaseToken,
      receipt: transaction.receipt,
    }), "purchase-receipt", "transaction");
    const purchaseKind = subscription ? "subscription" : "inApp";
    const enrichmentCallback = transaction.platform === "ios"
      ? this.purchaseEnrichment?.ios
      : this.purchaseEnrichment?.android?.[purchaseKind];
    let enrichment: Readonly<Record<string, JsonValue>> | undefined;
    let enrichmentOutcome: "collected" | "failed" | "notConfigured" = "notConfigured";
    if (enrichmentCallback) {
      try {
        enrichment = clone(await enrichmentCallback(clone(transaction)));
        assertJsonObject(enrichment, "purchases.enrichment");
        assertSafePublicValue(enrichment, "purchases.enrichment");
        enrichmentOutcome = "collected";
      } catch {
        enrichment = undefined;
        enrichmentOutcome = "failed";
      }
    }
    const recordId = `purchase_${dedupeKey.replace(/[^a-zA-Z\d_-]/g, "_").slice(0, 180)}`;
    this.enqueue(MEASUREMENT_RECORD_TYPES.PURCHASE_OBSERVED, {
      acknowledged: transaction.isAcknowledged,
      environment: configuration.environment ?? "production",
      expirationDate: transaction.expirationDate,
      hasAccountToken: transaction.appAccountToken !== undefined,
      originalTransactionId: transaction.originalTransactionId,
      platform: transaction.platform,
      productId: transaction.productId,
      purchaseDate: transaction.purchaseDate,
      purchaseKind,
      purchaseState: transaction.purchaseState,
      quantity: transaction.quantity,
      transactionId: transaction.transactionId,
      enrichment,
      enrichmentOutcome,
    }, "store", protectedPayloadRef, undefined, recordId);
    await this.checkAndSetDurableDedupe("purchase-observed", dedupeKey);
    return recordId;
  }

  /** Hydrates the identity obtained during SDK initialization without inventing a transition. */
  internalHydrateIdentity(distinctId: string): void {
    if (this.state.readiness === "uninitialized") {
      this.state.identity = { ...this.state.identity, distinctId };
      return;
    }
    if (this.state.identity.distinctId !== distinctId) this.setIdentity(distinctId);
  }

  /** Returns the exact event context and state snapshot used by analytics capture. */
  getAnalyticsCaptureSnapshot(
    distinctId: string,
    standardized: Readonly<Record<string, unknown>>,
  ): { readonly context: Record<string, unknown>; readonly distinctId: string; readonly sessionId?: string } {
    return {
      distinctId,
      sessionId: this.state.session?.id,
      context: {
        schemaVersion: 1,
        installation: { id: this.state.installationId, sequence: this.state.sequence + 1 },
        identity: { ...clone(this.state.identity), distinctId },
        consentRevision: this.state.consent.revision,
        app: {
          bundleId: standardized.$bundle_id ?? this.options.bundleId ?? null,
          build: standardized.$app_build ?? this.options.appBuild ?? null,
          name: standardized.$app_name ?? null,
          version: standardized.$app_version ?? this.options.appVersion ?? null,
          sdk: standardized.$sdk ?? "react-native",
          sdkVersion: standardized.$sdk_version ?? SDK_VERSION,
        },
        device: {
          brand: standardized.$device_brand ?? null,
          name: standardized.$device_name ?? null,
          locale: this.state.configuration.configuration.localeOverride ?? standardized.$locale ?? null,
          platform: standardized.$platform ?? this.options.platform,
          platformVersion: standardized.$platform_version ?? this.options.platformVersion ?? null,
        },
        measurement: clone(this.state.configuration.configuration.context ?? {}),
      },
    };
  }

  /** Drains eligible records and emits one redacted diagnostic per record. */
  async flush(): Promise<MeasurementFlushResult> {
    if (this.state.stopped.upload || !this.getConsentState().effective.upload) {
      const policyBlocked = this.state.outbox.length;
      for (const item of this.state.outbox) this.emitDelivery(item, "policyBlocked", "uploadPaused");
      return { accepted: 0, scheduled: 0, quarantined: 0, policyBlocked };
    }
    const now = this.nowMs();
    const eligible = this.state.outbox.filter((item) => item.eligibleAt <= now);
    const nativeResult = this.adapter.flushMeasurement
      ? await this.adapter.flushMeasurement()
      : undefined;
    if (nativeResult) {
      if (nativeResult.scheduled > 0) {
        for (const item of eligible) this.emitDelivery(item, "retryScheduled", "nativeDeliveryPending");
        return nativeResult;
      }
      this.state.outbox = this.state.outbox.filter((item) => item.eligibleAt > now);
      for (const item of eligible) this.emitDelivery(item, "accepted");
      return nativeResult;
    }
    this.state.outbox = this.state.outbox.filter((item) => item.eligibleAt > now);
    for (const item of eligible) this.emitDelivery(item, "accepted");
    return { accepted: eligible.length, scheduled: this.state.outbox.length, quarantined: 0, policyBlocked: 0 };
  }

  /** Records a native notification receipt after vaulting the raw payload. */
  internalReceiveNotification(input: {
    readonly rawPayload: Readonly<Record<string, unknown>>;
    readonly title?: string;
    readonly body?: string;
    readonly pushNotificationSendId?: string;
  }): IncomingNotification {
    const protectedPayloadRef = this.vault(JSON.stringify(input.rawPayload), "push-token", "ephemeral");
    const received: IncomingNotification = {
      id: this.makeId("notification"),
      title: input.title,
      body: input.body,
      receivedAt: this.now(),
      pushNotificationSendId: input.pushNotificationSendId,
    };
    this.enqueue(MEASUREMENT_RECORD_TYPES.PUSH_RECEIVED, received, "push", protectedPayloadRef);
    this.notificationEvents.emit("received", received);
    return received;
  }

  /** Records a native notification open and routes its allowlisted link. */
  async internalOpenNotification(
    notification: IncomingNotification,
    link?: string,
  ): Promise<OpenedNotification> {
    const opened: OpenedNotification = { ...notification, openedAt: this.now(), link };
    const linkResult = link ? await this.handleLink({ source: "push", url: link }) : undefined;
    this.enqueue(MEASUREMENT_RECORD_TYPES.PUSH_OPENED, {
      notificationId: notification.id,
      pushNotificationSendId: notification.pushNotificationSendId,
      linkResolutionId: linkResult?.resolutionId,
      openedAt: opened.openedAt,
    }, "push");
    this.capture(STANDARD_EVENTS.OPENED_FROM_PUSH_NOTIFICATION, {
      notification_id: notification.id,
      ...(notification.pushNotificationSendId
        ? { push_notification_send_id: notification.pushNotificationSendId }
        : {}),
    });
    this.notificationEvents.emit("opened", opened);
    return opened;
  }

  private async configure(patch: MeasurementConfigurationPatch): Promise<MeasurementState> {
    if (patch.ios?.disableSKAD !== undefined && this.state.readiness !== "uninitialized") {
      throw new MeasurementConfigurationError("disableSKAD can only be configured before initialization", "ios.disableSKAD");
    }
    const { partnerData, purchases, ...remainingPatch } = patch;
    if (partnerData) await this.persistPartnerData(partnerData);
    if (purchases?.enrichment !== undefined) this.purchaseEnrichment = purchases.enrichment;
    const { enrichment: _, ...serializablePurchases } = purchases ?? {};
    const publicPatch: MeasurementConfigurationPatch = {
      ...remainingPatch,
      purchases: purchases ? serializablePurchases : undefined,
    };
    this.state.configuration = mergeConfiguration(this.state.configuration, publicPatch);
    return clone(this.state.configuration);
  }

  private async persistPartnerData(
    partnerData: NonNullable<MeasurementConfiguration["partnerData"]>,
  ): Promise<void> {
    const partners = Object.keys(partnerData).sort();
    if (partners.length > 64 || partners.some((partner) => !/^[a-zA-Z\d._-]{1,64}$/.test(partner))) {
      throw new MeasurementConfigurationError("Partner IDs must be 1-64 safe characters", "partnerData");
    }
    for (const [partner, value] of Object.entries(partnerData)) {
      assertJsonObject(value, `partnerData.${partner}`);
      if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 16_384) {
        throw new MeasurementConfigurationError("Partner data exceeds the per-partner size bound", `partnerData.${partner}`);
      }
    }
    const encoded = JSON.stringify(partnerData);
    if (new TextEncoder().encode(encoded).byteLength > 65_536) {
      throw new MeasurementConfigurationError("Partner data exceeds the total size bound", "partnerData");
    }
    const protectedPayloadRef = await this.persistProtected(encoded, "partner-context", "installation");
    this.enqueue(MEASUREMENT_RECORD_TYPES.PARTNER_CONTEXT_CHANGED, {
      partners,
      configurationRevision: this.state.configuration.revision + 1,
    }, "javascript", protectedPayloadRef);
  }

  private async start(reason: SessionStartReason = "manual"): Promise<SessionSnapshot> {
    if (this.state.session && this.state.readiness === "sessionStarted") return clone(this.state.session);
    this.state.sessionSequence += 1;
    const session: SessionSnapshot = {
      id: this.makeId("session"),
      sequence: this.state.sessionSequence,
      startedAt: this.now(),
      reason,
    };
    this.state.session = session;
    this.state.readiness = "sessionStarted";
    this.enqueue(MEASUREMENT_RECORD_TYPES.SESSION_STARTED, session, "native");
    this.measurementEvents.emit("session", clone(session));
    return clone(session);
  }

  private async stop(options: MeasurementStopOptions = { collection: true, upload: true, partnerSharing: true }): Promise<void> {
    this.state.stopped = { ...this.state.stopped, ...options };
  }

  /** Marks the current session backgrounded using a monotonic timestamp. */
  background(): void {
    this.lastBackgroundAt = this.adapter.monotonicNowMs?.() ?? this.nowMs();
    this.state.readiness = "backgrounded";
  }

  /** Resumes or rotates the session based on the configured inactivity threshold. */
  async foreground(): Promise<SessionSnapshot | undefined> {
    const now = this.adapter.monotonicNowMs?.() ?? this.nowMs();
    const timeout = this.state.configuration.configuration.sessionTimeoutMs;
    if (this.state.session && this.lastBackgroundAt !== undefined && now - this.lastBackgroundAt <= timeout) {
      this.state.readiness = "sessionStarted";
      return clone(this.state.session);
    }
    if (this.state.session) {
      this.enqueue(MEASUREMENT_RECORD_TYPES.SESSION_ENDED, {
        sessionId: this.state.session.id,
        durationMs: Math.max(0, now - (this.lastBackgroundAt ?? now)),
        reason: "timeout",
      }, "native");
      this.state.session = undefined;
    }
    if (this.state.configuration.configuration.startMode === "manual") {
      this.state.readiness = "sdkReady";
      return undefined;
    }
    return this.start("foreground");
  }

  private async handleMeasurementInput(input: MeasurementInput): Promise<MeasurementHandleResult> {
    if (input.type === "location") {
      const policy = this.collectionPolicy();
      if (policy.location !== "manual-only") throw new MeasurementPolicyBlocked("location");
      if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
        throw new MeasurementInputError("latitude must be between -90 and 90", "latitude");
      }
      if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
        throw new MeasurementInputError("longitude must be between -180 and 180", "longitude");
      }
      const recordId = this.enqueue("location.observed.v1", input, "javascript", undefined, input.occurredAt);
      return { accepted: true, recordId };
    }
    if (input.type === "identifier") {
      const decision = evaluateMeasurementCollection(
        "advertisingIdentifier",
        this.collectionPolicy(),
        this.state.consent,
        true,
      );
      if (!decision.allowed) throw new MeasurementPolicyBlocked("advertisingIdentifier");
      if (!input.value.trim() || input.value.length > 1_024) {
        throw new MeasurementInputError("Identifier must be 1-1024 characters", "value");
      }
      const protectedPayloadRef = await this.persistProtected(input.value, "advertising-identifier", "installation");
      const recordId = this.enqueue(MEASUREMENT_RECORD_TYPES.IDENTIFIER_OBSERVED, {
        kind: input.kind,
        outcome: "collected",
        policyBasis: decision.reason,
        manuallySupplied: true,
      }, "javascript", protectedPayloadRef);
      return { accepted: true, recordId };
    }
    const previous = this.state.consent.att;
    if (previous === input.status) {
      for (let index = this.state.outbox.length - 1; index >= 0; index -= 1) {
        const envelope = this.state.outbox[index]?.envelope;
        if (envelope?.type === MEASUREMENT_RECORD_TYPES.IOS_ATT_CHANGED) {
          return { accepted: true, recordId: envelope.recordId };
        }
      }
    }
    this.state.consent = { ...this.state.consent, att: input.status };
    const recordId = this.enqueue(MEASUREMENT_RECORD_TYPES.IOS_ATT_CHANGED, {
      previous,
      current: input.status,
      source: input.source,
    }, "javascript");
    return { accepted: true, recordId };
  }

  private async setConsent(snapshot: ConsentSnapshot): Promise<ConsentState> {
    if (!Number.isInteger(snapshot.revision) || snapshot.revision <= this.state.consent.revision) {
      throw new MeasurementInputError("Consent revision must increase monotonically", "revision");
    }
    if (!Number.isFinite(Date.parse(snapshot.decidedAt))) {
      throw new MeasurementInputError("decidedAt must be an ISO timestamp", "decidedAt");
    }
    const previous = clone(this.state.consent);
    this.state.consent = clone(snapshot);
    this.enqueue(MEASUREMENT_RECORD_TYPES.CONSENT_CHANGED, { previous, current: clone(snapshot) }, "javascript");
    const state = this.getConsentState();
    if (this.state.configuration.configuration.startMode === "consent-gated" && state.effective.analytics && !this.state.session) {
      await this.start("manual");
    }
    return state;
  }

  private getConsentState(): ConsentState {
    return consentState(this.state.consent, this.collectionPolicy());
  }

  private collectionPolicy(): CollectionPolicy {
    return { ...DEFAULT_COLLECTION_POLICY, ...this.state.configuration.configuration.collection };
  }

  private nativeLinkSource(source: string): UrlSource {
    switch (source) {
      case "appLink":
      case "universalLink":
      case "customScheme":
      case "push":
      case "deferred":
      case "esp":
        return source;
      default:
        return "manual";
    }
  }

  private async handleLink(
    input: { readonly url: string; readonly source: UrlSource; readonly receivedAt?: string },
    existingProtectedRef?: string,
  ): Promise<DeepLinkResult> {
    const resolutionId = this.makeId("resolution");
    const receivedAt = input.receivedAt ?? this.now();
    if (input.url.length > MAX_LINK_LENGTH) {
      return this.emitLinkError(resolutionId, new MeasurementInputError("Link exceeds the maximum length", "url"));
    }
    const protectedRef = existingProtectedRef ?? await this.persistProtected(input.url, "link-capture", "installation");
    this.enqueue(MEASUREMENT_RECORD_TYPES.LINK_RECEIVED, { source: input.source, receivedAt }, "native", protectedRef, receivedAt);
    let url: URL;
    try {
      const authorityStart = input.url.indexOf("://");
      const pathStart = authorityStart < 0 ? input.url.indexOf(":") + 1 : input.url.indexOf("/", authorityStart + 3);
      const rawPath = pathStart < 0 ? "" : input.url.slice(pathStart).split(/[?#]/, 1)[0] ?? "";
      if (decodeURIComponent(rawPath).split("/").some((part) => part === "..")) {
        throw new Error("path traversal");
      }
      url = new URL(input.url);
      decodeURIComponent(url.pathname);
    } catch {
      return this.emitLinkError(resolutionId, new MeasurementInputError("Link is malformed", "url"));
    }
    const ruleApplications: Array<{ readonly id: string; readonly appended: ReadonlyArray<string>; readonly missingPid: boolean }> = [];
    for (const rule of this.linkConfiguration.parameterRules ?? []) {
      if (!/^[a-zA-Z\d._-]{1,64}$/.test(rule.id)) {
        return this.emitLinkError(resolutionId, new MeasurementConfigurationError("Invalid link parameter rule ID", "links.parameterRules.id"));
      }
      const domains = (rule.match.domains ?? []).map((domain) => domain.toLowerCase().replace(/\.$/, ""));
      const matchesDomain = domains.length === 0 || domains.includes(url.hostname.toLowerCase().replace(/\.$/, ""));
      const matchesSubstring = !rule.match.contains || url.toString().includes(rule.match.contains);
      if (!matchesDomain || !matchesSubstring) continue;
      const missingPid = !url.searchParams.has("pid");
      if (missingPid && rule.requiredPid === "reject") {
        this.enqueue(MEASUREMENT_RECORD_TYPES.LINK_ROUTED, { resolutionId, ruleId: rule.id, outcome: "requiredPidMissing" }, "native");
        return this.emitLinkNotFound(resolutionId, "requiredPidMissing");
      }
      const appended: string[] = [];
      for (const [name, value] of Object.entries(rule.parameters ?? {})) {
        if (!/^[a-zA-Z\d._-]{1,64}$/.test(name) || value.length > MAX_LINK_VALUE_LENGTH || /[\r\n]/.test(value)) {
          return this.emitLinkError(resolutionId, new MeasurementConfigurationError("Invalid link rule parameter", `links.parameterRules.${rule.id}`));
        }
        if (rule.overwrite || !url.searchParams.has(name)) {
          url.searchParams.set(name, value);
          appended.push(name);
        }
      }
      if (rule.reengagement === true) {
        url.searchParams.set("is_retargeting", "true");
        appended.push("is_retargeting");
      }
      ruleApplications.push({ id: rule.id, appended: [...new Set(appended)].sort(), missingPid });
    }
    const wrappedDomains = new Set(
      (this.linkConfiguration.resolveWrappedDomains ?? []).map((item) =>
        item.toLowerCase().replace(/\.$/, ""),
      ),
    );
    if (wrappedDomains.has(url.hostname.toLowerCase().replace(/\.$/, ""))) {
      const resolved = await this.resolveWrappedLink(url, resolutionId, protectedRef);
      if (resolved instanceof MeasurementError) return this.emitLinkError(resolutionId, resolved);
      url = resolved;
    }
    const scheme = url.protocol.slice(0, -1).toLowerCase();
    const allowedSchemes = new Set((this.linkConfiguration.allowedSchemes ?? ["https"]).map((item) => item.toLowerCase()));
    if (!allowedSchemes.has(scheme) || scheme === "javascript" || scheme === "file") {
      return this.emitLinkError(resolutionId, new MeasurementInputError("Link scheme is not allowed", "url"));
    }
    const normalizedHost = url.hostname.toLowerCase().replace(/\.$/, "");
    const allowedDomains = (this.linkConfiguration.allowedDomains ?? []).map((item) => item.toLowerCase().replace(/\.$/, ""));
    if (scheme === "https" && allowedDomains.length > 0 && !allowedDomains.includes(normalizedHost)) {
      return this.emitLinkNotFound(resolutionId, "domainNotAllowed");
    }
    if (decodeURIComponent(url.pathname).split("/").some((part) => part === "..")) {
      return this.emitLinkError(resolutionId, new MeasurementInputError("Link path traversal is not allowed", "url"));
    }
    const seen = new Set<string>();
    for (const [key, value] of url.searchParams) {
      if (seen.has(key)) return this.emitLinkError(resolutionId, new MeasurementInputError("Duplicate query fields are not allowed", key));
      if (value.length > MAX_LINK_VALUE_LENGTH) return this.emitLinkError(resolutionId, new MeasurementInputError("Link value exceeds the maximum length", key));
      seen.add(key);
    }
    const dedupeKey = `${scheme}://${normalizedHost}${url.pathname}?${[...url.searchParams.entries()].sort().map(([key, value]) => `${key}=${value}`).join("&")}`;
    const previous = this.state.dedupe.get(`link:${dedupeKey}`);
    const dedupeWindow = this.linkConfiguration.dedupeWindowMs ?? 5_000;
    if (previous?.result && this.nowMs() - previous.at <= dedupeWindow) return clone(previous.result);
    const routeValue = url.searchParams.get("deep_link_value") ?? url.pathname.split("/").filter(Boolean).at(-1);
    if (!routeValue) return this.emitLinkNotFound(resolutionId, "routeMissing");
    const subvalues: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10, string>> = {};
    for (let index = 1; index <= 10; index += 1) {
      const value = url.searchParams.get(`deep_link_sub${index}`);
      if (value) subvalues[index as keyof typeof subvalues] = value;
    }
    const result: DeepLinkResult = {
      status: "found",
      resolutionId,
      direct: input.source !== "deferred",
      deferred: input.source === "deferred",
      linkId: url.searchParams.get("link_id") ?? url.searchParams.get("click_id") ?? undefined,
      route: { value: routeValue, subvalues },
      campaign: {
        campaign: url.searchParams.get("campaign") ?? url.searchParams.get("c") ?? undefined,
        channel: url.searchParams.get("channel") ?? undefined,
        mediaSource: url.searchParams.get("media_source") ?? url.searchParams.get("pid") ?? undefined,
      },
      receivedAt,
      resolvedAt: this.now(),
    };
    this.state.dedupe.set(`link:${dedupeKey}`, { at: this.nowMs(), result });
    this.enqueue(MEASUREMENT_RECORD_TYPES.LINK_RESOLVED, { ...result, ruleApplications }, "native");
    this.linkEvents.emit("deepLink", clone(result));
    return clone(result);
  }

  private async resolveWrappedLink(
    initialUrl: URL,
    resolutionId: string,
    protectedPayloadRef: string,
  ): Promise<URL | MeasurementError> {
    const fetcher = this.adapter.fetch ?? globalThis.fetch;
    if (!fetcher) return new MeasurementCapabilityUnavailable("links.wrappedResolution", "notConfigured");
    const maximumRedirects = this.linkConfiguration.maxRedirects ?? 5;
    const timeoutMs = this.linkConfiguration.resolutionTimeoutMs ?? 5_000;
    const seen = new Set<string>();
    const hops: Array<{
      readonly durationMs: number;
      readonly host: string;
      readonly scheme: string;
      readonly status: number;
    }> = [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let current = initialUrl;
    let outcome = "resolved";
    try {
      for (let index = 0; index <= maximumRedirects; index += 1) {
        if (
          current.protocol !== "https:" &&
          !(this.linkConfiguration.allowInsecureRedirects === true && current.protocol === "http:")
        ) {
          outcome = "insecureRedirect";
          return new MeasurementError({
            code: "transport",
            message: "Wrapped link resolution refused an insecure redirect",
            detail: { reason: outcome },
          });
        }
        const normalized = this.normalizeRedirectIdentity(current);
        if (seen.has(normalized)) {
          outcome = "redirectLoop";
          return new MeasurementError({
            code: "transport",
            message: "Wrapped link resolution detected a redirect loop",
            detail: { reason: outcome },
          });
        }
        seen.add(normalized);
        const startedAt = this.nowMs();
        const isConfiguredWrappedDomain = (this.linkConfiguration.resolveWrappedDomains ?? [])
          .map((item) => item.toLowerCase().replace(/\.$/, ""))
          .includes(current.hostname.toLowerCase().replace(/\.$/, ""));
        const supplied = isConfiguredWrappedDomain
          ? await this.linkConfiguration.wrappedDomainHeaderProvider?.(current.origin)
          : undefined;
        const headers = new Headers();
        for (const [name, value] of Object.entries(supplied ?? {})) {
          if (/\r|\n/.test(name) || /\r|\n/.test(value)) {
            outcome = "invalidHeaders";
            return new MeasurementError({
              code: "invalidConfiguration",
              message: "Wrapped-domain headers contain invalid characters",
              detail: { reason: outcome },
            });
          }
          headers.set(name, value);
        }
        let response: Response;
        for (;;) {
          try {
            response = await fetcher(current.toString(), {
              headers,
              method: "GET",
              redirect: "manual",
              signal: controller.signal,
            });
            break;
          } catch (error) {
            if (controller.signal.aborted) throw error;
            await new Promise<void>((resolve, reject) => {
              const retry = setTimeout(resolve, this.linkConfiguration.wrappedRetryDelayMs ?? 100);
              controller.signal.addEventListener("abort", () => {
                clearTimeout(retry);
                reject(new DOMException("Aborted", "AbortError"));
              }, { once: true });
            });
          }
        }
        hops.push({
          durationMs: Math.max(0, this.nowMs() - startedAt),
          host: current.hostname.toLowerCase().replace(/\.$/, ""),
          scheme: current.protocol.slice(0, -1),
          status: response.status,
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) return current;
        if (index >= maximumRedirects) {
          outcome = "redirectLimit";
          return new MeasurementError({
            code: "transport",
            message: "Wrapped link resolution exceeded its redirect limit",
            detail: { reason: outcome },
          });
        }
        const location = response.headers.get("location");
        if (!location) {
          outcome = "missingLocation";
          return new MeasurementError({
            code: "transport",
            message: "Wrapped link redirect omitted its destination",
            detail: { reason: outcome },
          });
        }
        current = new URL(location, current);
        if (current.protocol !== "http:" && current.protocol !== "https:") return current;
      }
      outcome = "redirectLimit";
      return new MeasurementError({
        code: "transport",
        message: "Wrapped link resolution exceeded its redirect limit",
        detail: { reason: outcome },
      });
    } catch (error) {
      outcome = controller.signal.aborted ? "timeout" : "transport";
      return new MeasurementError({
        code: controller.signal.aborted ? "timeout" : "transport",
        message: controller.signal.aborted
          ? "Wrapped link resolution timed out"
          : "Wrapped link resolution failed",
        detail: { reason: outcome },
      });
    } finally {
      clearTimeout(timeout);
      this.enqueue("link.redirect_evidence.v1", {
        hops,
        outcome,
        resolutionId,
      }, "native", protectedPayloadRef);
    }
  }

  private normalizeRedirectIdentity(url: URL): string {
    const normalized = new URL(url.toString());
    normalized.hostname = normalized.hostname.toLowerCase().replace(/\.$/, "");
    normalized.hash = "";
    normalized.search = [...normalized.searchParams.entries()]
      .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
      )
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
    return normalized.toString();
  }

  private emitLinkNotFound(resolutionId: string, reason: string): DeepLinkResult {
    const result: DeepLinkResult = { status: "notFound", reason, resolutionId };
    this.enqueue(MEASUREMENT_RECORD_TYPES.LINK_RESOLVED, result, "native");
    this.linkEvents.emit("deepLink", result);
    return result;
  }

  private emitLinkError(resolutionId: string, error: MeasurementError): DeepLinkResult {
    const result: DeepLinkResult = { status: "error", resolutionId, error };
    this.enqueue(MEASUREMENT_RECORD_TYPES.LINK_RESOLVED, {
      status: "error",
      resolutionId,
      error: { code: error.code, message: error.message, source: error.source },
    }, "native");
    this.linkEvents.emit("deepLink", result);
    this.measurementEvents.emit("attributionError", error);
    return result;
  }

  private async trackAdRevenue(input: AdRevenueInput): Promise<void> {
    if (!input.impressionId.trim() || !input.monetizationNetwork.trim()) {
      throw new MeasurementInputError("Ad revenue requires impressionId and monetizationNetwork");
    }
    const allowedMediation = new Set([
      "ironsource", "applovin_max", "google_admob", "fyber", "appodeal", "admost", "topon",
      "tradplus", "yandex", "chartboost", "unity", "topon_pte", "custom_mediation",
      "direct_monetization_network",
    ]);
    if (!allowedMediation.has(input.mediationNetwork)) throw new MeasurementInputError("Unknown mediation network", "mediationNetwork");
    const currency = assertIsoCurrency(input.currency);
    if (!/^-?(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/.test(input.revenue)) {
      throw new MeasurementInputError("Revenue must be a bounded decimal string with at most 8 fractional digits", "revenue");
    }
    if (input.additionalParameters) assertSafePublicValue(input.additionalParameters, "additionalParameters");
    const dedupeKey = `ad-revenue:${input.impressionId}`;
    if (this.state.dedupe.has(dedupeKey)) return;
    this.state.dedupe.set(dedupeKey, { at: this.nowMs() });
    this.enqueue(MEASUREMENT_RECORD_TYPES.AD_REVENUE, { ...clone(input), currency }, "javascript");
  }

  private async validatePurchase(input: PurchaseValidationInput): Promise<PurchaseValidationResult> {
    const allowedKeys = new Set(["transactionId", "platform", "protectedEvidenceId", "environment", "idempotencyKey"]);
    for (const key of Object.keys(input)) if (!allowedKeys.has(key)) throw new MeasurementInputError(`Unknown purchase validation field '${key}'`, key);
    if (!input.transactionId || !input.protectedEvidenceId) throw new MeasurementInputError("Purchase validation requires an opaque transaction and protected evidence reference");
    const environment = input.environment ?? this.state.configuration.configuration.purchases?.environment ?? "production";
    if (environment === "sandbox" && this.adapter.isReleaseBuild === true) {
      throw new MeasurementConfigurationError("Sandbox purchase validation is forbidden in release builds", "purchases.environment");
    }
    const requestId = this.makeId("purchase-validation");
    this.enqueue(MEASUREMENT_RECORD_TYPES.PURCHASE_VALIDATION_REQUESTED, {
      requestId,
      transactionId: input.transactionId,
      environment,
      idempotencyKey: input.idempotencyKey ?? requestId,
      protectedEvidenceId: input.protectedEvidenceId,
    }, "javascript");
    let result: PurchaseValidationResult;
    let protectedResponseRef: string | undefined;
    if (!this.adapter.validatePurchase) {
      result = {
        requestId,
        transactionId: input.transactionId,
        outcome: "indeterminate",
        failure: { kind: "configuration", message: "No purchase validation transport is configured" },
      };
    } else {
      try {
        const response = await this.adapter.validatePurchase({ ...input, environment, requestId });
        if (response.outcome !== "valid" && response.outcome !== "invalid" && response.outcome !== "indeterminate") {
          throw new TypeError("Invalid purchase validation response");
        }
        if (response.outcome === "invalid" && response.failure) {
          throw new TypeError("Store-invalid validation must not contain a transport failure");
        }
        assertNormalizedStoreState(response.storeState);
        protectedResponseRef = response.protectedResponse
          ? await this.persistProtected(response.protectedResponse, "purchase-receipt", "transaction")
          : undefined;
        result = {
          requestId,
          transactionId: input.transactionId,
          outcome: response.outcome,
          storeState: response.storeState,
          failure: response.failure,
        };
      } catch (error) {
        const failure = typeof error === "object" && error !== null && "kind" in error &&
          new Set(["network", "store", "configuration", "server"]).has(String(error.kind))
          ? String(error.kind) as NonNullable<PurchaseValidationResult["failure"]>["kind"]
          : "server";
        result = {
          requestId,
          transactionId: input.transactionId,
          outcome: "indeterminate",
          failure: { kind: failure, message: error instanceof Error ? error.message : "Purchase validation failed" },
        };
      }
    }
    this.enqueue(MEASUREMENT_RECORD_TYPES.PURCHASE_VALIDATION_RESULT, result, "server-correlation", protectedResponseRef);
    this.measurementEvents.emit("purchaseValidation", clone(result));
    return result;
  }

  private async createInviteLink(input: InviteLinkInput): Promise<GeneratedLink> {
    if (!input.deepLinkValue.trim()) throw new MeasurementInputError("deepLinkValue is required", "deepLinkValue");
    const limitedValues = [
      input.channel, input.campaign, input.referrerCustomerId, input.referrerUid,
      input.referrerName, input.referrerImageUrl, input.baseDeepLink, input.brandedDomain,
      input.appleAppId, ...Object.values(input.deepLinkSubvalues ?? {}),
    ];
    if (limitedValues.some((value) => value !== undefined && value.length > 1_024)) {
      throw new MeasurementInputError("Invite link fields must not exceed 1024 characters");
    }
    const customParameters: Record<string, string> = {};
    const allowed = new Set(this.linkConfiguration.allowedCustomParameters ?? []);
    for (const [key, value] of Object.entries(input.customParameters ?? {})) {
      if (!allowed.has(key)) throw new MeasurementInputError(`Invite parameter '${key}' is not allowlisted`, key);
      if (typeof value !== "string" || value.length > 1_024) {
        throw new MeasurementInputError("Invite custom parameters must be strings up to 1024 characters", key);
      }
      customParameters[key] = value;
    }
    const request: LinksCreateLinkRequest = {
      brandedDomain: input.brandedDomain,
      campaign: { campaign: input.campaign, channel: input.channel },
      customParameters,
      destination: {
        appleAppId: input.appleAppId,
        baseDeepLink: input.baseDeepLink,
        deepLinkValue: input.deepLinkValue,
        subvalues: Object.fromEntries(Object.entries(input.deepLinkSubvalues ?? {})),
      },
      referrerCustomerId: input.referrerCustomerId,
      referrerImageUrl: input.referrerImageUrl,
      referrerName: input.referrerName,
      referrerUid: input.referrerUid,
      templateId: this.linkConfiguration.templateId,
      token: this.options.publishableKey,
    };
    const fetcher = this.adapter.fetch ?? globalThis.fetch;
    let response: Response;
    try {
      response = await fetcher(
        `${(this.options.linksUrl ?? this.options.baseUrl).replace(/\/$/, "")}/l/v1/links`,
        { body: JSON.stringify(request), headers: { "content-type": "application/json" }, method: "POST" },
      );
    } catch {
      throw new MeasurementError({ code: "transport", message: "Invite link creation failed" });
    }
    if (!response.ok) {
      throw new MeasurementError({ code: "transport", message: `Invite link creation returned HTTP ${response.status}` });
    }
    const generated = await response.json() as Partial<GeneratedLink>;
    if (typeof generated.linkId !== "string" || typeof generated.url !== "string") {
      throw new MeasurementError({ code: "transport", message: "Invite link creation returned an invalid response" });
    }
    return { linkId: generated.linkId, url: generated.url, expiresAt: generated.expiresAt };
  }

  private async trackInviteShare(input: { readonly linkId: string; readonly channel: string }): Promise<void> {
    if (!input.linkId.trim() || !input.channel.trim()) {
      throw new MeasurementInputError("Invite sharing requires linkId and channel");
    }
    this.capture(STANDARD_EVENTS.INVITE_SHARED, { channel: input.channel, link_id: input.linkId });
  }

  private async trackCrossPromotion(input: CrossPromotionInput): Promise<CrossPromotionResult> {
    if (!input.promotedAppId.trim()) throw new MeasurementInputError("promotedAppId is required", "promotedAppId");
    if (input.parameters) assertSafePublicValue(input.parameters, "parameters");
    const recordId = this.capture(`cross promotion ${input.action}`, {
      campaign: input.campaign,
      parameters: input.parameters,
      promoted_app_id: input.promotedAppId,
    });
    if (!recordId) throw new MeasurementPolicyBlocked("analytics");
    if (input.action === "impression") return { recordId };
    const link = await this.createInviteLink({ campaign: input.campaign, deepLinkValue: input.promotedAppId });
    if (!this.adapter.openUrl) throw new MeasurementCapabilityUnavailable("openUrl", "notConfigured");
    return { link, opened: await this.adapter.openUrl(link.url), recordId };
  }

  private async getPermissionStatus(): Promise<PushPermissionStatus> {
    this.state.permission = this.adapter.getPermissionStatus
      ? await this.adapter.getPermissionStatus()
      : this.state.permission;
    return this.state.permission;
  }

  private async requestPermission(options?: PushPermissionOptions): Promise<PushPermissionStatus> {
    if (!this.adapter.requestPermission) throw new MeasurementCapabilityUnavailable("notifications.permission", "notConfigured");
    this.state.permission = await this.adapter.requestPermission(options);
    return this.state.permission;
  }

  private async registerNotifications(): Promise<PushRegistration> {
    if (this.state.registration) return clone(this.state.registration);
    if (this.notificationRegistrationInFlight) return this.notificationRegistrationInFlight;
    if (!this.adapter.getPushToken) throw new MeasurementCapabilityUnavailable("notifications.registration", "notConfigured");
    const operation = (async () => {
      const token = await this.adapter.getPushToken!();
      const protectedRef = await this.persistProtected(token.token, "push-token", "installation");
      const response = await this.postPushDevice("register", {
        bundleId: this.options.bundleId,
        environment: token.provider === "apns"
          ? token.environment === "development" ? "sandbox" : "production"
          : undefined,
        platform: this.options.platform,
        platformToken: token.token,
        provider: token.provider,
      });
      const pushDeviceTokenId = (response as { pushDeviceTokenId?: unknown }).pushDeviceTokenId;
      if (typeof pushDeviceTokenId !== "string" || !pushDeviceTokenId) {
        throw new MeasurementError({ code: "transport", message: "Push registration returned an invalid response" });
      }
      this.state.protectedEvidence.delete(protectedRef);
      await this.adapter.deleteProtectedEvidence?.(protectedRef);
      const registration: PushRegistration = {
        pushDeviceTokenId,
        provider: token.provider,
        environment: token.environment,
        registeredAt: this.now(),
      };
      this.state.registration = registration;
      await this.persistPushRegistration(registration);
      this.enqueue(MEASUREMENT_RECORD_TYPES.PUSH_TOKEN, registration, "push");
      this.notificationEvents.emit("tokenChanged", clone(registration));
      return clone(registration);
    })();
    this.notificationRegistrationInFlight = operation;
    try {
      return await operation;
    } catch (error) {
      this.emitRegistrationError(error);
      throw error;
    } finally {
      this.notificationRegistrationInFlight = undefined;
    }
  }

  private async unregisterNotifications(): Promise<void> {
    if (!this.state.registration) return;
    await this.postPushDevice("unregister", {
      pushDeviceTokenId: this.state.registration.pushDeviceTokenId,
    });
    this.state.registration = undefined;
    await this.adapter.clearPushRegistrationState?.();
  }

  private async relinkNotificationRegistration(): Promise<void> {
    const previous = this.state.registration;
    if (!previous || !this.adapter.getPushToken) return;
    const token = await this.adapter.getPushToken();
    const response = await this.postPushDevice("register", {
      bundleId: this.options.bundleId,
      environment: token.provider === "apns"
        ? token.environment === "development" ? "sandbox" : "production"
        : undefined,
      platform: this.options.platform,
      platformToken: token.token,
      previousPushDeviceTokenId: previous.pushDeviceTokenId,
      provider: token.provider,
    });
    const pushDeviceTokenId = (response as { pushDeviceTokenId?: unknown }).pushDeviceTokenId;
    if (typeof pushDeviceTokenId !== "string" || !pushDeviceTokenId) {
      throw new MeasurementError({ code: "transport", message: "Push re-link returned an invalid response" });
    }
    this.state.registration = {
      ...previous,
      pushDeviceTokenId,
      registeredAt: this.now(),
    };
    await this.persistPushRegistration(this.state.registration);
    this.enqueue(MEASUREMENT_RECORD_TYPES.PUSH_TOKEN, {
      ...this.state.registration,
      previousPushDeviceTokenId: previous.pushDeviceTokenId,
      reason: "identityChanged",
    }, "push");
  }

  private async refreshNotificationRegistration(): Promise<void> {
    const registration = this.state.registration;
    if (!registration || !this.adapter.getPushToken) return;
    const token = await this.adapter.getPushToken();
    const protectedRef = await this.persistProtected(token.token, "push-token", "installation");
    await this.postPushDevice("refresh", {
      platformToken: token.token,
      pushDeviceTokenId: registration.pushDeviceTokenId,
    });
    this.state.protectedEvidence.delete(protectedRef);
    await this.adapter.deleteProtectedEvidence?.(protectedRef);
    const refreshed = { ...registration, environment: token.environment, provider: token.provider };
    this.state.registration = refreshed;
    await this.persistPushRegistration(refreshed);
    this.enqueue(MEASUREMENT_RECORD_TYPES.PUSH_TOKEN, {
      ...refreshed,
      reason: "tokenRotated",
    }, "push");
    this.notificationEvents.emit("tokenChanged", clone(refreshed));
  }

  private async postPushDevice(
    operation: "register" | "refresh" | "unregister",
    payload: Readonly<Record<string, unknown>>,
  ): Promise<unknown> {
    const fetcher = this.adapter.fetch ?? globalThis.fetch;
    if (!fetcher) throw new MeasurementCapabilityUnavailable("notifications.registration", "notConfigured");
    const response = await fetcher(
      `${this.options.baseUrl.replace(/\/$/, "")}/api/v1/sdk/push-devices/${operation}`,
      {
        body: JSON.stringify(payload),
        headers: {
          "content-type": "application/json",
          "x-client-bundle-id": this.options.bundleId ?? "unknown",
          "x-distinct-id": this.state.identity.distinctId,
          "x-is-backgrounded": "false",
          "x-is-debug-build": "false",
          "x-nonce": getNonce(),
          "x-observer-mode": "false",
          "x-platform": this.options.platform,
          "x-platform-flavor": "native",
          "x-publishable-key": this.options.publishableKey,
          "x-sdk": "react-native",
          "x-sdk-version": SDK_VERSION,
        },
        method: "POST",
      },
    );
    if (!response.ok) {
      throw new MeasurementError({
        code: "transport",
        message: `Push device ${operation} failed`,
        detail: { status: response.status },
      });
    }
    if (response.status === 204 || response.headers.get("content-length") === "0") return undefined;
    return response.json();
  }

  private async setBadgeCount(count: number): Promise<void> {
    if (!Number.isInteger(count) || count < 0) throw new MeasurementInputError("Badge count must be a non-negative integer", "count");
    if (!this.adapter.setBadgeCount) throw new MeasurementCapabilityUnavailable("notifications.badge", "notConfigured");
    await this.adapter.setBadgeCount(count);
    this.state.badgeCount = count;
  }

  private emitRegistrationError(error: unknown): void {
    const mapped = error instanceof MeasurementError
      ? error
      : new MeasurementError({ code: "unknownNative", message: "Notification registration failed", cause: error });
    this.notificationEvents.emit("registrationError", mapped);
  }

  private async deleteData(): Promise<{ readonly requestId: string; readonly status: "accepted" }> {
    const requestId = this.makeId("deletion");
    this.state.deletion = { requested: true, completed: false };
    this.enqueue("measurement.deletion_requested.v1", { requestId }, "javascript");
    await this.adapter.waitForPendingWrites?.();
    await this.adapter.deleteProtectedData?.(requestId);
    this.state.protectedEvidence.clear();
    this.state.protectedIdentityReferences.clear();
    this.state.deletion = { requested: true, completed: true };
    return { requestId, status: "accepted" };
  }

  private async setTestDevice(enabled: boolean): Promise<void> {
    await this.adapter.persistTestDeviceState?.(enabled);
    this.state.testDevice = enabled;
  }

  private async getState(): Promise<MeasurementDebugState> {
    const counts: Record<MeasurementPriority, number> = { critical: 0, high: 0, normal: 0, low: 0 };
    for (const item of this.state.outbox) counts[item.priority] += 1;
    const oldest = this.state.outbox.reduce<number | undefined>((value, item) => {
      const queuedAt = Date.parse(item.envelope.queuedAt);
      return value === undefined ? queuedAt : Math.min(value, queuedAt);
    }, undefined);
    const configuration = this.state.configuration.configuration;
    return {
      versions: { sdk: SDK_VERSION, native: "1", envelopeSchema: 1, configSchema: 1 },
      installation: { id: this.state.installationId, sequence: this.state.sequence, firstOpenedAt: this.state.firstOpenedAt },
      session: { current: this.state.session && clone(this.state.session), readiness: this.state.readiness, stopped: clone(this.state.stopped) },
      outbox: {
        counts,
        total: this.state.outbox.length,
        oldestAgeMs: oldest === undefined ? undefined : Math.max(0, this.nowMs() - oldest),
        lastDelivery: this.state.lastDelivery && clone(this.state.lastDelivery),
      },
      consent: this.getConsentState(),
      configuration: {
        revision: this.state.configuration.revision,
        startMode: configuration.startMode,
        sessionTimeoutMs: configuration.sessionTimeoutMs,
        defaultCurrency: configuration.defaultCurrency,
        localeOverride: configuration.localeOverride,
        contextKeys: Object.keys(configuration.context ?? {}).sort(),
        endpoints: {
          api: this.options.baseUrl,
          ingest: this.options.ingestUrl ?? this.options.baseUrl,
          links: this.options.linksUrl ?? this.options.baseUrl,
          trustedConfigKeyIds: [...(this.options.trustedConfigKeyIds ?? [])],
        },
        signed: this.state.signedConfiguration && clone(this.state.signedConfiguration),
        lastSignedConfigurationRejection: this.state.lastSignedConfigurationRejection,
      },
      collectors: this.collectorStates(),
      manifest: { present: false },
      deletion: clone(this.state.deletion),
      testDevice: this.state.testDevice,
    };
  }

  private collectorStates(): MeasurementDebugState["collectors"] {
    return {
      links: this.linkConfiguration.allowedDomains?.length || this.linkConfiguration.allowedSchemes?.length ? "available" : "notConfigured",
      referrer: "notConfigured",
      push: this.adapter.getPushToken ? "available" : "notConfigured",
      purchases: this.state.configuration.configuration.purchases?.enabled ? "available" : "notConfigured",
      advertisingIdentifiers: this.collectionPolicy().advertisingIdentifiers === "denied" ? "disabled" : "notConfigured",
      vendorIdentifiers: this.collectionPolicy().vendorIdentifiers === "denied" ? "disabled" : "notConfigured",
      networkMetadata: this.collectionPolicy().networkMetadata === "denied" ? "disabled" : "notConfigured",
      appleAds: this.state.configuration.configuration.ios?.collectAppleAds ? "available" : "notConfigured",
      skan: this.state.configuration.configuration.ios?.disableSKAD ? "disabled" : "noRules",
      adAttributionKit: this.state.configuration.configuration.ios?.disableSKAD ? "disabled" : "noRules",
    };
  }

  private enqueue(
    type: string,
    publicPayload: unknown,
    source: MeasurementEnvelopeV1["source"],
    protectedPayloadRef?: string,
    occurredAt = this.now(),
    recordId?: string,
  ): string {
    this.state.sequence += 1;
    const queuedAt = this.now();
    const envelope: MeasurementEnvelopeV1<string, unknown> = {
      schemaVersion: 1,
      recordId: recordId ?? this.makeId("record"),
      type,
      occurredAt,
      queuedAt,
      installationId: this.state.installationId,
      installationSequence: this.state.sequence,
      session: this.state.session && clone(this.state.session),
      identity: clone(this.state.identity),
      consent: clone(this.state.consent),
      app: this.appSnapshot(),
      device: this.deviceSnapshot(),
      source,
      publicPayload: clone(publicPayload),
      protectedPayloadRef,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(envelope)).byteLength;
    this.state.outbox.push({ envelope, priority: priorityForRecord(type), bytes, attempts: 0, eligibleAt: this.nowMs() });
    void this.adapter.enqueueMeasurement?.({
      commandId: envelope.recordId,
      recordType: envelope.type,
      occurredAt: envelope.occurredAt,
      source: envelope.source,
      priority: priorityForRecord(type),
      envelope: clone(envelope),
      protectedPayload: protectedPayloadRef,
      identity: clone(envelope.identity),
      consent: clone(envelope.consent),
      session: envelope.session && clone(envelope.session),
    }).catch((error) => {
      const mapped = error instanceof MeasurementError
        ? error
        : new MeasurementError({ code: "unknownNative", message: "Native measurement enqueue failed", cause: error });
      this.measurementEvents.emit("error", mapped);
    });
    this.enforceOutboxBounds();
    return envelope.recordId;
  }

  private enforceOutboxBounds(): void {
    let bytes = this.state.outbox.reduce((total, item) => total + item.bytes, 0);
    while (this.state.outbox.length > MAX_OUTBOX_RECORDS || bytes > MAX_OUTBOX_BYTES) {
      const index = this.state.outbox.findIndex(
        (item) => item.priority === "low" && !NON_EVICTABLE_RECORD_TYPES.has(item.envelope.type),
      );
      const fallback = this.state.outbox.findIndex(
        (item) => item.priority === "normal" && !NON_EVICTABLE_RECORD_TYPES.has(item.envelope.type),
      );
      const evictionIndex = index >= 0 ? index : fallback;
      if (evictionIndex < 0) throw new MeasurementError({ code: "transport", message: "Measurement outbox is full of protected-priority evidence" });
      const [evicted] = this.state.outbox.splice(evictionIndex, 1);
      bytes -= evicted?.bytes ?? 0;
    }
  }

  private emitDelivery(item: StoredEnvelope, outcome: DeliveryDiagnostic["outcome"], reason?: string): void {
    const diagnostic: DeliveryDiagnostic = {
      recordId: item.envelope.recordId,
      requestId: this.makeId("request"),
      outcome,
      reason,
      attemptCount: item.attempts + 1,
      occurredAt: this.now(),
    };
    this.state.lastDelivery = diagnostic;
    this.measurementEvents.emit("delivery", clone(diagnostic));
  }

  private vault(
    value: string,
    purpose: "advertising-identifier" | "diagnostic-authorization" | "email" | "install-referrer" | "link-capture" | "partner-context" | "phone" | "purchase-receipt" | "push-token" = "diagnostic-authorization",
    retentionClass: "ephemeral" | "installation" | "legal" | "transaction" = "installation",
  ): string {
    const reference = this.makeId("protected");
    this.state.protectedEvidence.set(reference, value);
    void this.adapter.putProtectedEvidence?.({
      blobId: reference,
      purpose,
      consentRevision: this.state.consent.revision,
      retentionClass,
      value: new TextEncoder().encode(value),
    }).catch((error) => {
      const mapped = error instanceof MeasurementError
        ? error
        : new MeasurementError({ code: "unknownNative", message: "Protected evidence persistence failed", cause: error });
      this.measurementEvents.emit("error", mapped);
    });
    return reference;
  }

  private async persistProtected(
    value: string,
    purpose: "advertising-identifier" | "diagnostic-authorization" | "email" | "install-referrer" | "link-capture" | "partner-context" | "phone" | "purchase-receipt" | "push-token",
    retentionClass: "ephemeral" | "installation" | "legal" | "transaction",
  ): Promise<string> {
    const reference = this.makeId("protected");
    this.state.protectedEvidence.set(reference, value);
    try {
      await this.adapter.putProtectedEvidence?.({
        blobId: reference,
        purpose,
        consentRevision: this.state.consent.revision,
        retentionClass,
        value: new TextEncoder().encode(value),
      });
      return reference;
    } catch (error) {
      this.state.protectedEvidence.delete(reference);
      const mapped = error instanceof MeasurementError
        ? error
        : new MeasurementError({ code: "unknownNative", message: "Protected evidence persistence failed", cause: error });
      this.measurementEvents.emit("error", mapped);
      throw mapped;
    }
  }

  private appSnapshot(): AppSnapshot {
    return { bundleId: this.options.bundleId, build: this.options.appBuild, version: this.options.appVersion };
  }

  private deviceSnapshot(): DeviceSnapshot {
    return {
      platform: this.options.platform,
      platformVersion: this.options.platformVersion,
      locale: this.state.configuration.configuration.localeOverride ?? this.options.locale,
    };
  }

  private now(): string {
    return (this.adapter.now?.() ?? new Date()).toISOString();
  }

  private nowMs(): number {
    return this.adapter.now?.().getTime() ?? Date.now();
  }

  private makeId(prefix: string): string {
    return this.adapter.makeId?.(prefix) ?? `${prefix}_${getNonce()}`;
  }
}
