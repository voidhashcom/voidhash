import { Db, type User } from "@voidhash/db";
import { DateTime, Effect, Layer } from "effect";

import { describe, expect, it } from "../../testing/effect-vitest.ts";

import type { LocalUserIdentity } from "../../domain/auth/LocalUserSession.ts";
import {
  OrganizationMembershipSyncPort,
  OrganizationMembershipSyncPortError,
} from "../organizations/OrganizationMembershipSyncPort.ts";
import { LocalUserSessionService } from "./LocalUserSessionService.ts";
import { IdentityProvider, IdentityProviderError } from "./IdentityProvider.ts";
import {
  IdentityLinkBackfillService,
  IdentityLinkBackfillError,
} from "./IdentityLinkBackfillService.ts";

/**
 * Partial stub for a service whose remaining members this test never touches.
 * Mirrors the `fakeService` helper used by the paywall-workspace unit tests.
 */
const fakeService = (impl: object): any => impl;

const at = (iso: string): Date => DateTime.toDateUtc(DateTime.makeUnsafe(iso));

const identity = (externalId: string | null = "local_user_1"): LocalUserIdentity => ({
  email: "alice@example.com",
  emailVerified: true,
  externalId,
  firstName: "Alice",
  id: "workos_user_1",
  lastName: "Example",
  profilePictureUrl: null,
});

const localUser: User = {
  banExpires: null,
  banReason: null,
  banned: false,
  createdAt: at("2026-01-01T00:00:00.000Z"),
  customImageUrl: null,
  email: "alice@example.com",
  emailVerified: true,
  id: "local_user_1",
  image: null,
  name: "Alice Example",
  role: null,
  updatedAt: at("2026-01-01T00:00:00.000Z"),
  workosUserId: "workos_user_1",
};

const makeTestLayer = (options: {
  readonly membershipFailure?: boolean;
  readonly setExternalIdFailure?: boolean;
} = {}) => {
  const membershipCalls: Array<{ localUserId: string; workosUserId: string }> = [];
  const externalIdCalls: Array<{ externalId: string; workosUserId: string }> = [];

  const Dependencies = Layer.mergeAll(
    Layer.succeed(Db, fakeService({})),
    Layer.succeed(
      LocalUserSessionService,
      fakeService({
        resolveLocalUser: () => Effect.succeed(localUser),
      }),
    ),
    Layer.succeed(
      OrganizationMembershipSyncPort,
      OrganizationMembershipSyncPort.of({
        syncMemberships: (input) => {
          membershipCalls.push(input);
          if (options.membershipFailure) {
            return Effect.fail(
              new OrganizationMembershipSyncPortError({ cause: "membership sync failed" }),
            );
          }
          return Effect.succeed({
            syncedMembershipIds: ["member_1"],
            syncedOrganizationIds: ["org_1"],
          });
        },
      }),
    ),
    Layer.succeed(
      IdentityProvider,
      fakeService({
        linkExternalId: (providerUserId: string, externalId: string) => {
          externalIdCalls.push({ externalId, workosUserId: providerUserId });
          if (options.setExternalIdFailure) {
            return Effect.fail(
              new IdentityProviderError({
                cause: "link failed",
                message: "link failed",
              }),
            );
          }
          return Effect.void;
        },
      }),
    ),
  );

  return {
    externalIdCalls,
    layer: Layer.mergeAll(
      Dependencies,
      IdentityLinkBackfillService.layer.pipe(Layer.provide(Dependencies)),
    ),
    membershipCalls,
  };
};

describe("IdentityLinkBackfillService", () => {
  it.effect("resolves the local user and delegates optional membership synchronization", () => {
    const testLayer = makeTestLayer();
    return Effect.gen(function* () {
      const sync = yield* IdentityLinkBackfillService;
      const result = yield* sync.syncAuthenticatedUser(identity());

      expect(result).toEqual({
        localUser,
        syncedMembershipIds: ["member_1"],
        syncedOrganizationIds: ["org_1"],
      });
      expect(testLayer.membershipCalls).toEqual([
        { localUserId: "local_user_1", workosUserId: "workos_user_1" },
      ]);
      expect(testLayer.externalIdCalls).toEqual([]);
    }).pipe(Effect.provide(testLayer.layer));
  });

  it.effect("best-effort backfills a missing WorkOS external id", () => {
    const testLayer = makeTestLayer();
    return Effect.gen(function* () {
      const sync = yield* IdentityLinkBackfillService;
      yield* sync.syncAuthenticatedUser(identity(null));

      expect(testLayer.externalIdCalls).toEqual([
        { externalId: "local_user_1", workosUserId: "workos_user_1" },
      ]);
    }).pipe(Effect.provide(testLayer.layer));
  });

  it.effect("continues when the best-effort external-id backfill fails", () => {
    const testLayer = makeTestLayer({ setExternalIdFailure: true });
    return Effect.gen(function* () {
      const sync = yield* IdentityLinkBackfillService;
      const result = yield* sync.syncAuthenticatedUser(identity(null));

      expect(result.localUser.id).toBe("local_user_1");
      expect(testLayer.membershipCalls).toHaveLength(1);
    }).pipe(Effect.provide(testLayer.layer));
  });

  it.effect("maps membership extension failures to the authentication-facing error", () => {
    const testLayer = makeTestLayer({ membershipFailure: true });
    return Effect.gen(function* () {
      const sync = yield* IdentityLinkBackfillService;
      const failure = yield* Effect.flip(sync.syncAuthenticatedUser(identity()));

      expect(failure).toBeInstanceOf(IdentityLinkBackfillError);
      expect(failure.cause).toBe("membership sync failed");
    }).pipe(Effect.provide(testLayer.layer));
  });
});
