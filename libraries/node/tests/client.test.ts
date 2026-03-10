import { ActionForbiddenError } from "@voidhash/api-spec/errors";
import { Cause, Effect, Exit, Option } from "effect";
import {
  afterEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

import {
  VoidhashNodeConfigurationError,
  createVoidhashNodeClient,
  createVoidhashNodeEffectClient,
  type VoidhashNodeClient,
  type VoidhashNodeEffectClient,
} from "../src/index";
import { createJsonResponse, installFetchMock } from "./helpers";

const EXPECTED_GROUPS = [
  "api_keys",
  "auth",
  "changesets",
  "customers",
  "organizations",
  "payment_provider_configurations",
  "payment_provider_products",
  "paywall_locations",
  "perks",
  "product_perks",
  "products",
  "projects",
  "users",
  "webhooks",
] as const;

type HasKey<TValue, TKey extends PropertyKey> = TKey extends keyof TValue
  ? true
  : false;

const extractEffectFailure = async <Result, Error>(
  effect: Effect.Effect<Result, Error>
) => {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) {
    throw new Error("Expected effect failure.");
  }

  const typedError = Cause.findErrorOption(exit.cause);

  return Option.isSome(typedError)
    ? typedError.value
    : Cause.squash(exit.cause);
};

describe("@voidhash/node", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes the exact non-sdk namespaces and omits sdk in types", () => {
    const effectClient = createVoidhashNodeEffectClient({
      secretKey: "vh_sk_test",
    });
    const promiseClient = createVoidhashNodeClient({
      secretKey: "vh_sk_test",
    });

    expect(Object.keys(effectClient).sort()).toEqual([...EXPECTED_GROUPS].sort());
    expect(Object.keys(promiseClient).sort()).toEqual([...EXPECTED_GROUPS].sort());
    expect("sdk" in effectClient).toBe(false);
    expect("sdk" in promiseClient).toBe(false);

    expectTypeOf<HasKey<VoidhashNodeEffectClient, "sdk">>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<VoidhashNodeClient, "sdk">>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<VoidhashNodeEffectClient, "auth">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<VoidhashNodeEffectClient, "webhooks">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<VoidhashNodeClient, "auth">>().toEqualTypeOf<true>();
    expectTypeOf<HasKey<VoidhashNodeClient, "webhooks">>().toEqualTypeOf<true>();
  });

  it("fails immediately for invalid configuration", () => {
    expect(() =>
      createVoidhashNodeEffectClient({
        secretKey: "   ",
      })
    ).toThrow(VoidhashNodeConfigurationError);

    expect(() =>
      createVoidhashNodeEffectClient({
        baseUrl: "not a url",
        secretKey: "vh_sk_test",
      })
    ).toThrow(VoidhashNodeConfigurationError);

    expect(() =>
      createVoidhashNodeEffectClient({
        headers: {
          "x-secret-key": "attempted_override",
        },
        secretKey: "vh_sk_test",
      })
    ).toThrow(VoidhashNodeConfigurationError);

    vi.stubGlobal("fetch", undefined);

    expect(() =>
      createVoidhashNodeClient({
        secretKey: "vh_sk_test",
      })
    ).toThrow(VoidhashNodeConfigurationError);
  });

  it("uses the default baseUrl and sends x-secret-key on auth.session()", async () => {
    const { calls } = installFetchMock(() =>
      createJsonResponse({
        method: "secret-key",
        name: "voidhash",
        organizations: [],
        projects: [],
      })
    );

    const client = createVoidhashNodeEffectClient({
      headers: {
        "x-trace-id": "trace_123",
      },
      secretKey: "vh_sk_test",
    });

    const session = await Effect.runPromise(client.auth.session());

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
  });

  it("supports path params with projects.listProjects({ params })", async () => {
    const { calls } = installFetchMock(() =>
      createJsonResponse([
        {
          id: "proj_1",
          name: "Alpha",
          slug: "alpha",
        },
      ])
    );

    const client = createVoidhashNodeClient({
      baseUrl: "https://api.voidhash.test",
      secretKey: "vh_sk_test",
    });

    const projects = await client.projects.listProjects({
      params: {
        organizationId: "org_123",
      },
    });

    expect(projects).toEqual([
      {
        id: "proj_1",
        name: "Alpha",
        slug: "alpha",
      },
    ]);
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.url).toBe(
      "https://api.voidhash.test/api/v1/projects/org_123"
    );
    expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");
  });

  it("supports POST bodies with customers.createCustomer({ payload })", async () => {
    const { calls } = installFetchMock(() =>
      createJsonResponse({
        appUserId: "user_123",
        email: "user@example.com",
        id: "customer_123",
        name: "Taylor",
      })
    );

    const client = createVoidhashNodeClient({
      baseUrl: "https://api.voidhash.test",
      secretKey: "vh_sk_test",
    });

    const customer = await client.customers.createCustomer({
      payload: {
        appUserId: "user_123",
        email: "user@example.com",
        name: "Taylor",
      },
    });

    expect(customer).toEqual({
      appUserId: "user_123",
      email: "user@example.com",
      id: "customer_123",
      name: "Taylor",
    });
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toBe("https://api.voidhash.test/api/v1/customers");
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({
      appUserId: "user_123",
      email: "user@example.com",
      name: "Taylor",
    });
    expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");
  });

  it("supports PATCH bodies with webhooks.updateWebhookEndpoint({ params, payload })", async () => {
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
      })
    );

    const client = createVoidhashNodeClient({
      baseUrl: "https://api.voidhash.test",
      secretKey: "vh_sk_test",
    });

    const endpoint = await client.webhooks.updateWebhookEndpoint({
      params: {
        endpointId: "wh_123",
      },
      payload: {
        description: "Updated description",
        events: ["purchase.completed"],
        name: "Updated endpoint",
        status: "active",
        url: "https://example.com/hooks",
      },
    });

    expect(endpoint.id).toBe("wh_123");
    expect(endpoint.createdAt).toEqual(new Date("2026-03-09T12:00:00.000Z"));
    expect(calls[0]?.method).toBe("PATCH");
    expect(calls[0]?.url).toBe(
      "https://api.voidhash.test/api/v1/webhooks/endpoints/wh_123"
    );
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({
      description: "Updated description",
      events: ["purchase.completed"],
      name: "Updated endpoint",
      status: "active",
      url: "https://example.com/hooks",
    });
    expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");
  });

  it("supports DELETE requests with api_keys.deleteApiKey({ params })", async () => {
    const { calls } = installFetchMock(() => new Response(null, { status: 204 }));

    const client = createVoidhashNodeClient({
      baseUrl: "https://api.voidhash.test",
      secretKey: "vh_sk_test",
    });

    const result = await client.api_keys.deleteApiKey({
      params: {
        apiKeyId: "ak_123",
      },
    });

    expect(result).toBeUndefined();
    expect(calls[0]?.method).toBe("DELETE");
    expect(calls[0]?.url).toBe(
      "https://api.voidhash.test/api/v1/api-keys/ak_123"
    );
    expect(calls[0]?.headers["x-secret-key"]).toBe("vh_sk_test");
  });

  it("surfaces matching success values through effect and promise factories", async () => {
    installFetchMock(() =>
      createJsonResponse({
        method: "secret-key",
        name: "voidhash",
        organizations: [],
        projects: [],
      })
    );

    const effectClient = createVoidhashNodeEffectClient({
      baseUrl: "https://api.voidhash.test",
      secretKey: "vh_sk_test",
    });
    const promiseClient = createVoidhashNodeClient({
      baseUrl: "https://api.voidhash.test",
      secretKey: "vh_sk_test",
    });

    const effectResult = await Effect.runPromise(effectClient.auth.session());
    const promiseResult = await promiseClient.auth.session();

    expect(promiseResult).toEqual(effectResult);
  });

  it("surfaces matching failure objects through effect and promise factories", async () => {
    installFetchMock(() =>
      createJsonResponse(
        new ActionForbiddenError({
          message: "Forbidden",
        }),
        403
      )
    );

    const effectClient = createVoidhashNodeEffectClient({
      baseUrl: "https://api.voidhash.test",
      secretKey: "vh_sk_test",
    });
    const promiseClient = createVoidhashNodeClient({
      baseUrl: "https://api.voidhash.test",
      secretKey: "vh_sk_test",
    });

    const effectError = await extractEffectFailure(effectClient.auth.session());
    const promiseError = await promiseClient.auth
      .session()
      .then(
        () => {
          throw new Error("Expected promise client failure.");
        },
        (error: unknown) => error
      );

    expect(promiseError).toStrictEqual(effectError);
    expect(promiseError).toBeInstanceOf(ActionForbiddenError);
  });
});
