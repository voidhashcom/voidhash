import { Cause, Effect, Exit, Option, Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createVoidhashSdk as createVoidhashEffectSdk } from "../src/effect";
import { VoidhashNodeConfigurationError, createVoidhashSdk } from "../src/index";
import { createJsonResponse, installFetchMock, type FetchCall } from "./helpers";

const BASE_URL = "https://api.voidhash.test";
const INGEST_URL = "https://ingest.voidhash.test";

const pathOf = (call: FetchCall) => new URL(call.url).pathname;

const decodeBody = Schema.decodeSync(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
);

const bodyOf = (call: FetchCall) => decodeBody(call.body ?? "{}");

const accepted = () => createJsonResponse({ accepted: 1, rejected: 0 }, 202);

const failureOf = <Result, Error>(effect: Effect.Effect<Result, Error>) =>
  Effect.gen(function* () {
    const exit = yield* Effect.exit(effect);

    if (Exit.isSuccess(exit)) {
      return yield* Effect.die(new Error("Expected effect failure."));
    }

    return Option.getOrElse(Cause.findErrorOption(exit.cause), () => Cause.squash(exit.cause));
  });

describe("@voidhash/node analytics", () => {
  // oxlint-disable-next-line effect/noTestLifecycleHooks -- vitest global-stub cleanup: vi.unstubAllGlobals resets vitest's own module state, which has no Effect-scoped equivalent.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the ingest contract with the publishable key in the body", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(accepted);

        const client = createVoidhashSdk({
          baseUrl: BASE_URL,
          ingestUrl: INGEST_URL,
          publishableKey: "vh_pk_test",
          secretKey: "vh_sk_test",
        });

        const result = yield* Effect.promise(() =>
          client.analytics.capture({ distinctId: "user_123", event: "note_created" }),
        );

        expect(result).toEqual({ accepted: 1, rejected: 0 });
        expect(calls).toHaveLength(1);

        const call = calls[0]!;
        expect(pathOf(call)).toBe("/i/v1/capture");
        expect(new URL(call.url).origin).toBe(INGEST_URL);
        // Ingest authenticates on the body token; the secret key must not leak
        // onto this origin.
        expect(call.headers["x-secret-key"]).toBeUndefined();

        const body = bodyOf(call);
        expect(body.event).toBe("note_created");
        expect(body.distinct_id).toBe("user_123");
        expect(body.token).toBe("vh_pk_test");
        expect(body.uuid).toEqual(expect.any(String));
        expect(body.sent_at).toEqual(expect.any(String));
        // Both are required objects on the wire; `null` or `[]` is rejected.
        expect(body.context).toEqual({});
        expect(body.properties).toEqual({});
      }),
    ));

  it("sends properties and an explicit timestamp when given", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(accepted);

        const client = createVoidhashSdk({
          ingestUrl: INGEST_URL,
          publishableKey: "vh_pk_test",
          secretKey: "vh_sk_test",
        });

        yield* Effect.promise(() =>
          client.analytics.capture({
            distinctId: "user_123",
            event: "export_requested",
            properties: { note_count: 3 },
            // oxlint-disable-next-line effect/noGlobals -- a fixed test vector, not a clock read: it pins the instant the SDK is expected to serialize onto the wire.
            timestamp: new Date("2026-08-22T10:00:00.000Z"),
          }),
        );

        const body = bodyOf(calls[0]!);
        expect(body.properties).toEqual({ note_count: 3 });
        expect(body.timestamp).toBe("2026-08-22T10:00:00.000Z");
      }),
    ));

  it("fails with a configuration error when no publishable key is set", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(accepted);

        const client = createVoidhashEffectSdk({ secretKey: "vh_sk_test" });

        const error = yield* failureOf(
          client.analytics.capture({ distinctId: "user_123", event: "note_created" }),
        );

        expect(error).toBeInstanceOf(VoidhashNodeConfigurationError);
        expect(calls).toHaveLength(0);
      }),
    ));

  it("writes person traits through the secret-key persons surface", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() =>
          createJsonResponse({
            personId: "person_123",
            distinctId: "user_123",
            email: null,
            name: null,
          }),
        );

        const client = createVoidhashSdk({ baseUrl: BASE_URL, secretKey: "vh_sk_test" });

        const person = yield* Effect.promise(() =>
          client.persons.setPersonAttributes({
            payload: { distinctId: "user_123", traits: { notes_created: 3, plan: "pro" } },
          }),
        );

        expect(person.personId).toBe("person_123");

        const call = calls[0]!;
        expect(pathOf(call)).toBe("/api/v1/persons/attributes");
        expect(call.headers["x-secret-key"]).toBe("vh_sk_test");
        expect(bodyOf(call)).toEqual({
          distinctId: "user_123",
          traits: { notes_created: 3, plan: "pro" },
        });
      }),
    ));
});
