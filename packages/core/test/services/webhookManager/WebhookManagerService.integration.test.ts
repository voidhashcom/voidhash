/**
 * Integration tests for {@link WebhookManagerService}, run against the real
 * backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PlanetScale DB; only the project schema cache is an in-memory stub).
 *
 * `WebhookManagerService` is the CRUD surface for outbound webhook endpoints and
 * their delivery history. Like {@link WebhookDeliveryService} it carries no auth
 * or permission guard — every public method scopes by `projectId` directly —
 * so there is no forbidden-path test here. Instead each test drives the service
 * end-to-end and verifies the *persisted* side effects rather than just the
 * return value:
 *  - the `webhook_endpoint` / `webhook_delivery` row written / updated / removed
 *    in MySQL (read straight back, bypassing the service),
 *  - the matching `audit_log` row (entity, action, actor, change snapshot),
 *  - the generated `whsec_<64 hex>` secret on create / rotate.
 *
 * The test substitutes a recording workflow runner. `updateEndpoint`
 * intentionally does *not* dispatch; only `retryDelivery` and `testEndpoint`
 * hand a delivery off, and they do so via `Effect.forkDetach` (fire-and-forget).
 * Those tests assert the synchronous, deterministic persisted state and use
 * {@link waitForDispatch} (a bounded poll that yields control so the detached
 * fiber can run) to observe the dispatch payload best-effort.
 *
 * Conventions: the webhook tables are not covered by the global fixture sweep,
 * so each test creates its own endpoint/delivery parent rows under the seeded
 * fixture project ({@link CoreTestFixture}), tracks every id it writes, and
 * {@link withWebhookCleanup} deletes them (deepest dependent first, plus their
 * append-only audit rows) on exit, success or failure. Ids/slugs are unique per
 * call so a leftover row from a crashed run can't collide, and assertions stay
 * membership-based (never exact `getEndpoints`/`getDeliveries` counts).
 */
import { Clock, DateTime, Deferred, Effect, Layer } from "effect";
import { describe, expect } from "vitest";

import { WebhookManagerService } from "@voidhash/core/services/webhookManager/WebhookManagerService";
import {
  WebhookDeliveryNotFoundError,
  WebhookEndpointNotFoundError,
  WebhookValidationError,
} from "@voidhash/core/domain/webhook/Webhook";
import type { DeliverWebhookInput } from "@voidhash/core/workflows/definitions";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import * as TestWorkflowRunner from "@voidhash/platform/TestWorkflowRunner";
import { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";
import {
  AuditLogAction,
  AuditLogActorType,
  AuditLogEntityType,
  Db,
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
  and,
  auditLogs,
  eq,
  inArray,
  webhookDeliveries,
  webhookDeliveryAttempts,
  webhookEndpoints,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Monotonic counter so slugs/ids stay unique even within the same millisecond. */
let seq = 0;
const uniqueSlug = (label: string) =>
  Effect.map(Clock.currentTimeMillis, (now) => `it-wh-${label}-${now}-${seq++}`);

/**
 * The recorder only ever observes `DeliverWebhook` dispatches; this narrows the
 * generic workflow payload without an assertion.
 */
const isDeliverWebhookInput = (input: unknown): input is DeliverWebhookInput =>
  typeof input === "object" && input !== null && "deliveryId" in input && "endpointId" in input;

// ---------------------------------------------------------------------------
// Recording workflow runner. The layer records each dispatch and completes a
// Deferred so a test can await the detached fork. One fresh recorder per test
// keeps calls isolated.
// ---------------------------------------------------------------------------

interface Recorder {
  readonly calls: DeliverWebhookInput[];
  readonly firstDispatch: Deferred.Deferred<DeliverWebhookInput>;
  readonly layer: Layer.Layer<WorkflowRunner | PlatformRuntime>;
}

const makeRecorder = (): Recorder => {
  const calls: DeliverWebhookInput[] = [];
  const firstDispatch = Deferred.makeUnsafe<DeliverWebhookInput>();
  const runner = TestWorkflowRunner.make();
  const layer = Layer.mergeAll(
    Layer.succeed(WorkflowRunner, {
      ...runner,
      dispatch: (workflow, input) =>
        Effect.gen(function* () {
          if (isDeliverWebhookInput(input)) {
            calls.push(input);
            yield* Deferred.succeed(firstDispatch, input);
          }
          return yield* runner.dispatch(workflow, input);
        }),
    }),
    Layer.succeed(PlatformRuntime, PlatformRuntime.of({})),
  );
  return { calls, firstDispatch, layer };
};

/**
 * Await the first dispatch the recorder captured, bounded by a timeout. The
 * service forks `dispatch` with `Effect.forkDetach`, so awaiting the Deferred
 * yields control to let that daemon fiber run; the timeout keeps the test from
 * hanging if a path (unexpectedly) never dispatches.
 */
const waitForDispatch = (recorder: Recorder) =>
  Deferred.await(recorder.firstDispatch).pipe(Effect.timeoutOption("10 seconds"));

// ---------------------------------------------------------------------------
// DB read-back helpers (bypass the service)
// ---------------------------------------------------------------------------

const findEndpointRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.webhookEndpoints.findFirst({ where: { id } });
  });

const findDeliveryRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.webhookDeliveries.findFirst({ where: { id } });
  });

/** All audit-log rows recorded for a given webhook-endpoint entity. */
const findEndpointAuditEntries = (entityId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, AuditLogEntityType.WebhookEndpoint),
          eq(auditLogs.entityId, entityId),
        ),
      );
  });

// ---------------------------------------------------------------------------
// Parent-row builders. The fixture seeds only user/org/member/project, so a
// manager test that needs an existing endpoint/delivery creates its own rows.
// ---------------------------------------------------------------------------

interface CreatedEndpoint {
  readonly id: string;
  readonly secret: string;
  readonly url: string;
}

const insertEndpoint = (overrides?: {
  readonly projectId?: string;
  readonly status?: number;
  readonly url?: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = yield* uniqueSlug("ep");
    const secret = `whsec_${yield* uniqueSlug("secret")}`;
    const url = overrides?.url ?? "https://example.test/hook";
    yield* db.insert(webhookEndpoints).values({
      consecutiveFailures: 0,
      createdAt: yield* DateTime.nowAsDate,
      events: ["person.created"],
      id,
      name: "Seed Endpoint",
      projectId: overrides?.projectId ?? projectId,
      secret,
      status: overrides?.status ?? WebhookEndpointStatus.Active,
      url,
    });
    return { id, secret, url } satisfies CreatedEndpoint;
  });

const insertDelivery = (input: {
  readonly endpointId: string;
  readonly projectId?: string;
  readonly status?: number;
  readonly attemptCount?: number;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = yield* uniqueSlug("del");
    yield* db.insert(webhookDeliveries).values({
      attemptCount: input.attemptCount ?? 0,
      completedAt: yield* DateTime.nowAsDate,
      createdAt: yield* DateTime.nowAsDate,
      eventOccurredAt: yield* DateTime.nowAsDate,
      eventType: "person.created",
      id,
      nextAttemptAt: yield* DateTime.nowAsDate,
      payload: { hello: "world" },
      projectId: input.projectId ?? projectId,
      status: input.status ?? WebhookDeliveryStatus.Failed,
      webhookEndpointId: input.endpointId,
    });
    return id;
  });

const insertAttempt = (input: { readonly deliveryId: string; readonly attemptNumber: number }) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = yield* uniqueSlug("att");
    yield* db.insert(webhookDeliveryAttempts).values({
      attemptNumber: input.attemptNumber,
      createdAt: yield* DateTime.nowAsDate,
      durationMs: 42,
      errorMessage: `attempt ${input.attemptNumber}`,
      id,
      responseBody: `body ${input.attemptNumber}`,
      statusCode: 500,
      succeeded: false,
      webhookDeliveryId: input.deliveryId,
    });
    return id;
  });

// ---------------------------------------------------------------------------
// Cleanup. Webhook rows are not covered by the global fixture sweep, so each
// test deletes the endpoints/deliveries/attempts it created (deepest dependent
// first) plus the append-only audit rows keyed by entityId.
// ---------------------------------------------------------------------------

interface Tracked {
  readonly endpointIds: string[];
  readonly deliveryIds: string[];
}

const cleanupWebhookRows = (tracked: Tracked) =>
  Effect.gen(function* () {
    const db = yield* Db;
    if (tracked.deliveryIds.length > 0) {
      const deliveryIds = [...tracked.deliveryIds];
      yield* db
        .delete(webhookDeliveryAttempts)
        .where(inArray(webhookDeliveryAttempts.webhookDeliveryId, deliveryIds))
        .pipe(Effect.ignore);
      yield* db
        .delete(webhookDeliveries)
        .where(inArray(webhookDeliveries.id, deliveryIds))
        .pipe(Effect.ignore);
    }
    if (tracked.endpointIds.length > 0) {
      const endpointIds = [...tracked.endpointIds];
      // Endpoint deliveries created by `testEndpoint` are keyed off the endpoint,
      // not tracked individually; clear them before the endpoint rows.
      yield* db
        .delete(webhookDeliveries)
        .where(inArray(webhookDeliveries.webhookEndpointId, endpointIds))
        .pipe(Effect.ignore);
      yield* db
        .delete(webhookEndpoints)
        .where(inArray(webhookEndpoints.id, endpointIds))
        .pipe(Effect.ignore);
      yield* db
        .delete(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, AuditLogEntityType.WebhookEndpoint),
            inArray(auditLogs.entityId, endpointIds),
          ),
        )
        .pipe(Effect.ignore);
    }
  });

/**
 * Wrap a test body so every endpoint/delivery it creates is removed afterward,
 * regardless of how the test exits. The body receives a `track` object whose
 * arrays it pushes created ids onto; cleanup reads them lazily at finalization
 * via `Effect.ensuring`, so it sees every id tracked while the body ran
 * (including on failure).
 */
const withWebhookCleanup = <E, R>(
  body: (track: Tracked) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const tracked: Tracked = { deliveryIds: [], endpointIds: [] };
  return body(tracked).pipe(Effect.ensuring(cleanupWebhookRows(tracked)));
};

const SECRET_PATTERN = /^whsec_[0-9a-f]{64}$/;

// ===========================================================================
// createEndpoint
// ===========================================================================

describe("WebhookManagerService.createEndpoint", () => {
  test(
    "persists an active endpoint with a whsec secret and records a Created audit entry",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const name = "Integration Endpoint";
        const url = "https://example.test/created";
        const events = ["person.created", "subscription.renewed"];

        const created = yield* svc.createEndpoint({
          description: "from integration test",
          events,
          name,
          projectId,
          url,
        });
        track.endpointIds.push(created.id);

        // Return-value shape.
        expect(created.id.startsWith("wh_ep")).toBe(true);
        expect(created.status).toBe("active");
        expect(created.consecutiveFailures).toBe(0);
        expect(created.lastSuccessAt).toBeNull();
        expect(SECRET_PATTERN.test(created.secret)).toBe(true);
        expect(created.events).toEqual(events);

        // Persisted row.
        const row = yield* findEndpointRow(created.id);
        expect(row).toBeDefined();
        expect(row?.name).toBe(name);
        expect(row?.url).toBe(url);
        expect(row?.projectId).toBe(projectId);
        expect(row?.status).toBe(WebhookEndpointStatus.Active);
        expect(row?.consecutiveFailures).toBe(0);
        expect(row?.lastSuccessAt).toBeNull();
        expect(row?.secret).toBe(created.secret);
        expect(row?.events).toEqual(events);

        // Audit entry with the create snapshot.
        const auditEntries = yield* findEndpointAuditEntries(created.id);
        const createdEntry = auditEntries.find((e) => e.action === AuditLogAction.Created);
        expect(createdEntry).toBeDefined();
        expect(createdEntry?.entityType).toBe(AuditLogEntityType.WebhookEndpoint);
        expect(createdEntry?.actorUserId).toBe(CoreTestFixture.userId);
        expect(createdEntry?.actorType).toBe(AuditLogActorType.User);
        expect(createdEntry?.changes).toEqual({ snapshot: { events, name, url } });
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects an invalid URL (non-http protocol / malformed) and writes nothing",
    // No cleanup wrapper: a validation failure writes no endpoint row.
    Effect.gen(function* () {
      const svc = yield* WebhookManagerService;

      const badProtocol = yield* Effect.flip(
        svc.createEndpoint({
          events: ["person.created"],
          name: "Bad",
          projectId,
          url: "ftp://example.test/hook",
        }),
      );
      expect(badProtocol).toBeInstanceOf(WebhookValidationError);

      const malformed = yield* Effect.flip(
        svc.createEndpoint({
          events: ["person.created"],
          name: "Bad",
          projectId,
          url: "not-a-url",
        }),
      );
      expect(malformed).toBeInstanceOf(WebhookValidationError);
    }).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects unknown event types and an empty event list, writing nothing",
    Effect.gen(function* () {
      const svc = yield* WebhookManagerService;

      const unknownEvent = yield* Effect.flip(
        svc.createEndpoint({
          events: ["person.created", "not.a.real.event"],
          name: "Bad",
          projectId,
          url: "https://example.test/hook",
        }),
      );
      expect(unknownEvent).toBeInstanceOf(WebhookValidationError);

      const noEvents = yield* Effect.flip(
        svc.createEndpoint({
          events: [],
          name: "Bad",
          projectId,
          url: "https://example.test/hook",
        }),
      );
      expect(noEvents).toBeInstanceOf(WebhookValidationError);
    }).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// updateEndpoint
// ===========================================================================

describe("WebhookManagerService.updateEndpoint", () => {
  test(
    "applies a partial update, resets consecutiveFailures when re-enabling, and records an Updated audit entry",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        // Seed a disabled endpoint with prior failures so re-enabling is observable.
        const endpoint = yield* insertEndpoint({
          status: WebhookEndpointStatus.Disabled,
          url: "https://example.test/before",
        });
        track.endpointIds.push(endpoint.id);
        yield* findEndpointRow(endpoint.id).pipe(
          Effect.tap((row) =>
            Effect.sync(() => {
              expect(row?.status).toBe(WebhookEndpointStatus.Disabled);
            }),
          ),
        );
        // Bump the failure counter directly so the reset on re-enable is visible.
        const db = yield* Db;
        yield* db
          .update(webhookEndpoints)
          .set({ consecutiveFailures: 4 })
          .where(eq(webhookEndpoints.id, endpoint.id));

        const newName = "Renamed Endpoint";
        const newUrl = "https://example.test/after";
        const newEvents = ["purchase.completed"];

        const updated = yield* svc.updateEndpoint({
          description: "updated desc",
          endpointId: endpoint.id,
          events: newEvents,
          name: newName,
          projectId,
          status: "active",
          url: newUrl,
        });
        expect(updated.id).toBe(endpoint.id);
        expect(updated.status).toBe("active");

        const row = yield* findEndpointRow(endpoint.id);
        expect(row?.name).toBe(newName);
        expect(row?.url).toBe(newUrl);
        expect(row?.events).toEqual(newEvents);
        expect(row?.description).toBe("updated desc");
        expect(row?.status).toBe(WebhookEndpointStatus.Active);
        // Re-enabling resets the consecutive-failure counter.
        expect(row?.consecutiveFailures).toBe(0);

        const auditEntries = yield* findEndpointAuditEntries(endpoint.id);
        const updatedEntry = auditEntries.find((e) => e.action === AuditLogAction.Updated);
        expect(updatedEntry).toBeDefined();
        expect(updatedEntry?.actorUserId).toBe(CoreTestFixture.userId);
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects an invalid URL/event update and leaves the row unchanged",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const endpoint = yield* insertEndpoint({ url: "https://example.test/keep" });
        track.endpointIds.push(endpoint.id);

        const urlError = yield* Effect.flip(
          svc.updateEndpoint({ endpointId: endpoint.id, projectId, url: "javascript:alert(1)" }),
        );
        expect(urlError).toBeInstanceOf(WebhookValidationError);

        const eventError = yield* Effect.flip(
          svc.updateEndpoint({ endpointId: endpoint.id, events: ["bogus"], projectId }),
        );
        expect(eventError).toBeInstanceOf(WebhookValidationError);

        const row = yield* findEndpointRow(endpoint.id);
        expect(row?.url).toBe("https://example.test/keep");
        expect(row?.events).toEqual(["person.created"]);
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with WebhookEndpointNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* WebhookManagerService;
      const error = yield* Effect.flip(
        svc.updateEndpoint({ endpointId: yield* uniqueSlug("missing"), name: "x", projectId }),
      );
      expect(error).toBeInstanceOf(WebhookEndpointNotFoundError);
    }).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "scopes by projectId: an endpoint in another project is not found and stays unchanged",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        // Endpoint belongs to a different project than the caller targets.
        const otherProjectId = `${projectId}-other`;
        const endpoint = yield* insertEndpoint({
          projectId: otherProjectId,
          url: "https://example.test/foreign",
        });
        track.endpointIds.push(endpoint.id);

        const error = yield* Effect.flip(
          svc.updateEndpoint({ endpointId: endpoint.id, name: "hijacked", projectId }),
        );
        expect(error).toBeInstanceOf(WebhookEndpointNotFoundError);

        const row = yield* findEndpointRow(endpoint.id);
        expect(row?.name).toBe("Seed Endpoint");
        expect(row?.projectId).toBe(otherProjectId);
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// deleteEndpoint
// ===========================================================================

describe("WebhookManagerService.deleteEndpoint", () => {
  test(
    "removes the endpoint and records a Deleted audit entry",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const endpoint = yield* insertEndpoint();
        track.endpointIds.push(endpoint.id);

        yield* svc.deleteEndpoint({ endpointId: endpoint.id, projectId });

        const row = yield* findEndpointRow(endpoint.id);
        expect(row).toBeUndefined();

        const auditEntries = yield* findEndpointAuditEntries(endpoint.id);
        const deletedEntry = auditEntries.find((e) => e.action === AuditLogAction.Deleted);
        expect(deletedEntry).toBeDefined();
        expect(deletedEntry?.actorUserId).toBe(CoreTestFixture.userId);
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with WebhookEndpointNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* WebhookManagerService;
      const error = yield* Effect.flip(
        svc.deleteEndpoint({ endpointId: yield* uniqueSlug("missing"), projectId }),
      );
      expect(error).toBeInstanceOf(WebhookEndpointNotFoundError);
    }).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "scopes by projectId: cannot delete an endpoint from another project",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const otherProjectId = `${projectId}-other`;
        const endpoint = yield* insertEndpoint({ projectId: otherProjectId });
        track.endpointIds.push(endpoint.id);

        const error = yield* Effect.flip(
          svc.deleteEndpoint({ endpointId: endpoint.id, projectId }),
        );
        expect(error).toBeInstanceOf(WebhookEndpointNotFoundError);

        const row = yield* findEndpointRow(endpoint.id);
        expect(row).toBeDefined();
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// getEndpointById
// ===========================================================================

describe("WebhookManagerService.getEndpointById", () => {
  test(
    "returns the endpoint dto and maps the status int to its string form",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const endpoint = yield* insertEndpoint({
          status: WebhookEndpointStatus.Failed,
          url: "https://example.test/byid",
        });
        track.endpointIds.push(endpoint.id);

        const dto = yield* svc.getEndpointById({ endpointId: endpoint.id, projectId });
        expect(dto.id).toBe(endpoint.id);
        expect(dto.url).toBe("https://example.test/byid");
        expect(dto.projectId).toBe(projectId);
        // status int 3 (Failed) maps to "failed".
        expect(dto.status).toBe("failed");
        expect(dto.events).toEqual(["person.created"]);
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with WebhookEndpointNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* WebhookManagerService;
      const error = yield* Effect.flip(
        svc.getEndpointById({ endpointId: yield* uniqueSlug("missing"), projectId }),
      );
      expect(error).toBeInstanceOf(WebhookEndpointNotFoundError);
    }).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "scopes by projectId: an endpoint in another project is not found",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const endpoint = yield* insertEndpoint({ projectId: `${projectId}-other` });
        track.endpointIds.push(endpoint.id);

        const error = yield* Effect.flip(
          svc.getEndpointById({ endpointId: endpoint.id, projectId }),
        );
        expect(error).toBeInstanceOf(WebhookEndpointNotFoundError);
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// getEndpoints
// ===========================================================================

describe("WebhookManagerService.getEndpoints", () => {
  test(
    "returns the project's endpoints (membership) with status ints mapped to strings",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const active = yield* insertEndpoint({ status: WebhookEndpointStatus.Active });
        track.endpointIds.push(active.id);
        const disabled = yield* insertEndpoint({ status: WebhookEndpointStatus.Disabled });
        track.endpointIds.push(disabled.id);
        // An endpoint in another project must not leak into the list.
        const foreign = yield* insertEndpoint({ projectId: `${projectId}-other` });
        track.endpointIds.push(foreign.id);

        const list = yield* svc.getEndpoints({ projectId });
        const activeDto = list.find((e) => e.id === active.id);
        const disabledDto = list.find((e) => e.id === disabled.id);
        expect(activeDto?.status).toBe("active");
        expect(disabledDto?.status).toBe("disabled");
        expect(list.some((e) => e.id === foreign.id)).toBe(false);
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// rotateSecret
// ===========================================================================

describe("WebhookManagerService.rotateSecret", () => {
  test(
    "replaces the endpoint secret with a fresh whsec value and records an Updated audit entry",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const endpoint = yield* insertEndpoint();
        track.endpointIds.push(endpoint.id);
        const original = yield* findEndpointRow(endpoint.id);
        const originalSecret = original?.secret;

        const rotated = yield* svc.rotateSecret({ endpointId: endpoint.id, projectId });
        expect(SECRET_PATTERN.test(rotated.secret)).toBe(true);
        expect(rotated.secret).not.toBe(originalSecret);

        const row = yield* findEndpointRow(endpoint.id);
        expect(row?.secret).toBe(rotated.secret);
        expect(row?.secret).not.toBe(originalSecret);

        const auditEntries = yield* findEndpointAuditEntries(endpoint.id);
        expect(auditEntries.some((e) => e.action === AuditLogAction.Updated)).toBe(true);
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with WebhookEndpointNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* WebhookManagerService;
      const error = yield* Effect.flip(
        svc.rotateSecret({ endpointId: yield* uniqueSlug("missing"), projectId }),
      );
      expect(error).toBeInstanceOf(WebhookEndpointNotFoundError);
    }).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "scopes by projectId: cannot rotate an endpoint from another project",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const endpoint = yield* insertEndpoint({ projectId: `${projectId}-other` });
        track.endpointIds.push(endpoint.id);
        const before = yield* findEndpointRow(endpoint.id);

        const error = yield* Effect.flip(svc.rotateSecret({ endpointId: endpoint.id, projectId }));
        expect(error).toBeInstanceOf(WebhookEndpointNotFoundError);

        const after = yield* findEndpointRow(endpoint.id);
        expect(after?.secret).toBe(before?.secret);
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// getDeliveries
// ===========================================================================

describe("WebhookManagerService.getDeliveries", () => {
  test(
    "returns the project's deliveries and filters by endpointId when provided",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const epA = yield* insertEndpoint();
        track.endpointIds.push(epA.id);
        const epB = yield* insertEndpoint();
        track.endpointIds.push(epB.id);

        const delA = yield* insertDelivery({ endpointId: epA.id });
        track.deliveryIds.push(delA);
        const delB = yield* insertDelivery({ endpointId: epB.id });
        track.deliveryIds.push(delB);

        // Project-wide: both appear (membership, never exact count).
        const all = yield* svc.getDeliveries({ projectId });
        expect(all.some((d) => d.id === delA)).toBe(true);
        expect(all.some((d) => d.id === delB)).toBe(true);

        // Filtered by endpoint: only that endpoint's deliveries.
        const onlyA = yield* svc.getDeliveries({ endpointId: epA.id, projectId });
        expect(onlyA.some((d) => d.id === delA)).toBe(true);
        expect(onlyA.some((d) => d.id === delB)).toBe(false);
        // status int maps to its string form.
        expect(onlyA.find((d) => d.id === delA)?.status).toBe("failed");
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "honors the limit argument",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const ep = yield* insertEndpoint();
        track.endpointIds.push(ep.id);
        const d1 = yield* insertDelivery({ endpointId: ep.id });
        track.deliveryIds.push(d1);
        const d2 = yield* insertDelivery({ endpointId: ep.id });
        track.deliveryIds.push(d2);

        const limited = yield* svc.getDeliveries({ endpointId: ep.id, limit: 1, projectId });
        expect(limited.length).toBe(1);
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// getDeliveryById
// ===========================================================================

describe("WebhookManagerService.getDeliveryById", () => {
  test(
    "returns the delivery dto plus its attempts ordered by attemptNumber asc",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const ep = yield* insertEndpoint();
        track.endpointIds.push(ep.id);
        const deliveryId = yield* insertDelivery({ endpointId: ep.id });
        track.deliveryIds.push(deliveryId);
        // Insert out of order to prove the asc ordering.
        yield* insertAttempt({ attemptNumber: 2, deliveryId });
        yield* insertAttempt({ attemptNumber: 1, deliveryId });

        const dto = yield* svc.getDeliveryById({ deliveryId, projectId });
        expect(dto.id).toBe(deliveryId);
        expect(dto.webhookEndpointId).toBe(ep.id);
        expect(dto.attempts.map((a) => a.attemptNumber)).toEqual([1, 2]);
        const first = dto.attempts[0]!;
        expect(first.statusCode).toBe(500);
        expect(first.succeeded).toBe(false);
        expect(first.errorMessage).toBe("attempt 1");
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with WebhookDeliveryNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* WebhookManagerService;
      const error = yield* Effect.flip(
        svc.getDeliveryById({ deliveryId: yield* uniqueSlug("missing"), projectId }),
      );
      expect(error).toBeInstanceOf(WebhookDeliveryNotFoundError);
    }).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "scopes by projectId: a delivery in another project is not found",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const ep = yield* insertEndpoint({ projectId: `${projectId}-other` });
        track.endpointIds.push(ep.id);
        const deliveryId = yield* insertDelivery({
          endpointId: ep.id,
          projectId: `${projectId}-other`,
        });
        track.deliveryIds.push(deliveryId);

        const error = yield* Effect.flip(svc.getDeliveryById({ deliveryId, projectId }));
        expect(error).toBeInstanceOf(WebhookDeliveryNotFoundError);
      }),
    ).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// retryDelivery
// ===========================================================================

describe("WebhookManagerService.retryDelivery", () => {
  test(
    "moves a Failed delivery to InProgress, clears completedAt/nextAttemptAt, and dispatches the next attempt",
    withWebhookCleanup((track) => {
      const recorder = makeRecorder();
      return Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const ep = yield* insertEndpoint();
        track.endpointIds.push(ep.id);
        const deliveryId = yield* insertDelivery({
          attemptCount: 2,
          endpointId: ep.id,
          status: WebhookDeliveryStatus.Failed,
        });
        track.deliveryIds.push(deliveryId);

        const result = yield* svc.retryDelivery({ deliveryId, projectId });
        expect(result.status).toBe("in_progress");

        // Persisted, synchronous state.
        const row = yield* findDeliveryRow(deliveryId);
        expect(row?.status).toBe(WebhookDeliveryStatus.InProgress);
        expect(row?.completedAt).toBeNull();
        expect(row?.nextAttemptAt).toBeNull();

        // Best-effort observation of the fire-and-forget dispatch.
        const dispatched = yield* waitForDispatch(recorder);
        if (dispatched._tag === "Some") {
          expect(dispatched.value.deliveryId).toBe(deliveryId);
          expect(dispatched.value.endpointId).toBe(ep.id);
          expect(dispatched.value.secret).toBe(ep.secret);
          expect(dispatched.value.url).toBe(ep.url);
          // attemptNumber = current.attemptCount (2) + 1.
          expect(dispatched.value.attemptNumber).toBe(3);
        }
      }).pipe(Effect.provide(recorder.layer));
    }).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects a delivery that is not Failed or Exhausted and leaves it unchanged",
    withWebhookCleanup((track) => {
      const recorder = makeRecorder();
      return Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const ep = yield* insertEndpoint();
        track.endpointIds.push(ep.id);
        const deliveryId = yield* insertDelivery({
          endpointId: ep.id,
          status: WebhookDeliveryStatus.Pending,
        });
        track.deliveryIds.push(deliveryId);

        const error = yield* Effect.flip(svc.retryDelivery({ deliveryId, projectId }));
        expect(error).toBeInstanceOf(WebhookValidationError);

        const row = yield* findDeliveryRow(deliveryId);
        expect(row?.status).toBe(WebhookDeliveryStatus.Pending);
      }).pipe(Effect.provide(recorder.layer));
    }).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with WebhookDeliveryNotFoundError for an unknown id",
    Effect.gen(function* () {
      const svc = yield* WebhookManagerService;
      const error = yield* Effect.flip(
        svc.retryDelivery({ deliveryId: yield* uniqueSlug("missing"), projectId }),
      );
      expect(error).toBeInstanceOf(WebhookDeliveryNotFoundError);
    }).pipe(
      Effect.provide(makeRecorder().layer),
      Effect.provide(WebhookManagerService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "scopes by projectId: a delivery in another project is not found and stays unchanged",
    withWebhookCleanup((track) => {
      const recorder = makeRecorder();
      return Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const ep = yield* insertEndpoint({ projectId: `${projectId}-other` });
        track.endpointIds.push(ep.id);
        const deliveryId = yield* insertDelivery({
          endpointId: ep.id,
          projectId: `${projectId}-other`,
          status: WebhookDeliveryStatus.Failed,
        });
        track.deliveryIds.push(deliveryId);

        const error = yield* Effect.flip(svc.retryDelivery({ deliveryId, projectId }));
        expect(error).toBeInstanceOf(WebhookDeliveryNotFoundError);

        const row = yield* findDeliveryRow(deliveryId);
        expect(row?.status).toBe(WebhookDeliveryStatus.Failed);
      }).pipe(Effect.provide(recorder.layer));
    }).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// testEndpoint
// ===========================================================================

describe("WebhookManagerService.testEndpoint", () => {
  test(
    "persists a Pending test.ping delivery, returns its dto, and dispatches it",
    withWebhookCleanup((track) => {
      const recorder = makeRecorder();
      return Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const ep = yield* insertEndpoint();
        track.endpointIds.push(ep.id);

        const dto = yield* svc.testEndpoint({ endpointId: ep.id, projectId });
        track.deliveryIds.push(dto.id);

        // Return-value shape mirrors the persisted Pending delivery.
        expect(dto.id.startsWith("wh_del")).toBe(true);
        expect(dto.eventType).toBe("test.ping");
        expect(dto.status).toBe("pending");
        expect(dto.attemptCount).toBe(0);
        expect(dto.webhookEndpointId).toBe(ep.id);
        expect(dto.payload).toMatchObject({ message: "This is a test webhook delivery" });

        // Persisted row.
        const row = yield* findDeliveryRow(dto.id);
        expect(row).toBeDefined();
        expect(row?.eventType).toBe("test.ping");
        expect(row?.status).toBe(WebhookDeliveryStatus.Pending);
        expect(row?.attemptCount).toBe(0);
        expect(row?.webhookEndpointId).toBe(ep.id);
        expect(row?.projectId).toBe(projectId);

        // Best-effort observation of the fire-and-forget dispatch.
        const dispatched = yield* waitForDispatch(recorder);
        if (dispatched._tag === "Some") {
          expect(dispatched.value.deliveryId).toBe(dto.id);
          expect(dispatched.value.endpointId).toBe(ep.id);
          expect(dispatched.value.secret).toBe(ep.secret);
          expect(dispatched.value.url).toBe(ep.url);
          expect(dispatched.value.eventType).toBe("test.ping");
          expect(dispatched.value.attemptNumber).toBe(1);
        }
      }).pipe(Effect.provide(recorder.layer));
    }).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with WebhookEndpointNotFoundError for an unknown endpoint and writes no delivery",
    Effect.gen(function* () {
      const svc = yield* WebhookManagerService;
      const error = yield* Effect.flip(
        svc.testEndpoint({ endpointId: yield* uniqueSlug("missing"), projectId }),
      );
      expect(error).toBeInstanceOf(WebhookEndpointNotFoundError);
    }).pipe(
      Effect.provide(makeRecorder().layer),
      Effect.provide(WebhookManagerService.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "scopes by projectId: cannot test an endpoint from another project",
    withWebhookCleanup((track) => {
      const recorder = makeRecorder();
      return Effect.gen(function* () {
        const svc = yield* WebhookManagerService;
        const ep = yield* insertEndpoint({ projectId: `${projectId}-other` });
        track.endpointIds.push(ep.id);

        const error = yield* Effect.flip(svc.testEndpoint({ endpointId: ep.id, projectId }));
        expect(error).toBeInstanceOf(WebhookEndpointNotFoundError);
      }).pipe(Effect.provide(recorder.layer));
    }).pipe(Effect.provide(WebhookManagerService.layer), CoreAuthSession.authenticate()),
  );
});
