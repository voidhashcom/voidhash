/**
 * Public DTOs returned by `SdkService`. The SDK snapshot is the top-level
 * shape every shipping client SDK install consumes — it stitches together the
 * authenticated person's profile, current entitlements, subscription and
 * purchase history, plus a "scope" descriptor that tells clients whether two
 * persons are temporarily merged during an in-flight identify migration.
 *
 * Pattern mirrors `domain/person/Person.ts`'s `PersonProfile`: pure
 * `Schema.TaggedClass`es, no `Effect`, no DB knowledge. Construction belongs
 * in `services/sdk/internal/snapshot-builder.ts`.
 */
import { Schema } from "effect";

// =============================================================================
// Status enums (Schema.Literal so they participate in the TaggedClass schema)
// =============================================================================

export const SdkPersonSnapshotMode = Schema.Literals(["persisted", "temporary_pending_transfer"]);
export type SdkPersonSnapshotMode = typeof SdkPersonSnapshotMode.Type;

export const SdkSubscriptionHistoryStatus = Schema.Literals([
  "active",
  "canceled",
  "expired",
  "trialing",
  "past_due",
]);
export type SdkSubscriptionHistoryStatus = typeof SdkSubscriptionHistoryStatus.Type;

export const SdkSubscriptionCurrentStatus = Schema.Literals([
  "none",
  "active",
  "canceled",
  "past_due",
  "trialing",
]);
export type SdkSubscriptionCurrentStatus = typeof SdkSubscriptionCurrentStatus.Type;

export const SdkPersonSnapshotGrantStatus = Schema.Literals(["active", "expired"]);
export type SdkPersonSnapshotGrantStatus = typeof SdkPersonSnapshotGrantStatus.Type;

export const SdkPersonSnapshotGrantSource = Schema.Literals(["subscription", "purchase", "manual"]);
export type SdkPersonSnapshotGrantSource = typeof SdkPersonSnapshotGrantSource.Type;

export const SdkPersonSnapshotPurchaseType = Schema.Literals(["one_time", "subscription"]);
export type SdkPersonSnapshotPurchaseType = typeof SdkPersonSnapshotPurchaseType.Type;

// =============================================================================
// Nested DTOs
// =============================================================================

export class SdkPersonSnapshotGrant extends Schema.TaggedClass<SdkPersonSnapshotGrant>()(
  "SdkPersonSnapshotGrant",
  {
    perkId: Schema.String,
    status: SdkPersonSnapshotGrantStatus,
    source: SdkPersonSnapshotGrantSource,
    sourceId: Schema.NullOr(Schema.String),
    sourcePersonId: Schema.String,
    expiresAt: Schema.NullOr(Schema.Date),
  },
) {}

export class SdkPersonSnapshotSubscriptionHistory extends Schema.TaggedClass<SdkPersonSnapshotSubscriptionHistory>()(
  "SdkPersonSnapshotSubscriptionHistory",
  {
    subscriptionId: Schema.String,
    productId: Schema.NullOr(Schema.String),
    status: SdkSubscriptionHistoryStatus,
    startsAt: Schema.Date,
    expiresAt: Schema.NullOr(Schema.Date),
    canceledAt: Schema.NullOr(Schema.Date),
    isTrial: Schema.Boolean,
    sourcePersonId: Schema.String,
  },
) {}

export class SdkPersonSnapshotCurrentSubscription extends Schema.TaggedClass<SdkPersonSnapshotCurrentSubscription>()(
  "SdkPersonSnapshotCurrentSubscription",
  {
    status: SdkSubscriptionCurrentStatus,
    expiresAt: Schema.NullOr(Schema.Date),
    productId: Schema.NullOr(Schema.String),
    subscriptionId: Schema.NullOr(Schema.String),
  },
) {}

export class SdkPersonSnapshotPurchaseHistory extends Schema.TaggedClass<SdkPersonSnapshotPurchaseHistory>()(
  "SdkPersonSnapshotPurchaseHistory",
  {
    purchaseId: Schema.String,
    productId: Schema.NullOr(Schema.String),
    type: SdkPersonSnapshotPurchaseType,
    providerKey: Schema.String,
    createdAt: Schema.Date,
    sourcePersonId: Schema.String,
  },
) {}

export class SdkPersonSnapshotEntitlements extends Schema.TaggedClass<SdkPersonSnapshotEntitlements>()(
  "SdkPersonSnapshotEntitlements",
  {
    grants: Schema.Array(SdkPersonSnapshotGrant),
  },
) {}

export class SdkPersonSnapshotSubscriptions extends Schema.TaggedClass<SdkPersonSnapshotSubscriptions>()(
  "SdkPersonSnapshotSubscriptions",
  {
    current: Schema.NullOr(SdkPersonSnapshotCurrentSubscription),
    history: Schema.Array(SdkPersonSnapshotSubscriptionHistory),
  },
) {}

export class SdkPersonSnapshotPurchases extends Schema.TaggedClass<SdkPersonSnapshotPurchases>()(
  "SdkPersonSnapshotPurchases",
  {
    history: Schema.Array(SdkPersonSnapshotPurchaseHistory),
  },
) {}

export class SdkPersonSnapshotContext extends Schema.TaggedClass<SdkPersonSnapshotContext>()(
  "SdkPersonSnapshotContext",
  {
    mode: SdkPersonSnapshotMode,
    migrationJobId: Schema.NullOr(Schema.String),
    includedPersonIds: Schema.Array(Schema.String),
  },
) {}

// =============================================================================
// Top-level DTO
// =============================================================================

/**
 * Public-facing snapshot of an SDK-authenticated person. Returned by
 * `SdkService.getPerson`, `SdkService.identifyPerson`, and embedded in
 * `SyncPersonAttributesResult` from `SdkService.syncPersonAttributes`.
 */
export class SdkPersonSnapshot extends Schema.TaggedClass<SdkPersonSnapshot>()(
  "SdkPersonSnapshot",
  {
    personId: Schema.String,
    distinctId: Schema.String,
    email: Schema.NullOr(Schema.String),
    name: Schema.NullOr(Schema.String),
    entitlements: SdkPersonSnapshotEntitlements,
    subscriptions: SdkPersonSnapshotSubscriptions,
    purchases: SdkPersonSnapshotPurchases,
    snapshotContext: SdkPersonSnapshotContext,
  },
) {}

// =============================================================================
// Domain errors — colocated with the entity. The `SdkServiceError` catch-all
// lives with the service in `services/sdk/`.
// =============================================================================

/** SDK person not found. */
export class SdkPersonNotFoundError extends Schema.TaggedErrorClass<SdkPersonNotFoundError>(
  "SdkPersonNotFoundError",
)("SdkPersonNotFoundError", { message: Schema.String }) {}

/** SDK person already identified. */
export class SdkPersonAlreadyIdentifiedError extends Schema.TaggedErrorClass<SdkPersonAlreadyIdentifiedError>(
  "SdkPersonAlreadyIdentifiedError",
)("SdkPersonAlreadyIdentifiedError", { distinctId: Schema.String }) {}

/** SDK validation error. */
export class SdkValidationError extends Schema.TaggedErrorClass<SdkValidationError>(
  "SdkValidationError",
)("SdkValidationError", { message: Schema.String }) {}
