import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VoidhashNodeConfigurationError, createVoidhashSdk } from "../src/index";
import { createVoidhashSdk as createVoidhashEffectSdk } from "../src/effect";
import { createJsonResponse, installFetchMock, type FetchCall } from "./helpers";

const BASE_URL = "https://api.voidhash.test";

const PERSON = {
  personId: "person_123",
  distinctId: "user_123",
  email: "user@example.com",
  name: "Taylor",
};

const PERKS = [
  { id: "perk_premium", name: "Premium", projectId: "proj_1", slug: "premium" },
  { id: "perk_pro", name: "Pro", projectId: "proj_1", slug: "pro" },
];

const LAST_PAGE_INFO = { endCursor: null, hasNextPage: false };

/** Wraps a list body in the `{ data, pageInfo }` envelope every list returns. */
const page = (data: ReadonlyArray<unknown>) => ({ data, pageInfo: LAST_PAGE_INFO });

const activeGrant = (perkId: string) => ({
  expiresAt: null,
  perkId,
  source: "subscription",
  sourceId: "sub_1",
  sourcePersonId: PERSON.personId,
  status: "active",
});

const expiredGrant = (perkId: string) => ({
  expiresAt: "2026-01-01T00:00:00.000Z",
  perkId,
  source: "purchase",
  sourceId: "purchase_1",
  sourcePersonId: PERSON.personId,
  status: "expired",
});

const pathOf = (call: FetchCall) => new URL(call.url).pathname;

/**
 * Routes the mocked fetch by path so a single test can serve the person
 * lookup, the perk catalogue and the entitlement read in one handler.
 */
const routes = (handlers: {
  readonly entitlements?: () => Response;
  readonly perks?: () => Response;
  readonly person?: () => Response;
}) =>
  installFetchMock((call) => {
    const path = pathOf(call);

    if (path === "/api/v1/persons") {
      return (handlers.person ?? (() => createJsonResponse(page([PERSON]))))();
    }

    if (path === "/api/v1/persons/person_123/entitlements") {
      return (handlers.entitlements ?? (() => createJsonResponse({ grants: [] })))();
    }

    if (path === "/api/v1/perks") {
      return (handlers.perks ?? (() => createJsonResponse(page(PERKS))))();
    }

    return new Response(null, { status: 404 });
  });

/** The list endpoint answers an empty page for an unknown distinct id. */
const noPersonResponse = () => createJsonResponse(page([]));

const unauthenticatedResponse = () =>
  createJsonResponse(
    {
      _tag: "Api/NotAuthenticatedError",
      message: "Missing secret key",
    },
    401,
  );

const promiseClient = () =>
  createVoidhashSdk({
    baseUrl: BASE_URL,
    secretKey: "vh_sk_test",
  });

const effectClient = () =>
  createVoidhashEffectSdk({
    baseUrl: BASE_URL,
    secretKey: "vh_sk_test",
  });

const failureOf = <Result, Error>(effect: Effect.Effect<Result, Error>) =>
  Effect.gen(function* () {
    const exit = yield* Effect.exit(effect);

    if (Exit.isSuccess(exit)) {
      return yield* Effect.die(new Error("Expected effect failure."));
    }

    return Option.getOrElse(Cause.findErrorOption(exit.cause), () => Cause.squash(exit.cause));
  });

describe("@voidhash/node entitlements", () => {
  // oxlint-disable-next-line effect/noTestLifecycleHooks -- vitest global-stub cleanup: vi.unstubAllGlobals resets vitest's own module state, which has no Effect-scoped equivalent.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the grants for a known distinct id", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = routes({
          entitlements: () => createJsonResponse({ grants: [activeGrant("perk_premium")] }),
        });

        const grants = yield* Effect.promise(() =>
          promiseClient().entitlements.getGrantsByDistinctId({ distinctId: "user_123" }),
        );

        expect(grants).toEqual([activeGrant("perk_premium")]);
        expect(calls.map(pathOf)).toEqual([
          "/api/v1/persons",
          "/api/v1/persons/person_123/entitlements",
        ]);
      }),
    ));

  it("propagates the API error when getGrantsByDistinctId cannot find the person", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        routes({ person: noPersonResponse });

        const error = yield* failureOf(
          effectClient().entitlements.getGrantsByDistinctId({ distinctId: "user_123" }),
        );

        expect(error).toMatchObject({
          _tag: "ApiPersonNotFoundErrorJsonEncoding",
          data: { _tag: "Api/PersonNotFoundError" },
        });
      }),
    ));

  it("reports true when an active grant matches the perk id", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = routes({
          entitlements: () =>
            createJsonResponse({
              grants: [expiredGrant("perk_pro"), activeGrant("perk_premium")],
            }),
        });

        const hasPerk = yield* Effect.promise(() =>
          promiseClient().entitlements.hasActivePerk({
            distinctId: "user_123",
            perkId: "perk_premium",
          }),
        );

        expect(hasPerk).toBe(true);
        expect(calls.map(pathOf)).not.toContain("/api/v1/perks");
      }),
    ));

  it("reports false when the only matching grant has expired", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        routes({
          entitlements: () => createJsonResponse({ grants: [expiredGrant("perk_premium")] }),
        });

        const hasPerk = yield* Effect.promise(() =>
          promiseClient().entitlements.hasActivePerk({
            distinctId: "user_123",
            perkId: "perk_premium",
          }),
        );

        expect(hasPerk).toBe(false);
      }),
    ));

  it("reports false for an unknown distinct id", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        routes({ person: noPersonResponse });

        const hasPerk = yield* Effect.promise(() =>
          promiseClient().entitlements.hasActivePerk({
            distinctId: "user_123",
            perkId: "perk_premium",
          }),
        );

        expect(hasPerk).toBe(false);
      }),
    ));

  it("resolves a perk slug through perks.listPerks", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = routes({
          entitlements: () => createJsonResponse({ grants: [activeGrant("perk_premium")] }),
        });

        const hasPerk = yield* Effect.promise(() =>
          promiseClient().entitlements.hasActivePerk({
            distinctId: "user_123",
            perkSlug: "premium",
          }),
        );

        expect(hasPerk).toBe(true);
        expect(calls.map(pathOf)).toEqual([
          "/api/v1/perks",
          "/api/v1/persons",
          "/api/v1/persons/person_123/entitlements",
        ]);
      }),
    ));

  it("reports false for a perk slug that matches no perk, without a person lookup", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = routes({});

        const hasPerk = yield* Effect.promise(() =>
          promiseClient().entitlements.hasActivePerk({
            distinctId: "user_123",
            perkSlug: "does-not-exist",
          }),
        );

        expect(hasPerk).toBe(false);
        expect(calls.map(pathOf)).toEqual(["/api/v1/perks"]);
      }),
    ));

  it("fails with a configuration error when both or neither perk selector is set", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls } = routes({});
        const client = effectClient();

        const neither = yield* failureOf(
          client.entitlements.hasActivePerk({ distinctId: "user_123" }),
        );
        const both = yield* failureOf(
          client.entitlements.hasActivePerk({
            distinctId: "user_123",
            perkId: "perk_premium",
            perkSlug: "premium",
          }),
        );

        expect(neither).toBeInstanceOf(VoidhashNodeConfigurationError);
        expect(both).toBeInstanceOf(VoidhashNodeConfigurationError);
        expect(calls).toHaveLength(0);

        yield* Effect.promise(() =>
          expect(
            promiseClient().entitlements.hasActivePerk({ distinctId: "user_123" }),
          ).rejects.toBeInstanceOf(VoidhashNodeConfigurationError),
        );
      }),
    ));

  it("propagates a 401 instead of reporting no access", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        routes({ person: unauthenticatedResponse });

        const error = yield* failureOf(
          effectClient().entitlements.hasActivePerk({
            distinctId: "user_123",
            perkId: "perk_premium",
          }),
        );

        // The 401 wrapper tag is now per-operation, so the stable assertion is
        // the decoded wire body carrying the API discriminator.
        expect(error).toMatchObject({
          data: { _tag: "Api/NotAuthenticatedError" },
        });
      }),
    ));

  it("propagates a 401 raised while resolving a perk slug", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        routes({ perks: unauthenticatedResponse });

        const error = yield* failureOf(
          effectClient().entitlements.hasActivePerk({
            distinctId: "user_123",
            perkSlug: "premium",
          }),
        );

        // The 401 wrapper tag is now per-operation, so the stable assertion is
        // the decoded wire body carrying the API discriminator.
        expect(error).toMatchObject({
          data: { _tag: "Api/NotAuthenticatedError" },
        });
      }),
    ));
});
