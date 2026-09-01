import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import type * as Ordering from "effect/Ordering";

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
  ProviderEnvironment,
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
  readonly paymentProviderConfigurationProduct: Option.Option<DbPaymentProviderConfigurationProduct>;
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
  readonly sourcePersonId: Option.Option<string>;
  readonly migrationJobId: Option.Option<string>;
  readonly mode: SdkPersonSnapshotMode;
}

const CONFLICTING_IDENTIFIED_WARNING_FRAGMENT = "different identified person";

const normalizeOrdering = (value: number): Ordering.Ordering => {
  if (value < 0) return -1;
  if (value > 0) return 1;
  return 0;
};

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
  migrationJobId: Option.Option<string> = Option.none(),
): TemporaryCanonicalScope => ({
  canonicalPersonId: personId,
  includedPersonIds: [personId],
  migrationJobId,
  mode: "persisted",
  sourcePersonId: Option.none(),
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
  const identityResult = Option.getOrElse(
    Option.fromNullishOr(input.identityResult),
    () => ({ personEvents: [], warnings: [] }),
  );
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
    migrationJobId: Option.fromNullishOr(input.activeJob?.id),
    mode: "temporary_pending_transfer",
    sourcePersonId: Option.some(input.sourceMapping.personId),
  };
};

const decideFromMigrationJob = (input: DecideSnapshotScopeInput): TemporaryCanonicalScope => {
  if (!input.activeJob) {
    return targetOnlyScope(input.personId);
  }

  if (!input.sourceMapping || input.sourceMapping.personId === input.personId) {
    return targetOnlyScope(input.personId, Option.some(input.activeJob.id));
  }

  return {
    canonicalPersonId: input.personId,
    includedPersonIds: [input.personId, input.sourceMapping.personId],
    migrationJobId: Option.some(input.activeJob.id),
    mode: "temporary_pending_transfer",
    sourcePersonId: Option.some(input.sourceMapping.personId),
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
  readonly unlockedBySubscriptionId: Option.Option<string>;
  readonly unlockedByPurchaseId: Option.Option<string>;
}): SdkPersonSnapshotGrantSource => {
  if (Option.isSome(perk.unlockedBySubscriptionId)) {
    return "subscription";
  }
  if (Option.isSome(perk.unlockedByPurchaseId)) {
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
): Option.Option<SdkPersonSnapshotCurrentSubscription> => {
  const eligible = candidates.filter((subscription) => {
    const status = mapSubscriptionStatus(subscription, now);
    return status !== "expired";
  });
  if (Arr.isReadonlyArrayEmpty(eligible)) {
    return Option.none();
  }

  const sorted = Arr.sort(
    eligible,
    Order.make((left: SubscriptionWithProduct, right: SubscriptionWithProduct) =>
      normalizeOrdering(compareSubscriptionsForCurrent(left, right, now)),
    ),
  );
  const best = sorted[0];
  if (!best) {
    return Option.none();
  }

  const status = mapSubscriptionStatus(best, now);
  const currentStatus = toCurrentStatus(status);

  return Option.some(new SdkPersonSnapshotCurrentSubscription({
    expiresAt: best.expiresAt ?? null,
    productId: Option.getOrNull(
      Option.map(best.paymentProviderConfigurationProduct, (product) => product.productId),
    ),
    status: currentStatus,
    subscriptionId: best.id,
  }));
};

export const mapSubscriptionHistory = (
  subscription: SubscriptionWithProduct,
  now: Date,
): SdkPersonSnapshotSubscriptionHistory =>
  new SdkPersonSnapshotSubscriptionHistory({
    canceledAt: subscription.canceledAt ?? null,
    expiresAt: subscription.expiresAt ?? null,
    isTrial: subscription.isTrial,
    productId: Option.getOrNull(
      Option.map(subscription.paymentProviderConfigurationProduct, (product) => product.productId),
    ),
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
  productIdLookup: HashMap.HashMap<string, string>,
): SdkPersonSnapshotPurchaseHistory =>
  new SdkPersonSnapshotPurchaseHistory({
    createdAt: purchase.createdAt ?? EPOCH,
    productId: Option.getOrNull(
      HashMap.get(productIdLookup, purchase.paymentProviderConfigurationProductId),
    ),
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
  const unlockedBySubscriptionId = Option.fromNullishOr(perk.unlockedBySubscriptionId);
  const unlockedByPurchaseId = Option.fromNullishOr(perk.unlockedByPurchaseId);
  const source = grantSource({ unlockedByPurchaseId, unlockedBySubscriptionId });
  const sourceId = Option.orElse(unlockedBySubscriptionId, () => unlockedByPurchaseId);
  const status = grantStatus(perk.status);

  return new SdkPersonSnapshotGrant({
    expiresAt: perk.expiresAt ?? null,
    perkId: perk.perkId,
    source,
    sourceId: Option.getOrNull(sourceId),
    sourcePersonId: perk.personId,
    status,
  });
};

export const dedupeSubscriptions = (
  rows: ReadonlyArray<SubscriptionWithProduct>,
): ReadonlyArray<SubscriptionWithProduct> => {
  const byId = Arr.reduce(rows, HashMap.empty<string, SubscriptionWithProduct>(), (acc, row) =>
    HashMap.has(acc, row.id) ? acc : HashMap.set(acc, row.id, row),
  );
  const byStoreId = Arr.reduce(
    HashMap.values(byId),
    HashMap.empty<string, SubscriptionWithProduct>(),
    (acc, row) => {
      const existing = HashMap.get(acc, row.storeSubscriptionId);
      if (Option.isNone(existing)) {
        return HashMap.set(acc, row.storeSubscriptionId, row);
      }
      const existingUpdated = existing.value.updatedAt?.getTime() ?? 0;
      const candidateUpdated = row.updatedAt?.getTime() ?? 0;
      return candidateUpdated > existingUpdated
        ? HashMap.set(acc, row.storeSubscriptionId, row)
        : acc;
    },
  );
  return [...HashMap.values(byStoreId)];
};

export const dedupePurchases = (rows: ReadonlyArray<DbPurchase>): ReadonlyArray<DbPurchase> => {
  const byId = Arr.reduce(rows, HashMap.empty<string, DbPurchase>(), (acc, row) =>
    HashMap.has(acc, row.id) ? acc : HashMap.set(acc, row.id, row),
  );
  const byProviderKey = Arr.reduce(
    HashMap.values(byId),
    HashMap.empty<string, DbPurchase>(),
    (acc, row) => {
      const existing = HashMap.get(acc, row.providerKey);
      if (Option.isNone(existing)) {
        return HashMap.set(acc, row.providerKey, row);
      }
      const existingCreated = existing.value.createdAt?.getTime() ?? 0;
      const candidateCreated = row.createdAt?.getTime() ?? 0;
      return candidateCreated > existingCreated ? HashMap.set(acc, row.providerKey, row) : acc;
    },
  );
  return [...HashMap.values(byProviderKey)];
};

export const dedupeGrants = (
  rows: ReadonlyArray<DbPersonUnlockedPerk>,
): ReadonlyArray<DbPersonUnlockedPerk> => {
  const byKey = Arr.reduce(rows, HashMap.empty<string, DbPersonUnlockedPerk>(), (acc, row) => {
    const key = row.perkId;
    const existing = HashMap.get(acc, key);
    if (Option.isNone(existing)) {
      return HashMap.set(acc, key, row);
    }
    const existingActive = existing.value.status === PersonUnlockedPerkStatus.Active;
    const candidateActive = row.status === PersonUnlockedPerkStatus.Active;
    if (!existingActive && candidateActive) {
      return HashMap.set(acc, key, row);
    }
    if (
      existingActive === candidateActive &&
      (row.environment ?? ProviderEnvironment.Production) <
        (existing.value.environment ?? ProviderEnvironment.Production)
    ) {
      return HashMap.set(acc, key, row);
    }
    return acc;
  });
  return [...HashMap.values(byKey)];
};

export const sortSubscriptionHistory = (
  history: ReadonlyArray<SdkPersonSnapshotSubscriptionHistory>,
): ReadonlyArray<SdkPersonSnapshotSubscriptionHistory> =>
  Arr.sort(history, Order.make((left: SdkPersonSnapshotSubscriptionHistory, right: SdkPersonSnapshotSubscriptionHistory) => {
    const leftStarts = left.startsAt.getTime();
    const rightStarts = right.startsAt.getTime();
    if (leftStarts !== rightStarts) {
      return normalizeOrdering(rightStarts - leftStarts);
    }
    const leftExpires = left.expiresAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const rightExpires = right.expiresAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    return normalizeOrdering(rightExpires - leftExpires);
  }));

export const sortPurchaseHistory = (
  history: ReadonlyArray<SdkPersonSnapshotPurchaseHistory>,
): ReadonlyArray<SdkPersonSnapshotPurchaseHistory> =>
  Arr.sort(
    history,
    Order.make((left: SdkPersonSnapshotPurchaseHistory, right: SdkPersonSnapshotPurchaseHistory) =>
      normalizeOrdering(right.createdAt.getTime() - left.createdAt.getTime()),
    ),
  );

export const sortGrants = (
  grants: ReadonlyArray<SdkPersonSnapshotGrant>,
): ReadonlyArray<SdkPersonSnapshotGrant> =>
  Arr.sort(grants, Order.make((left: SdkPersonSnapshotGrant, right: SdkPersonSnapshotGrant) => {
    if (left.status !== right.status) {
      if (left.status === "active") {
        return -1;
      }
      return 1;
    }
    const leftExpires = left.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightExpires = right.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (leftExpires !== rightExpires) {
      return normalizeOrdering(leftExpires - rightExpires);
    }
    return normalizeOrdering(left.perkId.localeCompare(right.perkId));
  }));

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
}): { readonly email: Option.Option<string>; readonly name: Option.Option<string> } => {
  const targetEvent = identityResult?.personEvents.find(
    (event) => event.personId === targetPerson.id,
  );
  const email = Option.fromNullishOr(targetEvent?.email ?? targetPerson.email);
  const name = Option.fromNullishOr(targetEvent?.name ?? targetPerson.name);
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
  readonly purchaseProductIdLookup: HashMap.HashMap<string, string>;
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
    email: Option.getOrNull(profile.email),
    entitlements: new SdkPersonSnapshotEntitlements({ grants }),
    name: Option.getOrNull(profile.name),
    personId: input.personId,
    purchases: new SdkPersonSnapshotPurchases({ history: purchaseHistory }),
    snapshotContext: new SdkPersonSnapshotContext({
      includedPersonIds: input.scope.includedPersonIds,
      migrationJobId: Option.getOrNull(input.scope.migrationJobId),
      mode: input.scope.mode,
    }),
    subscriptions: new SdkPersonSnapshotSubscriptions({
      current: Option.getOrNull(currentSubscription),
      history: subscriptionHistory,
    }),
  });
};
