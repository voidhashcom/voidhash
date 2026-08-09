/**
 * Integration tests for {@link WebhookDeliveryService}, run against the real
 * backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PlanetScale DB).
 *
 * Unlike the catalog services, `WebhookDeliveryService` carries no auth or
 * permission guard — it is the pure data/IO layer the durable workflow drives,
 * operating on `deliveryId`/`endpointId` directly. So there is no
 * forbidden-path test here; instead the focus is:
 *  - `send` against a *real* local HTTP server (success 2xx, error 5xx, body
 *    truncation) and a closed port (network error), plus verifying the
 *    HMAC-SHA256 signature and request headers the receiver actually sees;
 *  - the persisted side effects of `recordAttempt` / `markSucceeded` /
 *    `markFailed` / `markExhausted` read straight back from the
 *    `webhook_delivery_attempt`, `webhook_delivery`, and `webhook_endpoint`
 *    rows in MySQL;
 *  - the pure `nextRetryTime` backoff schedule including exhaustion.
 *
 * Conventions: each test creates its own endpoint/delivery parent rows under
 * the seeded fixture project ({@link CoreTestFixture}), tracks every id it
 * writes, and {@link withWebhookCleanup} deletes them (deepest dependent first)
 * on exit, success or failure. The harness's global sweep does not cover the
 * webhook tables, so per-test cleanup is the only thing that keeps the shared
 * DB tidy. Ids are unique per call so a leftover row from a crashed run can't
 * collide. `send` is exercised over a real `node:http` server bound to an
 * ephemeral port and torn down in an `Effect.ensuring` finalizer.
 */
import { createId } from "@paralleldrive/cuid2";
import { Clock, DateTime, Effect, Schema } from "effect";
import { describe, expect } from "vitest";

import { WebhookDeliveryService } from "@voidhash/core/services/webhookDispatch/WebhookDeliveryService";
import type { DeliverWebhookInput } from "@voidhash/core/workflows/definitions";
import {
  Db,
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
  inArray,
  webhookDeliveries,
  webhookDeliveryAttempts,
  webhookEndpoints,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";
import { stringOr } from "@voidhash/lib/lang";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Serializes a webhook payload the same way the service does. */
const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

/** Monotonic counter so ids stay unique even within the same process run. */
let idSeq = 0;
const uniqueId = (label: string) => `it-wh-${label}-${createId()}-${idSeq++}`;

// ---------------------------------------------------------------------------
// DB read-back helpers (bypass the service)
// ---------------------------------------------------------------------------

const findDeliveryRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.webhookDeliveries.findFirst({ where: { id } });
  });

const findEndpointRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.webhookEndpoints.findFirst({ where: { id } });
  });

/** All attempt rows recorded against a delivery. */
const findAttemptRows = (deliveryId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.webhookDeliveryAttempts.findMany({
      where: { webhookDeliveryId: deliveryId },
    });
  });

// ---------------------------------------------------------------------------
// Parent-row builders. The fixture seeds only user/org/member/project, so a
// delivery test must create its own endpoint + delivery rows.
// ---------------------------------------------------------------------------

interface CreatedEndpoint {
  readonly id: string;
  readonly secret: string;
}

const insertEndpoint = (overrides?: { readonly consecutiveFailures?: number }) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = uniqueId("ep");
    const secret = `whsec_${uniqueId("secret")}`;
    const createdAt = yield* DateTime.nowAsDate;
    yield* db.insert(webhookEndpoints).values({
      consecutiveFailures: overrides?.consecutiveFailures ?? 0,
      createdAt,
      events: ["person.created"],
      id,
      name: "Integration Endpoint",
      projectId,
      secret,
      status: WebhookEndpointStatus.Active,
      url: "https://example.test/hook",
    });
    return { id, secret } satisfies CreatedEndpoint;
  });

const insertDelivery = (endpointId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = uniqueId("del");
    const createdAt = yield* DateTime.nowAsDate;
    yield* db.insert(webhookDeliveries).values({
      createdAt,
      eventOccurredAt: createdAt,
      eventType: "person.created",
      id,
      payload: { hello: "world" },
      projectId,
      status: WebhookDeliveryStatus.Pending,
      webhookEndpointId: endpointId,
    });
    return id;
  });

// ---------------------------------------------------------------------------
// Cleanup. Webhook rows are not covered by the global fixture sweep, so each
// test deletes the endpoints/deliveries/attempts it created. Attempts depend
// on deliveries which depend on endpoints, so delete deepest-first.
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
      yield* db
        .delete(webhookEndpoints)
        .where(inArray(webhookEndpoints.id, endpointIds))
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

// ---------------------------------------------------------------------------
// Local HTTP server harness for `send`. A real Node server bound to an
// ephemeral port — no mocks; `send` performs a genuine `fetch` against it.
//
// `packages/core` is infra-pure and its tsconfig pulls in no `@types/node`, so
// the `node:http` surface used here is described by a minimal local interface
// and the module is loaded via a typed dynamic `import()`. The tests still run
// on the real Node http server at runtime (vite-plus/vitest pool: "threads").
// ---------------------------------------------------------------------------

interface NodeRequest {
  readonly headers: Record<string, string | string[] | undefined>;
  on(event: "data", cb: (chunk: { toString(): string }) => void): void;
  on(event: "end", cb: () => void): void;
}
interface NodeResponse {
  writeHead(status: number, headers: Record<string, string>): void;
  end(body: string): void;
}
interface NodeServer {
  listen(port: number, host: string, cb: () => void): void;
  address(): { readonly port: number } | null;
  close(cb: () => void): void;
}
interface NodeHttp {
  createServer(handler: (req: NodeRequest, res: NodeResponse) => void): NodeServer;
}

// The specifier is held in a variable so TypeScript does not try to resolve the
// `node:http` module (the infra-pure core tsconfig ships no `@types/node`); the
// import is real and resolves at runtime under Node.
const HTTP_MODULE = "node:http";

/** Structural check standing in for the type the untyped module cannot provide. */
const isNodeHttp = (value: unknown): value is NodeHttp =>
  typeof value === "object" &&
  value !== null &&
  "createServer" in value &&
  typeof value.createServer === "function";

const loadHttp = Effect.gen(function* () {
  const loaded: unknown = yield* Effect.promise(() => import(HTTP_MODULE));
  if (!isNodeHttp(loaded)) {
    return yield* Effect.die(new Error(`${HTTP_MODULE} did not expose createServer`));
  }
  return loaded;
});

interface CapturedRequest {
  readonly body: string;
  readonly headers: Record<string, string | string[] | undefined>;
}

interface RunningServer {
  readonly captured: CapturedRequest[];
  readonly close: Effect.Effect<void>;
  readonly url: string;
}

/** Start a server that replies with `respond(req.body)` for every request. */
const startServer = (
  respond: (body: string) => { readonly body: string; readonly status: number },
): Effect.Effect<RunningServer> =>
  Effect.gen(function* () {
    const http = yield* loadHttp;
    return yield* Effect.callback<RunningServer>((resume) => {
      const captured: CapturedRequest[] = [];
      const server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          captured.push({ body, headers: req.headers });
          const { body: responseBody, status } = respond(body);
          res.writeHead(status, { "Content-Type": "text/plain" });
          res.end(responseBody);
        });
      });
      server.listen(0, "127.0.0.1", () => {
        const port = server.address()?.port ?? 0;
        resume(
          Effect.succeed({
            captured,
            close: Effect.callback<void>((done) => {
              server.close(() => done(Effect.void));
            }),
            url: `http://127.0.0.1:${port}/`,
          }),
        );
      });
    });
  });

/** Build a {@link DeliverWebhookInput} pointed at `url` with `secret`. */
const deliverInput = (overrides: {
  readonly attemptNumber?: number;
  readonly deliveryId?: string;
  readonly endpointId?: string;
  readonly secret?: string;
  readonly url: string;
}): DeliverWebhookInput => ({
  attemptNumber: overrides.attemptNumber ?? 1,
  deliveryId: overrides.deliveryId ?? uniqueId("send-del"),
  endpointId: overrides.endpointId ?? uniqueId("send-ep"),
  eventType: "person.created",
  payload: { event: "person.created", id: "person_123" },
  secret: overrides.secret ?? `whsec_${uniqueId("send-secret")}`,
  url: overrides.url,
});

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** Recompute the service's signature independently to assert byte-equality. */
const expectedSignature = (payload: string, timestamp: string, secret: string) =>
  Effect.gen(function* () {
    const key = yield* Effect.promise(() =>
      crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { hash: "SHA-256", name: "HMAC" },
        false,
        ["sign"],
      ),
    );
    const sig = yield* Effect.promise(() =>
      crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)),
    );
    return `v1=${bytesToHex(new Uint8Array(sig))}`;
  });

// ===========================================================================
// send
// ===========================================================================

describe("WebhookDeliveryService.send", () => {
  test(
    "captures statusCode/responseBody/durationMs on a 2xx response; succeeded and no error",
    Effect.gen(function* () {
      const svc = yield* WebhookDeliveryService;
      const server = yield* startServer(() => ({ body: "ok-body", status: 200 }));

      const result = yield* svc
        .send(deliverInput({ url: server.url }))
        .pipe(Effect.ensuring(server.close));

      expect(result.succeeded).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.responseBody).toBe("ok-body");
      expect(result.errorMessage).toBeNull();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }).pipe(Effect.provide(WebhookDeliveryService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "captures statusCode/responseBody but not succeeded on a 5xx response; no error message",
    Effect.gen(function* () {
      const svc = yield* WebhookDeliveryService;
      const server = yield* startServer(() => ({ body: "boom", status: 500 }));

      const result = yield* svc
        .send(deliverInput({ url: server.url }))
        .pipe(Effect.ensuring(server.close));

      expect(result.succeeded).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.responseBody).toBe("boom");
      // A non-2xx HTTP response is not a transport error: errorMessage stays null.
      expect(result.errorMessage).toBeNull();
    }).pipe(Effect.provide(WebhookDeliveryService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "truncates the response body to 2048 chars",
    Effect.gen(function* () {
      const svc = yield* WebhookDeliveryService;
      const huge = "x".repeat(5000);
      const server = yield* startServer(() => ({ body: huge, status: 200 }));

      const result = yield* svc
        .send(deliverInput({ url: server.url }))
        .pipe(Effect.ensuring(server.close));

      expect(result.statusCode).toBe(200);
      expect(result.responseBody?.length).toBe(2048);
      expect(result.responseBody).toBe(huge.slice(0, 2048));
    }).pipe(Effect.provide(WebhookDeliveryService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "captures a transport error message (bounded to 500 chars) with no statusCode on a network failure",
    Effect.gen(function* () {
      const svc = yield* WebhookDeliveryService;

      // Bind then immediately close a server to obtain a port nothing listens
      // on, so the fetch gets a real connection-refused error.
      const server = yield* startServer(() => ({ body: "", status: 200 }));
      const deadUrl = server.url;
      yield* server.close;

      const result = yield* svc.send(deliverInput({ url: deadUrl }));

      expect(result.succeeded).toBe(false);
      expect(result.statusCode).toBeNull();
      expect(result.responseBody).toBeNull();
      expect(result.errorMessage).not.toBeNull();
      // Service slices any Error.message to 500 chars; the bound must hold.
      expect((result.errorMessage ?? "").length).toBeLessThanOrEqual(500);
    }).pipe(Effect.provide(WebhookDeliveryService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "signs the request with HMAC-SHA256 'v1=<hex>' and sets the webhook headers the receiver sees",
    Effect.gen(function* () {
      const svc = yield* WebhookDeliveryService;
      const server = yield* startServer(() => ({ body: "ok", status: 200 }));
      const secret = `whsec_${uniqueId("sig-secret")}`;
      const input = deliverInput({ secret, url: server.url });

      const result = yield* svc.send(input).pipe(Effect.ensuring(server.close));
      expect(result.succeeded).toBe(true);

      expect(server.captured.length).toBe(1);
      const req = server.captured[0]!;
      expect(req.headers["content-type"]).toBe("application/json");
      expect(req.headers["x-webhook-event"]).toBe("person.created");

      const signature = req.headers["x-webhook-signature"];
      const timestamp = req.headers["x-webhook-timestamp"];
      expect(typeof signature).toBe("string");
      const signatureText = stringOr(signature, "");
      expect(signatureText.startsWith("v1=")).toBe(true);
      expect(/^v1=[0-9a-f]{64}$/.test(signatureText)).toBe(true);
      expect(typeof timestamp).toBe("string");
      const timestampText = stringOr(timestamp, "");

      // The body the server received is exactly the JSON-serialized payload, and
      // the signature is HMAC over `${timestamp}.${body}` with the secret.
      expect(req.body).toBe(encodeJson(input.payload));
      const expected = yield* expectedSignature(req.body, timestampText, secret);
      expect(signatureText).toBe(expected);
    }).pipe(Effect.provide(WebhookDeliveryService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// recordAttempt
// ===========================================================================

describe("WebhookDeliveryService.recordAttempt", () => {
  test(
    "persists a delivery-attempt row carrying every result field",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookDeliveryService;
        const endpoint = yield* insertEndpoint();
        track.endpointIds.push(endpoint.id);
        const deliveryId = yield* insertDelivery(endpoint.id);
        track.deliveryIds.push(deliveryId);

        const input = deliverInput({
          attemptNumber: 2,
          deliveryId,
          endpointId: endpoint.id,
          secret: endpoint.secret,
          url: "https://example.test/hook",
        });

        yield* svc.recordAttempt(input, {
          durationMs: 123,
          errorMessage: "boom",
          responseBody: "server-said-no",
          statusCode: 502,
          succeeded: false,
        });

        const rows = yield* findAttemptRows(deliveryId);
        const attempt = rows.find((row) => row.attemptNumber === 2);
        expect(attempt).toBeDefined();
        expect(attempt?.webhookDeliveryId).toBe(deliveryId);
        expect(attempt?.statusCode).toBe(502);
        expect(attempt?.errorMessage).toBe("boom");
        expect(attempt?.responseBody).toBe("server-said-no");
        expect(attempt?.durationMs).toBe(123);
        expect(attempt?.succeeded).toBe(false);
      }),
    ).pipe(Effect.provide(WebhookDeliveryService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// markSucceeded
// ===========================================================================

describe("WebhookDeliveryService.markSucceeded", () => {
  test(
    "marks the delivery Succeeded with completedAt, clears nextAttemptAt, and resets the endpoint failure counter",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookDeliveryService;
        // Endpoint starts with prior failures and no lastSuccessAt.
        const endpoint = yield* insertEndpoint({ consecutiveFailures: 3 });
        track.endpointIds.push(endpoint.id);
        const deliveryId = yield* insertDelivery(endpoint.id);
        track.deliveryIds.push(deliveryId);

        yield* svc.markSucceeded(
          deliverInput({
            attemptNumber: 2,
            deliveryId,
            endpointId: endpoint.id,
            secret: endpoint.secret,
            url: "https://example.test/hook",
          }),
        );

        const delivery = yield* findDeliveryRow(deliveryId);
        expect(delivery?.status).toBe(WebhookDeliveryStatus.Succeeded);
        expect(delivery?.attemptCount).toBe(2);
        expect(delivery?.completedAt).not.toBeNull();
        expect(delivery?.nextAttemptAt).toBeNull();

        const ep = yield* findEndpointRow(endpoint.id);
        expect(ep?.consecutiveFailures).toBe(0);
        expect(ep?.lastSuccessAt).not.toBeNull();
      }),
    ).pipe(Effect.provide(WebhookDeliveryService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// markFailed
// ===========================================================================

describe("WebhookDeliveryService.markFailed", () => {
  test(
    "marks the delivery Failed, schedules nextAttemptAt, and increments the endpoint failure counter",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookDeliveryService;
        const endpoint = yield* insertEndpoint({ consecutiveFailures: 0 });
        track.endpointIds.push(endpoint.id);
        const deliveryId = yield* insertDelivery(endpoint.id);
        track.deliveryIds.push(deliveryId);

        // Whole-second instant: MySQL TIMESTAMP has no sub-second precision and
        // ROUNDS (not floors) a fractional second, so a sub-second `nextRetry`
        // could store one second ahead of the floored comparison below.
        const nowMillis = yield* Clock.currentTimeMillis;
        const nextRetry = DateTime.toDateUtc(
          DateTime.makeUnsafe(Math.floor((nowMillis + 60_000) / 1000) * 1000),
        );
        yield* svc.markFailed(
          deliverInput({
            attemptNumber: 1,
            deliveryId,
            endpointId: endpoint.id,
            secret: endpoint.secret,
            url: "https://example.test/hook",
          }),
          nextRetry,
        );

        const delivery = yield* findDeliveryRow(deliveryId);
        expect(delivery?.status).toBe(WebhookDeliveryStatus.Failed);
        expect(delivery?.attemptCount).toBe(1);
        expect(delivery?.nextAttemptAt).not.toBeNull();
        // MySQL timestamps drop sub-second precision; compare at second granularity.
        expect(Math.floor((delivery?.nextAttemptAt?.getTime() ?? 0) / 1000)).toBe(
          Math.floor(nextRetry.getTime() / 1000),
        );

        const ep = yield* findEndpointRow(endpoint.id);
        expect(ep?.consecutiveFailures).toBe(1);
      }),
    ).pipe(Effect.provide(WebhookDeliveryService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// markExhausted
// ===========================================================================

describe("WebhookDeliveryService.markExhausted", () => {
  test(
    "marks the delivery Exhausted with completedAt, clears nextAttemptAt, and leaves the failure counter at attemptCount",
    withWebhookCleanup((track) =>
      Effect.gen(function* () {
        const svc = yield* WebhookDeliveryService;
        const endpoint = yield* insertEndpoint({ consecutiveFailures: 4 });
        track.endpointIds.push(endpoint.id);
        const deliveryId = yield* insertDelivery(endpoint.id);
        track.deliveryIds.push(deliveryId);

        yield* svc.markExhausted(
          deliverInput({
            attemptNumber: 5,
            deliveryId,
            endpointId: endpoint.id,
            secret: endpoint.secret,
            url: "https://example.test/hook",
          }),
        );

        const delivery = yield* findDeliveryRow(deliveryId);
        expect(delivery?.status).toBe(WebhookDeliveryStatus.Exhausted);
        expect(delivery?.attemptCount).toBe(5);
        expect(delivery?.completedAt).not.toBeNull();
        expect(delivery?.nextAttemptAt).toBeNull();

        const ep = yield* findEndpointRow(endpoint.id);
        expect(ep?.consecutiveFailures).toBe(5);
      }),
    ).pipe(Effect.provide(WebhookDeliveryService.layer), CoreAuthSession.authenticate()),
  );
});

// ===========================================================================
// nextRetryTime (pure backoff schedule)
// ===========================================================================

describe("WebhookDeliveryService.nextRetryTime", () => {
  test(
    "follows the 60s/300s/1800s/7200s/86400s schedule then returns null once exhausted",
    Effect.gen(function* () {
      const svc = yield* WebhookDeliveryService;

      // Allow a small wall-clock tolerance: the service reads the clock inside.
      const expectDelay = (attemptNumber: number, seconds: number) =>
        Effect.gen(function* () {
          const before = yield* Clock.currentTimeMillis;
          const result = yield* svc.nextRetryTime(attemptNumber);
          const after = yield* Clock.currentTimeMillis;
          expect(result).not.toBeNull();
          const delta = (result?.getTime() ?? 0) - before;
          expect(delta).toBeGreaterThanOrEqual(seconds * 1000 - 1);
          expect(delta).toBeLessThanOrEqual(seconds * 1000 + (after - before) + 5000);
        });

      yield* expectDelay(1, 60);
      yield* expectDelay(2, 300);
      yield* expectDelay(3, 1800);
      yield* expectDelay(4, 7200);
      yield* expectDelay(5, 86400);

      // Beyond the schedule, no further retry is offered.
      expect(yield* svc.nextRetryTime(6)).toBeNull();
      expect(yield* svc.nextRetryTime(7)).toBeNull();
      expect(yield* svc.nextRetryTime(100)).toBeNull();
    }).pipe(Effect.provide(WebhookDeliveryService.layer), CoreAuthSession.authenticate()),
  );
});
