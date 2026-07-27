import { PurchaseType, SubscriptionStatus } from "@voidhash/lib";

import {
  type Person as DbPerson,
  type PersonIdentity as DbPersonIdentity,
  type PersonUnlockedPerk as DbPersonUnlockedPerk,
  type PaymentProviderConfigurationProduct as DbPaymentProviderConfigurationProduct,
  type Purchase as DbPurchase,
  PersonIdentityKind,
  PersonIdentityMigrationJobStatus,
  PersonUnlockedPerkStatus,
} from "@voidhash/db";
import { describe, expect, it } from "vite-plus/test";

import type { PersonIdentityResult } from "../../../src/services/personIdentity/PersonIdentityService.ts";
import type { PersonSnapshotEventV1 } from "../../../src/domain/person/Person.ts";
import {
  ACTIVE_MIGRATION_STATUSES,
  compareSubscriptionsForCurrent,
  composeSnapshot,
  decideSnapshotScope,
  dedupeGrants,
  dedupePurchases,
  dedupeSubscriptions,
  mapGrant,
  mapPurchaseHistory,
  mapSubscriptionHistory,
  mapSubscriptionStatus,
  resolveProfile,
  selectCurrentSubscription,
  sortGrants,
  sortPurchaseHistory,
  sortSubscriptionHistory,
  type SnapshotMigrationJobRow,
  type SubscriptionWithProduct,
  type TemporaryCanonicalScope,
} from "../../../src/services/sdk/snapshot-builder.ts";
import {
  SdkPersonSnapshot,
  SdkPersonSnapshotGrant,
  SdkPersonSnapshotPurchaseHistory,
  SdkPersonSnapshotSubscriptionHistory,
} from "../../../src/domain/sdkPerson/SdkPerson.ts";

// ---------------------------------------------------------------------------
// Fixture builders. Each returns a fresh object so no test mutates another's
// state. The builders type-cast a minimal field set to the full DB row type —
// `snapshot-builder` only reads the columns set here, so the cast is safe and
// keeps the fixtures readable rather than spelling out ~20 nullable columns.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-06-06T00:00:00.000Z");
const PAST = new Date("2026-01-01T00:00:00.000Z");
const FUTURE = new Date("2026-12-31T00:00:00.000Z");

const product = (
  overrides: Partial<DbPaymentProviderConfigurationProduct> = {},
): DbPaymentProviderConfigurationProduct =>
  ({
    configuration: null,
    createdAt: PAST,
    id: "ppcp-1",
    isActive: true,
    paymentProviderConfigurationId: "ppc-1",
    productId: "prod-1",
    providerProductKey: "com.app.product",
    updatedAt: PAST,
    ...overrides,
  }) as DbPaymentProviderConfigurationProduct;

const subscription = (overrides: Partial<SubscriptionWithProduct> = {}): SubscriptionWithProduct =>
  ({
    id: "sub-1",
    personId: "person-target",
    status: SubscriptionStatus.Active,
    initialTransactionId: "tx-init",
    latestTransactionId: "tx-latest",
    storeSubscriptionId: "store-sub-1",
    paymentProviderConfigurationProductId: "ppcp-1",
    providerEnvironment: 1,
    isTrial: false,
    startsAt: PAST,
    expiresAt: FUTURE,
    purchasedAt: PAST,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    cancellationReason: null,
    lastEventOccurredAt: null,
    billingRetryAt: null,
    gracePeriodExpiresAt: null,
    extendedTo: null,
    pendingPriceAmount: null,
    pendingPriceCurrency: null,
    pendingPriceEffectiveAt: null,
    createdAt: PAST,
    updatedAt: PAST,
    paymentProviderConfigurationProduct: product(),
    ...overrides,
  }) as SubscriptionWithProduct;

const purchase = (overrides: Partial<DbPurchase> = {}): DbPurchase =>
  ({
    id: "purchase-1",
    personId: "person-target",
    providerKey: "provider-key-1",
    type: PurchaseType.OneTime,
    paymentProviderConfigurationProductId: "ppcp-1",
    providerEnvironment: 1,
    refundedAt: null,
    refundReason: null,
    revokedAt: null,
    revocationReason: null,
    lastEventOccurredAt: null,
    createdAt: PAST,
    updatedAt: PAST,
    ...overrides,
  }) as DbPurchase;

const grant = (overrides: Partial<DbPersonUnlockedPerk> = {}): DbPersonUnlockedPerk =>
  ({
    id: "perk-grant-1",
    status: PersonUnlockedPerkStatus.Active,
    personId: "person-target",
    perkId: "perk-1",
    unlockedByPurchaseId: null,
    unlockedBySubscriptionId: null,
    expiresAt: null,
    createdAt: PAST,
    updatedAt: PAST,
    ...overrides,
  }) as DbPersonUnlockedPerk;

const person = (overrides: Partial<DbPerson> = {}): DbPerson =>
  ({
    id: "person-target",
    name: "Person Row Name",
    email: "row@example.com",
    traits: null,
    origin: 1,
    projectId: "project-1",
    mergedIntoPersonId: null,
    primaryDistinctId: null,
    firstSeenAt: null,
    lastSeenAt: null,
    archivedAt: null,
    deletedAt: null,
    deletionReason: null,
    createdAt: PAST,
    updatedAt: PAST,
    ...overrides,
  }) as DbPerson;

const personIdentity = (overrides: Partial<DbPersonIdentity> = {}): DbPersonIdentity =>
  ({
    id: "identity-1",
    projectId: "project-1",
    distinctId: "prev-distinct",
    personId: "person-source",
    kind: PersonIdentityKind.Anonymous,
    version: 0,
    createdAt: PAST,
    updatedAt: PAST,
    ...overrides,
  }) as DbPersonIdentity;

const migrationJob = (
  overrides: Partial<SnapshotMigrationJobRow> = {},
): SnapshotMigrationJobRow => ({
  id: "job-1",
  previousDistinctId: "prev-distinct",
  distinctId: "distinct-target",
  targetPersonId: "person-target",
  status: PersonIdentityMigrationJobStatus.Pending,
  projectId: "project-1",
  ...overrides,
});

const personEvent = (overrides: Partial<PersonSnapshotEventV1> = {}): PersonSnapshotEventV1 => ({
  changedAt: NOW.toISOString(),
  personId: "person-target",
  email: "event@example.com",
  isArchived: false,
  name: "Event Name",
  projectId: "project-1",
  schemaVersion: 1,
  traits: {},
  version: 1,
  ...overrides,
});

const identityResult = (overrides: Partial<PersonIdentityResult> = {}): PersonIdentityResult => ({
  personEvents: [personEvent()],
  identity: { distinctId: "distinct-target", mode: "full", personId: "person-target" },
  mappingEvents: [],
  warnings: [],
  ...overrides,
});

// ===========================================================================
// decideSnapshotScope
// ===========================================================================

describe("decideSnapshotScope", () => {
  it("with identityResult and no previousDistinctId: target-only persisted scope", () => {
    const scope = decideSnapshotScope({
      distinctId: "distinct-target",
      identityResult: identityResult(),
      personId: "person-target",
    });
    expect(scope.canonicalPersonId).toBe("person-target");
    expect(scope.includedPersonIds).toEqual(["person-target"]);
    expect(scope.sourcePersonId).toBeNull();
    expect(scope.migrationJobId).toBeNull();
    expect(scope.mode).toBe("persisted");
  });

  it("with identityResult flagging a conflicting identified warning: stays target-only", () => {
    const scope = decideSnapshotScope({
      distinctId: "distinct-target",
      identityResult: identityResult({
        warnings: ["merge into a different identified person was refused"],
      }),
      personId: "person-target",
      previousDistinctId: "prev-distinct",
      sourceMapping: personIdentity({ kind: PersonIdentityKind.Anonymous }),
    });
    expect(scope.mode).toBe("persisted");
    expect(scope.includedPersonIds).toEqual(["person-target"]);
    expect(scope.sourcePersonId).toBeNull();
  });

  it("with identityResult and an anonymous source mapping: dual-person pending-transfer scope", () => {
    const scope = decideSnapshotScope({
      activeJob: migrationJob(),
      distinctId: "distinct-target",
      identityResult: identityResult(),
      personId: "person-target",
      previousDistinctId: "prev-distinct",
      sourceMapping: personIdentity({
        kind: PersonIdentityKind.Anonymous,
        personId: "person-source",
      }),
    });
    expect(scope.mode).toBe("temporary_pending_transfer");
    expect(scope.includedPersonIds).toEqual(["person-target", "person-source"]);
    expect(scope.sourcePersonId).toBe("person-source");
    expect(scope.migrationJobId).toBe("job-1");
  });

  it("with identityResult and an *identified* source mapping: stays target-only", () => {
    const scope = decideSnapshotScope({
      distinctId: "distinct-target",
      identityResult: identityResult(),
      personId: "person-target",
      previousDistinctId: "prev-distinct",
      sourceMapping: personIdentity({
        kind: PersonIdentityKind.Identified,
        personId: "person-source",
      }),
    });
    expect(scope.mode).toBe("persisted");
    expect(scope.includedPersonIds).toEqual(["person-target"]);
    expect(scope.sourcePersonId).toBeNull();
  });

  it("without identityResult and no active job: target-only persisted scope", () => {
    const scope = decideSnapshotScope({
      distinctId: "distinct-target",
      personId: "person-target",
    });
    expect(scope.mode).toBe("persisted");
    expect(scope.includedPersonIds).toEqual(["person-target"]);
    expect(scope.migrationJobId).toBeNull();
  });

  it("without identityResult, active job but no sourceMapping: target-only carrying the migrationJobId", () => {
    const scope = decideSnapshotScope({
      activeJob: migrationJob(),
      distinctId: "distinct-target",
      personId: "person-target",
    });
    expect(scope.mode).toBe("persisted");
    expect(scope.includedPersonIds).toEqual(["person-target"]);
    expect(scope.migrationJobId).toBe("job-1");
    expect(scope.sourcePersonId).toBeNull();
  });

  it("without identityResult, active job, anonymous source person: dual-person pending-transfer scope", () => {
    const scope = decideSnapshotScope({
      activeJob: migrationJob(),
      distinctId: "distinct-target",
      personId: "person-target",
      sourceMapping: personIdentity({
        kind: PersonIdentityKind.Anonymous,
        personId: "person-source",
      }),
    });
    expect(scope.mode).toBe("temporary_pending_transfer");
    expect(scope.includedPersonIds).toEqual(["person-target", "person-source"]);
    expect(scope.sourcePersonId).toBe("person-source");
    expect(scope.migrationJobId).toBe("job-1");
  });
});

describe("ACTIVE_MIGRATION_STATUSES", () => {
  it("covers Pending, InProgress and Failed but never the terminal states", () => {
    expect(ACTIVE_MIGRATION_STATUSES).toEqual([
      PersonIdentityMigrationJobStatus.Pending,
      PersonIdentityMigrationJobStatus.InProgress,
      PersonIdentityMigrationJobStatus.Failed,
    ]);
    expect(ACTIVE_MIGRATION_STATUSES).not.toContain(PersonIdentityMigrationJobStatus.Succeeded);
    expect(ACTIVE_MIGRATION_STATUSES).not.toContain(PersonIdentityMigrationJobStatus.Exhausted);
  });
});

// ===========================================================================
// mapSubscriptionStatus
// ===========================================================================

describe("mapSubscriptionStatus", () => {
  it("returns 'canceled' for a canceled subscription regardless of dates", () => {
    expect(
      mapSubscriptionStatus(
        subscription({ status: SubscriptionStatus.Canceled, expiresAt: FUTURE }),
        NOW,
      ),
    ).toBe("canceled");
  });

  it("returns 'expired' when expiresAt is in the past", () => {
    expect(mapSubscriptionStatus(subscription({ expiresAt: PAST }), NOW)).toBe("expired");
  });

  it("returns 'trialing' for a non-expired trial subscription", () => {
    expect(mapSubscriptionStatus(subscription({ isTrial: true, expiresAt: FUTURE }), NOW)).toBe(
      "trialing",
    );
  });

  it("returns 'active' for a non-trial, non-expired subscription", () => {
    expect(mapSubscriptionStatus(subscription({ isTrial: false, expiresAt: FUTURE }), NOW)).toBe(
      "active",
    );
  });
});

// ===========================================================================
// compareSubscriptionsForCurrent
// ===========================================================================

describe("compareSubscriptionsForCurrent", () => {
  it("ranks active ahead of trialing (negative when left is active)", () => {
    const active = subscription({ id: "a", isTrial: false, expiresAt: FUTURE });
    const trial = subscription({ id: "t", isTrial: true, expiresAt: FUTURE });
    expect(compareSubscriptionsForCurrent(active, trial, NOW)).toBeLessThan(0);
  });

  it("prefers the later expiresAt when status is equal (positive when left expires first)", () => {
    const sooner = subscription({ id: "sooner", expiresAt: new Date("2026-07-01") });
    const later = subscription({ id: "later", expiresAt: FUTURE });
    expect(compareSubscriptionsForCurrent(sooner, later, NOW)).toBeGreaterThan(0);
  });

  it("breaks an expires tie by the later startsAt (positive when left starts first)", () => {
    const early = subscription({
      id: "early",
      expiresAt: FUTURE,
      startsAt: new Date("2026-01-01"),
    });
    const late = subscription({
      id: "late",
      expiresAt: FUTURE,
      startsAt: new Date("2026-03-01"),
    });
    expect(compareSubscriptionsForCurrent(early, late, NOW)).toBeGreaterThan(0);
  });

  it("breaks a full tie by the later updatedAt (positive when left updated first)", () => {
    const older = subscription({
      id: "older",
      expiresAt: FUTURE,
      startsAt: PAST,
      updatedAt: new Date("2026-02-01"),
    });
    const newer = subscription({
      id: "newer",
      expiresAt: FUTURE,
      startsAt: PAST,
      updatedAt: new Date("2026-05-01"),
    });
    expect(compareSubscriptionsForCurrent(older, newer, NOW)).toBeGreaterThan(0);
  });
});

// ===========================================================================
// selectCurrentSubscription
// ===========================================================================

describe("selectCurrentSubscription", () => {
  it("returns null when every candidate is expired", () => {
    expect(
      selectCurrentSubscription(
        [subscription({ id: "a", expiresAt: PAST }), subscription({ id: "b", expiresAt: PAST })],
        NOW,
      ),
    ).toBeNull();
  });

  it("returns a current-subscription snapshot for the single eligible subscription", () => {
    const current = selectCurrentSubscription(
      [subscription({ id: "sub-x", expiresAt: FUTURE, isTrial: true })],
      NOW,
    );
    expect(current).not.toBeNull();
    expect(current?.subscriptionId).toBe("sub-x");
    expect(current?.status).toBe("trialing");
    expect(current?.productId).toBe("prod-1");
    expect(current?.expiresAt).toEqual(FUTURE);
  });

  it("returns the highest-ranked candidate among several eligible subscriptions", () => {
    const current = selectCurrentSubscription(
      [
        subscription({ id: "trial", isTrial: true, expiresAt: FUTURE }),
        subscription({ id: "active", isTrial: false, expiresAt: new Date("2026-08-01") }),
      ],
      NOW,
    );
    // active outranks trialing even though it expires earlier.
    expect(current?.subscriptionId).toBe("active");
    expect(current?.status).toBe("active");
  });
});

// ===========================================================================
// mapSubscriptionHistory
// ===========================================================================

describe("mapSubscriptionHistory", () => {
  it("maps a trial subscription with a product, preserving isTrial and productId", () => {
    const history = mapSubscriptionHistory(
      subscription({ id: "sub-trial", isTrial: true, expiresAt: FUTURE }),
      NOW,
    );
    expect(history).toBeInstanceOf(SdkPersonSnapshotSubscriptionHistory);
    expect(history.subscriptionId).toBe("sub-trial");
    expect(history.isTrial).toBe(true);
    expect(history.status).toBe("trialing");
    expect(history.productId).toBe("prod-1");
    expect(history.sourcePersonId).toBe("person-target");
  });

  it("includes canceledAt for a canceled subscription", () => {
    const canceledAt = new Date("2026-05-01");
    const history = mapSubscriptionHistory(
      subscription({ status: SubscriptionStatus.Canceled, canceledAt }),
      NOW,
    );
    expect(history.status).toBe("canceled");
    expect(history.canceledAt).toEqual(canceledAt);
  });

  it("maps productId to null when the subscription has no product", () => {
    const history = mapSubscriptionHistory(
      subscription({ paymentProviderConfigurationProduct: null }),
      NOW,
    );
    expect(history.productId).toBeNull();
  });
});

// ===========================================================================
// mapPurchaseHistory
// ===========================================================================

describe("mapPurchaseHistory", () => {
  const lookup = new Map<string, string>([["ppcp-1", "prod-1"]]);

  it("maps a one-time purchase to type 'one_time'", () => {
    const history = mapPurchaseHistory(purchase({ type: PurchaseType.OneTime }), lookup);
    expect(history).toBeInstanceOf(SdkPersonSnapshotPurchaseHistory);
    expect(history.type).toBe("one_time");
    expect(history.productId).toBe("prod-1");
    expect(history.providerKey).toBe("provider-key-1");
  });

  it("maps a consumable purchase to type 'one_time' as well", () => {
    const history = mapPurchaseHistory(purchase({ type: PurchaseType.OneTimeConsumable }), lookup);
    expect(history.type).toBe("one_time");
  });

  it("maps a non-one-time purchase type to 'subscription'", () => {
    // type 99 is neither OneTime nor OneTimeConsumable → falls through to subscription.
    const history = mapPurchaseHistory(purchase({ type: 99 as never }), lookup);
    expect(history.type).toBe("subscription");
  });

  it("maps productId to null when the product is missing from the lookup", () => {
    const history = mapPurchaseHistory(
      purchase({ paymentProviderConfigurationProductId: "ppcp-unknown" }),
      lookup,
    );
    expect(history.productId).toBeNull();
  });

  it("falls back to epoch when createdAt is null", () => {
    const history = mapPurchaseHistory(purchase({ createdAt: null }), lookup);
    expect(history.createdAt).toEqual(new Date(0));
  });
});

// ===========================================================================
// mapGrant
// ===========================================================================

describe("mapGrant", () => {
  it("maps a subscription-sourced grant to source 'subscription' with its sourceId", () => {
    const result = mapGrant(grant({ unlockedBySubscriptionId: "sub-9" }));
    expect(result.source).toBe("subscription");
    expect(result.sourceId).toBe("sub-9");
  });

  it("maps a purchase-sourced grant to source 'purchase' with its sourceId", () => {
    const result = mapGrant(grant({ unlockedByPurchaseId: "purchase-9" }));
    expect(result.source).toBe("purchase");
    expect(result.sourceId).toBe("purchase-9");
  });

  it("maps a manually granted perk to source 'manual' with a null sourceId", () => {
    const result = mapGrant(grant({ unlockedBySubscriptionId: null, unlockedByPurchaseId: null }));
    expect(result.source).toBe("manual");
    expect(result.sourceId).toBeNull();
  });

  it("reports an active grant as status 'active'", () => {
    const result = mapGrant(grant({ status: PersonUnlockedPerkStatus.Active }));
    expect(result.status).toBe("active");
  });

  it("reports a non-active grant as status 'expired'", () => {
    const result = mapGrant(grant({ status: PersonUnlockedPerkStatus.Expired }));
    expect(result.status).toBe("expired");
  });
});

// ===========================================================================
// dedupeSubscriptions
// ===========================================================================

describe("dedupeSubscriptions", () => {
  it("returns an empty array for empty input", () => {
    expect(dedupeSubscriptions([])).toEqual([]);
  });

  it("returns a single subscription unchanged", () => {
    const only = subscription({ id: "sub-only" });
    expect(dedupeSubscriptions([only])).toEqual([only]);
  });

  it("collapses two rows that share the same id", () => {
    const result = dedupeSubscriptions([
      subscription({ id: "dup", storeSubscriptionId: "store-a" }),
      subscription({ id: "dup", storeSubscriptionId: "store-a" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("dedupes by storeSubscriptionId keeping the most recently updated row", () => {
    const stale = subscription({
      id: "stale",
      storeSubscriptionId: "store-shared",
      updatedAt: new Date("2026-01-01"),
    });
    const fresh = subscription({
      id: "fresh",
      storeSubscriptionId: "store-shared",
      updatedAt: new Date("2026-05-01"),
    });
    const result = dedupeSubscriptions([stale, fresh]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("fresh");
  });
});

// ===========================================================================
// dedupePurchases
// ===========================================================================

describe("dedupePurchases", () => {
  it("returns an empty array for empty input", () => {
    expect(dedupePurchases([])).toEqual([]);
  });

  it("returns a single purchase unchanged", () => {
    const only = purchase({ id: "p-only" });
    expect(dedupePurchases([only])).toEqual([only]);
  });

  it("collapses two rows that share the same id", () => {
    const result = dedupePurchases([
      purchase({ id: "dup", providerKey: "key-a" }),
      purchase({ id: "dup", providerKey: "key-a" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("dedupes by providerKey keeping the most recently created row", () => {
    const stale = purchase({
      id: "stale",
      providerKey: "key-shared",
      createdAt: new Date("2026-01-01"),
    });
    const fresh = purchase({
      id: "fresh",
      providerKey: "key-shared",
      createdAt: new Date("2026-05-01"),
    });
    const result = dedupePurchases([stale, fresh]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("fresh");
  });
});

// ===========================================================================
// dedupeGrants
// ===========================================================================

describe("dedupeGrants", () => {
  it("returns an empty array for empty input", () => {
    expect(dedupeGrants([])).toEqual([]);
  });

  it("returns a single grant unchanged", () => {
    const only = grant({ id: "g-only" });
    expect(dedupeGrants([only])).toEqual([only]);
  });

  it("prefers the active row when (perkId, source, sourceId) collide", () => {
    const expired = grant({
      id: "g-expired",
      perkId: "perk-shared",
      status: PersonUnlockedPerkStatus.Expired,
      unlockedBySubscriptionId: "sub-shared",
    });
    const active = grant({
      id: "g-active",
      perkId: "perk-shared",
      status: PersonUnlockedPerkStatus.Active,
      unlockedBySubscriptionId: "sub-shared",
    });
    const result = dedupeGrants([expired, active]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("g-active");
  });

  it("keeps distinct grants that differ only by source", () => {
    const fromSub = grant({ id: "g-sub", perkId: "perk-x", unlockedBySubscriptionId: "sub-1" });
    const fromManual = grant({ id: "g-manual", perkId: "perk-x" });
    const result = dedupeGrants([fromSub, fromManual]);
    expect(result).toHaveLength(2);
  });
});

// ===========================================================================
// sortSubscriptionHistory
// ===========================================================================

const subHistory = (
  overrides: Partial<ConstructorParameters<typeof SdkPersonSnapshotSubscriptionHistory>[0]> = {},
): SdkPersonSnapshotSubscriptionHistory =>
  new SdkPersonSnapshotSubscriptionHistory({
    canceledAt: null,
    expiresAt: FUTURE,
    isTrial: false,
    productId: "prod-1",
    sourcePersonId: "person-target",
    startsAt: PAST,
    status: "active",
    subscriptionId: "sub-1",
    ...overrides,
  });

describe("sortSubscriptionHistory", () => {
  it("sorts by startsAt descending, then expiresAt descending", () => {
    const earlyStart = subHistory({ subscriptionId: "early", startsAt: new Date("2026-01-01") });
    const lateStart = subHistory({ subscriptionId: "late", startsAt: new Date("2026-05-01") });
    const sorted = sortSubscriptionHistory([earlyStart, lateStart]);
    expect(sorted.map((s) => s.subscriptionId)).toEqual(["late", "early"]);
  });

  it("breaks a startsAt tie by later expiresAt first", () => {
    const expiresSoon = subHistory({
      subscriptionId: "soon",
      startsAt: PAST,
      expiresAt: new Date("2026-07-01"),
    });
    const expiresLate = subHistory({
      subscriptionId: "later",
      startsAt: PAST,
      expiresAt: FUTURE,
    });
    const sorted = sortSubscriptionHistory([expiresSoon, expiresLate]);
    expect(sorted.map((s) => s.subscriptionId)).toEqual(["later", "soon"]);
  });
});

// ===========================================================================
// sortPurchaseHistory
// ===========================================================================

const purchaseHistory = (
  overrides: Partial<ConstructorParameters<typeof SdkPersonSnapshotPurchaseHistory>[0]> = {},
): SdkPersonSnapshotPurchaseHistory =>
  new SdkPersonSnapshotPurchaseHistory({
    createdAt: PAST,
    productId: "prod-1",
    providerKey: "key-1",
    purchaseId: "purchase-1",
    sourcePersonId: "person-target",
    type: "one_time",
    ...overrides,
  });

describe("sortPurchaseHistory", () => {
  it("sorts by createdAt descending (newest first)", () => {
    const old = purchaseHistory({ purchaseId: "old", createdAt: new Date("2026-01-01") });
    const recent = purchaseHistory({ purchaseId: "recent", createdAt: new Date("2026-05-01") });
    const sorted = sortPurchaseHistory([old, recent]);
    expect(sorted.map((p) => p.purchaseId)).toEqual(["recent", "old"]);
  });
});

// ===========================================================================
// sortGrants
// ===========================================================================

const snapshotGrant = (
  overrides: Partial<ConstructorParameters<typeof SdkPersonSnapshotGrant>[0]> = {},
): SdkPersonSnapshotGrant =>
  new SdkPersonSnapshotGrant({
    expiresAt: null,
    perkId: "perk-1",
    source: "manual",
    sourceId: null,
    sourcePersonId: "person-target",
    status: "active",
    ...overrides,
  });

describe("sortGrants", () => {
  it("places active grants before expired ones", () => {
    const expired = snapshotGrant({ perkId: "expired", status: "expired" });
    const active = snapshotGrant({ perkId: "active", status: "active" });
    const sorted = sortGrants([expired, active]);
    expect(sorted.map((g) => g.perkId)).toEqual(["active", "expired"]);
  });

  it("orders same-status grants by expiresAt ascending (expiring soon first)", () => {
    const soon = snapshotGrant({ perkId: "soon", expiresAt: new Date("2026-07-01") });
    const late = snapshotGrant({ perkId: "late", expiresAt: FUTURE });
    const sorted = sortGrants([late, soon]);
    expect(sorted.map((g) => g.perkId)).toEqual(["soon", "late"]);
  });

  it("breaks an expiry tie alphabetically by perkId", () => {
    const beta = snapshotGrant({ perkId: "beta", expiresAt: FUTURE });
    const alpha = snapshotGrant({ perkId: "alpha", expiresAt: FUTURE });
    const sorted = sortGrants([beta, alpha]);
    expect(sorted.map((g) => g.perkId)).toEqual(["alpha", "beta"]);
  });
});

// ===========================================================================
// resolveProfile
// ===========================================================================

describe("resolveProfile", () => {
  it("prefers the identityResult event email/name for the target person", () => {
    const profile = resolveProfile({
      identityResult: identityResult({
        personEvents: [
          personEvent({ personId: "person-target", email: "fresh@example.com", name: "Fresh" }),
        ],
      }),
      targetPerson: person({ email: "row@example.com", name: "Row" }),
    });
    expect(profile.email).toBe("fresh@example.com");
    expect(profile.name).toBe("Fresh");
  });

  it("falls back to the target person row when there is no identityResult", () => {
    const profile = resolveProfile({
      targetPerson: person({ email: "row@example.com", name: "Row Name" }),
    });
    expect(profile.email).toBe("row@example.com");
    expect(profile.name).toBe("Row Name");
  });

  it("ignores an identityResult event for a different person", () => {
    const profile = resolveProfile({
      identityResult: identityResult({
        personEvents: [
          personEvent({ personId: "person-other", email: "other@example.com", name: "Other" }),
        ],
      }),
      targetPerson: person({ email: "row@example.com", name: "Row Name" }),
    });
    expect(profile.email).toBe("row@example.com");
    expect(profile.name).toBe("Row Name");
  });

  it("returns null for both fields when neither event nor row carries them", () => {
    const profile = resolveProfile({
      targetPerson: person({ email: null, name: null }),
    });
    expect(profile.email).toBeNull();
    expect(profile.name).toBeNull();
  });
});

// ===========================================================================
// composeSnapshot — the full dedupe → map → sort → wrap pipeline.
// ===========================================================================

describe("composeSnapshot", () => {
  it("dedupes, maps, sorts and wraps every input into an SdkPersonSnapshot", () => {
    const scope: TemporaryCanonicalScope = {
      canonicalPersonId: "person-target",
      includedPersonIds: ["person-target", "person-source"],
      migrationJobId: "job-1",
      mode: "temporary_pending_transfer",
      sourcePersonId: "person-source",
    };

    const snapshot = composeSnapshot({
      distinctId: "distinct-target",
      grants: [
        grant({ id: "g-active", perkId: "perk-a", unlockedBySubscriptionId: "sub-active" }),
        // duplicate of g-active by (perkId, source, sourceId) but expired → dropped.
        grant({
          id: "g-active-dup",
          perkId: "perk-a",
          status: PersonUnlockedPerkStatus.Expired,
          unlockedBySubscriptionId: "sub-active",
        }),
        grant({
          id: "g-expired",
          perkId: "perk-b",
          status: PersonUnlockedPerkStatus.Expired,
        }),
      ],
      identityResult: identityResult({
        personEvents: [
          personEvent({ personId: "person-target", email: "fresh@example.com", name: "Fresh" }),
        ],
      }),
      now: NOW,
      personId: "person-target",
      purchaseProductIdLookup: new Map([["ppcp-1", "prod-1"]]),
      purchases: [
        purchase({ id: "p-old", providerKey: "k-1", createdAt: new Date("2026-01-01") }),
        purchase({ id: "p-new", providerKey: "k-2", createdAt: new Date("2026-05-01") }),
      ],
      scope,
      subscriptions: [
        subscription({
          id: "sub-active",
          storeSubscriptionId: "store-active",
          isTrial: false,
          expiresAt: FUTURE,
        }),
        subscription({
          id: "sub-expired",
          storeSubscriptionId: "store-expired",
          expiresAt: PAST,
        }),
      ],
      targetPerson: person({ email: "row@example.com", name: "Row Name" }),
    });

    expect(snapshot).toBeInstanceOf(SdkPersonSnapshot);
    expect(snapshot.personId).toBe("person-target");
    expect(snapshot.distinctId).toBe("distinct-target");

    // Profile prefers the fresh identity event.
    expect(snapshot.email).toBe("fresh@example.com");
    expect(snapshot.name).toBe("Fresh");

    // Context carries the scope verbatim.
    expect(snapshot.snapshotContext.mode).toBe("temporary_pending_transfer");
    expect(snapshot.snapshotContext.migrationJobId).toBe("job-1");
    expect(snapshot.snapshotContext.includedPersonIds).toEqual(["person-target", "person-source"]);

    // Two subscriptions survive (different store ids); the active non-expired one
    // is current.
    expect(snapshot.subscriptions.history).toHaveLength(2);
    expect(snapshot.subscriptions.current?.subscriptionId).toBe("sub-active");
    expect(snapshot.subscriptions.current?.status).toBe("active");

    // Both purchases survive (distinct provider keys), newest first.
    expect(snapshot.purchases.history.map((p) => p.purchaseId)).toEqual(["p-new", "p-old"]);

    // Grants deduped to two; active before expired.
    expect(snapshot.entitlements.grants).toHaveLength(2);
    expect(snapshot.entitlements.grants.map((g) => g.perkId)).toEqual(["perk-a", "perk-b"]);
    expect(snapshot.entitlements.grants[0]?.status).toBe("active");
    expect(snapshot.entitlements.grants[1]?.status).toBe("expired");
  });

  it("produces a null current subscription and empty histories for an empty person", () => {
    const scope: TemporaryCanonicalScope = {
      canonicalPersonId: "person-target",
      includedPersonIds: ["person-target"],
      migrationJobId: null,
      mode: "persisted",
      sourcePersonId: null,
    };

    const snapshot = composeSnapshot({
      distinctId: "distinct-target",
      grants: [],
      now: NOW,
      personId: "person-target",
      purchaseProductIdLookup: new Map(),
      purchases: [],
      scope,
      subscriptions: [],
      targetPerson: person({ email: null, name: null }),
    });

    expect(snapshot.subscriptions.current).toBeNull();
    expect(snapshot.subscriptions.history).toEqual([]);
    expect(snapshot.purchases.history).toEqual([]);
    expect(snapshot.entitlements.grants).toEqual([]);
    expect(snapshot.email).toBeNull();
    expect(snapshot.name).toBeNull();
    expect(snapshot.snapshotContext.mode).toBe("persisted");
  });
});
