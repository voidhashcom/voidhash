import { DateTime } from "effect";

import { PurchaseType, SubscriptionStatus } from "@voidhash/lib";

import {
  type Person as DbPerson,
  type PersonIdentity as DbPersonIdentity,
  type PersonUnlockedPerk as DbPersonUnlockedPerk,
  type Purchase as DbPurchase,
  type Subscription as DbSubscription,
  type PaymentProviderConfigurationProduct as DbPaymentProviderConfigurationProduct,
  PersonIdentityKind,
  PersonIdentityMigrationJobStatus,
  PersonUnlockedPerkStatus,
} from "@voidhash/db";
import {
  SdkPersonSnapshot,
  SdkPersonSnapshotContext,
  SdkPersonSnapshotCurrentSubscription,
  type SdkPersonSnapshotGrantSource,
  type SdkPersonSnapshotGrantStatus,
  SdkPersonSnapshotGrant,
  type SdkPersonSnapshotMode,
  SdkPersonSnapshotPurchaseHistory,
  type SdkPersonSnapshotPurchaseType,
  SdkPersonSnapshotPurchases,
  SdkPersonSnapshotSubscriptionHistory,
  SdkPersonSnapshotSubscriptions,
  SdkPersonSnapshotEntitlements,
  type SdkSubscriptionCurrentStatus,
  type SdkSubscriptionHistoryStatus,
} from "../../domain/sdkPerson/SdkPerson.ts";
import type { PersonIdentityResult } from "../personIdentity/PersonIdentityService.ts";

export type SubscriptionWithProduct = DbSubscription & {
  readonly paymentProviderConfigurationProduct: DbPaymentProviderConfigurationProduct | null;
};

/**
 * Subset of `personIdentityMigrationJobs` used by the scope decider. The full
 * row carries event blobs and timestamps the decider does not need.
 */
export interface SnapshotMigrationJobRow {
  readonly id: string;
  readonly previousDistinctId: string;
  readonly distinctId: string;
  readonly targetPersonId: string;
  readonly status: number;
  readonly projectId: string;
}

export interface TemporaryCanonicalScope {
  readonly canonicalPersonId: string;
  readonly includedPersonIds: ReadonlyArray<string>;
  readonly sourcePersonId: string | null;
  readonly migrationJobId: string | null;
  readonly mode: SdkPersonSnapshotMode;
}

const CONFLICTING_IDENTIFIED_WARNING_FRAGMENT = "different identified person";

/**
 * Migration job statuses that signal the source resources have NOT yet been
 * durably re-parented onto the target person — the SDK keeps merging until
 * the job is `Succeeded` or otherwise resolved.
 */
export const ACTIVE_MIGRATION_STATUSES: ReadonlyArray<number> = [
  PersonIdentityMigrationJobStatus.Pending,
  PersonIdentityMigrationJobStatus.InProgress,
  PersonIdentityMigrationJobStatus.Failed,
];

const isConflictingIdentifiedWarning = (warnings: ReadonlyArray<string>) =>
  warnings.some((warning) => warning.includes(CONFLICTING_IDENTIFIED_WARNING_FRAGMENT));

const targetOnlyScope = (
  personId: string,
  migrationJobId: string | null = null,
): TemporaryCanonicalScope => ({
  canonicalPersonId: personId,
  includedPersonIds: [personId],
  migrationJobId,
  mode: "persisted",
  sourcePersonId: null,
});

export interface DecideSnapshotScopeInput {
  readonly distinctId: string;
  readonly personId: string;
  readonly previousDistinctId?: string;
  readonly identityResult?: PersonIdentityResult;
  readonly sourceMapping?: DbPersonIdentity;
  readonly activeJob?: SnapshotMigrationJobRow;
}

/**
 * Pure decision: given the inputs the orchestrator has already fetched,
 * which persons should appear in the snapshot and what mode should it be
 * tagged with?
 */
export const decideSnapshotScope = (input: DecideSnapshotScopeInput): TemporaryCanonicalScope => {
  if (input.identityResult) {
    return decideFromIdentityResult(input);
  }
  return decideFromMigrationJob(input);
};

const decideFromIdentityResult = (input: DecideSnapshotScopeInput): TemporaryCanonicalScope => {
  const identityResult = input.identityResult!;
  const target = targetOnlyScope(input.personId);

  if (isConflictingIdentifiedWarning(identityResult.warnings)) {
    return target;
  }

  const previousDistinctId = input.previousDistinctId;
  if (!previousDistinctId || previousDistinctId === input.distinctId) {
    return target;
  }

  if (!input.sourceMapping || input.sourceMapping.personId === input.personId) {
    return target;
  }

  if (input.sourceMapping.kind === PersonIdentityKind.Identified) {
    return target;
  }

  return {
    canonicalPersonId: input.personId,
    includedPersonIds: [input.personId, input.sourceMapping.personId],
    migrationJobId: input.activeJob?.id ?? null,
    mode: "temporary_pending_transfer",
    sourcePersonId: input.sourceMapping.personId,
  };
};

const decideFromMigrationJob = (input: DecideSnapshotScopeInput): TemporaryCanonicalScope => {
  if (!input.activeJob) {
    return targetOnlyScope(input.personId);
  }

  if (!input.sourceMapping || input.sourceMapping.personId === input.personId) {
    return targetOnlyScope(input.personId, input.activeJob.id);
  }

  return {
    canonicalPersonId: input.personId,
    includedPersonIds: [input.personId, input.sourceMapping.personId],
    migrationJobId: input.activeJob.id,
    mode: "temporary_pending_transfer",
    sourcePersonId: input.sourceMapping.personId,
  };
};

/** Unix epoch, used as the stable fallback for rows without a `createdAt`. */
const EPOCH = DateTime.toDateUtc(DateTime.makeUnsafe(0));

/**
 * Collapses a history status into the narrower "current subscription" status —
 * an expired subscription is reported as no current subscription at all.
 */
const toCurrentStatus = (status: SdkSubscriptionHistoryStatus): SdkSubscriptionCurrentStatus => {
  if (status === "expired") {
    return "none";
  }
  return status;
};

/** Which purchase artefact unlocked a perk grant, if any. */
const grantSource = (perk: {
  readonly unlockedBySubscriptionId: string | null;
  readonly unlockedByPurchaseId: string | null;
}): SdkPersonSnapshotGrantSource => {
  if (perk.unlockedBySubscriptionId) {
    return "subscription";
  }
  if (perk.unlockedByPurchaseId) {
    return "purchase";
  }
  return "manual";
};

export const mapSubscriptionStatus = (
  subscription: DbSubscription,
  now: Date,
): SdkSubscriptionHistoryStatus => {
  if (subscription.status === SubscriptionStatus.Canceled) {
    return "canceled";
  }
  if (subscription.expiresAt && subscription.expiresAt.getTime() < now.getTime()) {
    return "expired";
  }
  if (subscription.isTrial) {
    return "trialing";
  }
  return "active";
};

const SUBSCRIPTION_RANK_ORDER: Record<SdkSubscriptionHistoryStatus, number> = {
  active: 0,
  trialing: 1,
  past_due: 2,
  canceled: 3,
  expired: 4,
};

export const compareSubscriptionsForCurrent = (
  left: DbSubscription,
  right: DbSubscription,
  now: Date,
): number => {
  const leftStatus = mapSubscriptionStatus(left, now);
  const rightStatus = mapSubscriptionStatus(right, now);
  if (leftStatus !== rightStatus) {
    return SUBSCRIPTION_RANK_ORDER[leftStatus] - SUBSCRIPTION_RANK_ORDER[rightStatus];
  }
  const leftExpires = left.expiresAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  const rightExpires = right.expiresAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  if (leftExpires !== rightExpires) {
    return rightExpires - leftExpires;
  }
  const leftStarts = left.startsAt?.getTime() ?? 0;
  const rightStarts = right.startsAt?.getTime() ?? 0;
  if (leftStarts !== rightStarts) {
    return rightStarts - leftStarts;
  }
  const leftUpdated = left.updatedAt?.getTime() ?? 0;
  const rightUpdated = right.updatedAt?.getTime() ?? 0;
  return rightUpdated - leftUpdated;
};

export const selectCurrentSubscription = (
  candidates: ReadonlyArray<SubscriptionWithProduct>,
  now: Date,
): SdkPersonSnapshotCurrentSubscription | null => {
  const eligible = candidates.filter((subscription) => {
    const status = mapSubscriptionStatus(subscription, now);
    return status !== "expired";
  });
  if (eligible.length === 0) {
    return null;
  }

  const sorted = [...eligible].sort((left, right) =>
    compareSubscriptionsForCurrent(left, right, now),
  );
  const best = sorted[0];
  if (!best) {
    return null;
  }

  const status = mapSubscriptionStatus(best, now);
  const currentStatus = toCurrentStatus(status);

  return new SdkPersonSnapshotCurrentSubscription({
    expiresAt: best.expiresAt ?? null,
    productId: best.paymentProviderConfigurationProduct?.productId ?? null,
    status: currentStatus,
    subscriptionId: best.id,
  });
};

export const mapSubscriptionHistory = (
  subscription: SubscriptionWithProduct,
  now: Date,
): SdkPersonSnapshotSubscriptionHistory =>
  new SdkPersonSnapshotSubscriptionHistory({
    canceledAt: subscription.canceledAt ?? null,
    expiresAt: subscription.expiresAt ?? null,
    isTrial: subscription.isTrial,
    productId: subscription.paymentProviderConfigurationProduct?.productId ?? null,
    sourcePersonId: subscription.personId,
    startsAt: subscription.startsAt,
    status: mapSubscriptionStatus(subscription, now),
    subscriptionId: subscription.id,
  });

export const mapPurchaseType = (purchase: DbPurchase): SdkPersonSnapshotPurchaseType => {
  if (purchase.type === PurchaseType.OneTime || purchase.type === PurchaseType.OneTimeConsumable) {
    return "one_time";
  }
  return "subscription";
};

export const mapPurchaseHistory = (
  purchase: DbPurchase,
  productIdLookup: ReadonlyMap<string, string>,
): SdkPersonSnapshotPurchaseHistory =>
  new SdkPersonSnapshotPurchaseHistory({
    createdAt: purchase.createdAt ?? EPOCH,
    productId: productIdLookup.get(purchase.paymentProviderConfigurationProductId) ?? null,
    providerKey: purchase.providerKey,
    purchaseId: purchase.id,
    sourcePersonId: purchase.personId,
    type: mapPurchaseType(purchase),
  });

/** Whether a stored grant is still active. */
const grantStatus = (status: number): SdkPersonSnapshotGrantStatus => {
  if (status === PersonUnlockedPerkStatus.Active) {
    return "active";
  }
  return "expired";
};

export const mapGrant = (perk: DbPersonUnlockedPerk): SdkPersonSnapshotGrant => {
  const source = grantSource(perk);
  const sourceId = perk.unlockedBySubscriptionId ?? perk.unlockedByPurchaseId ?? null;
  const status = grantStatus(perk.status);

  return new SdkPersonSnapshotGrant({
    expiresAt: perk.expiresAt ?? null,
    perkId: perk.perkId,
    source,
    sourceId,
    sourcePersonId: perk.personId,
    status,
  });
};

export const dedupeSubscriptions = (
  rows: ReadonlyArray<SubscriptionWithProduct>,
): ReadonlyArray<SubscriptionWithProduct> => {
  const byId = new Map<string, SubscriptionWithProduct>();
  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  }
  const byStoreId = new Map<string, SubscriptionWithProduct>();
  for (const row of byId.values()) {
    const existing = byStoreId.get(row.storeSubscriptionId);
    if (!existing) {
      byStoreId.set(row.storeSubscriptionId, row);
      continue;
    }
    const existingUpdated = existing.updatedAt?.getTime() ?? 0;
    const candidateUpdated = row.updatedAt?.getTime() ?? 0;
    if (candidateUpdated > existingUpdated) {
      byStoreId.set(row.storeSubscriptionId, row);
    }
  }
  return [...byStoreId.values()];
};

export const dedupePurchases = (rows: ReadonlyArray<DbPurchase>): ReadonlyArray<DbPurchase> => {
  const byId = new Map<string, DbPurchase>();
  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  }
  const byProviderKey = new Map<string, DbPurchase>();
  for (const row of byId.values()) {
    const existing = byProviderKey.get(row.providerKey);
    if (!existing) {
      byProviderKey.set(row.providerKey, row);
      continue;
    }
    const existingCreated = existing.createdAt?.getTime() ?? 0;
    const candidateCreated = row.createdAt?.getTime() ?? 0;
    if (candidateCreated > existingCreated) {
      byProviderKey.set(row.providerKey, row);
    }
  }
  return [...byProviderKey.values()];
};

export const dedupeGrants = (
  rows: ReadonlyArray<DbPersonUnlockedPerk>,
): ReadonlyArray<DbPersonUnlockedPerk> => {
  const buildKey = (row: DbPersonUnlockedPerk) => {
    const source = grantSource(row);
    const sourceId = row.unlockedBySubscriptionId ?? row.unlockedByPurchaseId ?? "";
    return `${row.perkId}:${source}:${sourceId}`;
  };

  const byKey = new Map<string, DbPersonUnlockedPerk>();
  for (const row of rows) {
    const key = buildKey(row);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const existingActive = existing.status === PersonUnlockedPerkStatus.Active;
    const candidateActive = row.status === PersonUnlockedPerkStatus.Active;
    if (!existingActive && candidateActive) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
};

export const sortSubscriptionHistory = (
  history: ReadonlyArray<SdkPersonSnapshotSubscriptionHistory>,
): ReadonlyArray<SdkPersonSnapshotSubscriptionHistory> =>
  [...history].sort((left, right) => {
    const leftStarts = left.startsAt.getTime();
    const rightStarts = right.startsAt.getTime();
    if (leftStarts !== rightStarts) {
      return rightStarts - leftStarts;
    }
    const leftExpires = left.expiresAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const rightExpires = right.expiresAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    return rightExpires - leftExpires;
  });

export const sortPurchaseHistory = (
  history: ReadonlyArray<SdkPersonSnapshotPurchaseHistory>,
): ReadonlyArray<SdkPersonSnapshotPurchaseHistory> =>
  [...history].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

export const sortGrants = (
  grants: ReadonlyArray<SdkPersonSnapshotGrant>,
): ReadonlyArray<SdkPersonSnapshotGrant> =>
  [...grants].sort((left, right) => {
    if (left.status !== right.status) {
      if (left.status === "active") {
        return -1;
      }
      return 1;
    }
    const leftExpires = left.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightExpires = right.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (leftExpires !== rightExpires) {
      return leftExpires - rightExpires;
    }
    return left.perkId.localeCompare(right.perkId);
  });

/**
 * Profile (`email` + `name`) for the snapshot. When the orchestrator was
 * given an `identityResult` for the target person, that event is the freshest
 * data — we prefer its `email`/`name` over the persisted person row, which
 * may not yet reflect a just-applied identify.
 */
export const resolveProfile = ({
  identityResult,
  targetPerson,
}: {
  readonly identityResult?: PersonIdentityResult;
  readonly targetPerson: DbPerson;
}): { readonly email: string | null; readonly name: string | null } => {
  const targetEvent = identityResult?.personEvents.find(
    (event) => event.personId === targetPerson.id,
  );
  const email = targetEvent?.email ?? targetPerson.email ?? null;
  const name = targetEvent?.name ?? targetPerson.name ?? null;
  return { email, name };
};

export interface ComposeSnapshotInput {
  readonly distinctId: string;
  readonly personId: string;
  readonly scope: TemporaryCanonicalScope;
  readonly targetPerson: DbPerson;
  readonly subscriptions: ReadonlyArray<SubscriptionWithProduct>;
  readonly purchases: ReadonlyArray<DbPurchase>;
  readonly grants: ReadonlyArray<DbPersonUnlockedPerk>;
  readonly purchaseProductIdLookup: ReadonlyMap<string, string>;
  readonly identityResult?: PersonIdentityResult;
  readonly now: Date;
}

/**
 * Pure assembly: dedupe → map → sort → wrap. The orchestrator calls this
 * after fetching every input; the result is the public `SdkPersonSnapshot`.
 */
export const composeSnapshot = (input: ComposeSnapshotInput): SdkPersonSnapshot => {
  const dedupedSubscriptions = dedupeSubscriptions(input.subscriptions);
  const dedupedPurchases = dedupePurchases(input.purchases);
  const dedupedGrants = dedupeGrants(input.grants);

  const subscriptionHistory = sortSubscriptionHistory(
    dedupedSubscriptions.map((subscription) => mapSubscriptionHistory(subscription, input.now)),
  );
  const purchaseHistory = sortPurchaseHistory(
    dedupedPurchases.map((purchase) => mapPurchaseHistory(purchase, input.purchaseProductIdLookup)),
  );
  const grants = sortGrants(dedupedGrants.map((perk) => mapGrant(perk)));

  const currentSubscription = selectCurrentSubscription(dedupedSubscriptions, input.now);
  const profile = resolveProfile({
    identityResult: input.identityResult,
    targetPerson: input.targetPerson,
  });

  return new SdkPersonSnapshot({
    distinctId: input.distinctId,
    email: profile.email,
    entitlements: new SdkPersonSnapshotEntitlements({ grants }),
    name: profile.name,
    personId: input.personId,
    purchases: new SdkPersonSnapshotPurchases({ history: purchaseHistory }),
    snapshotContext: new SdkPersonSnapshotContext({
      includedPersonIds: input.scope.includedPersonIds,
      migrationJobId: input.scope.migrationJobId,
      mode: input.scope.mode,
    }),
    subscriptions: new SdkPersonSnapshotSubscriptions({
      current: currentSubscription,
      history: subscriptionHistory,
    }),
  });
};
