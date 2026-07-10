import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VoidhashNotInitializedError, createVoidhashClient } from "../src/index";
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

    await expect(client.getFeatureFlags()).rejects.toBeInstanceOf(VoidhashNotInitializedError);
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
          202,
        );
      }

      if (call.url.endsWith("/sdk/sync-person-attributes")) {
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

  it("flushes queued analytics before identify and reset identity", async () => {
    const { calls } = installFetchMock((call) => {
      if (call.url.endsWith("/sdk/identify")) {
        return createJsonResponse({
          personId: "person_123",
          distinctId: "user_123",
          email: null,
          name: null,
        });
      }

      if (call.url.endsWith("/batch")) {
        return createJsonResponse({ accepted: 1, rejected: 0 }, 202);
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
    const initialDistinctId = client.getDistinctId();

    // Queue an event under the anonymous id, then identify. The pending event
    // must flush attributed to the pre-switch distinct id.
    await client.track("checkout_started", { source: "pricing_page" });
    await client.identify("user_123", { companyId: "acme", plan: "pro" });
    await client.reset();

    // No person-attributes sync endpoint is hit during identify/reset anymore.
    expect(calls.some((call) => call.url.includes("sync-person-attributes"))).toBe(false);

    const identifyCall = calls.find((call) => call.url.endsWith("/sdk/identify"));
    expect(JSON.parse(identifyCall?.body ?? "{}")).toEqual({
      distinctId: "user_123",
      traits: {
        companyId: "acme",
        plan: "pro",
      },
    });

    // The queued event flushed before the identity switch, attributed to the
    // original anonymous distinct id.
    const batchCall = calls.find((call) => call.url.endsWith("/batch"));
    expect(JSON.parse(batchCall?.body ?? "{}").events?.[0]?.distinct_id).toBe(initialDistinctId);

    expect(client.getDistinctId()).toMatch(/^vh:anon:/);

    await client.destroy();
  });

  it("setPersonAttributes enqueues a $set event with $process_person_profile", async () => {
    const { calls } = installFetchMock((call) => {
      if (call.url.endsWith("/batch")) {
        return createJsonResponse({ accepted: 1, rejected: 0 }, 202);
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
    const distinctId = client.getDistinctId();

    await client.setPersonAttributes({
      email: "ada@example.com",
      name: "Ada",
      plan: "pro",
    });
    const flushResult = await client.flushAnalytics();

    expect(flushResult).toEqual({ accepted: 1, rejected: 0 });

    const batchCall = calls.find((call) => call.url.endsWith("/batch"));
    const event = JSON.parse(batchCall?.body ?? "{}").events?.[0];
    expect(event).toMatchObject({
      distinct_id: distinctId,
      event: "$set",
      properties: {
        $process_person_profile: true,
        $set: {
          email: "ada@example.com",
          name: "Ada",
          plan: "pro",
        },
      },
    });

    await client.destroy();
  });

  it("setPersonAttributesSync posts attributes and returns the person snapshot", async () => {
    const { calls } = installFetchMock((call) => {
      if (call.url.endsWith("/sdk/person/traits")) {
        return createJsonResponse({
          personId: "person_sync",
          distinctId: "synced",
          email: "ada@example.com",
          name: "Ada",
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
    const distinctId = client.getDistinctId();

    const snapshot = await client.setPersonAttributesSync({
      email: "ada@example.com",
      name: "Ada",
      plan: "pro",
    });

    expect(snapshot).toMatchObject({
      personId: "person_sync",
      email: "ada@example.com",
      name: "Ada",
    });

    const syncCall = calls.find((call) => call.url.endsWith("/sdk/person/traits"));
    expect(syncCall?.headers["x-distinct-id"]).toBe(distinctId);
    expect(JSON.parse(syncCall?.body ?? "{}")).toEqual({
      email: "ada@example.com",
      name: "Ada",
      traits: {
        plan: "pro",
      },
    });

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
