import type * as Option from "effect/Option";

export type VoidhashTraitValue = string | number | boolean | Option.Option<never>;

export type VoidhashTraits = Record<string, VoidhashTraitValue>;

/**
 * Person attributes accepted by `setPersonAttributes` /
 * `setPersonAttributesSync`. `email` and `name` are reserved fields; every
 * other key is treated as a free-form person trait.
 */
export type VoidhashPersonAttributes = {
  readonly email?: string;
  readonly name?: string;
} & Readonly<Record<string, VoidhashTraitValue>>;

export interface FeatureFlagEntry {
  readonly enabled: boolean;
  readonly key: string;
  readonly payload: unknown;
  readonly variantKey: Option.Option<string>;
}

export interface FeatureFlagsResult {
  readonly flags: ReadonlyArray<FeatureFlagEntry>;
  /** `true` when the value was served past its hard TTL. */
  readonly isExpired: boolean;
  /** `true` when the value was served from cache without a successful refresh. */
  readonly isStale: boolean;
}

/** Category of a diagnostic, so hosts can route to logging vs. alerting. */
export type VoidhashDiagnosticKind = "auth" | "breaker" | "cache" | "eviction" | "transport";

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
  readonly persist?: boolean;
  readonly prefetchOnInit?: boolean;
  readonly refreshOnOnline?: boolean;
  readonly refreshOnVisibility?: boolean;
  readonly ttlMs?: number;
}

export interface VoidhashAnalyticsOptions {
  readonly baseUrl?: string;
  readonly enabled?: boolean;
  readonly flushIntervalMs?: number;
  readonly maxBatchBytes?: number;
  readonly maxBatchSize?: number;
  readonly maxQueueSize?: number;
}

export interface VoidhashClientOptions {
  readonly analytics?: VoidhashAnalyticsOptions;
  /**
   * Called for every SDK diagnostic (transport failures, evictions, circuit
   * breaker transitions, auth pauses, cache faults). Exceptions thrown by the
   * handler are swallowed.
   */
  readonly onDiagnostic?: (diagnostic: VoidhashDiagnostic) => void;
  readonly baseUrl?: string;
  readonly distinctId?: string;
  readonly featureFlags?: VoidhashFeatureFlagsOptions;
  readonly observerMode?: boolean;
  readonly publishableKey: string;
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
  readonly previousDistinctId: Option.Option<string>;
}

export interface FeatureFlagsUpdatedEvent {
  readonly keys?: ReadonlyArray<string>;
  readonly result: FeatureFlagsResult;
}

export interface AnalyticsFlushedEvent extends AnalyticsFlushResult {}

export interface AnalyticsPartialRejectionEvent extends AnalyticsFlushResult {}

export interface VoidhashErrorEvent {
  readonly error?: unknown;
  readonly message: string;
  readonly source: "analytics" | "client" | "feature-flags" | "identity" | "storage";
}

export interface VoidhashEventMap {
  readonly "analytics-flush-needed": undefined;
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
    readonly enabled: boolean;
    readonly flushIntervalMs: number;
    readonly maxBatchBytes: number;
    readonly maxBatchSize: number;
    readonly maxQueueSize: number;
  };
  readonly baseUrl: string;
  readonly featureFlags: {
    readonly persist: boolean;
    readonly prefetchOnInit: boolean;
    readonly refreshOnOnline: boolean;
    readonly refreshOnVisibility: boolean;
    readonly ttlMs: number;
  };
  readonly distinctId?: string;
  readonly observerMode: boolean;
  readonly publishableKey: string;
}
