import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VoidhashNotInitializedError,
  createVoidhashClient,
} from "../src/index";
import { createJsonResponse, flushMicrotasks, installFetchMock } from "./helpers";

describe("VoidhashWebClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects operational methods before initialize", async () => {
    const client = createVoidhashClient({
      publishableKey: "vh_pk_test",
    });

    await expect(client.getFeatureFlags()).rejects.toBeInstanceOf(
      VoidhashNotInitializedError
    );
  });

  it("initializes, fetches flags, derives analytics url, and flushes events", async () => {
    const { calls } = installFetchMock((call) => {
      if (call.url.endsWith("/sdk/evaluate-flags")) {
        return createJsonResponse({
          flags: [
            {
              enabled: true,
              key: "new-nav",
              payload: { color: "blue" },
              variantKey: "on",
            },
          ],
        });
      }

      if (call.url.endsWith("/batch")) {
        return createJsonResponse(
          {
            accepted: 1,
            rejected: 0,
          },
          202
        );
      }

      if (call.url.endsWith("/sdk/sync-customer-attributes")) {
        return createJsonResponse({});
      }

      return createJsonResponse({});
    });
    const client = createVoidhashClient({
      analytics: {
        flushIntervalMs: 60_000,
      },
      baseUrl: "https://api.voidhash.test",
      publishableKey: "vh_pk_test",
    });

    await client.initialize();
    const distinctId = client.getDistinctId();
    const flags = await client.getFeatureFlags(["new-nav"]);
    await client.track("checkout_started", { source: "pricing_page" });
    const flushResult = await client.flushAnalytics();

    expect(distinctId).toMatch(/^vh:anon:/);
    expect(flags.flags[0]?.key).toBe("new-nav");
    expect(client.isFeatureEnabled("new-nav")).toBe(true);
    expect(flushResult).toEqual({
      accepted: 1,
      rejected: 0,
    });

    const analyticsCall = calls.find((call) => call.url.includes("/batch"));
    expect(analyticsCall?.url).toBe("https://i.voidhash.test/batch");
    expect(analyticsCall?.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(JSON.parse(analyticsCall?.body ?? "{}")).toMatchObject({
      events: [
        {
          distinct_id: distinctId,
          event: "checkout_started",
          properties: {
            source: "pricing_page",
          },
          uuid: expect.stringMatching(/^evt_/),
        },
      ],
      token: "vh_pk_test",
    });

    await client.destroy();
  });

  it("syncs traits before identify and reset identity", async () => {
    const { calls } = installFetchMock((call) => {
      if (call.url.endsWith("/sdk/identify")) {
        return createJsonResponse({
          customerId: "customer_123",
          distinctId: "user_123",
          email: null,
          name: null,
        });
      }

      if (call.url.endsWith("/sdk/sync-customer-attributes")) {
        return createJsonResponse({
          customerId: "customer_sync",
          distinctId: "synced",
          email: null,
          name: null,
        });
      }

      return createJsonResponse({});
    });
    const client = createVoidhashClient({
      analytics: {
        enabled: false,
      },
      publishableKey: "vh_pk_test",
    });

    await client.initialize();
    const initialDistinctId = client.getDistinctId();
    await client.identify("user_123", { companyId: "acme", plan: "pro" });
    await client.reset();

    const syncCalls = calls.filter((call) =>
      call.url.endsWith("/sdk/person/traits")
    );
    const identifyCall = calls.find((call) => call.url.endsWith("/sdk/identify"));

    expect(syncCalls[0]?.headers["x-distinct-id"]).toBe(initialDistinctId);
    expect(JSON.parse(identifyCall?.body ?? "{}")).toEqual({
      distinctId: "user_123",
      traits: {
        companyId: "acme",
        plan: "pro",
      },
    });
    expect(syncCalls[1]?.headers["x-distinct-id"]).toBe("user_123");
    expect(client.getDistinctId()).toMatch(/^vh:anon:/);

    await client.destroy();
  });

  it("refreshes tracked feature flags when the browser comes back online", async () => {
    const { calls } = installFetchMock((call) => {
      if (call.url.endsWith("/sdk/evaluate-flags")) {
        return createJsonResponse({
          flags: [
            {
              enabled: true,
              key: "new-nav",
              payload: null,
              variantKey: "on",
            },
          ],
        });
      }

      return createJsonResponse({});
    });
    const client = createVoidhashClient({
      analytics: {
        enabled: false,
      },
      publishableKey: "vh_pk_test",
    });

    await client.initialize();
    await client.getFeatureFlags(["new-nav"]);
    window.dispatchEvent(new Event("online"));
    await flushMicrotasks();

    const flagCalls = calls.filter((call) => call.url.endsWith("/sdk/evaluate-flags"));
    expect(flagCalls).toHaveLength(2);

    await client.destroy();
  });
});
