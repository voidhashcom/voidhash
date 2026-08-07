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
  "apiKeys",
  "auth",
  "organizations",
  "paymentProviderConfigurations",
  "paymentProviderProducts",
  "paywallLocations",
  "perks",
  "persons",
  "productPerks",
  "products",
  "projects",
  "schema",
  "users",
  "webhooks",
];

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

const extractEffectFailure = <Result, Error>(effect: Effect.Effect<Result, Error>) =>
  Effect.gen(function* () {
    const exit = yield* Effect.exit(effect);

    if (Exit.isSuccess(exit)) {
      return yield* Effect.die(new Error("Expected effect failure."));
    }

    return Option.getOrElse(Cause.findErrorOption(exit.cause), () => Cause.squash(exit.cause));
  });

describe("@voidhash/node", () => {
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

    expect(Object.keys(effectClient).sort()).toEqual([...EXPECTED_GROUPS].sort());
    expect(Object.keys(promiseClient).sort()).toEqual([...EXPECTED_GROUPS].sort());
    expect("sdk" in effectClient).toBe(false);
    expect("sdk" in promiseClient).toBe(false);

    expectTypeOf<HasKey<VoidhashNodeEffectClient, "sdk">>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<VoidhashNodeClient, "sdk">>().toEqualTypeOf<false>();
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

  it("supports path params with projects.listProjects({ params })", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() =>
          createJsonResponse([
            {
              id: "proj_1",
              name: "Alpha",
              slug: "alpha",
            },
          ]),
        );

        const client = createVoidhashSdk({
          baseUrl: "https://api.voidhash.test",
          secretKey: "vh_sk_test",
        });

        const projects = yield* Effect.promise(() =>
          client.projects.listProjects({
            params: {
              organizationId: "org_123",
            },
          }),
        );

        expect(projects).toEqual([
          {
            id: "proj_1",
            name: "Alpha",
            slug: "alpha",
          },
        ]);
        expect(calls[0]?.method).toBe("GET");
        expect(calls[0]?.url).toBe("https://api.voidhash.test/api/v1/projects/org_123");
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

  it("supports PATCH bodies with webhooks.updateWebhookEndpoint({ params, payload })", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = installFetchMock(() =>
          createJsonResponse({
            consecutiveFailures: 0,
            createdAt: "2026-03-09T12:00:00.000Z",
            description: "Updated description",
            events: ["purchase.completed"],
            id: "wh_123",
            lastSuccessAt: null,
            name: "Updated endpoint",
            projectId: "proj_123",
            secret: "secret_123",
            status: "active",
            url: "https://example.com/hooks",
          }),
        );

        const client = createVoidhashSdk({
          baseUrl: "https://api.voidhash.test",
          secretKey: "vh_sk_test",
        });

        const endpoint = yield* Effect.promise(() =>
          client.webhooks.updateWebhookEndpoint({
            params: {
              endpointId: "wh_123",
            },
            payload: {
              description: "Updated description",
              events: ["purchase.completed"],
              name: "Updated endpoint",
              status: "disabled",
              url: "https://example.com/hooks",
            },
          }),
        );

        expect(endpoint.id).toBe("wh_123");
        expect(endpoint.createdAt).toBe("2026-03-09T12:00:00.000Z");
        expect(calls[0]?.method).toBe("PATCH");
        expect(calls[0]?.url).toBe("https://api.voidhash.test/api/v1/webhooks/endpoints/wh_123");
        expect(decodeJson(calls[0]?.body ?? "{}")).toEqual({
          description: "Updated description",
          events: ["purchase.completed"],
          name: "Updated endpoint",
          status: "disabled",
          url: "https://example.com/hooks",
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
          _tag: "ApiActionForbiddenError",
        });
      }),
    ));
});
