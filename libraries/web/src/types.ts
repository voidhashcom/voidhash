export type VoidhashTraitValue = string | number | boolean | null;

export type VoidhashTraits = Record<string, VoidhashTraitValue>;

export interface FeatureFlagEntry {
  readonly enabled: boolean;
  readonly key: string;
  readonly payload: unknown | null;
  readonly variantKey: string | null;
}

export interface FeatureFlagsResult {
  readonly flags: ReadonlyArray<FeatureFlagEntry>;
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
  readonly baseUrl?: string;
  readonly featureFlags?: VoidhashFeatureFlagsOptions;
  readonly initialAppUserId?: string;
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

export interface InitializedEvent {
  readonly appUserId: string;
}

export interface IdentityChangedEvent {
  readonly appUserId: string;
  readonly previousAppUserId: string | null;
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
  readonly source:
    | "analytics"
    | "client"
    | "feature-flags"
    | "identity"
    | "storage";
}

export interface VoidhashEventMap {
  readonly "analytics-flushed": AnalyticsFlushedEvent;
  readonly "analytics-partial-rejection": AnalyticsPartialRejectionEvent;
  readonly error: VoidhashErrorEvent;
  readonly "feature-flags-updated": FeatureFlagsUpdatedEvent;
  readonly "identity-changed": IdentityChangedEvent;
  readonly initialized: InitializedEvent;
}

export type VoidhashEventName = keyof VoidhashEventMap;

export interface ResolvedVoidhashConfig {
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
  readonly initialAppUserId?: string;
  readonly observerMode: boolean;
  readonly publishableKey: string;
}
