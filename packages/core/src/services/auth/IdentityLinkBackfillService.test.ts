import { Db, type User } from "@voidhash/db";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import type { LocalUserIdentity } from "../../domain/auth/LocalUserSession.ts";
import {
  OrganizationMembershipSyncPort,
  OrganizationMembershipSyncPortError,
} from "../organizations/OrganizationMembershipSyncPort.ts";
import { LocalUserSessionService } from "./LocalUserSessionService.ts";
import { IdentityProvider } from "./IdentityProvider.ts";
import {
  IdentityLinkBackfillService,
  IdentityLinkBackfillError,
} from "./IdentityLinkBackfillService.ts";

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
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  customImageUrl: null,
  email: "alice@example.com",
  emailVerified: true,
  id: "local_user_1",
  image: null,
  name: "Alice Example",
  role: null,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  workosUserId: "workos_user_1",
};

const makeTestLayer = (options: {
  readonly membershipFailure?: boolean;
  readonly setExternalIdFailure?: boolean;
} = {}) => {
  const membershipCalls: Array<{ localUserId: string; workosUserId: string }> = [];
  const externalIdCalls: Array<{ externalId: string; workosUserId: string }> = [];

  const Dependencies = Layer.mergeAll(
    Layer.succeed(Db, {} as never),
    Layer.succeed(
      LocalUserSessionService,
      {
        resolveLocalUser: () => Effect.succeed(localUser),
      } as never,
    ),
    Layer.succeed(
      OrganizationMembershipSyncPort,
      OrganizationMembershipSyncPort.of({
        syncMemberships: (input) => {
          membershipCalls.push(input);
          return options.membershipFailure
            ? Effect.fail(
                new OrganizationMembershipSyncPortError({ cause: "membership sync failed" }),
              )
            : Effect.succeed({
                syncedMembershipIds: ["member_1"],
                syncedOrganizationIds: ["org_1"],
              });
        },
      }),
    ),
    Layer.succeed(
      IdentityProvider,
      {
        linkExternalId: (providerUserId: string, externalId: string) => {
          externalIdCalls.push({ externalId, workosUserId: providerUserId });
          return options.setExternalIdFailure
            ? Effect.fail({ _tag: "IdentityProviderError" } as never)
            : Effect.void;
        },
      } as never,
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
  it("resolves the local user and delegates optional membership synchronization", async () => {
    const testLayer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sync = yield* IdentityLinkBackfillService;
        return yield* sync.syncAuthenticatedUser(identity());
      }).pipe(Effect.provide(testLayer.layer)),
    );

    expect(result).toEqual({
      localUser,
      syncedMembershipIds: ["member_1"],
      syncedOrganizationIds: ["org_1"],
    });
    expect(testLayer.membershipCalls).toEqual([
      { localUserId: "local_user_1", workosUserId: "workos_user_1" },
    ]);
    expect(testLayer.externalIdCalls).toEqual([]);
  });

  it("best-effort backfills a missing WorkOS external id", async () => {
    const testLayer = makeTestLayer();
    await Effect.runPromise(
      Effect.gen(function* () {
        const sync = yield* IdentityLinkBackfillService;
        yield* sync.syncAuthenticatedUser(identity(null));
      }).pipe(Effect.provide(testLayer.layer)),
    );

    expect(testLayer.externalIdCalls).toEqual([
      { externalId: "local_user_1", workosUserId: "workos_user_1" },
    ]);
  });

  it("continues when the best-effort external-id backfill fails", async () => {
    const testLayer = makeTestLayer({ setExternalIdFailure: true });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sync = yield* IdentityLinkBackfillService;
        return yield* sync.syncAuthenticatedUser(identity(null));
      }).pipe(Effect.provide(testLayer.layer)),
    );

    expect(result.localUser.id).toBe("local_user_1");
    expect(testLayer.membershipCalls).toHaveLength(1);
  });

  it("maps membership extension failures to the authentication-facing error", async () => {
    const testLayer = makeTestLayer({ membershipFailure: true });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sync = yield* IdentityLinkBackfillService;
        return yield* Effect.result(sync.syncAuthenticatedUser(identity()));
      }).pipe(Effect.provide(testLayer.layer)),
    );

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(result.failure).toBeInstanceOf(IdentityLinkBackfillError);
      expect(result.failure.cause).toBe("membership sync failed");
    }
  });
});
