import type { CacheManager } from "../caching/cache-manager";
import type { QueuedAnalyticsEvent } from "./contracts";

const QUEUE_KEY = "analytics:queue";

const estimateEventBytes = (event: QueuedAnalyticsEvent) =>
  new TextEncoder().encode(JSON.stringify(event.payload)).byteLength;

export class AnalyticsQueue {
  private events: QueuedAnalyticsEvent[] = [];
  private isLoaded = false;

  constructor(
    private readonly cache: CacheManager,
    private readonly maxQueueSize: number
  ) {}

  async drop(ids: ReadonlySet<string>) {
    await this.load();
    this.events = this.events.filter((event) => !ids.has(event.id));
    await this.persist();
  }

  async enqueue(event: Omit<QueuedAnalyticsEvent, "attempts" | "availableAt">) {
    await this.load();
    this.events.push({
      ...event,
      attempts: 0,
      availableAt: Date.now(),
    });
    const droppedCount = Math.max(this.events.length - this.maxQueueSize, 0);
    if (droppedCount > 0) {
      this.events.splice(0, droppedCount);
    }
    await this.persist();
    return droppedCount;
  }

  async peekBatch(input: {
    ignoreAvailability?: boolean;
    maxBatchBytes: number;
    maxBatchSize: number;
    now?: number;
  }) {
    await this.load();
    const now = input.now ?? Date.now();
    const dueEvents = this.events.filter((event) =>
      input.ignoreAvailability ? true : event.availableAt <= now
    );

    if (dueEvents.length === 0) {
      return [];
    }

    const firstDistinctId = dueEvents[0]?.distinctId;
    const selected: QueuedAnalyticsEvent[] = [];
    let totalBytes = 0;

    for (const event of dueEvents) {
      if (event.distinctId !== firstDistinctId) {
        break;
      }

      const nextBytes = estimateEventBytes(event);
      if (selected.length > 0 && totalBytes + nextBytes > input.maxBatchBytes) {
        break;
      }

      selected.push(event);
      totalBytes += nextBytes;

      if (selected.length >= input.maxBatchSize) {
        break;
      }
    }

    return selected;
  }

  async postpone(ids: ReadonlySet<string>, nextAvailableAt: number) {
    await this.load();
    this.events = this.events.map((event) =>
      ids.has(event.id)
        ? {
            ...event,
            attempts: event.attempts + 1,
            availableAt: nextAvailableAt,
          }
        : event
    );
    await this.persist();
  }

  async size() {
    await this.load();
    return this.events.length;
  }

  private async load() {
    if (this.isLoaded) {
      return;
    }

    const cached = await this.cache.get<QueuedAnalyticsEvent[]>(QUEUE_KEY);
    this.events = cached?.value ?? [];
    this.isLoaded = true;
  }

  private async persist() {
    await this.cache.set(QUEUE_KEY, this.events);
  }
}
