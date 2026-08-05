/**
 * Integration tests for {@link WebhookDispatchService}, run against the real
 * backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PlanetScale DB). The producer side of outbound webhooks: `emit` finds the
 * project's active, subscribed endpoints, writes a `webhook_delivery` row per
 * endpoint, then forks a fire-and-forget dispatch of the shared
 * `DeliverWebhook` definition.
 *
 * Each test drives `emit` end-to-end and verifies the *persisted* side effects
 * rather than just the return value:
 *  - the `webhook_delivery` rows written in MySQL (status `Pending`,
 *    `attemptCount` 0, payload + eventType round-tripped),
 *  - the `deliveriesCreated` count returned,
 *  - the dispatch hand-off recorded by an in-process workflow stub.
 *
 * A recording workflow runner captures each dispatch. The real delivery (HTTP
 * POST + retry) is the workflow runtime's concern and is covered by a
 * `test.todo` below.
 *
 * Conventions used throughout:
 *  - Every test shares the one seeded fixture project ({@link CoreTestFixture})
 *    but cleans up after itself: {@link withCleanup} deletes the endpoints and
 *    deliveries it created on exit, success or failure. The global teardown
 *    sweep is only a backstop. Assertions stay membership-based and ids are
 *    unique per call so a leftover row from a crashed run can't collide.
 *  - `emit` performs no permission check and depends on no `AuthSession`, so
 *    there is no forbidden-path case and no `CoreAuthSession.authenticate()`.
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof` before reading its fields.
 */
import { Effect, Layer, Ref } from "effect";
import { describe, expect, test as vitestTest } from "vitest";

import { WebhookDispatchService } from "@voidhash/core/services/webhookDispatch/WebhookDispatchService";
import type { DeliverWebhookInput } from "@voidhash/core/workflows/definitions";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import * as TestWorkflowRunner from "@voidhash/platform/TestWorkflowRunner";
import { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";
import { WebhookServiceError } from "@voidhash/core/services/webhookManager/WebhookManagerService";
import {
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
  Db,
  inArray,
  webhookDeliveries,
  webhookEndpoints,
} from "@voidhash/db";

import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Monotonic counter so ids stay unique even within the same millisecond. */
let idSeq = 0;
const uniqueId = (label: string) => `it-wh-${label}-${Date.now()}-${idSeq++}`;

/**
 * Recording workflow runner. Dispatches are captured into a `Ref`; the service
 * forks them fire-and-forget, so a test reads the recorded calls after giving
 * the detached fibers a tick to run.
 */
const makeRecordingWorkflow = Effect.gen(function* () {
  const calls = yield* Ref.make<ReadonlyArray<DeliverWebhookInput>>([]);
  const runner = TestWorkflowRunner.make();
  const layer = Layer.mergeAll(
    Layer.succeed(WorkflowRunner, {
      ...runner,
      dispatch: (workflow, input) =>
        Ref.update(calls, (prev) => [...prev, input as DeliverWebhookInput]).pipe(
          Effect.andThen(runner.dispatch(workflow, input)),
        ),
    }),
    Layer.succeed(PlatformRuntime, PlatformRuntime.of({})),
  );
  return { calls, layer } as const;
});

/** All delivery rows recorded for a given endpoint. */
const findDeliveriesForEndpoint = (endpointId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.webhookDeliveries.findMany({
      where: { webhookEndpointId: endpointId },
    });
  });

/**
 * Insert a webhook endpoint directly so a test can control its `status` and
 * subscribed `events` precisely. Returns the inserted id + secret/url for
 * dispatch assertions.
 */
const insertEndpoint = (input: {
  readonly id: string;
  readonly events: ReadonlyArray<string>;
  readonly status?: number;
  readonly url?: string;
  readonly secret?: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const url = input.url ?? `https://example.test/${input.id}`;
    const secret = input.secret ?? `whsec_${input.id}`;
    yield* db.insert(webhookEndpoints).values({
      consecutiveFailures: 0,
      createdAt: new Date(),
      events: [...input.events],
      id: input.id,
      name: `Endpoint ${input.id}`,
      projectId,
      secret,
      status: input.status ?? WebhookEndpointStatus.Active,
      url,
    });
    return { id: input.id, secret, url };
  });

/**
 * Delete the given endpoints and every delivery row belonging to them. Each
 * delete is `ignore`d so a missing row never turns the finalizer into a failure.
 */
const cleanup = (endpointIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (endpointIds.length === 0) return;
    const db = yield* Db;
    const targets = [...endpointIds];
    yield* db
      .delete(webhookDeliveries)
      .where(inArray(webhookDeliveries.webhookEndpointId, targets))
      .pipe(Effect.ignore);
    yield* db
      .delete(webhookEndpoints)
      .where(inArray(webhookEndpoints.id, targets))
      .pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every endpoint (and its deliveries) it creates is removed
 * afterward, regardless of how the test exits. Pass each created endpoint id to
 * the `track` callback; cleanup reads the collected ids lazily at finalization
 * via `Effect.ensuring`, so it sees every id tracked while the body ran.
 */
const withCleanup = <E, R>(
  body: (track: (id: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const createdIds: string[] = [];
  return body((id) => {
    createdIds.push(id);
  }).pipe(Effect.ensuring(cleanup(createdIds)));
};

/**
 * Provide the service-under-test layer backed by a fresh recording workflow
 * runner, and expose its `calls` Ref to the body. The harness supplies `Db` and
 * the shared runtime services.
 */
const runEmit = <E>(
  body: (
    recorded: Ref.Ref<ReadonlyArray<DeliverWebhookInput>>,
  ) => Effect.Effect<void, E, Db | WebhookDispatchService | WorkflowRunner | PlatformRuntime>,
): Effect.Effect<void, E, Db> =>
  Effect.gen(function* () {
    const workflow = yield* makeRecordingWorkflow;
    yield* body(workflow.calls).pipe(
      Effect.provide(WebhookDispatchService.layer.pipe(Layer.provideMerge(workflow.layer))),
    );
  });

describe("WebhookDispatchService.emit", () => {
  test(
    "creates a Pending delivery row for an active subscribed endpoint and dispatches attempt 1",
    withCleanup((track) =>
      runEmit((recorded) =>
        Effect.gen(function* () {
          const endpointId = uniqueId("active");
          track(endpointId);
          const endpoint = yield* insertEndpoint({
            id: endpointId,
            events: ["person.created", "person.updated"],
          });

          const dispatch = yield* WebhookDispatchService;
          const payload = { id: "person_1", name: "Ada" };
          const result = yield* dispatch.emit({
            eventType: "person.created",
            payload,
            projectId,
          });

          // `emit` counts every active subscribed endpoint in the *shared*
          // fixture project, not just the one this test created, so this is a
          // lower bound; the exact per-endpoint row count below is the scoped,
          // deterministic check.
          expect(result.deliveriesCreated).toBeGreaterThanOrEqual(1);

          const rows = yield* findDeliveriesForEndpoint(endpointId);
          expect(rows.length).toBe(1);
          const row = rows[0];
          expect(row?.status).toBe(WebhookDeliveryStatus.Pending);
          expect(row?.attemptCount).toBe(0);
          expect(row?.eventType).toBe("person.created");
          expect(row?.projectId).toBe(projectId);
          expect(row?.webhookEndpointId).toBe(endpointId);
          expect(row?.payload).toEqual(payload);
          expect(row?.eventOccurredAt).toBeInstanceOf(Date);

          // Let the fire-and-forget dispatch fiber run, then assert the hand-off.
          yield* Effect.sleep("100 millis");
          const calls = yield* Ref.get(recorded);
          const dispatched = calls.find((call) => call.deliveryId === row?.id);
          expect(dispatched).toBeDefined();
          expect(dispatched?.attemptNumber).toBe(1);
          expect(dispatched?.endpointId).toBe(endpointId);
          expect(dispatched?.eventType).toBe("person.created");
          expect(dispatched?.payload).toEqual(payload);
          expect(dispatched?.secret).toBe(endpoint.secret);
          expect(dispatched?.url).toBe(endpoint.url);
        }),
      ),
    ),
  );

  test(
    "fans out to every active endpoint subscribed to the event and returns the matching count",
    withCleanup((track) =>
      runEmit((recorded) =>
        Effect.gen(function* () {
          const subA = uniqueId("fan-a");
          const subB = uniqueId("fan-b");
          track(subA);
          track(subB);
          yield* insertEndpoint({ id: subA, events: ["subscription.created"] });
          yield* insertEndpoint({
            id: subB,
            events: ["subscription.created", "purchase.completed"],
          });

          const dispatch = yield* WebhookDispatchService;
          const result = yield* dispatch.emit({
            eventType: "subscription.created",
            payload: { plan: "pro" },
            projectId,
          });

          // Project-wide count, so a lower bound; the per-endpoint exact counts
          // below pin down that *both* of this test's endpoints fanned out.
          expect(result.deliveriesCreated).toBeGreaterThanOrEqual(2);

          const rowsA = yield* findDeliveriesForEndpoint(subA);
          const rowsB = yield* findDeliveriesForEndpoint(subB);
          expect(rowsA.length).toBe(1);
          expect(rowsB.length).toBe(1);

          yield* Effect.sleep("100 millis");
          const calls = yield* Ref.get(recorded);
          const endpointsDispatched = calls.map((call) => call.endpointId);
          expect(endpointsDispatched).toContain(subA);
          expect(endpointsDispatched).toContain(subB);
        }),
      ),
    ),
  );

  test(
    "skips endpoints not subscribed to the event and disabled endpoints",
    withCleanup((track) =>
      runEmit((recorded) =>
        Effect.gen(function* () {
          const subscribed = uniqueId("filter-subscribed");
          const wrongEvent = uniqueId("filter-wrong-event");
          const disabled = uniqueId("filter-disabled");
          track(subscribed);
          track(wrongEvent);
          track(disabled);

          // Subscribed + active: should receive a delivery.
          yield* insertEndpoint({ id: subscribed, events: ["purchase.refunded"] });
          // Active but subscribed to a different event: skipped by membership filter.
          yield* insertEndpoint({ id: wrongEvent, events: ["purchase.completed"] });
          // Subscribed to the event but disabled: skipped by the status filter.
          yield* insertEndpoint({
            id: disabled,
            events: ["purchase.refunded"],
            status: WebhookEndpointStatus.Disabled,
          });

          const dispatch = yield* WebhookDispatchService;
          const result = yield* dispatch.emit({
            eventType: "purchase.refunded",
            payload: { reason: "duplicate" },
            projectId,
          });

          // Project-wide count, so a lower bound; the per-endpoint exact counts
          // below verify the membership/status filter actually skipped the
          // wrong-event and disabled endpoints this test created.
          expect(result.deliveriesCreated).toBeGreaterThanOrEqual(1);
          expect((yield* findDeliveriesForEndpoint(subscribed)).length).toBe(1);
          expect((yield* findDeliveriesForEndpoint(wrongEvent)).length).toBe(0);
          expect((yield* findDeliveriesForEndpoint(disabled)).length).toBe(0);

          yield* Effect.sleep("100 millis");
          const calls = yield* Ref.get(recorded);
          const endpointsDispatched = calls.map((call) => call.endpointId);
          expect(endpointsDispatched).toContain(subscribed);
          expect(endpointsDispatched).not.toContain(wrongEvent);
          expect(endpointsDispatched).not.toContain(disabled);
        }),
      ),
    ),
  );

  test(
    "returns deliveriesCreated=0 and writes nothing when no endpoint is subscribed",
    // No cleanup wrapper: the only endpoint is for an unrelated event and is
    // tracked for deletion; emit itself writes no delivery rows.
    withCleanup((track) =>
      runEmit((recorded) =>
        Effect.gen(function* () {
          const endpointId = uniqueId("none");
          track(endpointId);
          yield* insertEndpoint({ id: endpointId, events: ["person.created"] });

          const dispatch = yield* WebhookDispatchService;
          const result = yield* dispatch.emit({
            eventType: "subscription.expired",
            payload: { at: 1 },
            projectId,
          });

          expect(result.deliveriesCreated).toBe(0);
          expect((yield* findDeliveriesForEndpoint(endpointId)).length).toBe(0);

          yield* Effect.sleep("50 millis");
          const calls = yield* Ref.get(recorded);
          expect(calls.length).toBe(0);
        }),
      ),
    ),
  );

  test(
    "round-trips a complex nested object payload through the JSON delivery column",
    withCleanup((track) =>
      runEmit((recorded) =>
        Effect.gen(function* () {
          const endpointId = uniqueId("payload");
          track(endpointId);
          yield* insertEndpoint({ id: endpointId, events: ["subscription.renewed"] });

          const payload = {
            metadata: { flags: [true, false], tags: ["a", "b"] },
            nested: { deep: { value: 42 } },
            person: { distinctIds: ["d1", "d2"], id: "person_x" },
          };

          const dispatch = yield* WebhookDispatchService;
          yield* dispatch.emit({ eventType: "subscription.renewed", payload, projectId });

          const rows = yield* findDeliveriesForEndpoint(endpointId);
          expect(rows.length).toBe(1);
          expect(rows[0]?.payload).toEqual(payload);

          yield* Effect.sleep("100 millis");
          const calls = yield* Ref.get(recorded);
          const dispatched = calls.find((call) => call.endpointId === endpointId);
          expect(dispatched?.payload).toEqual(payload);
        }),
      ),
    ),
  );

  test(
    "wraps an infrastructural failure as WebhookServiceError and writes no delivery row",
    withCleanup((track) =>
      runEmit(() =>
        Effect.gen(function* () {
          const endpointId = uniqueId("db-error");
          track(endpointId);
          yield* insertEndpoint({ id: endpointId, events: ["person.deleted"] });

          // A circular object cannot be serialized to the JSON `payload` column;
          // the driver throws inside `db.use`, surfacing as `DatabaseError`,
          // which `emit`'s `catchTags` maps to `WebhookServiceError`.
          const circular: Record<string, unknown> = { ok: true };
          circular.self = circular;

          const dispatch = yield* WebhookDispatchService;
          const error = yield* Effect.flip(
            dispatch.emit({
              eventType: "person.deleted",
              payload: circular,
              projectId,
            }),
          );
          expect(error).toBeInstanceOf(WebhookServiceError);
          if (error instanceof WebhookServiceError) {
            expect(error.cause).toContain("Failed to emit webhook event");
          }

          // The failed insert must leave no delivery row behind for the endpoint.
          expect((yield* findDeliveriesForEndpoint(endpointId)).length).toBe(0);
        }),
      ),
    ),
  );

  // Real outbound delivery (signed HTTP POST + retry/backoff + attempt-log rows)
  // is deferred to an app-level test running against a durable workflow
  // runtime. The producer's hand-off (delivery row + dispatch call) is fully
  // covered above.
  vitestTest.todo(
    "delivers the webhook over HTTP and records attempt rows — deferred: requires a durable workflow runtime",
  );
});
