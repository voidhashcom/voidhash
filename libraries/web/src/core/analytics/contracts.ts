import type { AnalyticsFlushResult } from "../../types";

export interface AnalyticsRequestEvent {
  readonly context?: Record<string, unknown>;
  readonly event_id: string;
  readonly event_name: string;
  readonly event_ts: string;
  readonly properties?: Record<string, unknown>;
  readonly session_id?: string;
}

export interface AnalyticsBatchRequest {
  readonly events: ReadonlyArray<AnalyticsRequestEvent>;
}

export interface QueuedAnalyticsEvent {
  readonly appUserId: string;
  readonly attempts: number;
  readonly availableAt: number;
  readonly id: string;
  readonly payload: AnalyticsRequestEvent;
}

export interface AnalyticsTransportResult {
  readonly data?: Record<string, unknown>;
  readonly status: number;
}

export interface AnalyticsSendBatchResult extends AnalyticsFlushResult {}
