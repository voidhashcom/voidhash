import type {
  CaptureBatchRequest,
  CaptureEvent,
} from "@voidhash/generated-clients/event-capture";

import type { AnalyticsFlushResult } from "../../types";

export type AnalyticsRequestEvent = CaptureEvent;
export type AnalyticsBatchRequest = CaptureBatchRequest;

export interface QueuedAnalyticsEvent {
  readonly attempts: number;
  readonly availableAt: number;
  readonly id: string;
  readonly payload: AnalyticsRequestEvent;
}

export interface AnalyticsTransportResult {
  readonly data?: Record<string, unknown>;
  readonly retryAfterMs?: number;
  readonly status: number;
}

export interface AnalyticsSendBatchResult extends AnalyticsFlushResult {}
