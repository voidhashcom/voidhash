import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  VoidhashNodeConfigurationError,
  createVoidhashSdk,
  type VoidhashNodeClient,
} from "../src/index";
import {
  createVoidhashSdk as createVoidhashEffectSdk,
  type VoidhashNodeEffectClient,
} from "../src/effect";
import { createJsonResponse, decodeJson, installFetchMock } from "./helpers";

const EXPECTED_GROUPS = [
  "analytics",
  "apiKeys",
  "auth",
  "development",
  "events",
  "experiments",
  "featureFlagOverrides",
  "featureFlagTargets",
  "featureFlags",
  "ingestPolicy",
  "notificationSends",
  "notifications",
  "organizations",
  "paymentProviderConfigurations",
  "paymentProviderProducts",
  "paywallDeploys",
  "paywallLocations",
  "paywalls",
  "perks",
  "persons",
  "products",
  "projects",
  "pushNotificationConfigurations",
  "schema",
  "users",
  "webhooks",
];

// Hand-written conveniences layered on top of the generated groups.
const EXPECTED_CONVENIENCE_NAMESPACES = ["entitlements", "eventCapture"];

const EXPECTED_NAMESPACES = [...EXPECTED_GROUPS, ...EXPECTED_CONVENIENCE_NAMESPACES];

type HasKey<TValue, TKey extends PropertyKey> = TKey extends keyof TValue ? true : false;

const tagOf = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null || !("_tag" in value)) {
    return undefined;
  }

  if (typeof value._tag !== "string") {
    return undefined;
  }

  return value._tag;
};

/** Decodes a captured JSON request body into a plain record for key-level assertions. */
const decodeBody = (body: string | undefined): Record<string, unknown> => {
  const decoded = decodeJson(body ?? "{}");

  if (typeof decoded !== "object" || decoded === null) {
    return {};
  }

  return Object.fromEntries(Object.entries(decoded));
};

const extractEffectFailure = <Result, Error>(effect: Effect.Effect<Result, Error>) =>
  Effect.gen(function* () {
    const exit = yield* Effect.exit(effect);

    if (Exit.isSuccess(exit)) {
      return yield* Effect.die(new Error("Expected effect failure."));
    }

    return Option.getOrElse(Cause.findErrorOption(exit.cause), () => Cause.squash(exit.cause));
  });

describe("@voidhash/node", () => {
  // oxlint-disable-next-line effect/noTestLifecycleHooks -- vitest global-stub cleanup: vi.unstubAllGlobals resets vitest's own module state, which has no Effect-scoped equivalent.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes the exact non-sdk namespaces and omits sdk in types", () => {
    const effectClient = createVoidhashEffectSdk({
      secretKey: "vh_sk_test",
    });
    const promiseClient = createVoidhashSdk({
      secretKey: "vh_sk_test",
    });

    expect(EXPECTED_GROUPS).toHaveLength(26);
    expect(Object.keys(effectClient).sort()).toEqual([...EXPECTED_NAMESPACES].sort());
    expect(Object.keys(promiseClient).sort()).toEqual([...EXPECTED_NAMESPACES].sort());
    expect("sdk" in effectClient).toBe(false);
    expect("sdk" in promiseClient).toBe(false);

    expectTypeOf<HasKey<VoidhashNodeEffectClient, "sdk">>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<VoidhashNodeClient, "sdk">>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<VoidhashNodeEffectClient, "entitlements">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<VoidhashNodeClient, "entitlements">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<VoidhashNodeEffectClient, "eventCapture">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<VoidhashNodeClient, "eventCapture">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<VoidhashNodeEffectClient, "changesets">>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<VoidhashNodeEffectClient, "auth">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<VoidhashNodeEffectClient, "schema">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<VoidhashNodeEffectClient, "webhooks">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<VoidhashNodeClient, "auth">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<VoidhashNodeClient, "schema">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<VoidhashNodeClient, "webhooks">>().toEqualTypeOf<true>();
  });

  it("fails immediately for invalid configuration", () => {
    expect(() =>
      createVoidhashEffectSdk({
        secretKey: "   ",
      }),
    ).toThrow(VoidhashNodeConfigurationError);

    expect(() =>
      createVoidhashEffectSdk({
        baseUrl: "not a url",
        secretKey: "vh_sk_test",
      }),
    ).toThrow(VoidhashNodeConfigurationError);

    expect(() =>
      createVoidhashEffectSdk({
        ingestUrl: "not a url",
        secretKey: "vh_sk_test",
      }),
    ).toThrow(VoidhashNodeConfigurationError);

    expect(() =>
      createVoidhashEffectSdk({
        headers: {
          "x-secret-key": "attempted_override",
        },
        secretKey: "vh_sk_test",
      }),
    ).toThrow(VoidhashNodeConfigurationError);

    vi.stubGlobal("fetch", undefined);

    expect(() =>
      createVoidhashSdk({
        secretKey: "vh_sk_test",
      }),
    ).toThrow(VoidhashNodeConfigurationError);
  });

  it("uses the default baseUrl and sends x-secret-key on auth.session()", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() =>
          createJsonResponse({
            method: "secret-key",
            name: "voidhash",
            organizations: [],
            projects: [],
          }),
        );

        const client = createVoidhashEffectSdk({
          headers: {
            "x-trace-id": "trace_123",
          },
          secretKey: "vh_sk_test",
        });

        const session = yield* client.auth.session();

        expect(session).toEqual({
          method: "secret-key",
          name: "voidhash",
          organizations: [],
          projects: [],
        });
        expect(calls[0]?.method).toBe("GET");
        expect(calls[0]?.url).toBe("https://api.voidhash.com/api/v1/auth/session");
        expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");
        expect(calls[0]?.headers["x-trace-id"]).toBe("trace_123");
      }),
    ));

  it("supports path params and the list envelope with organizations.listOrganizationProjects({ params })", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() =>
          createJsonResponse({
            data: [
              {
                id: "proj_1",
                name: "Alpha",
                slug: "alpha",
              },
            ],
            pageInfo: {
              endCursor: null,
              hasNextPage: false,
            },
          }),
        );

        const client = createVoidhashSdk({
          baseUrl: "https://api.voidhash.test",
          secretKey: "vh_sk_test",
        });

        const projects = yield* Effect.promise(() =>
          client.organizations.listOrganizationProjects({
            params: {
              organizationId: "org_123",
              cursor: undefined,
              limit: undefined,
            },
          }),
        );

        expect(projects.data).toEqual([
          {
            id: "proj_1",
            name: "Alpha",
            slug: "alpha",
          },
        ]);
        expect(projects.pageInfo).toEqual({
          endCursor: null,
          hasNextPage: false,
        });
        expect(calls[0]?.method).toBe("GET");
        expect(calls[0]?.url).toBe(
          "https://api.voidhash.test/api/v1/organizations/org_123/projects",
        );
        expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");
      }),
    ));

  it("supports persons.getPersonEntitlements({ params })", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() =>
          createJsonResponse({
            grants: [
              {
                expiresAt: null,
                perkId: "perk_1",
                source: "purchase",
                sourceId: "purchase_1",
                sourcePersonId: "person_123",
                status: "active",
              },
            ],
          }),
        );

        const client = createVoidhashSdk({
          baseUrl: "https://api.voidhash.test",
          secretKey: "vh_sk_test",
        });

        const entitlements = yield* Effect.promise(() =>
          client.persons.getPersonEntitlements({
            params: {
              personId: "person_123",
            },
          }),
        );

        expect(entitlements.grants).toHaveLength(1);
        expect(entitlements.grants[0]?.perkId).toBe("perk_1");
        expect(calls[0]?.method).toBe("GET");
        expect(calls[0]?.url).toBe(
          "https://api.voidhash.test/api/v1/persons/person_123/entitlements",
        );
        expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");
      }),
    ));

  it("supports POST bodies with persons.createPerson({ payload })", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() =>
          createJsonResponse({
            personId: "person_123",
            distinctId: "user_123",
            email: "user@example.com",
            name: "Taylor",
          }),
        );

        const client = createVoidhashSdk({
          baseUrl: "https://api.voidhash.test",
          secretKey: "vh_sk_test",
        });

        const person = yield* Effect.promise(() =>
          client.persons.createPerson({
            payload: {
              distinctId: "user_123",
              email: "user@example.com",
              name: "Taylor",
            },
          }),
        );

        expect(person).toEqual({
          personId: "person_123",
          distinctId: "user_123",
          email: "user@example.com",
          name: "Taylor",
        });
        expect(calls[0]?.method).toBe("POST");
        expect(calls[0]?.url).toBe("https://api.voidhash.test/api/v1/persons");
        expect(decodeJson(calls[0]?.body ?? "{}")).toEqual({
          distinctId: "user_123",
          email: "user@example.com",
          name: "Taylor",
        });
        expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");
      }),
    ));

  it("supports PATCH bodies with persons.updatePerson({ params, payload })", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() =>
          createJsonResponse({
            personId: "person_123",
            distinctId: "user_123",
            email: "updated@example.com",
            name: "Updated Taylor",
          }),
        );

        const client = createVoidhashSdk({
          baseUrl: "https://api.voidhash.test",
          secretKey: "vh_sk_test",
        });

        const person = yield* Effect.promise(() =>
          client.persons.updatePerson({
            params: {
              personId: "person_123",
            },
            payload: {
              email: "updated@example.com",
              name: "Updated Taylor",
            },
          }),
        );

        expect(person.personId).toBe("person_123");
        expect(person.name).toBe("Updated Taylor");
        expect(calls[0]?.method).toBe("PATCH");
        expect(calls[0]?.url).toBe("https://api.voidhash.test/api/v1/persons/person_123");
        expect(decodeJson(calls[0]?.body ?? "{}")).toEqual({
          email: "updated@example.com",
          name: "Updated Taylor",
        });
        expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");
      }),
    ));

  it("supports DELETE requests with apiKeys.deleteApiKey({ params })", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() => new Response(null, { status: 204 }));

        const client = createVoidhashSdk({
          baseUrl: "https://api.voidhash.test",
          secretKey: "vh_sk_test",
        });

        const result = yield* Effect.promise(() =>
          client.apiKeys.deleteApiKey({
            params: {
              apiKeyId: "ak_123",
            },
          }),
        );

        expect(result).toBeUndefined();
        expect(calls[0]?.method).toBe("DELETE");
        expect(calls[0]?.url).toBe("https://api.voidhash.test/api/v1/api-keys/ak_123");
        expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");
      }),
    ));

  it("captures events against the default ingest base URL with only the secret key", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() =>
          createJsonResponse({
            accepted: 1,
            rejected: 0,
          }),
        );

        const client = createVoidhashEffectSdk({
          baseUrl: "https://api.voidhash.test",
          secretKey: "vh_sk_test",
        });

        const accepted = yield* client.eventCapture.capture({
          distinctId: "user_123",
          event: "paywall_viewed",
        });

        expect(accepted).toEqual({
          accepted: 1,
          rejected: 0,
        });
        expect(calls[0]?.method).toBe("POST");
        expect(calls[0]?.url).toBe("https://ingest.voidhash.com/i/v1/capture");
        expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");

        const body = decodeBody(calls[0]?.body);

        // Backend SDKs authorize with the header, so the body carries no token.
        expect(Object.keys(body).sort()).toEqual([
          "context",
          "distinct_id",
          "event",
          "properties",
          "sent_at",
          "uuid",
        ]);
        expect(body).toMatchObject({
          context: {},
          distinct_id: "user_123",
          event: "paywall_viewed",
          properties: {},
        });
        expect(body["uuid"]).toEqual(expect.any(String));
        expect(body["uuid"]).not.toBe("");
        expect(body["sent_at"]).toEqual(expect.any(String));
      }),
    ));

  it("preserves a caller-supplied uuid and the optional per-event fields", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() =>
          createJsonResponse({
            accepted: 1,
            rejected: 0,
          }),
        );

        const client = createVoidhashEffectSdk({
          ingestUrl: "https://ingest.voidhash.test",
          secretKey: "vh_sk_test",
        });

        yield* client.eventCapture.capture({
          context: { app_version: "1.2.3" },
          distinctId: "user_123",
          event: "paywall_viewed",
          properties: { paywall_id: "pw_1" },
          sessionId: "session_1",
          timestamp: "2026-08-22T12:00:00.000Z",
          uuid: "018f6d2e-4c3a-7b1d-9e5f-2a8c1b0d4e6f",
        });

        expect(calls[0]?.url).toBe("https://ingest.voidhash.test/i/v1/capture");
        expect(decodeBody(calls[0]?.body)).toMatchObject({
          context: { app_version: "1.2.3" },
          distinct_id: "user_123",
          event: "paywall_viewed",
          properties: { paywall_id: "pw_1" },
          session_id: "session_1",
          timestamp: "2026-08-22T12:00:00.000Z",
          uuid: "018f6d2e-4c3a-7b1d-9e5f-2a8c1b0d4e6f",
        });
      }),
    ));

  it("sends a configured publishable key as the body token", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() =>
          createJsonResponse({
            accepted: 1,
            rejected: 0,
          }),
        );

        const client = createVoidhashEffectSdk({
          publishableKey: "vh_pk_test",
          secretKey: "vh_sk_test",
        });

        yield* client.eventCapture.capture({
          distinctId: "user_123",
          event: "paywall_viewed",
        });

        // Browser parity: the header still authorizes, the token is additive.
        expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");
        expect(decodeBody(calls[0]?.body)["token"]).toBe("vh_pk_test");
      }),
    ));

  it("posts eventCapture.batch to /i/v1/batch with one request-level sent_at", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() =>
          createJsonResponse({
            accepted: 2,
            rejected: 0,
          }),
        );

        const client = createVoidhashSdk({
          ingestUrl: "https://ingest.voidhash.test",
          secretKey: "vh_sk_test",
        });

        const accepted = yield* Effect.promise(() =>
          client.eventCapture.batch([
            { distinctId: "user_123", event: "paywall_viewed" },
            { distinctId: "user_123", event: "purchase_started" },
          ]),
        );

        expect(accepted).toEqual({
          accepted: 2,
          rejected: 0,
        });
        expect(calls[0]?.method).toBe("POST");
        expect(calls[0]?.url).toBe("https://ingest.voidhash.test/i/v1/batch");
        expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");

        const body = decodeBody(calls[0]?.body);

        expect(Object.keys(body).sort()).toEqual(["events", "sent_at"]);
        expect(body["sent_at"]).toEqual(expect.any(String));
        expect(body["events"]).toEqual([
          {
            context: {},
            distinct_id: "user_123",
            event: "paywall_viewed",
            properties: {},
            uuid: expect.any(String),
          },
          {
            context: {},
            distinct_id: "user_123",
            event: "purchase_started",
            properties: {},
            uuid: expect.any(String),
          },
        ]);
      }),
    ));

  it("treats an empty eventCapture.batch as a no-op", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() => new Response(null, { status: 500 }));

        const client = createVoidhashEffectSdk({
          secretKey: "vh_sk_test",
        });

        const accepted = yield* client.eventCapture.batch([]);

        expect(accepted).toEqual({
          accepted: 0,
          rejected: 0,
        });
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

        const client = createVoidhashSdk({
          baseUrl: "https://api.voidhash.test",
          secretKey: "vh_sk_test",
        });

        const person = yield* Effect.promise(() =>
          client.persons.updatePerson({
            params: { personId: "person_123" },
            payload: { traits: { notes_created: 3, plan: "pro" } },
          }),
        );

        expect(person.personId).toBe("person_123");
        expect(calls[0]?.url).toBe("https://api.voidhash.test/api/v1/persons/person_123");
        expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");
        expect(decodeBody(calls[0]?.body)).toEqual({
          traits: { notes_created: 3, plan: "pro" },
        });
      }),
    ));

  it("surfaces matching success values through effect and promise factories", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        installFetchMock(() =>
          createJsonResponse({
            method: "secret-key",
            name: "voidhash",
            organizations: [],
            projects: [],
          }),
        );

        const effectClient = createVoidhashEffectSdk({
          baseUrl: "https://api.voidhash.test",
          secretKey: "vh_sk_test",
        });
        const promiseClient = createVoidhashSdk({
          baseUrl: "https://api.voidhash.test",
          secretKey: "vh_sk_test",
        });

        const effectResult = yield* effectClient.auth.session();
        const promiseResult = yield* Effect.promise(() => promiseClient.auth.session());

        expect(promiseResult).toEqual(effectResult);
      }),
    ));

  it("surfaces matching failure objects through effect and promise factories", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        installFetchMock(() =>
          createJsonResponse(
            {
              _tag: "ActionForbiddenError",
              message: "Forbidden",
            },
            403,
          ),
        );

        const effectClient = createVoidhashEffectSdk({
          baseUrl: "https://api.voidhash.test",
          secretKey: "vh_sk_test",
        });
        const promiseClient = createVoidhashSdk({
          baseUrl: "https://api.voidhash.test",
          secretKey: "vh_sk_test",
        });

        const effectError = yield* extractEffectFailure(effectClient.auth.session());
        const promiseExit = yield* Effect.exit(
          Effect.tryPromise({
            try: () => promiseClient.auth.session(),
            catch: (error: unknown) => error,
          }),
        );

        if (Exit.isSuccess(promiseExit)) {
          return yield* Effect.die(new Error("Expected promise client failure."));
        }

        const promiseError = Cause.squash(promiseExit.cause);

        expect(promiseError).toMatchObject({
          _tag: tagOf(effectError),
        });
        expect(promiseError).toMatchObject({
          _tag: "ApiActionForbiddenErrorJsonEncoding",
        });
      }),
    ));
});
