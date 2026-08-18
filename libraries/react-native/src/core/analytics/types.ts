import { Data } from "effect";

export interface QueuedAnalyticsEvent {
  readonly attempts: number;
  readonly availableAt: number;
  readonly eventName: string;
  readonly eventTimestamp: string;
  readonly id: string;
  readonly properties: Record<string, unknown>;
  readonly context: Record<string, unknown>;
  readonly distinctId: string;
  readonly sessionId?: string;
}

export interface AnalyticsIngestEvent {
  /** Shared metadata attached to every event (for example app, device, or SDK context). */
  readonly context: Record<string, unknown>;
  /** Identity captured with this individual event, never resolved at batch time. */
  readonly distinct_id: string;
  /** Unique identifier for this event instance. */
  readonly event_id: string;
  /** Canonical event name used for analytics processing. */
  readonly event_name: string;
  /** Event timestamp in string form (typically ISO-8601). */
  readonly event_ts: string;
  /** Event-specific payload fields for this event name. */
  readonly properties: Record<string, unknown>;
  /** Identifier that groups events belonging to the same user session. */
  readonly session_id?: string;
}

/**
 * Tagged error raised when the analytics ingest endpoint rejects a batch.
 * Tagged so callers can use `Effect.catchTag("AnalyticsSendFailure", ...)`.
 * `retryable` indicates whether the failure is worth re-attempting; `retryAfterMs`
 * communicates a server-suggested backoff (from `Retry-After` header or body).
 */
export class AnalyticsSendFailure extends Data.TaggedError("AnalyticsSendFailure")<{
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number | undefined;
  readonly status?: number | undefined;
  readonly cause?: unknown;
}> {}
