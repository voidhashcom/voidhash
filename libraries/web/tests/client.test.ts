import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";

import { VoidhashNotInitializedError, createVoidhashClient } from "../src/index";
import { createJsonResponse, flushMicrotasks, installFetchMock } from "./helpers";

const decodeJson = Schema.decodeUnknownSync(Schema.UnknownFromJsonString);

const decodeBatchBody = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      events: Schema.optional(Schema.Array(Schema.Record(Schema.String, Schema.Unknown))),
    }),
  ),
);

/** Restores the globals each test stubs, replacing the `beforeEach`/`afterEach` hooks. */
const withCleanup = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.ensuring(
    effect,
    Effect.sync(() => {
      vi.unstubAllGlobals();
      window.localStorage.clear();
    }),
  );

describe("VoidhashWebClient", () => {
  it("rejects operational methods before initialize", () =>
    Effect.runPromise(
      Effect.gen(function* rejectsBeforeInitialize() {
        const client = createVoidhashClient({
          publishableKey: "vh_pk_test",
        });

        yield* Effect.promise(() =>
          expect(client.getFeatureFlags()).rejects.toBeInstanceOf(VoidhashNotInitializedError),
        );
      }).pipe(withCleanup),
    ));

  it("initializes, fetches flags, derives analytics url, and flushes events", () =>
    Effect.runPromise(
      Effect.gen(function* initializesAndFlushes() {
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

        yield* Effect.promise(() => client.initialize());
        const distinctId = client.getDistinctId();
        const flags = yield* Effect.promise(() => client.getFeatureFlags(["new-nav"]));
        yield* Effect.promise(() => client.track("checkout_started", { source: "pricing_page" }));
        const flushResult = yield* Effect.promise(() => client.flushAnalytics());

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
        expect(decodeJson(analyticsCall?.body ?? "{}")).toMatchObject({
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

        yield* Effect.promise(() => client.destroy());
      }).pipe(withCleanup),
    ));

  it("flushes queued analytics before identify and reset identity", () =>
    Effect.runPromise(
      Effect.gen(function* flushesBeforeIdentity() {
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

        yield* Effect.promise(() => client.initialize());
        const initialDistinctId = client.getDistinctId();

        // Queue an event under the anonymous id, then identify. The pending event
        // must flush attributed to the pre-switch distinct id.
        yield* Effect.promise(() => client.track("checkout_started", { source: "pricing_page" }));
        yield* Effect.promise(() =>
          client.identify("user_123", { companyId: "acme", plan: "pro" }),
        );
        yield* Effect.promise(() => client.reset());

        // No person-attributes sync endpoint is hit during identify/reset anymore.
        expect(calls.some((call) => call.url.includes("sync-person-attributes"))).toBe(false);

        const identifyCall = calls.find((call) => call.url.endsWith("/sdk/identify"));
        expect(decodeJson(identifyCall?.body ?? "{}")).toEqual({
          distinctId: "user_123",
          traits: {
            companyId: "acme",
            plan: "pro",
          },
        });

        // The queued event flushed before the identity switch, attributed to the
        // original anonymous distinct id.
        const batchCall = calls.find((call) => call.url.endsWith("/batch"));
        expect(decodeBatchBody(batchCall?.body ?? "{}").events?.[0]?.distinct_id).toBe(
          initialDistinctId,
        );

        expect(client.getDistinctId()).toMatch(/^vh:anon:/);

        yield* Effect.promise(() => client.destroy());
      }).pipe(withCleanup),
    ));

  it("setPersonAttributes enqueues a $set event with $process_person_profile", () =>
    Effect.runPromise(
      Effect.gen(function* setPersonAttributesEnqueues() {
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

        yield* Effect.promise(() => client.initialize());
        const distinctId = client.getDistinctId();

        yield* Effect.promise(() =>
          client.setPersonAttributes({
            email: "ada@example.com",
            name: "Ada",
            plan: "pro",
          }),
        );
        const flushResult = yield* Effect.promise(() => client.flushAnalytics());

        expect(flushResult).toEqual({ accepted: 1, rejected: 0 });

        const batchCall = calls.find((call) => call.url.endsWith("/batch"));
        const event = decodeBatchBody(batchCall?.body ?? "{}").events?.[0];
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

        yield* Effect.promise(() => client.destroy());
      }).pipe(withCleanup),
    ));

  it("setPersonAttributesSync posts attributes and returns the person snapshot", () =>
    Effect.runPromise(
      Effect.gen(function* setPersonAttributesSyncPosts() {
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

        yield* Effect.promise(() => client.initialize());
        const distinctId = client.getDistinctId();

        const snapshot = yield* Effect.promise(() =>
          client.setPersonAttributesSync({
            email: "ada@example.com",
            name: "Ada",
            plan: "pro",
          }),
        );

        expect(snapshot).toMatchObject({
          personId: "person_sync",
          email: "ada@example.com",
          name: "Ada",
        });

        const syncCall = calls.find((call) => call.url.endsWith("/sdk/person/traits"));
        expect(syncCall?.headers["x-distinct-id"]).toBe(distinctId);
        expect(decodeJson(syncCall?.body ?? "{}")).toEqual({
          email: "ada@example.com",
          name: "Ada",
          traits: {
            plan: "pro",
          },
        });

        yield* Effect.promise(() => client.destroy());
      }).pipe(withCleanup),
    ));

  it("refreshes tracked feature flags when the browser comes back online", () =>
    Effect.runPromise(
      Effect.gen(function* refreshesWhenOnline() {
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

        yield* Effect.promise(() => client.initialize());
        yield* Effect.promise(() => client.getFeatureFlags(["new-nav"]));
        window.dispatchEvent(new Event("online"));
        yield* Effect.promise(() => flushMicrotasks());

        const flagCalls = calls.filter((call) => call.url.endsWith("/sdk/evaluate-flags"));
        expect(flagCalls).toHaveLength(2);

        yield* Effect.promise(() => client.destroy());
      }).pipe(withCleanup),
    ));
});
