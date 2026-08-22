import { EventCaptureApi } from "@voidhash/api-contracts/event-capture";
import {
  type CaptureRequest,
  type EventCaptureServiceShape,
  EventCaptureService,
  resolveCaptureCredential,
} from "@voidhash/core/services/analyticsIngest/EventCaptureService";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { describe, expect, it } from "vite-plus/test";

import { EventCaptureGroupLive } from "./event-capture.ts";

const SECRET = "vh_sk_AbCdEfGhIjKlMnOpQrStUvWxYzAbCd";
const PUBLISHABLE = "vh_pk_AbCdEfGhIjKlMnOpQrStUvWxYzAbCd";

const CaptureEventFields = {
  uuid: Schema.String,
  event: Schema.String,
  distinct_id: Schema.String,
  properties: Schema.Struct({}),
  context: Schema.Struct({}),
};

const encodeCaptureBody = Schema.encodeSync(
  Schema.fromJsonString(
    Schema.Struct({
      ...CaptureEventFields,
      sent_at: Schema.String,
      token: Schema.optional(Schema.String),
    }),
  ),
);

const encodeBatchBody = Schema.encodeSync(
  Schema.fromJsonString(
    Schema.Struct({
      events: Schema.Array(Schema.Struct(CaptureEventFields)),
      sent_at: Schema.String,
      token: Schema.optional(Schema.String),
    }),
  ),
);

const captureEvent = {
  uuid: "018f6d2e-4c3a-7b1d-9e5f-2a8c1b0d4e6f",
  event: "paywall_viewed",
  distinct_id: "user_123",
  properties: {},
  context: {},
};

/**
 * Stand-in capture service that records what the route resolved and then runs
 * the real credential validation, so an unauthorized request fails exactly the
 * way the database-backed service would.
 */
const captureStub = (recorded: Array<CaptureRequest>) =>
  Layer.succeed(EventCaptureService)({
    captureEvents: (input) =>
      Effect.gen(function* () {
        recorded.push(input);
        yield* resolveCaptureCredential(input.request.token);
        return { accepted: input.events.length, rejected: 0 };
      }),
  } satisfies EventCaptureServiceShape);

/**
 * POST a JSON body at one of the capture routes, returning the web response
 * alongside the capture requests the route handed to the service.
 */
const post = (path: string, body: string, headers: Record<string, string>) =>
  Effect.gen(function* () {
    const recorded: Array<CaptureRequest> = [];
    const handler = yield* HttpRouter.toHttpEffect(
      HttpApiBuilder.layer(EventCaptureApi).pipe(
        Layer.provide(EventCaptureGroupLive),
        Layer.provide(captureStub(recorded)),
        // `generateId` is platform-gated, so the handlers carry a per-request
        // `PlatformRuntime` requirement that only `provideRequest` satisfies.
        HttpRouter.provideRequest(Layer.succeed(PlatformRuntime)(PlatformRuntime.of({}))),
        Layer.provide(HttpServer.layerServices),
      ),
    );
    const response = yield* handler.pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(
          new Request(`http://localhost${path}`, {
            body,
            headers: { "content-type": "application/json", ...headers },
            method: "POST",
          }),
        ),
      ),
    );
    return {
      recorded,
      response: HttpServerResponse.toWeb(response),
      token: recorded[0]?.request.token,
    };
  }).pipe(Effect.scoped);

const singleBody = (token?: string) =>
  encodeCaptureBody({ ...captureEvent, sent_at: "2026-08-22T12:00:01.000Z", token });

const capture = (token: string | undefined, headers: Record<string, string>) =>
  post("/i/v1/capture", singleBody(token), headers);

describe("POST /i/v1/capture credential resolution", () => {
  it("prefers the body token over the x-secret-key header", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { response, token } = yield* capture(PUBLISHABLE, { "x-secret-key": SECRET });

        expect(response.status).toBe(202);
        expect(token).toBe(PUBLISHABLE);
      }),
    ));

  it("uses the x-secret-key header when the body carries no token", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { response, token } = yield* capture(undefined, { "x-secret-key": SECRET });

        expect(response.status).toBe(202);
        expect(token).toBe(SECRET);
      }),
    ));

  it("falls back to the x-publishable-key header last", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { token } = yield* capture(undefined, {
          "x-publishable-key": PUBLISHABLE,
          "x-secret-key": SECRET,
        });
        expect(token).toBe(SECRET);

        const fallback = yield* capture(undefined, { "x-publishable-key": PUBLISHABLE });
        expect(fallback.response.status).toBe(202);
        expect(fallback.token).toBe(PUBLISHABLE);
      }),
    ));

  it("answers 401 unauthorized — not a schema 400 — when no credential is supplied", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { recorded, response } = yield* capture(undefined, {});

        // The request must reach the handler: `token` is optional in the body
        // schema, so a missing credential is an authorization failure.
        expect(recorded).toHaveLength(1);
        expect(response.status).toBe(401);
        expect(yield* Effect.promise(() => response.json())).toMatchObject({
          code: "unauthorized",
          error: "missing token",
        });
      }),
    ));

  it("answers 401 unauthorized — not a schema 400 — for a present-but-empty x-secret-key header", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        // What `headers: { "x-secret-key": process.env.KEY ?? "" }` emits when
        // the env var is unset. The header schema must not reject it before the
        // handler runs, or the caller gets an empty-body 400 instead of the
        // uniform unauthorized envelope.
        const { recorded, response } = yield* capture(undefined, { "x-secret-key": "" });

        expect(recorded).toHaveLength(1);
        expect(response.status).toBe(401);
        expect(yield* Effect.promise(() => response.json())).toMatchObject({
          code: "unauthorized",
          error: "missing token",
        });
      }),
    ));

  it("rejects a secret key in the body token field with 401 before reaching the service", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { recorded, response } = yield* capture(SECRET, {});

        expect(recorded).toHaveLength(0);
        expect(response.status).toBe(401);
        expect(yield* Effect.promise(() => response.json())).toMatchObject({
          code: "unauthorized",
          error: expect.stringContaining("x-secret-key"),
        });
      }),
    ));

  it("rejects a body secret key even when a valid header credential is also present", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { recorded, response } = yield* capture(SECRET, { "x-secret-key": SECRET });

        expect(recorded).toHaveLength(0);
        expect(response.status).toBe(401);
      }),
    ));

  it("trims the presented header credential", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { token } = yield* capture(undefined, { "x-secret-key": `  ${SECRET}  ` });

        expect(token).toBe(SECRET);
      }),
    ));
});

describe("POST /i/v1/batch credential resolution", () => {
  const batchBody = (token?: string) =>
    encodeBatchBody({
      events: [captureEvent],
      sent_at: "2026-08-22T12:00:05.000Z",
      token,
    });

  it("accepts a secret key from the x-secret-key header", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { recorded, response } = yield* post("/i/v1/batch", batchBody(), {
          "x-secret-key": SECRET,
        });

        expect(response.status).toBe(202);
        expect(recorded[0]?.request.token).toBe(SECRET);
        expect(recorded[0]?.request.path).toBe("/i/v1/batch");
      }),
    ));

  it("answers 401 unauthorized when no credential is supplied", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { response } = yield* post("/i/v1/batch", batchBody(), {});

        expect(response.status).toBe(401);
      }),
    ));

  it("rejects a secret key in the body token field with 401", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { recorded, response } = yield* post("/i/v1/batch", batchBody(SECRET), {});

        expect(recorded).toHaveLength(0);
        expect(response.status).toBe(401);
        expect(yield* Effect.promise(() => response.json())).toMatchObject({
          code: "unauthorized",
        });
      }),
    ));
});
