export interface QueuedAnalyticsEvent {
  readonly attempts: number;
  readonly availableAt: number;
  readonly eventName: string;
  readonly eventTimestamp: string;
  readonly id: string;
  readonly properties: Record<string, unknown>;
}

export interface AnalyticsIngestEvent {
  /** Shared metadata attached to every event (for example app, device, or SDK context). */
  readonly context: Record<string, unknown>;
  /** Unique identifier for this event instance. */
  readonly event_id: string;
  /** Canonical event name used for analytics processing. */
  readonly event_name: string;
  /** Event timestamp in string form (typically ISO-8601). */
  readonly event_ts: string;
  /** Event-specific payload fields for this event name. */
  readonly properties: Record<string, unknown>;
  /** Identifier that groups events belonging to the same user session. */
  readonly session_id: string;
}

export class AnalyticsSendFailure extends Error {
  readonly retryAfterMs?: number;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(input: {
    readonly message: string;
    readonly retryable: boolean;
    readonly retryAfterMs?: number;
    readonly status?: number;
    readonly cause?: unknown;
  }) {
    super(input.message, input.cause ? { cause: input.cause } : undefined);
    this.name = "AnalyticsSendFailure";
    this.retryAfterMs = input.retryAfterMs;
    this.retryable = input.retryable;
    this.status = input.status;
  }
}
