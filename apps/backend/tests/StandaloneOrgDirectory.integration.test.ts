import { StandaloneOrgDirectoryLive } from "@voidhash/core/services/organizations/StandaloneOrgDirectory";
import { OrgDirectoryPort } from "@voidhash/core/services/organizations/OrgDirectoryPort";
import { generateId } from "@voidhash/core/utils/generate-id";
import { Db, eq, member, organization, user } from "@voidhash/db";
import { DateTime, Effect } from "effect";
import { afterAll, describe, expect, it } from "vitest";

import { getSelfhostDatabaseConfig } from "../src/config.ts";

const database = Db.layer(getSelfhostDatabaseConfig());

const userId = generateId("user");
const orgId = generateId("organization");
const memberId = generateId("member");
const email = "local-org-directory@integration.test";

const withServices = <A, E>(effect: Effect.Effect<A, E, Db | OrgDirectoryPort>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(StandaloneOrgDirectoryLive),
      Effect.provide(database),
      Effect.scoped,
    ),
  );

describe("local organization directory", () => {
  // oxlint-disable-next-line effect/noTestLifecycleHooks -- deletes the shared fixture rows once after the whole suite; the rows outlive every individual test's Effect scope, so acquireRelease cannot own them.
  afterAll(() =>
    withServices(
      Effect.gen(function* () {
        const db = yield* Db;
        yield* db.delete(member).where(eq(member.id, memberId));
        yield* db.delete(organization).where(eq(organization.id, orgId));
        yield* db.delete(user).where(eq(user.id, userId));
      }),
    ),
  );

  it("synthesizes provider ids that satisfy the NOT NULL workos columns", () =>
    withServices(
      Effect.gen(function* () {
        const port = yield* OrgDirectoryPort;
        const db = yield* Db;
        const now = yield* DateTime.nowAsDate;

        yield* db.insert(user).values({
          banned: false,
          banExpires: null,
          banReason: null,
          createdAt: now,
          customImageUrl: null,
          email,
          emailVerified: true,
          id: userId,
          image: null,
          name: "Directory Dev",
          role: null,
          updatedAt: now,
          workosUserId: `local_${"a".repeat(24)}`,
        });

        const createdOrg = yield* port.createOrganization({
          externalId: orgId,
          name: "Directory Org",
        });
        expect(createdOrg.id).toBe(`local_org_${orgId}`);
        // `organization.workos_organization_id` is varchar(64).
        expect(createdOrg.id.length).toBeLessThanOrEqual(64);

        const membership = yield* port.createMembership({
          roleSlug: "admin",
          workosOrganizationId: createdOrg.id,
          workosUserId: `local_${"a".repeat(24)}`,
        });
        expect(membership.id.startsWith("local_mem_")).toBe(true);
        expect(membership.id.length).toBeLessThanOrEqual(64);

        // The real INSERTs OrganizationService performs — proof the synthesized
        // ids actually satisfy the constraints.
        yield* db.insert(organization).values({
          createdAt: now,
          id: orgId,
          logo: null,
          metadata: null,
          name: "Directory Org",
          slug: `directory-org-${orgId.slice(-8)}`,
          workosOrganizationId: createdOrg.id,
        });
        yield* db.insert(member).values({
          createdAt: now,
          id: memberId,
          organizationId: orgId,
          role: "admin",
          userId,
          workosMembershipId: membership.id,
        });
      }),
    ));

  it("reads users and memberships back out of the local tables", () =>
    withServices(
      Effect.gen(function* () {
        const port = yield* OrgDirectoryPort;

        const found = yield* port.findUserByEmail(email);
        expect(found?.email).toBe(email);
        expect(found?.firstName).toBe("Directory");
        expect(found?.lastName).toBe("Dev");
        expect(found?.externalId).toBe(userId);

        const memberships = yield* port.listMembershipsForUser(found?.id ?? "");
        expect(memberships).toHaveLength(1);
        expect(memberships[0]?.organizationId).toBe(`local_org_${orgId}`);
        expect(memberships[0]?.role).toBe("admin");

        const org = yield* port.getOrganizationByExternalId(orgId);
        expect(org?.name).toBe("Directory Org");
      }),
    ));

  it("returns null for an unknown email", () =>
    withServices(
      Effect.gen(function* () {
        const port = yield* OrgDirectoryPort;
        expect(yield* port.findUserByEmail("nobody@integration.test")).toBeNull();
      }),
    ));
});
