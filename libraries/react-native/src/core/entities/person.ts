import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import type { PerkSlug, ProductSlug } from "../schema/registry";
import {
  enumOrUnknown,
  listOrEmpty,
  OptionalEpochMillis,
  optionalNullable,
  renamedEnumOrUnknown,
} from "./decoding";
import type { Environment } from "./transaction";

/*
 * The person as the Voidhash API reports them (its person snapshot), read
 * into the SDK's names: timestamps become milliseconds since the epoch,
 * `null` an absent field, and the server's snake_case values the SDK's
 * camelCase ones. Values a newer server adds read as `"unknown"`, and a list
 * entry this version cannot read is left out, so a snapshot always keeps the
 * access it grants.
 *
 * The field names are the server's (`SdkPerson` in its contract). Keep them in
 * step with the generated client in `networking/generated/sdk-client.ts` when
 * it is regenerated.
 */

/** Where a subscription or grant comes from. */
export type PersonStore = "appStore" | "googlePlay" | "stripe" | "other" | "unknown";

/** A perk the person has or had. */
export interface EntitlementGrant {
  readonly perkId: string;
  /** The perk's slug, which access is checked by; absent when the perk was deleted. */
  readonly perkSlug?: PerkSlug;
  /** `active` while the person has access, `expired` once it ended. */
  readonly status: "active" | "expired" | "unknown";
  /** What granted it: a `subscription`, a one-time `purchase`, or a `manual` grant. */
  readonly source: "subscription" | "purchase" | "manual" | "unknown";
  /** The id of the subscription or purchase that granted it; absent for a manual grant. */
  readonly sourceId?: string;
  /** The person who owns it: this person, one merged into them, or one sharing it with them. */
  readonly sourcePersonId: string;
  /** When the access ends, in milliseconds since the epoch; absent when it does not end. */
  readonly expiresAt?: number;
}

/**
 * A subscription's state:
 *
 * - `active`: paid and renewing (or canceled, running until it ends).
 * - `trialing`: in a free trial.
 * - `inGracePeriod`: a renewal payment failed and the store keeps access
 *   until `gracePeriodExpiresAt` while it retries.
 * - `inBillingRetry`: a renewal payment failed and the store is retrying it.
 * - `onHold`: Google Play account hold: payment failed and access is paused.
 * - `paused`: the end user paused it on Google Play until `resumesAt`.
 * - `expired`: it ended.
 * - `revoked`: the store withdrew it, such as after a refund.
 */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "inGracePeriod"
  | "inBillingRetry"
  | "onHold"
  | "paused"
  | "expired"
  | "revoked"
  | "unknown";

/** Which price period a subscription is in: a free `trial`, an `intro` price, or the `regular` price. */
export type SubscriptionPeriodType = "trial" | "intro" | "regular" | "unknown";

/** A price change the store announced for a subscription's next renewals. */
export interface SubscriptionPendingPrice {
  readonly amountMicros: number;
  /** ISO 4217 currency code. */
  readonly currency: string;
  /** When the new price takes effect, in milliseconds since the epoch. */
  readonly effectiveAt?: number;
  /** Whether the end user agreed to it, where the store asks; absent where it does not. */
  readonly consent?: "pending" | "accepted" | "unknown";
}

/**
 * A subscription that has not ended, as the server knows it across devices
 * and stores. Timestamps are milliseconds since the epoch. What the person
 * can use always comes from their entitlements, never from this.
 */
export interface Subscription {
  readonly subscriptionId: string;
  /** The Voidhash product id; absent when its store product is not linked to one. */
  readonly productId?: string;
  readonly productSlug?: ProductSlug;
  readonly store: PersonStore;
  /** Where it was bought; `development` for development-mode purchases. */
  readonly environment: Environment;
  readonly status: SubscriptionStatus;
  readonly periodType: SubscriptionPeriodType;
  readonly startsAt?: number;
  /** When the current period ends. */
  readonly expiresAt?: number;
  /** Whether it renews at `expiresAt`. */
  readonly willRenew: boolean;
  /** When auto-renewal was turned off or it was canceled. */
  readonly canceledAt?: number;
  /** The product it renews into at `expiresAt`: a downgrade or plan change waiting for renewal. */
  readonly renewsToProductSlug?: ProductSlug;
  readonly gracePeriodExpiresAt?: number;
  /** When the store first failed to charge the renewal. */
  readonly billingIssueDetectedAt?: number;
  /** When a paused subscription resumes (Google Play). */
  readonly resumesAt?: number;
  readonly pendingPrice?: SubscriptionPendingPrice;
  /** The offer it was bought with. */
  readonly offerId?: string;
  /** Whether the person has it through App Store Family Sharing. */
  readonly isFamilyShared: boolean;
  readonly refundedAt?: number;
  readonly revokedAt?: number;
}

/** One subscription the person owns or shares, ended or not. */
export interface SubscriptionHistoryEntry {
  readonly subscriptionId: string;
  readonly productId?: string;
  readonly productSlug?: ProductSlug;
  readonly store: PersonStore;
  readonly status: SubscriptionStatus;
  readonly isTrial: boolean;
  readonly startsAt?: number;
  readonly expiresAt?: number;
  readonly canceledAt?: number;
  readonly refundedAt?: number;
  readonly sourcePersonId: string;
}

/** One purchase the person owns or shares, one per store transaction. */
export interface PurchaseHistoryEntry {
  readonly purchaseId: string;
  readonly productId?: string;
  readonly productSlug?: ProductSlug;
  /** The store's id for the transaction, such as an App Store transaction id. */
  readonly providerKey: string;
  readonly type: "oneTime" | "consumable" | "subscription" | "unknown";
  /** When it was recorded. */
  readonly createdAt?: number;
  readonly refundedAt?: number;
  readonly revokedAt?: number;
  readonly sourcePersonId: string;
}

/** The end user as Voidhash knows them: who they are, what they can use and what they bought. */
export interface Person {
  readonly personId: string;
  readonly distinctId: string;
  readonly email?: string;
  readonly name?: string;
  readonly entitlements: {
    /** The perks the person has or had, one per perk. */
    readonly grants: ReadonlyArray<EntitlementGrant>;
  };
  readonly subscriptions: {
    /**
     * The subscription that matters most now, of the ones that have not
     * ended: active first, then trialing, in a grace period, in billing
     * retry, on hold, paused.
     */
    readonly current?: Subscription;
    /**
     * Every subscription that has not ended, including ones in a grace
     * period, in billing retry, on hold or paused: what a "manage
     * subscription" screen lists. Access comes from entitlements, never from
     * this list.
     */
    readonly all: ReadonlyArray<Subscription>;
    readonly history: ReadonlyArray<SubscriptionHistoryEntry>;
  };
  readonly purchases: {
    readonly history: ReadonlyArray<PurchaseHistoryEntry>;
  };
}

const StoreValue = renamedEnumOrUnknown({
  app_store: "appStore",
  google_play: "googlePlay",
  stripe: "stripe",
  other: "other",
});

/** A field a server older than it left out. */
const withDefault = <S extends Schema.Top>(schema: S, value: S["Encoded"]) =>
  schema.pipe(Schema.withDecodingDefaultKey(Effect.succeed(value)));

const GrantValue = Schema.Struct({
  perkId: Schema.String,
  perkSlug: optionalNullable(Schema.String),
  status: enumOrUnknown(["active", "expired"]),
  source: withDefault(enumOrUnknown(["subscription", "purchase", "manual"]), "unknown"),
  sourceId: optionalNullable(Schema.String),
  sourcePersonId: withDefault(Schema.String, ""),
  expiresAt: OptionalEpochMillis,
});

/** Statuses of current and past subscriptions alike: the server sends one list for both. */
const SubscriptionStatusValue = renamedEnumOrUnknown({
  active: "active",
  trialing: "trialing",
  in_grace_period: "inGracePeriod",
  in_billing_retry: "inBillingRetry",
  on_hold: "onHold",
  paused: "paused",
  expired: "expired",
  revoked: "revoked",
});

const SubscriptionValue = Schema.Struct({
  subscriptionId: Schema.String,
  productId: optionalNullable(Schema.String),
  productSlug: optionalNullable(Schema.String),
  store: withDefault(StoreValue, "unknown"),
  environment: withDefault(
    renamedEnumOrUnknown({ production: "production", sandbox: "sandbox", test: "development" }),
    "unknown",
  ),
  status: SubscriptionStatusValue,
  periodType: withDefault(enumOrUnknown(["trial", "intro", "regular"]), "unknown"),
  startsAt: OptionalEpochMillis,
  expiresAt: OptionalEpochMillis,
  willRenew: withDefault(Schema.Boolean, false),
  canceledAt: OptionalEpochMillis,
  renewsToProductSlug: optionalNullable(Schema.String),
  gracePeriodExpiresAt: OptionalEpochMillis,
  billingIssueDetectedAt: OptionalEpochMillis,
  resumesAt: OptionalEpochMillis,
  pendingPrice: optionalNullable(
    Schema.Struct({
      amountMicros: Schema.Number,
      currency: Schema.String,
      effectiveAt: OptionalEpochMillis,
      consent: optionalNullable(enumOrUnknown(["pending", "accepted"])),
    }),
  ),
  offerId: optionalNullable(Schema.String),
  isFamilyShared: withDefault(Schema.Boolean, false),
  refundedAt: OptionalEpochMillis,
  revokedAt: OptionalEpochMillis,
});

const SubscriptionHistoryEntryValue = Schema.Struct({
  subscriptionId: Schema.String,
  productId: optionalNullable(Schema.String),
  productSlug: optionalNullable(Schema.String),
  store: withDefault(StoreValue, "unknown"),
  status: SubscriptionStatusValue,
  isTrial: withDefault(Schema.Boolean, false),
  startsAt: OptionalEpochMillis,
  expiresAt: OptionalEpochMillis,
  canceledAt: OptionalEpochMillis,
  refundedAt: OptionalEpochMillis,
  sourcePersonId: withDefault(Schema.String, ""),
});

const PurchaseHistoryEntryValue = Schema.Struct({
  purchaseId: Schema.String,
  productId: optionalNullable(Schema.String),
  productSlug: optionalNullable(Schema.String),
  providerKey: Schema.String,
  type: renamedEnumOrUnknown({
    one_time: "oneTime",
    consumable: "consumable",
    subscription: "subscription",
  }),
  createdAt: OptionalEpochMillis,
  refundedAt: OptionalEpochMillis,
  revokedAt: OptionalEpochMillis,
  sourcePersonId: withDefault(Schema.String, ""),
});

/**
 * A `current` subscription a snapshot cached before the server sent full
 * subscriptions cannot be read as one; it counts as none.
 */
const decodeCurrentSubscription = Schema.decodeUnknownOption(SubscriptionValue);

const PersonJson = Schema.fromJsonString(
  Schema.Struct({
    personId: withDefault(Schema.String, ""),
    distinctId: Schema.String,
    email: optionalNullable(Schema.String),
    name: optionalNullable(Schema.String),
    entitlements: withDefault(Schema.Struct({ grants: listOrEmpty(GrantValue) }), { grants: [] }),
    subscriptions: withDefault(
      Schema.Struct({
        current: optionalNullable(Schema.Unknown),
        all: listOrEmpty(SubscriptionValue),
        history: listOrEmpty(SubscriptionHistoryEntryValue),
      }),
      { all: [], history: [] },
    ),
    purchases: withDefault(Schema.Struct({ history: listOrEmpty(PurchaseHistoryEntryValue) }), {
      history: [],
    }),
  }),
);

/**
 * Reads a person snapshot the native client sent as JSON; `None` when it is
 * not one. Only `distinctId` is required: a snapshot that lacks something
 * else still answers the access it records.
 */
export const decodePerson = (json: string): Option.Option<Person> =>
  Option.map(Schema.decodeUnknownOption(PersonJson)(json), (wire): Person => {
    const current = Option.getOrUndefined(decodeCurrentSubscription(wire.subscriptions.current));
    return {
      ...wire,
      subscriptions: {
        all: wire.subscriptions.all,
        history: wire.subscriptions.history,
        ...(current === undefined ? {} : { current }),
      },
    };
  });
