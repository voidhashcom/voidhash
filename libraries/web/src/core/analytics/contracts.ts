import {
  CaptureBatchRequest,
  CaptureEvent,
} from "@voidhash/api-spec/event-capture";

import type { AnalyticsFlushResult } from "../../types";

export type AnalyticsRequestEvent = typeof CaptureEvent.Type;
export type AnalyticsBatchRequest = typeof CaptureBatchRequest.Type;

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
