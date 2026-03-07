import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createVoidhashClient } from "../src/index";
import { createJsonResponse } from "./helpers";

describe("analytics delivery", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a retryable analytics failure on the next flush", async () => {
    let analyticsAttempts = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = input.toString();
      if (url.endsWith("/v1/events")) {
        analyticsAttempts += 1;
        if (analyticsAttempts === 1) {
          return createJsonResponse({ error: "try again" }, 503);
        }

        return createJsonResponse(
          {
            accepted: 1,
            rejected: 0,
            request_id: "req_retry",
          },
          202
        );
      }

      return createJsonResponse({});
    }));
    const client = createVoidhashClient({
      analytics: {
        flushIntervalMs: 60_000,
      },
      publishableKey: "vh_pk_test",
    });

    await client.initialize();
    await client.track("purchase_started");

    expect(await client.flushAnalytics()).toBeNull();
    expect(await client.flushAnalytics()).toEqual({
      accepted: 1,
      rejected: 0,
      requestId: "req_retry",
    });

    await client.destroy();
  });

  it("splits batches when the ingest service returns 413", async () => {
    let analyticsAttempts = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = input.toString();
      if (url.endsWith("/v1/events")) {
        analyticsAttempts += 1;
        if (analyticsAttempts === 1) {
          return createJsonResponse({ error: "payload too large" }, 413);
        }

        return createJsonResponse(
          {
            accepted: 1,
            rejected: 0,
            request_id: `req_${analyticsAttempts}`,
          },
          202
        );
      }

      return createJsonResponse({});
    }));
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
      requestId: "req_3",
    });
    expect(analyticsAttempts).toBe(3);

    await client.destroy();
  });
});
