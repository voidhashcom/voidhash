import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createVoidhashClient } from "../src/index";
import { createJsonResponse, installFetchMock } from "./helpers";

describe("analytics delivery", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a retryable analytics failure on the next flush", async () => {
    vi.useFakeTimers();

    let analyticsAttempts = 0;
    installFetchMock((call) => {
      if (call.url.endsWith("/batch")) {
        analyticsAttempts += 1;
        if (analyticsAttempts === 1) {
          return createJsonResponse(
            {
              code: "dependency_unavailable",
              error: "try again",
            },
            503,
          );
        }

        return createJsonResponse(
          {
            accepted: 1,
            rejected: 0,
          },
          202,
        );
      }

      return createJsonResponse({});
    });
    const client = createVoidhashClient({
      analytics: {
        flushIntervalMs: 60_000,
      },
      publishableKey: "vh_pk_test",
    });

    await client.initialize();
    await client.track("purchase_started");

    try {
      expect(await client.flushAnalytics()).toBeNull();
      expect(await client.flushAnalytics()).toBeNull();

      vi.advanceTimersByTime(1_000);
      expect(await client.flushAnalytics()).toEqual({
        accepted: 1,
        rejected: 0,
      });
    } finally {
      vi.useRealTimers();
      await client.destroy();
    }
  });

  it("splits batches when the ingest service returns 413", async () => {
    let analyticsAttempts = 0;
    installFetchMock((call) => {
      if (call.url.endsWith("/batch")) {
        analyticsAttempts += 1;
        if (analyticsAttempts === 1) {
          return createJsonResponse(
            {
              code: "payload_too_large",
              error: "payload too large",
            },
            413,
          );
        }

        return createJsonResponse(
          {
            accepted: 1,
            rejected: 0,
          },
          202,
        );
      }

      return createJsonResponse({});
    });
    const client = createVoidhashClient({
      analytics: {
        flushIntervalMs: 60_000,
        maxBatchBytes: 100_000,
        maxBatchSize: 10,
      },
      publishableKey: "vh_pk_test",
    });

    await client.initialize();
    await client.track("event_one");
    await client.track("event_two");

    expect(await client.flushAnalytics()).toEqual({
      accepted: 2,
      rejected: 0,
    });
    expect(analyticsAttempts).toBe(3);

    await client.destroy();
  });

  it("honors Retry-After before retrying a rate-limited batch", async () => {
    vi.useFakeTimers();

    let analyticsAttempts = 0;
    installFetchMock((call) => {
      if (call.url.endsWith("/batch")) {
        analyticsAttempts += 1;
        if (analyticsAttempts === 1) {
          return createJsonResponse(
            {
              code: "rate_limited",
              error: "request rate limit exceeded",
              retry_after_ms: 2_000,
            },
            429,
            {
              "retry-after": "2",
            },
          );
        }

        return createJsonResponse(
          {
            accepted: 1,
            rejected: 0,
          },
          202,
        );
      }

      return createJsonResponse({});
    });
    const client = createVoidhashClient({
      analytics: {
        flushIntervalMs: 60_000,
      },
      publishableKey: "vh_pk_test",
    });

    try {
      await client.initialize();
      await client.track("purchase_started");

      expect(await client.flushAnalytics()).toBeNull();
      expect(await client.flushAnalytics()).toBeNull();

      vi.advanceTimersByTime(2_000);
      expect(await client.flushAnalytics()).toEqual({
        accepted: 1,
        rejected: 0,
      });
      expect(analyticsAttempts).toBe(2);
    } finally {
      vi.useRealTimers();
      await client.destroy();
    }
  });
});
