import {
  apiKeys,
  apikey,
  auditLogs,
  captureProjectPolicies,
  Db,
  eq,
  featureFlagOverrides,
  featureFlags,
  featureFlagTargets,
  featureFlagVariants,
  inArray,
  invitation,
  member,
  organization,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  paywallLocationShowings,
  paywallLocations,
  paywallReleases,
  paywalls,
  perks,
  personDeletionRequests,
  personExternalIdentifiers,
  personIdentities,
  personIdentityMigrationJobs,
  personPersonlessIdentities,
  persons,
  personUnlockedPerks,
  productPerks,
  products,
  projects,
  user,
  webhookDeliveries,
  webhookDeliveryAttempts,
  webhookEndpoints,
} from "@voidhash/db";
import * as Effect from "effect/Effect";

import { makeSmokeIds } from "./smoke-ids.ts";

/**
 * Deterministic fixture for the backend RPC smoke. Seeds an `admin`-role user, a
 * normal user, their organization/memberships, a project, and a seeded API key
 * — everything the {@link rpcSmokeCases} manifest reads or scopes
 * against. Kept separate from the lean shared `CoreTestFixture` because the smoke
 * needs a richer, smoke-specific tenant; it still rides the same once-deployed
 * stack + `testConnections` as the service-level integration tests.
 *
 * Previously these ran inside the deployed test worker behind `/__test/seed` and
 * `/__test/reset` HTTP routes; the smoke now runs in-process, so they are plain
 * Effects executed against `Db.layer(testConnections.db)` in a `beforeAll`.
 */

const deleteIfAny = <T, A, E, R>(
  values: ReadonlyArray<T>,
  run: (values: [T, ...T[]]) => Effect.Effect<A, E, R>,
): Effect.Effect<A | void, E, R> =>
  values.length === 0 ? Effect.void : run(values as [T, ...T[]]);

const selectIds = <T extends { id: string | null }, E, R>(
  rows: Effect.Effect<ReadonlyArray<T>, E, R>,
): Effect.Effect<string[], E, R> =>
  Effect.map(rows, (resolved) => resolved.flatMap((row) => (row.id ? [row.id] : [])));

/**
 * Delete every row the smoke fixture (and the cases that build on it) creates,
 * deepest foreign-key dependents first, scoped to the run's namespaced ids. Safe
 * to run before each seed so a crashed run never leaves colliding state.
 */
export const resetSmokeData = (runId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const ids = makeSmokeIds(runId);

    const productIds = yield* selectIds(
      db.select({ id: products.id }).from(products).where(eq(products.projectId, ids.projectId)),
    );
    const perkIds = yield* selectIds(
      db.select({ id: perks.id }).from(perks).where(eq(perks.projectId, ids.projectId)),
    );
    const paymentProviderConfigurationIds = yield* selectIds(
      db
        .select({ id: paymentProviderConfigurations.id })
        .from(paymentProviderConfigurations)
        .where(eq(paymentProviderConfigurations.projectId, ids.projectId)),
    );
    const paywallIds = yield* selectIds(
      db.select({ id: paywalls.id }).from(paywalls).where(eq(paywalls.projectId, ids.projectId)),
    );
    const featureFlagIds = yield* selectIds(
      db
        .select({ id: featureFlags.id })
        .from(featureFlags)
        .where(eq(featureFlags.projectId, ids.projectId)),
    );
    const personIds = yield* selectIds(
      db.select({ id: persons.id }).from(persons).where(eq(persons.projectId, ids.projectId)),
    );
    const webhookDeliveryIds = yield* selectIds(
      db
        .select({ id: webhookDeliveries.id })
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.projectId, ids.projectId)),
    );

    yield* deleteIfAny(webhookDeliveryIds, (values) =>
      db
        .delete(webhookDeliveryAttempts)
        .where(inArray(webhookDeliveryAttempts.webhookDeliveryId, values)),
    );
    yield* db.delete(webhookDeliveries).where(eq(webhookDeliveries.projectId, ids.projectId));
    yield* db.delete(webhookEndpoints).where(eq(webhookEndpoints.projectId, ids.projectId));

    yield* db
      .delete(paywallLocationShowings)
      .where(eq(paywallLocationShowings.projectId, ids.projectId));
    yield* db.delete(paywallLocations).where(eq(paywallLocations.projectId, ids.projectId));
    yield* deleteIfAny(paywallIds, (values) =>
      db.delete(paywallReleases).where(inArray(paywallReleases.paywallId, values)),
    );
    yield* db.delete(paywalls).where(eq(paywalls.projectId, ids.projectId));

    yield* deleteIfAny(productIds, (values) =>
      db.delete(productPerks).where(inArray(productPerks.productId, values)),
    );
    yield* deleteIfAny(perkIds, (values) =>
      db.delete(productPerks).where(inArray(productPerks.perkId, values)),
    );
    yield* deleteIfAny(productIds, (values) =>
      db
        .delete(paymentProviderConfigurationProducts)
        .where(inArray(paymentProviderConfigurationProducts.productId, values)),
    );
    yield* deleteIfAny(paymentProviderConfigurationIds, (values) =>
      db
        .delete(paymentProviderConfigurationProducts)
        .where(
          inArray(paymentProviderConfigurationProducts.paymentProviderConfigurationId, values),
        ),
    );
    yield* db
      .delete(paymentProviderConfigurations)
      .where(eq(paymentProviderConfigurations.projectId, ids.projectId));
    yield* db.delete(products).where(eq(products.projectId, ids.projectId));
    yield* db.delete(perks).where(eq(perks.projectId, ids.projectId));

    yield* deleteIfAny(featureFlagIds, (values) =>
      db.delete(featureFlagVariants).where(inArray(featureFlagVariants.featureFlagId, values)),
    );
    yield* deleteIfAny(featureFlagIds, (values) =>
      db.delete(featureFlagTargets).where(inArray(featureFlagTargets.featureFlagId, values)),
    );
    yield* deleteIfAny(featureFlagIds, (values) =>
      db.delete(featureFlagOverrides).where(inArray(featureFlagOverrides.featureFlagId, values)),
    );
    yield* db.delete(featureFlags).where(eq(featureFlags.projectId, ids.projectId));

    yield* db
      .delete(personExternalIdentifiers)
      .where(eq(personExternalIdentifiers.projectId, ids.projectId));
    yield* db
      .delete(personIdentityMigrationJobs)
      .where(eq(personIdentityMigrationJobs.projectId, ids.projectId));
    yield* db
      .delete(personPersonlessIdentities)
      .where(eq(personPersonlessIdentities.projectId, ids.projectId));
    yield* db
      .delete(personDeletionRequests)
      .where(eq(personDeletionRequests.projectId, ids.projectId));
    yield* deleteIfAny(personIds, (values) =>
      db.delete(personUnlockedPerks).where(inArray(personUnlockedPerks.personId, values)),
    );
    yield* db.delete(personIdentities).where(eq(personIdentities.projectId, ids.projectId));
    yield* db.delete(persons).where(eq(persons.projectId, ids.projectId));

    yield* db.delete(apiKeys).where(eq(apiKeys.projectId, ids.projectId));
    yield* db.delete(auditLogs).where(eq(auditLogs.projectId, ids.projectId));
    yield* db
      .delete(captureProjectPolicies)
      .where(eq(captureProjectPolicies.projectId, ids.projectId));
    yield* db.delete(projects).where(eq(projects.id, ids.projectId));

    yield* db.delete(invitation).where(eq(invitation.organizationId, ids.organizationId));
    yield* db.delete(member).where(eq(member.organizationId, ids.organizationId));
    yield* db.delete(organization).where(eq(organization.id, ids.organizationId));

    yield* db
      .delete(apikey)
      .where(inArray(apikey.userId, [ids.adminUserId, ids.normalUserId, ids.invitedUserId]));
    yield* db
      .delete(user)
      .where(inArray(user.id, [ids.adminUserId, ids.normalUserId, ids.invitedUserId]));
  });

/**
 * Reset, then seed the smoke fixture. Run once before the smoke cases over
 * `Db.layer(testConnections.db)`.
 */
export const seedSmokeData = (runId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const ids = makeSmokeIds(runId);
    const now = new Date();

    yield* resetSmokeData(runId);
    yield* db.insert(user).values([
      {
        banned: false,
        banExpires: null,
        banReason: null,
        createdAt: now,
        email: ids.adminEmail,
        emailVerified: true,
        id: ids.adminUserId,
        image: null,
        name: "RPC Smoke Admin",
        role: "admin",
        updatedAt: now,
        workosUserId: ids.workosAdminUserId,
      },
      {
        banned: false,
        banExpires: null,
        banReason: null,
        createdAt: now,
        email: ids.normalEmail,
        emailVerified: true,
        id: ids.normalUserId,
        image: null,
        name: "RPC Smoke User",
        role: null,
        updatedAt: now,
        workosUserId: ids.workosNormalUserId,
      },
    ]);
    yield* db.insert(organization).values({
      createdAt: now,
      id: ids.organizationId,
      logo: null,
      metadata: null,
      name: "RPC Smoke Organization",
      slug: ids.organizationSlug,
      workosOrganizationId: ids.workosOrganizationId,
    });
    yield* db.insert(member).values([
      {
        createdAt: now,
        id: ids.adminMemberId,
        organizationId: ids.organizationId,
        role: "owner",
        userId: ids.adminUserId,
        workosMembershipId: ids.workosAdminMembershipId,
      },
      {
        createdAt: now,
        id: ids.normalMemberId,
        organizationId: ids.organizationId,
        role: "member",
        userId: ids.normalUserId,
        workosMembershipId: ids.workosNormalMembershipId,
      },
    ]);
    yield* db.insert(projects).values({
      createdAt: now,
      createdByUserId: ids.adminUserId,
      id: ids.projectId,
      name: "RPC Smoke Project",
      organizationId: ids.organizationId,
      slug: ids.projectSlug,
      updatedAt: now,
    });
    yield* db.insert(captureProjectPolicies).values({
      createdAt: now,
      projectId: ids.projectId,
      updatedAt: now,
    });
    yield* db.insert(apiKeys).values({
      createdAt: now,
      end: "test",
      id: ids.apiKeyId,
      isPublic: false,
      key: "seeded-smoke-key",
      name: "Seeded smoke secret",
      prefix: "smk",
      projectId: ids.projectId,
      updatedAt: now,
    });
  });
