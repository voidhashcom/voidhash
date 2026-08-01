/**
 * The single, deterministic test container shared by every core integration
 * test (and reused across runs). Seeding upserts these rows once-if-absent so
 * all junk entities a test creates live under one org/project/user, and
 * {@link CoreAuthSession} builds its session from the same constants so
 * permission checks resolve against the seeded project.
 *
 * IDs are stable, human-readable, and prefixed `it_` so they are easy to spot
 * (and bulk-delete) in a shared database.
 */
export const CoreTestFixture = {
  userId: "it_user",
  userEmail: "integration@voidhash.test",
  userName: "Integration Test User",
  workosUserId: "it_workos_user",

  organizationId: "it_org",
  organizationName: "Integration Test Org",
  organizationSlug: "it-org",
  workosOrganizationId: "it_workos_org",

  memberId: "it_member",
  workosMembershipId: "it_workos_membership",

  projectId: "it_project",
  projectName: "Integration Test Project",
  projectSlug: "it-project",
} as const;
