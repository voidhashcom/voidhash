import type { CaptureBatchRequest, CaptureEvent } from "@voidhash/generated-clients/event-capture";

import type { AnalyticsFlushResult } from "../../types";

export type AnalyticsRequestEvent = CaptureEvent;
export type AnalyticsBatchRequest = CaptureBatchRequest;

export interface QueuedAnalyticsEvent {
  readonly attempts: number;
  readonly availableAt: number;
  readonly id: string;
  /**
   * When the `pagehide` flush handed the event to a `keepalive` request whose
   * answer the page has not seen. Such an event is not sent again.
   */
  readonly keepaliveSentAt?: number;
  readonly payload: AnalyticsRequestEvent;
  /**
   * Set on the `$set` of `setPersonAttributes()`: what the app said about the
   * person, not something the SDK observed. When consent is withdrawn it leaves
   * the queue as a person write instead of being discarded.
   */
  readonly personWrite?: boolean;
  /**
   * Set on the `$pageleave` a page queues as it is hidden. It is stored, as the
   * browser may discard a hidden page without another event, but not sent while
   * the visitor may still return. The page that takes over a closed page's queue
   * sends it.
   */
  readonly provisional?: boolean;
}

export interface AnalyticsTransportResult {
  readonly data?: Record<string, unknown>;
  readonly retryAfterMs?: number;
  readonly status: number;
}

export interface AnalyticsSendBatchResult extends AnalyticsFlushResult {}
