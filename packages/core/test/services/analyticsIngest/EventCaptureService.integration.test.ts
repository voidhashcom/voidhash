/**
 * Integration tests for {@link EventCaptureService}, run against the real
 * backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PlanetScale DB). The service resolves its caller from the *capture token* in
 * the `api_key` / `capture_project_policy` tables rather than from an
 * {@link AuthSession}, so these tests authenticate by seeding a public api-key
 * row and never call {@link CoreAuthSession.authenticate}.
 *
 * What is real vs. doubled:
 *  - `Db` is the live MySQL connection: every test seeds a `vh_pk_*` public
 *    api-key (and optionally a `capture_project_policy`) under the shared
 *    fixture project and verifies the service resolves them in one query.
 *  - `PolicyCounterStore` and `CaptureIngress` are *port boundaries* whose
 *    concrete implementations are Cloudflare-runtime backed (KV / Durable
 *    Objects) with no in-process seam. The port ships a sanctioned
 *    {@link PolicyCounterStore.noop} layer; we use it for the allow path and
 *    inject small typed doubles to exercise the reject / quota / publish paths.
 *  - The `PolicyCounterStore` port colors its effects with the
 *    {@link PlatformRuntime} marker, so the harness's service set is not
 *    sufficient on its own; we provide a minimal platform runtime stub
 *    (the noop / double counter implementations never read it).
 *
 * The service writes NOTHING to the database — it only reads the api-key/policy
 * rows and hands accepted envelopes to the ingress port — so the persisted
 * side-effect we verify is the *batch published to the ingress double*. The
 * only DB rows that need cleanup are the api-key / policy rows the test seeds;
 * {@link withCaptureCleanup} removes them on exit, success or failure.
 *
 * Typed failures are asserted with `Effect.flip` (project convention), narrowed
 * with `instanceof` before reading their fields, and each failure path is
 * paired with a state assertion (no batch published).
 */
import type { RouteClass } from "@voidhash/core/domain/analyticsIngest/AnalyticsIngest";
import {
  CaptureIngress,
  CaptureIngressError,
  type CaptureRequest,
  EventCaptureService,
  EventCaptureServiceError,
  PolicyCounterStore,
  type PolicyCounterStoreShape,
  PolicyStoreError,
  type PublishableCaptureEvent,
} from "@voidhash/core/services";
import {
  CaptureRateLimitedError,
  CaptureUnauthorizedError,
  type CaptureEvent,
} from "@voidhash/api-contracts/event-capture";
import { apiKeys, captureProjectPolicies, Db, eq, inArray } from "@voidhash/db";
import { Effect, Layer } from "effect";
import { describe, expect } from "vitest";
import { PlatformRuntime } from "@orbian/sdk/PlatformRuntime";

import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Monotonic counter so tokens/ids stay unique even within the same millisecond. */
let seq = 0;
const uniqueToken = (label: string) => `vh_pk_it${label}${Date.now()}${seq++}`;
const uniqueId = (label: string) => `it_capt_${label}_${Date.now()}_${seq++}`;

/**
 * Minimal {@link PlatformRuntime} stub. The noop / double {@link PolicyCounterStore}
 * implementations never read it; it exists only to discharge the runtime-phase
 * marker the port colors its effects with.
 */
const PlatformRuntimeStub = Layer.succeed(PlatformRuntime, PlatformRuntime.of({}));

/**
 * A {@link CaptureIngress} double that records every batch handed to it, so a
 * test can assert which envelopes were published (and on which route). Returns
 * the layer plus the live `batches` array it appends to.
 */
const makeIngressSpy = () => {
  const batches: Array<ReadonlyArray<PublishableCaptureEvent>> = [];
  const layer = Layer.succeed(CaptureIngress, {
    enqueueBatch: (events) =>
      Effect.sync(() => {
        batches.push(events);
      }),
  });
  return { batches, layer };
};

/** Flatten the recorded batches into a single list of published events. */
const publishedEvents = (
  batches: ReadonlyArray<ReadonlyArray<PublishableCaptureEvent>>,
): ReadonlyArray<PublishableCaptureEvent> => batches.flat();

/** Build a `PolicyCounterStore` layer from a partial shape, defaulting to allow-all. */
const policyStoreLayer = (overrides: Partial<PolicyCounterStoreShape> = {}) =>
  Layer.succeed(PolicyCounterStore, {
    checkRequestLimit: () => Effect.succeed({ allowed: true }),
    checkEventQuota: () => Effect.succeed(true),
    ...overrides,
  });

/**
 * Pipeable that wires the service-under-test for a test. The
 * {@link EventCaptureService} layer is built with the per-test ingress +
 * policy-store port doubles supplied (its build-time requirements), and the
 * {@link PlatformRuntime} stub is layered in for the runtime-phase marker the
 * policy port colors its `captureEvents` effect with. `Db` (and the other
 * harness services) is left to the harness.
 */
const provideService =
  (ports: {
    readonly ingress: Layer.Layer<CaptureIngress>;
    readonly policyStore?: Layer.Layer<PolicyCounterStore>;
  }) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.provide(
        EventCaptureService.layer.pipe(
          Layer.provide(Layer.mergeAll(ports.ingress, ports.policyStore ?? policyStoreLayer())),
        ),
      ),
      Effect.provide(PlatformRuntimeStub),
    );

/** A fresh capture event with sensible defaults; override fields per test. */
const captureEvent = (
  overrides: Partial<typeof CaptureEvent.Type> = {},
): typeof CaptureEvent.Type => ({
  uuid: uniqueId("evt"),
  event: "page_view",
  context: {},
  properties: {},
  distinct_id: "user-1",
  ...overrides,
});

/** A fresh capture request wrapping the given events. */
const captureRequest = (
  token: string,
  events: ReadonlyArray<typeof CaptureEvent.Type>,
): CaptureRequest => {
  const now = new Date();
  return {
    request: {
      headers: { "user-agent": "integration-test" },
      receivedAt: now,
      requestId: uniqueId("req"),
      sentAt: now,
      token,
    },
    events,
  };
};

/** Insert a public api-key row (the capture token) under the fixture project. */
const insertPublicApiKey = (token: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = uniqueId("key");
    yield* db.insert(apiKeys).values({
      end: token.slice(-8),
      id,
      isPublic: true,
      key: token,
      name: "Integration capture key",
      prefix: "api_pk",
      projectId,
    });
    return id;
  });

/** Insert (or upsert) the capture-project policy row for the fixture project. */
const upsertCapturePolicy = (policy: {
  readonly ingestEnabled?: boolean;
  readonly requestsPerMinute?: number;
  readonly eventsPerDay?: number;
  readonly forceRoute?: string;
  readonly skipEnrichment?: boolean;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db
      .insert(captureProjectPolicies)
      .values({ projectId, ...policy })
      .onConflictDoUpdate({
        target: captureProjectPolicies.projectId,
        set: {
          ...(policy.ingestEnabled !== undefined ? { ingestEnabled: policy.ingestEnabled } : {}),
          ...(policy.requestsPerMinute !== undefined
            ? { requestsPerMinute: policy.requestsPerMinute }
            : {}),
          ...(policy.eventsPerDay !== undefined ? { eventsPerDay: policy.eventsPerDay } : {}),
          ...(policy.forceRoute !== undefined ? { forceRoute: policy.forceRoute } : {}),
          ...(policy.skipEnrichment !== undefined ? { skipEnrichment: policy.skipEnrichment } : {}),
        },
      });
  });

/**
 * Delete the api-key rows and the capture-policy row the test seeded. The
 * policy row is keyed by `projectId`, so it is cleared by project id; each
 * delete is `ignore`d so a missing row never turns the finalizer into a
 * failure.
 */
const cleanup = (apiKeyIds: ReadonlyArray<string>, seededPolicy: boolean) =>
  Effect.gen(function* () {
    const db = yield* Db;
    if (apiKeyIds.length > 0) {
      yield* db
        .delete(apiKeys)
        .where(inArray(apiKeys.id, [...apiKeyIds]))
        .pipe(Effect.ignore);
    }
    if (seededPolicy) {
      yield* db
        .delete(captureProjectPolicies)
        .where(eq(captureProjectPolicies.projectId, projectId))
        .pipe(Effect.ignore);
    }
  });

/**
 * Wrap a test body so every api-key (and the policy row) it seeds is removed
 * afterward, regardless of how the test exits. `trackKey` collects api-key ids;
 * `markPolicy` flags that the project policy row was written. Cleanup reads the
 * collected ids lazily at finalization via `Effect.ensuring`.
 */
const withCaptureCleanup = <E, R>(
  body: (trackKey: (id: string) => void, markPolicy: () => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const apiKeyIds: string[] = [];
  let seededPolicy = false;
  return body(
    (id) => {
      apiKeyIds.push(id);
    },
    () => {
      seededPolicy = true;
    },
  ).pipe(Effect.ensuring(Effect.suspend(() => cleanup(apiKeyIds, seededPolicy))));
};

describe("EventCaptureService.captureEvents", () => {
  test(
    "resolves a public token, publishes envelopes on the main route, and returns accepted counts",
    (() => {
      const ingress = makeIngressSpy();
      return withCaptureCleanup((trackKey) =>
        Effect.gen(function* () {
          const service = yield* EventCaptureService;

          const token = uniqueToken("ok");
          trackKey(yield* insertPublicApiKey(token));

          const eventA = captureEvent({ event: "signup", distinct_id: "user-a" });
          const eventB = captureEvent({ event: "page_view", distinct_id: "user-b" });

          const result = yield* service.captureEvents(captureRequest(token, [eventA, eventB]));

          expect(result.accepted).toBe(2);
          expect(result.rejected).toBe(0);

          const events = publishedEvents(ingress.batches);
          expect(events.length).toBe(2);
          // No policy row → default policy → "main" route for within-quota events.
          expect(events.every((entry) => entry.routeClass === "main")).toBe(true);
          expect(events.some((entry) => entry.envelope.event === "signup")).toBe(true);
          expect(events.some((entry) => entry.envelope.event === "page_view")).toBe(true);
          // Envelopes carry the resolved project + the trimmed token.
          expect(events.every((entry) => entry.envelope.projectId === projectId)).toBe(true);
          expect(events.every((entry) => entry.envelope.token === token)).toBe(true);
        }),
      ).pipe(provideService({ ingress: ingress.layer }));
    })(),
  );

  test(
    "trims whitespace around an otherwise-valid token before resolving it",
    (() => {
      const ingress = makeIngressSpy();
      return withCaptureCleanup((trackKey) =>
        Effect.gen(function* () {
          const service = yield* EventCaptureService;

          const token = uniqueToken("trim");
          trackKey(yield* insertPublicApiKey(token));

          // Surrounding whitespace must be stripped so the DB lookup hits.
          const result = yield* service.captureEvents(
            captureRequest(`  ${token}\n`, [captureEvent()]),
          );

          expect(result.accepted).toBe(1);
          expect(publishedEvents(ingress.batches).length).toBe(1);
        }),
      ).pipe(provideService({ ingress: ingress.layer }));
    })(),
  );

  test(
    "fails with CaptureUnauthorizedError for a malformed token and publishes nothing",
    (() => {
      const ingress = makeIngressSpy();
      // No cleanup wrapper: a malformed token never reaches an insert.
      return Effect.gen(function* () {
        const service = yield* EventCaptureService;

        const error = yield* Effect.flip(
          service.captureEvents(captureRequest("not-a-valid-token", [captureEvent()])),
        );
        expect(error).toBeInstanceOf(CaptureUnauthorizedError);
        if (error instanceof CaptureUnauthorizedError) {
          expect(error.code).toBe("unauthorized");
        }

        expect(ingress.batches.length).toBe(0);
      }).pipe(provideService({ ingress: ingress.layer }));
    })(),
  );

  test(
    "fails with CaptureUnauthorizedError for a well-formed but unknown token",
    (() => {
      const ingress = makeIngressSpy();
      return Effect.gen(function* () {
        const service = yield* EventCaptureService;

        // Correct `vh_pk_*` shape, but no matching api-key row exists.
        const error = yield* Effect.flip(
          service.captureEvents(captureRequest(uniqueToken("missing"), [captureEvent()])),
        );
        expect(error).toBeInstanceOf(CaptureUnauthorizedError);

        expect(ingress.batches.length).toBe(0);
      }).pipe(provideService({ ingress: ingress.layer }));
    })(),
  );

  test(
    "rejects the request with CaptureRateLimitedError when the project's policy disables ingest",
    (() => {
      const ingress = makeIngressSpy();
      return withCaptureCleanup((trackKey, markPolicy) =>
        Effect.gen(function* () {
          const service = yield* EventCaptureService;

          const token = uniqueToken("disabled");
          trackKey(yield* insertPublicApiKey(token));
          yield* upsertCapturePolicy({ ingestEnabled: false });
          markPolicy();

          const error = yield* Effect.flip(
            service.captureEvents(captureRequest(token, [captureEvent()])),
          );
          expect(error).toBeInstanceOf(CaptureRateLimitedError);
          if (error instanceof CaptureRateLimitedError) {
            expect(error.code).toBe("rate_limited");
          }

          expect(ingress.batches.length).toBe(0);
        }),
      ).pipe(provideService({ ingress: ingress.layer }));
    })(),
  );

  test(
    "rejects with CaptureRateLimitedError carrying retry_after_ms when the request limit is exceeded",
    (() => {
      const ingress = makeIngressSpy();
      const policyStore = policyStoreLayer({
        checkRequestLimit: () => Effect.succeed({ allowed: false, retryAfterMs: 4_200 }),
      });
      return withCaptureCleanup((trackKey) =>
        Effect.gen(function* () {
          const service = yield* EventCaptureService;

          const token = uniqueToken("ratelimited");
          trackKey(yield* insertPublicApiKey(token));

          const error = yield* Effect.flip(
            service.captureEvents(captureRequest(token, [captureEvent()])),
          );
          expect(error).toBeInstanceOf(CaptureRateLimitedError);
          if (error instanceof CaptureRateLimitedError) {
            expect(error.retry_after_ms).toBe(4_200);
          }

          expect(ingress.batches.length).toBe(0);
        }),
      ).pipe(provideService({ ingress: ingress.layer, policyStore }));
    })(),
  );

  test(
    "rejects reserved revenue event names from public-key capture but accepts the rest",
    (() => {
      const ingress = makeIngressSpy();
      return withCaptureCleanup((trackKey) =>
        Effect.gen(function* () {
          const service = yield* EventCaptureService;

          const token = uniqueToken("reserved");
          trackKey(yield* insertPublicApiKey(token));

          const reserved = captureEvent({ event: "$purchase.completed" });
          const allowed = captureEvent({ event: "checkout_started" });

          const result = yield* service.captureEvents(captureRequest(token, [reserved, allowed]));

          expect(result.rejected).toBe(1);
          expect(result.accepted).toBe(1);

          const events = publishedEvents(ingress.batches);
          expect(events.length).toBe(1);
          expect(events[0]?.envelope.event).toBe("checkout_started");
          // The reserved event must never reach the ingress.
          expect(events.some((entry) => entry.envelope.event === "$purchase.completed")).toBe(
            false,
          );
        }),
      ).pipe(provideService({ ingress: ingress.layer }));
    })(),
  );

  test(
    "routes over-quota events to the overflow lane while staying accepted",
    (() => {
      const ingress = makeIngressSpy();
      const policyStore = policyStoreLayer({ checkEventQuota: () => Effect.succeed(false) });
      return withCaptureCleanup((trackKey) =>
        Effect.gen(function* () {
          const service = yield* EventCaptureService;

          const token = uniqueToken("overflow");
          trackKey(yield* insertPublicApiKey(token));

          // Quota check denies → selectRoute falls back to the overflow lane.
          const result = yield* service.captureEvents(captureRequest(token, [captureEvent()]));

          expect(result.accepted).toBe(1);
          expect(result.rejected).toBe(0);

          const events = publishedEvents(ingress.batches);
          expect(events.length).toBe(1);
          expect(events[0]?.routeClass).toBe<RouteClass>("overflow");
        }),
      ).pipe(provideService({ ingress: ingress.layer, policyStore }));
    })(),
  );

  test(
    "honors a forced route from the project policy",
    (() => {
      const ingress = makeIngressSpy();
      return withCaptureCleanup((trackKey, markPolicy) =>
        Effect.gen(function* () {
          const service = yield* EventCaptureService;

          const token = uniqueToken("historical");
          trackKey(yield* insertPublicApiKey(token));
          yield* upsertCapturePolicy({ forceRoute: "historical" });
          markPolicy();

          const result = yield* service.captureEvents(captureRequest(token, [captureEvent()]));

          expect(result.accepted).toBe(1);
          const events = publishedEvents(ingress.batches);
          expect(events.length).toBe(1);
          expect(events[0]?.routeClass).toBe<RouteClass>("historical");
          // Forced historical route stamps the envelope as historical.
          expect(events[0]?.envelope.routing.isHistorical).toBe(true);
        }),
      ).pipe(provideService({ ingress: ingress.layer }));
    })(),
  );

  test(
    "counts a per-event quota failure as rejected and continues processing the batch",
    (() => {
      const ingress = makeIngressSpy();
      // The first per-event quota check fails (PolicyStoreError surfaced inside
      // the per-event `Effect.result`); the second succeeds. The failing event is
      // counted rejected, the loop keeps going.
      let calls = 0;
      const policyStore = policyStoreLayer({
        checkEventQuota: () => {
          calls += 1;
          return calls === 1
            ? Effect.fail(new PolicyStoreError({ message: "per-event quota check failed" }))
            : Effect.succeed(true);
        },
      });
      return withCaptureCleanup((trackKey) =>
        Effect.gen(function* () {
          const service = yield* EventCaptureService;

          const token = uniqueToken("partialfail");
          trackKey(yield* insertPublicApiKey(token));

          const result = yield* service.captureEvents(
            captureRequest(token, [captureEvent(), captureEvent()]),
          );

          expect(result.rejected).toBe(1);
          expect(result.accepted).toBe(1);
          expect(publishedEvents(ingress.batches).length).toBe(1);
        }),
      ).pipe(provideService({ ingress: ingress.layer, policyStore }));
    })(),
  );

  test(
    "wraps a CaptureIngressError from the publish step as EventCaptureServiceError",
    (() => {
      const failingIngress = Layer.succeed(CaptureIngress, {
        enqueueBatch: () =>
          Effect.fail(new CaptureIngressError({ message: "ingress unavailable" })),
      });
      return withCaptureCleanup((trackKey) =>
        Effect.gen(function* () {
          const service = yield* EventCaptureService;

          const token = uniqueToken("ingresserr");
          trackKey(yield* insertPublicApiKey(token));

          const error = yield* Effect.flip(
            service.captureEvents(captureRequest(token, [captureEvent()])),
          );
          // CaptureIngressError is wrapped at the public boundary, surfacing the
          // adapter's message on EventCaptureServiceError.
          expect(error).toBeInstanceOf(EventCaptureServiceError);
          if (error instanceof EventCaptureServiceError) {
            expect(error.message).toBe("ingress unavailable");
          }
        }),
      ).pipe(provideService({ ingress: failingIngress }));
    })(),
  );

  test(
    "wraps a PolicyStoreError from the request-limit check as EventCaptureServiceError",
    (() => {
      const ingress = makeIngressSpy();
      const policyStore = policyStoreLayer({
        checkRequestLimit: () =>
          Effect.fail(new PolicyStoreError({ message: "counter store down" })),
      });
      return withCaptureCleanup((trackKey) =>
        Effect.gen(function* () {
          const service = yield* EventCaptureService;

          const token = uniqueToken("policyerr");
          trackKey(yield* insertPublicApiKey(token));

          const error = yield* Effect.flip(
            service.captureEvents(captureRequest(token, [captureEvent()])),
          );
          expect(error).toBeInstanceOf(EventCaptureServiceError);
          if (error instanceof EventCaptureServiceError) {
            expect(error.message).toBe("counter store down");
          }

          expect(ingress.batches.length).toBe(0);
        }),
      ).pipe(provideService({ ingress: ingress.layer, policyStore }));
    })(),
  );
});
