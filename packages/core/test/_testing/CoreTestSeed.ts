import {
  Db,
  auditLogs,
  eq,
  inArray,
  member,
  organization,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  paywallLocations,
  perks,
  productPerks,
  products,
  projects,
  user,
} from "@voidhash/db";
import { DateTime, Effect } from "effect";

import { CoreTestFixture } from "./CoreTestFixture";

/**
 * Upsert the shared fixture container (user → organization → membership →
 * project) once-if-absent. Idempotent via `ON DUPLICATE KEY UPDATE`, so the
 * rows are reused across runs and concurrent local runs never collide. Run once
 * from `globalSetup`; requires {@link Db}.
 */
const NO_IDS: ReadonlyArray<string> = [];

export const seedFixture = Effect.gen(function* () {
  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;

  yield* db
    .insert(user)
    .values({
      createdAt: now,
      email: CoreTestFixture.userEmail,
      emailVerified: true,
      id: CoreTestFixture.userId,
      name: CoreTestFixture.userName,
      updatedAt: now,
      workosUserId: CoreTestFixture.workosUserId,
    })
    // Heal the full canonical row on reuse: a prior run's test could have
    // updated this shared user (e.g. matched it by the unique email and
    // overwritten name/workosUserId), and integration tests assert against
    // these exact values. Resetting them keeps every run deterministic.
    .onConflictDoUpdate({
      target: user.id,
      set: {
        email: CoreTestFixture.userEmail,
        emailVerified: true,
        name: CoreTestFixture.userName,
        workosUserId: CoreTestFixture.workosUserId,
      },
    });

  yield* db
    .insert(organization)
    .values({
      createdAt: now,
      id: CoreTestFixture.organizationId,
      name: CoreTestFixture.organizationName,
      slug: CoreTestFixture.organizationSlug,
      workosOrganizationId: CoreTestFixture.workosOrganizationId,
    })
    .onConflictDoUpdate({
      target: organization.id,
      set: { name: CoreTestFixture.organizationName },
    });

  yield* db
    .insert(member)
    .values({
      createdAt: now,
      id: CoreTestFixture.memberId,
      organizationId: CoreTestFixture.organizationId,
      role: "owner",
      userId: CoreTestFixture.userId,
      workosMembershipId: CoreTestFixture.workosMembershipId,
    })
    .onConflictDoUpdate({ target: member.id, set: { role: "owner" } });

  yield* db
    .insert(projects)
    .values({
      id: CoreTestFixture.projectId,
      name: CoreTestFixture.projectName,
      organizationId: CoreTestFixture.organizationId,
      slug: CoreTestFixture.projectSlug,
    })
    .onConflictDoUpdate({ target: projects.id, set: { name: CoreTestFixture.projectName } });
});

/**
 * Best-effort sweep of the entities tests create under the fixture project,
 * deepest foreign-key dependents first. The container (user/org/member/project)
 * is intentionally retained so it is reused next run. Each delete is wrapped in
 * `Effect.ignore` so a missing table / FK quirk never aborts the whole sweep.
 * Run once from `globalSetup` teardown; requires {@link Db}.
 */
export const cleanupFixture = Effect.gen(function* () {
  const db = yield* Db;
  const projectId = CoreTestFixture.projectId;

  const ids = (rows: ReadonlyArray<{ readonly id: string }>) => rows.map((row) => row.id);
  const productIds = yield* db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.projectId, projectId))
    .pipe(
      Effect.map(ids),
      Effect.catch(() => Effect.succeed(NO_IDS)),
    );
  const perkIds = yield* db
    .select({ id: perks.id })
    .from(perks)
    .where(eq(perks.projectId, projectId))
    .pipe(
      Effect.map(ids),
      Effect.catch(() => Effect.succeed(NO_IDS)),
    );

  if (productIds.length > 0) {
    yield* db
      .delete(paymentProviderConfigurationProducts)
      .where(inArray(paymentProviderConfigurationProducts.productId, productIds))
      .pipe(Effect.ignore);
  }
  if (perkIds.length > 0) {
    yield* db.delete(productPerks).where(inArray(productPerks.perkId, perkIds)).pipe(Effect.ignore);
  }

  yield* db.delete(auditLogs).where(eq(auditLogs.projectId, projectId)).pipe(Effect.ignore);
  yield* db
    .delete(paywallLocations)
    .where(eq(paywallLocations.projectId, projectId))
    .pipe(Effect.ignore);
  yield* db
    .delete(paymentProviderConfigurations)
    .where(eq(paymentProviderConfigurations.projectId, projectId))
    .pipe(Effect.ignore);
  yield* db.delete(products).where(eq(products.projectId, projectId)).pipe(Effect.ignore);
  yield* db.delete(perks).where(eq(perks.projectId, projectId)).pipe(Effect.ignore);
});
