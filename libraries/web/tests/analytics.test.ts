import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createVoidhashClient } from "../src/index";
import { createJsonResponse, installFetchMock } from "./helpers";

/** Restores the globals each test stubs, replacing the `beforeEach`/`afterEach` hooks. */
const withCleanup = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.ensuring(
    effect,
    Effect.sync(() => {
      vi.unstubAllGlobals();
      window.localStorage.clear();
    }),
  );

describe("analytics delivery", () => {
  it("retries a retryable analytics failure on the next flush", () =>
    Effect.runPromise(
      Effect.gen(function* retriesRetryableFailure() {
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

        yield* Effect.promise(() => client.initialize());
        yield* Effect.promise(() => client.track("purchase_started"));

        yield* Effect.gen(function* assertRetries() {
          expect(yield* Effect.promise(() => client.flushAnalytics())).toBeNull();
          expect(yield* Effect.promise(() => client.flushAnalytics())).toBeNull();

          vi.advanceTimersByTime(1_000);
          expect(yield* Effect.promise(() => client.flushAnalytics())).toEqual({
            accepted: 1,
            rejected: 0,
          });
        }).pipe(
          Effect.ensuring(
            Effect.gen(function* restoreTimers() {
              vi.useRealTimers();
              yield* Effect.promise(() => client.destroy());
            }),
          ),
        );
      }).pipe(withCleanup),
    ));

  it("splits batches when the ingest service returns 413", () =>
    Effect.runPromise(
      Effect.gen(function* splitsOversizedBatches() {
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

        yield* Effect.promise(() => client.initialize());
        yield* Effect.promise(() => client.track("event_one"));
        yield* Effect.promise(() => client.track("event_two"));

        expect(yield* Effect.promise(() => client.flushAnalytics())).toEqual({
          accepted: 2,
          rejected: 0,
        });
        expect(analyticsAttempts).toBe(3);

        yield* Effect.promise(() => client.destroy());
      }).pipe(withCleanup),
    ));

  it("honors Retry-After before retrying a rate-limited batch", () =>
    Effect.runPromise(
      Effect.gen(function* honorsRetryAfter() {
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

        yield* Effect.gen(function* assertRetryAfter() {
          yield* Effect.promise(() => client.initialize());
          yield* Effect.promise(() => client.track("purchase_started"));

          expect(yield* Effect.promise(() => client.flushAnalytics())).toBeNull();
          expect(yield* Effect.promise(() => client.flushAnalytics())).toBeNull();

          vi.advanceTimersByTime(2_000);
          expect(yield* Effect.promise(() => client.flushAnalytics())).toEqual({
            accepted: 1,
            rejected: 0,
          });
          expect(analyticsAttempts).toBe(2);
        }).pipe(
          Effect.ensuring(
            Effect.gen(function* restoreTimers() {
              vi.useRealTimers();
              yield* Effect.promise(() => client.destroy());
            }),
          ),
        );
      }).pipe(withCleanup),
    ));
});
