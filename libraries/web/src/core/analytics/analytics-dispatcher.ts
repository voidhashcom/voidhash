import { VoidhashAnalyticsError } from "../../errors";
import type { EventBus } from "../event-bus";
import { AnalyticsHttpClient } from "../http/analytics-client";
import { AnalyticsQueue } from "./analytics-queue";
import type {
  AnalyticsRequestEvent,
  AnalyticsSendBatchResult,
  QueuedAnalyticsEvent,
} from "./contracts";

const MAX_INGEST_BATCH_SIZE = 100;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

const buildIdSet = (events: ReadonlyArray<QueuedAnalyticsEvent>) =>
  new Set(events.map((event) => event.id));

const getBackoffMs = (attempts: number) =>
  Math.min(1000 * 2 ** Math.max(attempts - 1, 0), 30_000);

export class AnalyticsDispatcher {
  private flushIntervalId: ReturnType<typeof setInterval> | null = null;
  private inFlightFlush: Promise<AnalyticsSendBatchResult | null> | null = null;

  constructor(
    private readonly queue: AnalyticsQueue,
    private readonly client: AnalyticsHttpClient,
    private readonly config: {
      readonly flushIntervalMs: number;
      readonly maxBatchBytes: number;
      readonly maxBatchSize: number;
    },
    private readonly eventBus: EventBus
  ) {}

  start() {
    if (this.flushIntervalId) {
      return;
    }

    this.flushIntervalId = setInterval(() => {
      void this.flush().catch((error) => {
        this.eventBus.emit("error", {
          error,
          message: "Scheduled analytics flush failed.",
          source: "analytics",
        });
      });
    }, this.config.flushIntervalMs);
  }

  stop() {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
  }

  async flush(options?: { force?: boolean; keepalive?: boolean }) {
    if (this.inFlightFlush) {
      return this.inFlightFlush;
    }

    this.inFlightFlush = this.flushInternal(options).finally(() => {
      this.inFlightFlush = null;
    });

    return this.inFlightFlush;
  }

  private async flushInternal(options?: { force?: boolean; keepalive?: boolean }) {
    const batch = await this.queue.peekBatch({
      ignoreAvailability: options?.force,
      maxBatchBytes: this.config.maxBatchBytes,
      maxBatchSize: Math.min(this.config.maxBatchSize, MAX_INGEST_BATCH_SIZE),
    });

    if (batch.length === 0) {
      return null;
    }

    return this.sendBatch(batch, options);
  }

  private async sendBatch(
    batch: ReadonlyArray<QueuedAnalyticsEvent>,
    options?: { keepalive?: boolean }
  ): Promise<AnalyticsSendBatchResult | null> {
    if (batch.length === 0) {
      return null;
    }

    const distinctId = batch[0]?.appUserId;
    if (!distinctId) {
      return null;
    }

    try {
      const result = await this.client.send(
        distinctId,
        { events: batch.map((entry) => entry.payload as AnalyticsRequestEvent) },
        options
      );
      const ids = buildIdSet(batch);

      if (result.status === 202) {
        await this.queue.drop(ids);
        const response = {
          accepted: Number(result.data?.accepted ?? batch.length),
          rejected: Number(result.data?.rejected ?? 0),
          requestId:
            typeof result.data?.request_id === "string"
              ? result.data.request_id
              : undefined,
        };

        this.eventBus.emit("analytics-flushed", response);
        if (response.rejected > 0) {
          this.eventBus.emit("analytics-partial-rejection", response);
        }

        return response;
      }

      if (result.status === 413) {
        return this.handlePayloadTooLarge(batch, options);
      }

      if (RETRYABLE_STATUS_CODES.has(result.status)) {
        await this.queue.postpone(
          ids,
          Date.now() + getBackoffMs((batch[0]?.attempts ?? 0) + 1)
        );
        return null;
      }

      await this.queue.drop(ids);
      this.eventBus.emit("error", {
        message: `Dropping analytics batch after non-retryable ${result.status} response.`,
        source: "analytics",
      });
      return null;
    } catch (error) {
      if (error instanceof VoidhashAnalyticsError) {
        const ids = buildIdSet(batch);
        await this.queue.postpone(
          ids,
          Date.now() + getBackoffMs((batch[0]?.attempts ?? 0) + 1)
        );
        return null;
      }

      throw error;
    }
  }

  private async handlePayloadTooLarge(
    batch: ReadonlyArray<QueuedAnalyticsEvent>,
    options?: { keepalive?: boolean }
  ): Promise<AnalyticsSendBatchResult | null> {
    if (batch.length === 1) {
      await this.queue.drop(buildIdSet(batch));
      this.eventBus.emit("error", {
        message: "Dropping analytics event after 413 response.",
        source: "analytics",
      });
      return {
        accepted: 0,
        rejected: 1,
      };
    }

    const midpoint = Math.ceil(batch.length / 2);
    const first = await this.sendBatch(batch.slice(0, midpoint), options);
    const second = await this.sendBatch(batch.slice(midpoint), options);

    if (!first && !second) {
      return null;
    }

    return {
      accepted: (first?.accepted ?? 0) + (second?.accepted ?? 0),
      rejected: (first?.rejected ?? 0) + (second?.rejected ?? 0),
      requestId: second?.requestId ?? first?.requestId,
    };
  }
}
