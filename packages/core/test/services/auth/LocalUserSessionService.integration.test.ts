/**
 * Integration tests for {@link LocalUserSessionService}, run against the real
 * backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PlanetScale DB; only the project schema cache is an in-memory stub).
 *
 * The service mirrors WorkOS identities into the local `user` table and derives
 * an RPC `UserSession` from a user's memberships. None of its methods are
 * project-permission guarded, so there is no `ActionForbiddenError` path — the
 * coverage here is about the *persisted* upsert/backfill semantics:
 *  - `resolveLocalUser` matched-by-`workos_user_id` (no-op when unchanged),
 *  - matched-by-`email` fallback that backfills `workos_user_id` and updates
 *    changed columns,
 *  - a fresh INSERT for an unknown identity, and the duplicate-key upsert that
 *    makes a racing second `resolveLocalUser` a no-op rather than a failure,
 *  - the name derivation (`firstName`+`lastName` → `name`, email fallback) and
 *    `profilePictureUrl` → `image` mapping,
 *  - `loadUserAccess` over real `member`/`organization`/`project` joins,
 *  - the pure `toUserSession` projection (auth-critical session shape).
 *
 * Conventions used throughout:
 *  - Tests build their own throwaway users/orgs/projects under unique ids
 *    (never the shared fixture rows) and delete them — plus their memberships —
 *    on exit via {@link withUserCleanup}'s `Effect.ensuring` finalizer, success
 *    or failure. The global teardown sweep retains the container, so anything we
 *    create must be self-cleaned. Assertions stay membership-based.
 *  - DB reads bypass the service via `yield* Db` to verify the row that actually
 *    persisted (which, for the upsert path, may not be the one we generated).
 */
import { Effect } from "effect";
import { describe, expect } from "vitest";

import { LocalUserSessionService } from "@voidhash/core/services";
import type {
  LocalUserAccess,
  LocalUserIdentity,
} from "@voidhash/core/domain/auth/LocalUserSession";
import {
  Db,
  eq,
  inArray,
  member,
  organization,
  projects,
  user,
  type User as DbUser,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";

const { test } = CoreIntegrationTestHarness.make();

/** Monotonic counter so ids/emails stay unique even within the same millisecond. */
let seq = 0;
const nonce = () => `${Date.now()}-${seq++}`;
/**
 * The `user`/`organization`/`member` primary keys are `varchar(36)`, so a
 * descriptive `label` embedded in the id can overflow the column ("Data too
 * long for column 'id'"). Keep ids compact and label-free — uniqueness comes
 * from the base36 timestamp + counter, which stays well under 36 chars — and
 * carry the human-readable `label` in the `varchar(255)` email/slug columns
 * instead. `label` is accepted for call-site readability but intentionally
 * unused in the id itself.
 */
const uniqueId = (_label: string) => `lus-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const uniqueEmail = (label: string) => `it-lus-${label}-${nonce()}@voidhash.test`;
const uniqueWorkosId = (label: string) => `it_workos_${label}_${nonce()}`;

/** Build a {@link LocalUserIdentity} (WorkOS-shaped) with sensible defaults. */
const identity = (
  overrides: Partial<LocalUserIdentity> & Pick<LocalUserIdentity, "id" | "email">,
): LocalUserIdentity => ({
  emailVerified: true,
  externalId: null,
  firstName: null,
  lastName: null,
  profilePictureUrl: null,
  ...overrides,
});

/** Read a user row straight from the database, bypassing the service. */
const findUserRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.user.findFirst({ where: { id } });
  });

/** Read a user row by email straight from the database. */
const findUserRowByEmail = (email: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.user.findFirst({ where: { email } });
  });

/**
 * Delete the given users and any memberships referencing them. Each delete is
 * `ignore`d so a missing row never turns the finalizer into a failure;
 * memberships are removed first to respect the FK from `member.user_id`.
 */
const cleanupCreated = (
  userIds: ReadonlyArray<string>,
  orgIds: ReadonlyArray<string>,
  projectIds: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    if (userIds.length > 0) {
      yield* db
        .delete(member)
        .where(inArray(member.userId, [...userIds]))
        .pipe(Effect.ignore);
    }
    if (projectIds.length > 0) {
      yield* db
        .delete(projects)
        .where(inArray(projects.id, [...projectIds]))
        .pipe(Effect.ignore);
    }
    if (userIds.length > 0) {
      yield* db
        .delete(user)
        .where(inArray(user.id, [...userIds]))
        .pipe(Effect.ignore);
    }
    if (orgIds.length > 0) {
      yield* db
        .delete(organization)
        .where(inArray(organization.id, [...orgIds]))
        .pipe(Effect.ignore);
    }
  });

/**
 * Wrap a test body so every user/org/project it creates is removed afterward,
 * regardless of how the test exits. Pass each created id to the matching
 * `track*` callback; cleanup reads the collected ids lazily at finalization via
 * `Effect.ensuring`, so it sees every id tracked while the body ran (including
 * a row the upsert path persisted under an id we did not generate).
 */
const withUserCleanup = <E, R>(
  body: (track: {
    user: (id: string) => void;
    org: (id: string) => void;
    project: (id: string) => void;
  }) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const userIds: string[] = [];
  const orgIds: string[] = [];
  const projectIds: string[] = [];
  return body({
    user: (id) => userIds.push(id),
    org: (id) => orgIds.push(id),
    project: (id) => projectIds.push(id),
  }).pipe(Effect.ensuring(cleanupCreated(userIds, orgIds, projectIds)));
};

describe("LocalUserSessionService.resolveLocalUser", () => {
  test(
    "matches by workosUserId and returns the existing row unchanged when no field differs",
    withUserCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* LocalUserSessionService;
        const db = yield* Db;

        const id = uniqueId("match-workos");
        const email = uniqueEmail("match-workos");
        const workosUserId = uniqueWorkosId("match");
        const now = new Date();
        // Store the row already in the exact shape the incoming identity derives
        // (name = "Existing Name" from firstName+lastName, verified, no image)
        // so the `needsUpdate` guard is false and resolve is a pure read-back.
        yield* db.insert(user).values({
          createdAt: now,
          email,
          emailVerified: true,
          id,
          image: null,
          name: "Existing Name",
          updatedAt: now,
          workosUserId,
        });
        track.user(id);

        const resolved = yield* service.resolveLocalUser(
          identity({
            email,
            emailVerified: true,
            firstName: "Existing",
            id: workosUserId,
            lastName: "Name",
          }),
        );

        expect(resolved.id).toBe(id);
        expect(resolved.workosUserId).toBe(workosUserId);
        expect(resolved.name).toBe("Existing Name");

        const row = yield* findUserRow(id);
        expect(row?.email).toBe(email);
        expect(row?.workosUserId).toBe(workosUserId);
        expect(row?.name).toBe("Existing Name");
      }),
    ).pipe(Effect.provide(LocalUserSessionService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "matches by email for a row without a workosUserId, backfills it, and updates changed fields",
    withUserCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* LocalUserSessionService;
        const db = yield* Db;

        const id = uniqueId("backfill");
        const email = uniqueEmail("backfill");
        const now = new Date();
        // Legacy-style row: has the email but no workos_user_id yet, and stale
        // emailVerified / image / name compared to the incoming identity.
        yield* db.insert(user).values({
          createdAt: now,
          email,
          emailVerified: false,
          id,
          image: null,
          name: "Stale Name",
          updatedAt: now,
          workosUserId: null,
        });
        track.user(id);

        const workosUserId = uniqueWorkosId("backfill");
        const resolved = yield* service.resolveLocalUser(
          identity({
            email,
            emailVerified: true,
            firstName: "Fresh",
            id: workosUserId,
            lastName: "Person",
            profilePictureUrl: "https://example.test/avatar.png",
          }),
        );

        expect(resolved.id).toBe(id);
        expect(resolved.workosUserId).toBe(workosUserId);
        expect(resolved.emailVerified).toBe(true);
        expect(resolved.name).toBe("Fresh Person");
        expect(resolved.image).toBe("https://example.test/avatar.png");

        // Verify the columns were actually persisted, not just returned.
        const row = yield* findUserRow(id);
        expect(row?.workosUserId).toBe(workosUserId);
        expect(row?.emailVerified).toBe(true);
        expect(row?.name).toBe("Fresh Person");
        expect(row?.image).toBe("https://example.test/avatar.png");
      }),
    ).pipe(Effect.provide(LocalUserSessionService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "creates a new user row when not found by workosUserId or email",
    withUserCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* LocalUserSessionService;

        const email = uniqueEmail("create");
        const workosUserId = uniqueWorkosId("create");

        const resolved = yield* service.resolveLocalUser(
          identity({
            email,
            emailVerified: false,
            firstName: "Brand",
            id: workosUserId,
            lastName: "New",
          }),
        );
        track.user(resolved.id);

        expect(resolved.id.startsWith("user_")).toBe(true);
        expect(resolved.workosUserId).toBe(workosUserId);
        expect(resolved.name).toBe("Brand New");
        expect(resolved.emailVerified).toBe(false);

        const row = yield* findUserRowByEmail(email);
        expect(row).toBeDefined();
        expect(row?.id).toBe(resolved.id);
        expect(row?.workosUserId).toBe(workosUserId);
        expect(row?.name).toBe("Brand New");
      }),
    ).pipe(Effect.provide(LocalUserSessionService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "resolves the same fresh identity concurrently via upsert without a duplicate-key failure",
    withUserCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* LocalUserSessionService;
        const db = yield* Db;

        const email = uniqueEmail("race");
        const workosUserId = uniqueWorkosId("race");
        const id = identity({
          email,
          emailVerified: true,
          firstName: "Race",
          id: workosUserId,
          lastName: "Winner",
        });

        // Both fibers miss the workosUserId/email lookups for this brand-new
        // identity and race to INSERT the same (unique) email + workos_user_id;
        // each generates its own local `id`. onDuplicateKeyUpdate turns the
        // loser into a no-op instead of a duplicate-key DatabaseError, and each
        // racer then reads back whichever row actually persisted.
        const [first, second] = yield* Effect.all(
          [service.resolveLocalUser(id), service.resolveLocalUser(id)],
          { concurrency: "unbounded" },
        );
        track.user(first.id);
        track.user(second.id);

        // Neither call failed, and both converge on the single persisted row.
        const persisted = yield* findUserRowByEmail(email);
        expect(persisted).toBeDefined();
        expect(persisted?.workosUserId).toBe(workosUserId);
        expect(first.id).toBe(persisted?.id);
        expect(second.id).toBe(persisted?.id);

        // Exactly one row carries this unique email — the loser became a no-op.
        const allWithEmail = yield* db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, email));
        expect(allWithEmail.length).toBe(1);
      }),
    ).pipe(Effect.provide(LocalUserSessionService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "derives name from firstName/lastName, falls back to email, and maps profilePictureUrl to image",
    withUserCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* LocalUserSessionService;

        // No firstName/lastName → name falls back to the email; null picture → null image.
        const emailNoName = uniqueEmail("noname");
        const noName = yield* service.resolveLocalUser(
          identity({ email: emailNoName, emailVerified: true, id: uniqueWorkosId("noname") }),
        );
        track.user(noName.id);
        expect(noName.name).toBe(emailNoName);
        expect(noName.image).toBeNull();

        // firstName only → trimmed single-word name; picture mapped to image.
        const emailFirstOnly = uniqueEmail("firstonly");
        const firstOnly = yield* service.resolveLocalUser(
          identity({
            email: emailFirstOnly,
            emailVerified: true,
            firstName: "Solo",
            id: uniqueWorkosId("firstonly"),
            profilePictureUrl: "https://example.test/solo.png",
          }),
        );
        track.user(firstOnly.id);
        expect(firstOnly.name).toBe("Solo");
        expect(firstOnly.image).toBe("https://example.test/solo.png");

        const persistedFirstOnly = yield* findUserRow(firstOnly.id);
        expect(persistedFirstOnly?.name).toBe("Solo");
        expect(persistedFirstOnly?.image).toBe("https://example.test/solo.png");
      }),
    ).pipe(Effect.provide(LocalUserSessionService.layer), CoreAuthSession.authenticate()),
  );
});

describe("LocalUserSessionService.loadUserAccess", () => {
  test(
    "returns the organizations (with workosOrganizationId) and projects a member can access",
    withUserCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* LocalUserSessionService;
        const db = yield* Db;

        const userId = uniqueId("access-user");
        const orgId = uniqueId("access-org");
        const workosOrgId = uniqueWorkosId("access-org");
        const projectAId = uniqueId("access-proj-a");
        const projectBId = uniqueId("access-proj-b");
        const otherOrgId = uniqueId("access-other-org");
        const otherProjectId = uniqueId("access-other-proj");
        const now = new Date();

        yield* db.insert(user).values({
          createdAt: now,
          email: uniqueEmail("access-user"),
          emailVerified: true,
          id: userId,
          name: "Access User",
          updatedAt: now,
          workosUserId: uniqueWorkosId("access-user"),
        });
        track.user(userId);

        yield* db.insert(organization).values([
          {
            createdAt: now,
            id: orgId,
            name: "Access Org",
            slug: uniqueId("access-org-slug"),
            workosOrganizationId: workosOrgId,
          },
          {
            createdAt: now,
            id: otherOrgId,
            name: "Other Org",
            slug: uniqueId("access-other-org-slug"),
            workosOrganizationId: uniqueWorkosId("access-other-org"),
          },
        ]);
        track.org(orgId);
        track.org(otherOrgId);

        // Membership only in `orgId`, not in `otherOrgId`.
        yield* db.insert(member).values({
          createdAt: now,
          id: uniqueId("access-member"),
          organizationId: orgId,
          role: "owner",
          userId,
          workosMembershipId: uniqueWorkosId("access-member"),
        });

        yield* db.insert(projects).values([
          { id: projectAId, name: "Proj A", organizationId: orgId, slug: uniqueId("proj-a") },
          { id: projectBId, name: "Proj B", organizationId: orgId, slug: uniqueId("proj-b") },
          {
            id: otherProjectId,
            name: "Other Proj",
            organizationId: otherOrgId,
            slug: uniqueId("other-proj"),
          },
        ]);
        track.project(projectAId);
        track.project(projectBId);
        track.project(otherProjectId);

        const access = yield* service.loadUserAccess(userId);

        const org = access.organizations.find((o) => o.id === orgId);
        expect(org).toBeDefined();
        expect(org?.workosOrganizationId).toBe(workosOrgId);
        expect(org?.permissions).toContain("organization:all");
        expect(access.organizations.some((o) => o.id === otherOrgId)).toBe(false);

        // Only projects under the member's org are returned.
        expect(access.projects.some((p) => p.id === projectAId)).toBe(true);
        expect(access.projects.some((p) => p.id === projectBId)).toBe(true);
        expect(access.projects.some((p) => p.id === otherProjectId)).toBe(false);
        const projA = access.projects.find((p) => p.id === projectAId);
        expect(projA?.organizationId).toBe(orgId);
        expect(projA?.permissions).toContain("project:all");
      }),
    ).pipe(Effect.provide(LocalUserSessionService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "returns empty organizations and projects for a user with no memberships",
    withUserCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* LocalUserSessionService;
        const db = yield* Db;

        const userId = uniqueId("no-access-user");
        const now = new Date();
        yield* db.insert(user).values({
          createdAt: now,
          email: uniqueEmail("no-access-user"),
          emailVerified: true,
          id: userId,
          name: "No Access",
          updatedAt: now,
          workosUserId: uniqueWorkosId("no-access-user"),
        });
        track.user(userId);

        const access = yield* service.loadUserAccess(userId);
        expect(access.organizations).toEqual([]);
        expect(access.projects).toEqual([]);
      }),
    ).pipe(Effect.provide(LocalUserSessionService.layer), CoreAuthSession.authenticate()),
  );
});

describe("LocalUserSessionService.toUserSession", () => {
  test(
    "projects a DbUser plus access into a method='user' RPC session with all fields populated",
    Effect.gen(function* () {
      const service = yield* LocalUserSessionService;

      const now = new Date();
      const dbUser: DbUser = {
        banExpires: null,
        banReason: null,
        banned: false,
        createdAt: now,
        customImageUrl: null,
        email: "session@voidhash.test",
        emailVerified: true,
        id: "user_session_shape",
        image: "https://example.test/pic.png",
        name: "Session User",
        role: "admin",
        updatedAt: now,
        workosUserId: "it_workos_session",
      };
      const access: LocalUserAccess = {
        organizations: [
          {
            id: "org_x",
            logo: null,
            name: "Org X",
            permissions: ["organization:all"],
            slug: "org-x",
            workosOrganizationId: "it_workos_org_x",
          },
        ],
        projects: [
          {
            id: "proj_x",
            logo: null,
            name: "Proj X",
            organizationId: "org_x",
            permissions: ["project:all"],
            slug: "proj-x",
          },
        ],
      };

      const session = service.toUserSession(dbUser, access, "cookie-value", dbUser.workosUserId);

      expect(session.method).toBe("user");
      expect(session.cookie).toBe("cookie-value");
      expect(session.person).toBeNull();
      expect(session.name).toBe("Session User <session@voidhash.test>");
      expect(session.organizations).toBe(access.organizations);
      expect(session.projects).toBe(access.projects);
      expect(session.user.id).toBe("user_session_shape");
      expect(session.user.email).toBe("session@voidhash.test");
      expect(session.user.emailVerified).toBe(true);
      expect(session.user.image).toBe("https://example.test/pic.png");
      expect(session.user.name).toBe("Session User");
      expect(session.user.role).toBe("admin");
      expect(session.user.workosUserId).toBe("it_workos_session");
      expect(session.user.createdAt).toBe(now);
      expect(session.user.updatedAt).toBe(now);
    }).pipe(Effect.provide(LocalUserSessionService.layer), CoreAuthSession.authenticate()),
  );
});

describe("LocalUserSessionService.getLocalUser", () => {
  test(
    "retrieves a user by id and returns undefined for an unknown id",
    withUserCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* LocalUserSessionService;
        const db = yield* Db;

        const id = uniqueId("get");
        const email = uniqueEmail("get");
        const now = new Date();
        yield* db.insert(user).values({
          createdAt: now,
          email,
          emailVerified: true,
          id,
          name: "Lookup User",
          updatedAt: now,
          workosUserId: uniqueWorkosId("get"),
        });
        track.user(id);

        const found = yield* service.getLocalUser(id);
        expect(found?.id).toBe(id);
        expect(found?.email).toBe(email);

        const missing = yield* service.getLocalUser(`user_missing_${nonce()}`);
        expect(missing).toBeUndefined();
      }),
    ).pipe(Effect.provide(LocalUserSessionService.layer), CoreAuthSession.authenticate()),
  );
});
