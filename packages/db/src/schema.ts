import { ProductType, PurchaseType, SubscriptionStatus } from "@voidhash/lib";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  smallint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable(
  "user",
  {
    banExpires: timestamp("ban_expires", { withTimezone: true, precision: 3 }),
    banReason: text("ban_reason"),
    banned: boolean("banned").default(false),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    /**
     * User-uploaded avatar (public file store URL). Kept separate from `image`
     * because `image` mirrors the WorkOS profile picture and is overwritten on
     * every authenticated sync; this column is never touched by that sync, so a
     * custom avatar survives. The session resolves `image = customImageUrl ?? image`.
     */
    customImageUrl: text("custom_image_url"),
    email: varchar("email", { length: 255 }).notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    id: varchar("id", { length: 36 }).primaryKey(),
    image: text("image"),
    name: varchar("name", { length: 255 }).notNull(),
    role: text("role"),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    /**
     * Stable WorkOS user id (`user_xxx`) this row mirrors. Our own `id` is the
     * primary key; the WorkOS id is only a secondary identifier. Nullable
     * because rows created before this column existed (and any non-WorkOS user)
     * carry no WorkOS id until it is backfilled on the next authenticated sync.
     */
    workosUserId: varchar("workos_user_id", { length: 64 }),
  },
  (table) => [uniqueIndex("user_workos_id_uidx").on(table.workosUserId)],
);

export const organization = pgTable(
  "organization",
  {
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull(),
    id: varchar("id", { length: 36 }).primaryKey(),
    logo: text("logo"),
    metadata: text("metadata"),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    workosOrganizationId: varchar("workos_organization_id", { length: 64 }).notNull(),
  },
  (table) => [
    uniqueIndex("organization_slug_uidx").on(table.slug),
    uniqueIndex("organization_workos_id_uidx").on(table.workosOrganizationId),
  ],
);

export const member = pgTable(
  "member",
  {
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull(),
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 255 }).default("member").notNull(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workosMembershipId: varchar("workos_membership_id", { length: 64 }).notNull(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    uniqueIndex("member_workos_id_uidx").on(table.workosMembershipId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
    id: varchar("id", { length: 36 }).primaryKey(),
    inviterId: varchar("inviter_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 255 }),
    status: varchar("status", { length: 255 }).default("pending").notNull(),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ],
);

export const apikey = pgTable(
  "apikey",
  {
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull(),
    enabled: boolean("enabled").default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }),
    id: varchar("id", { length: 36 }).primaryKey(),
    key: varchar("key", { length: 255 }).notNull(),
    lastRefillAt: timestamp("last_refill_at", { withTimezone: true, precision: 3 }),
    lastRequest: timestamp("last_request", { withTimezone: true, precision: 3 }),
    metadata: text("metadata"),
    name: text("name"),
    permissions: text("permissions"),
    prefix: text("prefix"),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitMax: integer("rate_limit_max").default(10),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86_400_000),
    refillAmount: integer("refill_amount"),
    refillInterval: integer("refill_interval"),
    remaining: integer("remaining"),
    requestCount: integer("request_count").default(0),
    end: text("end"),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("apikey_key_idx").on(table.key), index("apikey_userId_idx").on(table.userId)],
);

export const projects = pgTable(
  "project",
  {
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    createdByUserId: varchar("created_by", { length: 255 }),
    id: varchar("id", { length: 255 }).primaryKey(),
    logo: text("logo"),
    name: varchar("name", { length: 255 }).notNull(),
    organizationId: varchar("organization_id", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("organization_id_idx").on(table.organizationId),
    uniqueIndex("slug_oragnization_id_idx").on(table.slug, table.organizationId),
  ],
);

export const captureProjectPolicies = pgTable(
  "capture_project_policy",
  {
    projectId: varchar("project_id", { length: 255 })
      .primaryKey()
      .references(() => projects.id, { onDelete: "cascade" }),
    ingestEnabled: boolean("ingest_enabled").notNull().default(true),
    requestsPerMinute: integer("requests_per_minute"),
    eventsPerDay: integer("events_per_day"),
    forceRoute: varchar("force_route", { length: 32 }),
    customTopic: varchar("custom_topic", { length: 255 }),
    skipEnrichment: boolean("skip_enrichment").notNull().default(false),
    processorEnabled: boolean("processor_enabled").notNull().default(true),
    processorPersonProcessingEnabled: boolean("processor_person_processing_enabled")
      .notNull()
      .default(true),
    processorSchemaMode: varchar("processor_schema_mode", { length: 16 })
      .notNull()
      .default("reject"),
    processorAllowOverflow: boolean("processor_allow_overflow").notNull().default(true),
    processorAllowHistorical: boolean("processor_allow_historical").notNull().default(true),
    processorHistoricalMinAgeHours: integer("processor_historical_min_age_hours")
      .notNull()
      .default(48),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [index("capture_project_policy_force_route_idx").on(table.forceRoute)],
);

export const apiKeys = pgTable(
  "api_key",
  {
    id: varchar("id", { length: 255 }).primaryKey(),

    name: varchar("name", { length: 255 }).notNull(),

    /**
     * Shows the last few characters of the API key
     * This allows you to show those few characters in the UI to make it easier for users to identify the API key.
     */
    end: varchar("end", { length: 255 }).notNull(),
    /**
     * The full API key.
     */
    key: varchar("key", { length: 255 }).notNull(),
    /**
     * The prefix of the key.
     */
    prefix: varchar("prefix", { length: 16 }).notNull(),
    /**
     * Whether the API key is public. Public keys are not hashed and are visible to users.
     */
    isPublic: boolean("is_public").notNull().default(false),
    /**
     * The environment of the API key.
     */
    projectId: varchar("project_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [index("api_key_key_idx").on(table.key)],
);

export const PersonIdentityKind = {
  Anonymous: 1,
  Identified: 2,
} as const;

export type PersonIdentityKindValue = (typeof PersonIdentityKind)[keyof typeof PersonIdentityKind];

export const PersonType = PersonIdentityKind;

export type PersonTypeValue = PersonIdentityKindValue;

export const PersonOrigin = {
  API: 5,
  Android: 3,
  /**
   * Synthetic anonymous "stand-in" person created from App Store server-side
   * data (a webhook notification, or reconciliation history) before any real
   * user identity is known. Distinguishes a provisional stand-in — safe to
   * merge into the real person on SDK confirmation — from a genuine user.
   */
  AppStoreWebhook: 6,
  Dashboard: 1,
  /**
   * Synthetic anonymous "stand-in" person created from Google Play server-side
   * data (an RTDN notification, or reconciliation) before any real user
   * identity is known. The Google Play analogue of {@link PersonOrigin.AppStoreWebhook}.
   */
  GooglePlayWebhook: 7,
  IOS: 2,
  Stripe: 4,
} as const;

export type PersonOriginValue = (typeof PersonOrigin)[keyof typeof PersonOrigin];

export interface AdditionalPersonAttributes {
  [key: string]: unknown;
  platform?: string;
  sdk?: string;
  sdkVersion?: string;
  platformFlavor?: string;
  platformFlavorVersion?: string;
  platformVersion?: string;
  platformDevice?: string;
  platformBrand?: string;
  preferredLocales?: string;
  clientLocale?: string;
  clientVersion?: string;
  storefront?: string;
}

/**
 * Per-trait last-write-wins metadata for the order-agnostic person projection.
 * Records, per trait key, the `(ts, id)` of the write that set the current
 * value plus its `mode`, so a later out-of-order event can decide
 * deterministically whether it wins: `set` keeps the newest write, `setOnce`
 * the earliest, and any `set` permanently outranks `setOnce` for that key.
 */
export interface PersonTraitMeta {
  readonly ts: number;
  readonly id: string;
  readonly mode: "set" | "setOnce";
}

export type PersonTraitsMeta = Record<string, PersonTraitMeta>;

export const persons = pgTable(
  "person",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    traits: jsonb("traits").$type<AdditionalPersonAttributes>(),

    /**
     * Per-trait LWW metadata mirroring {@link traits} (see {@link PersonTraitsMeta}).
     * Lets out-of-order trait writes resolve deterministically without depending
     * on processing order.
     */
    traitsMeta: jsonb("traits_meta").$type<PersonTraitsMeta>(),

    /**
     * From where the person was created
     */
    origin: smallint("origin").notNull().default(PersonOrigin.Dashboard),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    mergedIntoPersonId: varchar("merged_into_person_id", { length: 255 }),
    primaryDistinctId: varchar("primary_distinct_id", { length: 255 }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true, precision: 3 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, precision: 3 }),
    archivedAt: timestamp("archived_at", { withTimezone: true, precision: 3 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
    deletionReason: varchar("deletion_reason", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [index("person_merged_into_person_id_idx").on(table.mergedIntoPersonId)],
);

export const personIdentities = pgTable(
  "person_identity",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    distinctId: varchar("distinct_id", { length: 255 }).notNull(),
    personId: varchar("person_id", { length: 255 })
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    kind: smallint("kind").notNull().default(PersonIdentityKind.Anonymous),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("person_identity_project_distinct_uidx").on(table.projectId, table.distinctId),
    index("person_identity_project_person_idx").on(table.projectId, table.personId),
  ],
);

export const personPersonlessIdentities = pgTable(
  "person_personless_identity",
  {
    projectId: varchar("project_id", { length: 255 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    distinctId: varchar("distinct_id", { length: 255 }).notNull(),
    isMerged: boolean("is_merged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("person_personless_identity_project_distinct_uidx").on(
      table.projectId,
      table.distinctId,
    ),
  ],
);

/**
 * Append-only log of identity assertions — the source of truth for the
 * order-agnostic ("Option B") identity model (`docs/order-agnostic-analytics-events.md`).
 * Every `$identify` appends one immutable row asserting that two distinct ids
 * name the same person. The `(distinctIdA, distinctIdB)` pair is stored
 * canonically sorted (`a <= b`) so an unordered edge has a single
 * representation, and `dedupKey` (the capture/event id) makes a retried or
 * redelivered identify insert exactly once. The union-find projection in
 * `person_identity` / `person.merged_into_person_id` is fully derivable from
 * this log, so it can be rebuilt from scratch for disaster recovery or a
 * stitching-rule change.
 */
export const identityAssertions = pgTable(
  "identity_assertion",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    distinctIdA: varchar("distinct_id_a", { length: 255 }).notNull(),
    distinctIdB: varchar("distinct_id_b", { length: 255 }).notNull(),
    eventTs: timestamp("event_ts", { withTimezone: true, precision: 3 }).notNull(),
    source: smallint("source").notNull().default(PersonOrigin.API),
    dedupKey: varchar("dedup_key", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
  },
  (table) => [
    uniqueIndex("identity_assertion_project_dedup_uidx").on(table.projectId, table.dedupKey),
    index("identity_assertion_project_a_idx").on(table.projectId, table.distinctIdA),
    index("identity_assertion_project_b_idx").on(table.projectId, table.distinctIdB),
  ],
);

export const PersonIdentityMigrationJobStatus = {
  Pending: 1,
  InProgress: 2,
  Succeeded: 3,
  Failed: 4,
  Exhausted: 5,
} as const;

export type PersonIdentityMigrationJobStatusValue =
  (typeof PersonIdentityMigrationJobStatus)[keyof typeof PersonIdentityMigrationJobStatus];

export const personIdentityMigrationJobs = pgTable(
  "person_identity_migration_job",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    previousDistinctId: varchar("previous_distinct_id", { length: 255 }).notNull(),
    distinctId: varchar("distinct_id", { length: 255 }).notNull(),
    targetPersonId: varchar("target_person_id", { length: 255 })
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    status: smallint("status").notNull().default(PersonIdentityMigrationJobStatus.Pending),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    personEvents: jsonb("person_events").$type<unknown[]>(),
    mappingEvents: jsonb("mapping_events").$type<unknown[]>(),
    requestedAt: timestamp("requested_at", { withTimezone: true, precision: 3 }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("person_identity_migration_project_status_created_idx").on(
      table.projectId,
      table.status,
      table.createdAt,
    ),
    index("person_identity_migration_project_previous_idx").on(
      table.projectId,
      table.previousDistinctId,
    ),
    index("person_identity_migration_project_distinct_idx").on(table.projectId, table.distinctId),
  ],
);

export const PersonUnlockedPerkStatus = {
  Active: 1,
  Expired: 2,
} as const;

export type PersonUnlockedPerkStatusValue =
  (typeof PersonUnlockedPerkStatus)[keyof typeof PersonUnlockedPerkStatus];

export const personUnlockedPerks = pgTable(
  "person_unlocked_perk",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    status: smallint("status").notNull().default(PersonUnlockedPerkStatus.Active),
    personId: varchar("person_id", { length: 255 }).notNull(),
    perkId: varchar("perk_id", { length: 255 }).notNull(),
    // Controls the lifetime of the perk
    unlockedByPurchaseId: varchar("unlocked_by_purchase_id", {
      length: 255,
    }),
    unlockedBySubscriptionId: varchar("unlocked_by_subscription_id", {
      length: 255,
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [uniqueIndex("person_id_perk_id_idx").on(table.personId, table.perkId)],
);

export const personExternalIdentifiers = pgTable(
  "person_external_identifier",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 }).references(() => projects.id, {
      onDelete: "cascade",
    }),
    personId: varchar("person_id", { length: 255 })
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    serviceId: varchar("service_id", { length: 255 }).notNull(), // stripe, appstore, slack etc
    isDefault: boolean("is_default").notNull(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("person_external_identifier_project_service_identifier_uidx").on(
      table.projectId,
      table.serviceId,
      table.identifier,
    ),
  ],
);
export const PersonDeletionRequestStatus = {
  Queued: 1,
  InProgress: 2,
  Completed: 3,
  Failed: 4,
} as const;

export type PersonDeletionRequestStatusValue =
  (typeof PersonDeletionRequestStatus)[keyof typeof PersonDeletionRequestStatus];

export const personDeletionRequests = pgTable(
  "person_deletion_request",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    personId: varchar("person_id", { length: 255 })
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    projectId: varchar("project_id", { length: 255 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    requestedBy: varchar("requested_by", { length: 255 }).notNull(),
    reason: varchar("reason", { length: 64 }).notNull(),
    status: smallint("status").notNull().default(PersonDeletionRequestStatus.Queued),
    requestedAt: timestamp("requested_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("person_deletion_request_person_idx").on(table.personId),
    index("person_deletion_request_project_status_idx").on(table.projectId, table.status),
  ],
);

export const paymentProviderConfigurations = pgTable(
  "payment_provider_configuration",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    providerId: varchar("provider_id", { length: 255 }).notNull(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    /** Key generated based on configuration. Used as an external identifier for the payment provider configuration. For example, for App Store, it is the bundleId. */
    paymentProviderKey: varchar("payment_provider_key", {
      length: 255,
    }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    name: varchar("name", { length: 255 }).notNull().default("Unknown"),
    configuration: jsonb("configuration").$type<object>(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
    activeProviderId: varchar("active_provider_id", { length: 255 }).generatedAlwaysAs(
      sql`(case when deleted_at is null then provider_id else null end)`,
    ),
  },
  (table) => [
    index("project_id_idx").on(table.projectId),
    index("provider_id_idx").on(table.providerId),
    uniqueIndex("payment_provider_configuration_project_active_provider_uidx").on(
      table.projectId,
      table.activeProviderId,
    ),
  ],
);

// Perk
export const perks = pgTable(
  "perk",
  {
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    id: varchar("id", { length: 255 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [uniqueIndex("perk_slug_project_id_idx").on(table.slug, table.projectId)],
);

export const products = pgTable(
  "product",
  {
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    id: varchar("id", { length: 255 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    type: smallint("type").notNull().default(ProductType.Subscription),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [uniqueIndex("product_slug_project_id_idx").on(table.slug, table.projectId)],
);

export const productPerks = pgTable(
  "product_perk",
  {
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    id: varchar("id", { length: 255 }).primaryKey(),
    perkId: varchar("perk_id", { length: 255 }).notNull(),
    productId: varchar("product_id", { length: 255 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [uniqueIndex("product_id_perk_id_idx").on(table.productId, table.perkId)],
);

export const paymentProviderConfigurationProducts = pgTable(
  "payment_provider_configuration_product",
  {
    configuration: jsonb("configuration").$type<object>(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    id: varchar("id", { length: 255 }).primaryKey(),
    isActive: boolean("is_active").notNull().default(true),
    paymentProviderConfigurationId: varchar("payment_provider_configuration_id", {
      length: 255,
    }).notNull(),
    productId: varchar("product_id", { length: 255 }).notNull(),
    providerProductKey: varchar("provider_product_key", {
      length: 255,
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("product_provider_configuration_ext_pk_idx").on(
      table.paymentProviderConfigurationId,
      table.providerProductKey,
      table.productId,
    ),
    index("payment_provider_configuration_id_idx").on(table.paymentProviderConfigurationId),
  ],
);

export const CheckoutSessionStatus = {
  Cancelled: 5,
  Error: 4,
  Pending: 1,
  Processing: 2,
  Success: 3,
};

export const checkoutSessions = pgTable("checkout_session", {
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
  personId: varchar("person_id", { length: 255 }).notNull(),
  errorCallbackUrl: varchar("error_callback_url", { length: 255 }).notNull().default("LEGACY"),
  id: varchar("id", { length: 255 }).primaryKey(),
  paymentProviderConfigurationProductId: varchar("payment_provider_configuration_product_id", {
    length: 255,
  }).notNull(),
  status: smallint("status").notNull().default(CheckoutSessionStatus.Pending),
  successCallbackUrl: varchar("success_callback_url", {
    length: 255,
  })
    .notNull()
    .default("LEGACY"),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
    () => new Date(),
  ),
});

// App Store
export const ProviderEnvironment = {
  Production: 1,
  Sandbox: 2,
} as const;

export type ProviderEnvironmentValue =
  (typeof ProviderEnvironment)[keyof typeof ProviderEnvironment];

export const purchases = pgTable(
  "purchase",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    personId: varchar("person_id", { length: 255 }).notNull(),
    providerKey: varchar("provider_key", { length: 255 }).notNull(),
    type: smallint("type").notNull().default(PurchaseType.OneTime),
    paymentProviderConfigurationProductId: varchar("payment_provider_configuration_product_id", {
      length: 255,
    }).notNull(),

    /**
     * The environment the subscription was purchased in
     */
    providerEnvironment: smallint("provider_environment")
      .notNull()
      .default(ProviderEnvironment.Production),

    /** Set when the provider refunds the purchase entitlement. */
    refundedAt: timestamp("refunded_at", { withTimezone: true, precision: 3 }),
    refundReason: varchar("refund_reason", { length: 100 }),
    /** Set when the provider revokes the purchase entitlement without refunding it. */
    revokedAt: timestamp("revoked_at", { withTimezone: true, precision: 3 }),
    revocationReason: varchar("revocation_reason", { length: 100 }),
    /**
     * Watermark for out-of-order safety on refund / revoke updates. Mirrors
     * `transaction.lastEventOccurredAt` for one-time purchase entitlement state.
     */
    lastEventOccurredAt: timestamp("last_event_occurred_at", { withTimezone: true, precision: 3 }),

    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("provider_key_idx").on(table.providerKey),
    index("purchase_person_active_idx").on(table.personId, table.refundedAt, table.revokedAt),
  ],
);

export const subscriptions = pgTable(
  "subscription",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    personId: varchar("person_id", { length: 255 }).notNull(),
    status: smallint("status").notNull().default(SubscriptionStatus.Active),
    initialTransactionId: varchar("initial_transaction_id", {
      length: 255,
    }).notNull(),
    latestTransactionId: varchar("latest_transaction_id", {
      length: 255,
    }).notNull(),
    /**
     * - This is the 'original_transaction_id' for Apple, or 'subscription_id' for Google
     */
    storeSubscriptionId: varchar("store_subscription_id", {
      length: 255,
    }).notNull(),

    paymentProviderConfigurationProductId: varchar("payment_provider_configuration_product_id", {
      length: 255,
    }).notNull(),

    /**
     * The environment the subscription was purchased in
     */
    providerEnvironment: smallint("provider_environment")
      .notNull()
      .default(ProviderEnvironment.Production),

    isTrial: boolean("is_trial").notNull().default(false),

    /**
     * The date the subscription started
     */
    startsAt: timestamp("starts_at", { withTimezone: true, precision: 3 }).notNull(),
    /**
     * The date the subscription expires. Null if the subscription is not set to expire or if it is a one-time purchase
     */
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }),
    /**
     * The date the subscription was purchased
     */
    purchasedAt: timestamp("purchased_at", { withTimezone: true, precision: 3 }).notNull(),
    /**
     * Whether the subscription is set to cancel at the end of the current period
     */
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    /**
     * The date the subscription was canceled
     */
    canceledAt: timestamp("canceled_at", { withTimezone: true, precision: 3 }),

    cancellationReason: varchar("cancellation_reason", { length: 255 }),

    /**
     * Watermark for out-of-order safety. State-mutating UPDATEs are gated on
     * `WHERE last_event_occurred_at IS NULL OR last_event_occurred_at <=
     * :occurredAt`; a stale late-arriving event is rejected at the projection
     * level (the ledger row is still written so analytics replay captures the
     * historical event).
     */
    lastEventOccurredAt: timestamp("last_event_occurred_at", { withTimezone: true, precision: 3 }),

    /** `DID_FAIL_TO_RENEW`: subscription entered the billing-retry loop. */
    billingRetryAt: timestamp("billing_retry_at", { withTimezone: true, precision: 3 }),
    /**
     * `DID_FAIL_TO_RENEW` subtype `GRACE_PERIOD`: deadline by which billing
     * must recover before the subscription transitions to `Canceled` via
     * `GRACE_PERIOD_EXPIRED`.
     */
    gracePeriodExpiresAt: timestamp("grace_period_expires_at", {
      withTimezone: true,
      precision: 3,
    }),
    /** `RENEWAL_EXTENDED`: latest extension target for `expiresAt`. */
    extendedTo: timestamp("extended_to", { withTimezone: true, precision: 3 }),
    /** `PRICE_INCREASE`: amount that will take effect on next renewal. */
    pendingPriceAmount: integer("pending_price_amount"),
    pendingPriceCurrency: varchar("pending_price_currency", { length: 3 }),
    pendingPriceEffectiveAt: timestamp("pending_price_effective_at", {
      withTimezone: true,
      precision: 3,
    }),
    /**
     * `DID_CHANGE_RENEWAL_PREF`: target product mapping. Recorded as intent
     * only — actual product swap happens when `renewSubscription` fires for
     * the new product (Apple's preference change takes effect on the next
     * billing cycle), at which point this column is cleared atomically.
     */
    pendingProductChangeId: varchar("pending_product_change_id", { length: 255 }),
    /** `OFFER_REDEEMED`: most recently redeemed offer identifier. */
    redeemedOfferId: varchar("redeemed_offer_id", { length: 255 }),
    redeemedOfferAt: timestamp("redeemed_offer_at", { withTimezone: true, precision: 3 }),

    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("subscription_store_subscription_unique_idx").on(
      table.paymentProviderConfigurationProductId,
      table.storeSubscriptionId,
    ),
    index("status_starts_at_idx").on(table.status, table.startsAt),
    index("canceled_at_idx").on(table.canceledAt),
    index("person_id_idx").on(table.personId),
  ],
);

export const transactions = pgTable(
  "transaction",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    personId: varchar("person_id", { length: 255 }).notNull(),
    /**
     * Legacy single-amount column. Kept temporarily for read-side compatibility
     * while ClickHouse views migrate to {@link transactions.grossAmount}.
     * New writes mirror `grossAmount` into this column; remove once readers
     * have cut over.
     */
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    /**
     * Legacy USD-converted amount. Mirrors {@link transactions.grossAmountUsd}
     * during the read-side migration window; remove with `amount`.
     */
    amountUsd: integer("amount_usd"),
    /**
     * Apple-style ISO 3166 alpha-3 storefront country (e.g., `USA`, `DEU`).
     * Used both for analytics breakdowns and to look up the per-country VAT
     * rate that {@link transactions.taxAmount} was estimated from.
     */
    storefront: varchar("storefront", { length: 3 }),
    /**
     * Gross amount paid by the customer in the original currency's minor
     * unit (e.g., cents for USD). Includes any VAT / sales tax baked into
     * the price by the provider where the provider is merchant of record.
     */
    grossAmount: integer("gross_amount").notNull().default(0),
    /**
     * Estimated tax included in {@link transactions.grossAmount}, in
     * original-currency minor units. Estimated from
     * `storefront`-based VAT tables — Apple does not break out tax in
     * the JWS payload. Authoritative tax is reconciled later from monthly
     * App Store Connect financial reports.
     */
    taxAmount: integer("tax_amount").notNull().default(0),
    /**
     * Store commission deducted from the gross amount in original-currency
     * minor units (e.g., Apple's 30% standard or 15% Small Business Program
     * rate applied at transaction time).
     */
    storeCommissionAmount: integer("store_commission_amount").notNull().default(0),
    /**
     * `grossAmount - storeCommissionAmount`, in original-currency minor
     * units. Persisted (rather than re-derived at read time) so analytics
     * aggregations can sum the column directly.
     */
    proceedsAmount: integer("proceeds_amount").notNull().default(0),
    /**
     * `grossAmount - storeCommissionAmount - taxAmount`, in original-
     * currency minor units. Same persistence rationale as `proceedsAmount`.
     */
    proceedsAfterTaxAmount: integer("proceeds_after_tax_amount").notNull().default(0),
    /** Gross amount converted to USD cents. */
    grossAmountUsd: integer("gross_amount_usd"),
    /** Tax amount converted to USD cents. */
    taxAmountUsd: integer("tax_amount_usd"),
    /** Store commission converted to USD cents. */
    storeCommissionAmountUsd: integer("store_commission_amount_usd"),
    /** Proceeds (after commission) converted to USD cents. */
    proceedsAmountUsd: integer("proceeds_amount_usd"),
    /** Proceeds after commission + tax, converted to USD cents. */
    proceedsAfterTaxAmountUsd: integer("proceeds_after_tax_amount_usd"),
    /**
     * Exchange rate used to populate the USD columns.
     * Stored as rate * 1,000,000 for precision.
     * e.g., 1.25 USD/EUR stored as 1250000.
     */
    exchangeRate: integer("exchange_rate"),

    paymentProviderConfigurationProductId: varchar("payment_provider_product_configuration_id", {
      length: 255,
    }).notNull(),
    providerEnvironment: smallint("provider_environment")
      .notNull()
      .default(ProviderEnvironment.Production),
    storeTransactionId: varchar("store_transaction_id", {
      length: 255,
    }),
    occurredAt: timestamp("occurred_at", { withTimezone: true, precision: 3 }).notNull(),
    /**
     * Set when the provider refunds this transaction. Apple's REFUND
     * notification mutates the existing transaction record in place rather than
     * issuing a new transactionId, so the refund state lives on this row.
     */
    refundedAt: timestamp("refunded_at", { withTimezone: true, precision: 3 }),
    refundReason: varchar("refund_reason", { length: 100 }),
    /**
     * Set when the provider revokes the entitlement attached to this
     * transaction (e.g. Apple's REVOKE notification for Family Sharing).
     * Same in-place mutation semantics as `refundedAt`.
     */
    revokedAt: timestamp("revoked_at", { withTimezone: true, precision: 3 }),
    revocationReason: varchar("revocation_reason", { length: 100 }),
    /**
     * Watermark for out-of-order safety on refund / revoke updates. Same
     * semantics as {@link subscriptions.lastEventOccurredAt}: a UPDATE that
     * carries an older `occurredAt` than the column value is rejected at the
     * projection level (the ledger row is still written for replay).
     */
    lastEventOccurredAt: timestamp("last_event_occurred_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("transaction_provider_tx_unique_idx").on(
      table.paymentProviderConfigurationProductId,
      table.storeTransactionId,
    ),
    index("occurred_at_idx").on(table.occurredAt),
  ],
);

/**
 * Cache of foreign-exchange rates from arbitrary ISO 4217 currencies to
 * USD, shared across the fleet so analytics ingestion never hits the
 * upstream rates provider on the hot path.
 *
 * Written only by {@link FxRateService}'s daily sync workflow and its
 * one-shot startup seed — never on the read path. Rate is stored as
 * `rate * 1_000_000` to preserve six decimal places in an integer column
 * (matches the {@link transactions.exchangeRate} convention).
 */
export const fxRates = pgTable(
  "fx_rate",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    /** ISO 4217 currency code converted FROM (e.g., `"EUR"`). */
    currency: varchar("currency", { length: 3 }).notNull(),
    /**
     * The date the rate applies to. Per-day granularity is enough for revenue
     * dashboards; intraday volatility is irrelevant.
     */
    asOfDate: timestamp("as_of_date", { withTimezone: true, precision: 3 }).notNull(),
    /** Rate × 1_000_000 from `currency` to USD. */
    usdRate: integer("usd_rate").notNull(),
    /** Identifier of the rate provider, e.g., `"openexchangerates"` or `"stub"`. */
    source: varchar("source", { length: 64 }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, precision: 3 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("fx_rate_currency_date_idx").on(table.currency, table.asOfDate)],
);

/**
 * Worker / dispatch state for {@link purchaseLedger}. The polling worker
 * advances rows through `Pending → InProgress → Published` (or `DeadLetter`
 * after exhausting retries). `InProgress` rows older than the stale-claim
 * cutoff are swept back to `Pending` at the start of each poll.
 *
 * This status describes analytics dispatch only — the ledger row itself is
 * append-only and is never deleted.
 */
export const PurchaseLedgerStatus = {
  Pending: 1,
  InProgress: 2,
  Published: 3,
  DeadLetter: 4,
} as const;

export type PurchaseLedgerStatusValue =
  (typeof PurchaseLedgerStatus)[keyof typeof PurchaseLedgerStatus];

/**
 * Append-only ledger of normalized purchase events. A row is written inside
 * the same DB transaction as the operational purchase writes (transaction /
 * subscription / purchase rows), so the operational state and the ledger
 * commit-or-rollback atomically. The UNIQUE on `idempotencyKey` is the
 * service-level cross-source dedup gate — duplicate inbound deliveries of
 * the same logical store event (webhook + SDK + reconciliation) collide
 * here and short-circuit before any operational write.
 *
 * The ledger has two consumers:
 *  - Analytics dispatch: a separate polling worker drains the table by
 *    re-dispatching each row's `eventsPayload` onto the shared analytics-ingest
 *    queue (`AnalyticsDispatchService.dispatchTrusted`).
 *  - Replay-from-source: `rawProviderPayload` archives the upstream signed /
 *    decoded provider payload alongside the normalized fact, so if our
 *    normalization has a bug we can re-derive the analytics without re-
 *    fetching from the provider.
 */
export const purchaseLedger = pgTable(
  "purchase_ledger",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    idempotencyKey: varchar("idempotency_key", { length: 512 }).notNull(),
    providerId: varchar("provider_id", { length: 50 }).notNull(),
    providerEventType: varchar("provider_event_type", { length: 100 }).notNull(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    organizationId: varchar("organization_id", { length: 255 }).notNull(),
    personId: varchar("person_id", { length: 255 }).notNull(),
    /**
     * Serialized `PurchaseProcessingResult` snapshot. Replayed verbatim to the
     * caller when a duplicate idempotency key arrives, so the second caller
     * sees the same transactionId/subscriptionId/purchaseId/analyticsEventIds
     * the first caller did.
     */
    resultPayload: jsonb("result_payload").$type<object>().notNull(),
    /**
     * Serialized `ReadonlyArray<InternalAnalyticsEvent>` the worker
     * re-dispatches onto the shared analytics-ingest queue. Stored as JSON to
     * preserve the discriminated-union shape end-to-end.
     */
    eventsPayload: jsonb("events_payload").$type<ReadonlyArray<object>>().notNull(),
    /**
     * Raw upstream payload (decoded JWS for App Store, raw webhook body for
     * other providers). Optional because some legacy or synthetic events
     * arrive without one. Enables replay-from-source if normalization needs
     * to be re-run after a bug fix.
     */
    rawProviderPayload: jsonb("raw_provider_payload").$type<unknown>(),
    /**
     * Origin of the inbound event: `"sdk" | "webhook" | "reconciliation"`.
     * Metadata only — logic never branches on this (the idempotency key is
     * designed to collapse the same logical event regardless of source).
     */
    source: varchar("source", { length: 32 }),
    status: smallint("status").notNull().default(PurchaseLedgerStatus.Pending),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, precision: 3 }),
    lastError: varchar("last_error", { length: 1000 }),
    claimedBy: varchar("claimed_by", { length: 64 }),
    claimedAt: timestamp("claimed_at", { withTimezone: true, precision: 3 }),
    publishedAt: timestamp("published_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("purchase_ledger_idempotency_key_idx").on(table.idempotencyKey),
    index("purchase_ledger_poll_idx").on(table.status, table.nextAttemptAt),
    index("purchase_ledger_provider_idx").on(table.providerId, table.providerEventType),
  ],
);

export const AnalyticsIngestDlqReplayStatus = {
  Pending: "pending",
  Requeued: "requeued",
  Failed: "failed",
} as const;

export type AnalyticsIngestDlqReplayStatusValue =
  (typeof AnalyticsIngestDlqReplayStatus)[keyof typeof AnalyticsIngestDlqReplayStatus];

export const analyticsIngestDlq = pgTable(
  "analytics_ingest_dlq",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    captureId: varchar("capture_id", { length: 255 }),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    distinctId: varchar("distinct_id", { length: 512 }),
    routeClass: varchar("route_class", { length: 32 }).notNull(),
    failureClass: varchar("failure_class", { length: 64 }).notNull(),
    failureMessage: varchar("failure_message", { length: 1000 }).notNull(),
    payloadJson: jsonb("payload_json").$type<unknown>().notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    sourceShard: varchar("source_shard", { length: 255 }).notNull(),
    sourceSequence: bigint("source_sequence", { mode: "number" }).notNull(),
    replayedAt: timestamp("replayed_at", { withTimezone: true, precision: 3 }),
    replayStatus: varchar("replay_status", { length: 32 })
      .notNull()
      .default(AnalyticsIngestDlqReplayStatus.Pending),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("analytics_ingest_dlq_capture_id_idx").on(table.captureId),
    index("analytics_ingest_dlq_project_failure_idx").on(table.projectId, table.failureClass),
    index("analytics_ingest_dlq_replay_idx").on(table.replayStatus, table.createdAt),
  ],
);

/**
 * Per-`notificationUUID` ledger of inbound provider notifications. Serves
 * three purposes:
 *  - Webhook-layer dedup via the UNIQUE on `(configuration, notificationUUID)`
 *    — a duplicate webhook delivery fails the INSERT and the handler treats
 *    it as already-processed.
 *  - Park-and-replay for notifications that arrived before the customer
 *    mapped the product (`result = "parked_pending_product_mapping"` with
 *    `parkedUntilProviderProductKey` + `parkedRawPayload` set). When a new
 *    `payment_provider_configuration_product` row is inserted, parked rows
 *    for that key are replayed through the normal record path.
 *  - Park-and-replay for notifications that arrived before the SDK confirmed
 *    the transaction series (`result = "parked_pending_sdk_confirmation"`
 *    with `parkedUntilOriginalTransactionId` + `parkedRawPayload` set).
 *    Triggered by the per-tenant
 *    `trackNewPurchasesFromAppleServerNotifications = false` mode. When the
 *    SDK eventually confirms a transaction in the series, parked rows are
 *    replayed through the normal record path. Aged after 90 days via a
 *    scheduled expiry workflow (`result = "expired"`).
 */
export const paymentProviderNotificationProcessed = pgTable(
  "payment_provider_notification_processed",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    paymentProviderConfigurationId: varchar("payment_provider_configuration_id", {
      length: 255,
    }).notNull(),
    providerId: varchar("provider_id", { length: 50 }).notNull(),
    notificationUuid: varchar("notification_uuid", { length: 255 }).notNull(),
    notificationType: varchar("notification_type", { length: 64 }).notNull(),
    notificationSubtype: varchar("notification_subtype", { length: 64 }),
    source: varchar("source", { length: 32 }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    /**
     * Outcome string. Conventional values:
     *  - `"applied"`        – mapped to a record method and processed.
     *  - `"ignored"`        – ack-without-handling (e.g. TEST, unmapped subtype).
     *  - `"parked_pending_product_mapping"` – product not mapped yet; replay
     *                         when the mapping appears.
     *  - `"parked_pending_sdk_confirmation"` – SDK has not yet confirmed the
     *                         transaction series; replay when SDK arrives.
     *  - `"expired"`        – parked row aged past the 90-day TTL.
     *  - `"failed"`         – decode / signature failure that should not retry.
     */
    result: varchar("result", { length: 32 }).notNull(),
    resultNote: varchar("result_note", { length: 500 }),
    parkedUntilProviderProductKey: varchar("parked_until_provider_product_key", { length: 255 }),
    parkedUntilOriginalTransactionId: varchar("parked_until_original_transaction_id", {
      length: 255,
    }),
    parkedRawPayload: jsonb("parked_raw_payload").$type<unknown>(),
  },
  (table) => [
    uniqueIndex("notif_uuid_uniq").on(table.paymentProviderConfigurationId, table.notificationUuid),
    index("notif_processed_at_idx").on(table.processedAt),
    index("notif_parked_lookup_idx").on(
      table.paymentProviderConfigurationId,
      table.result,
      table.parkedUntilProviderProductKey,
    ),
    index("notif_parked_sdk_idx").on(
      table.paymentProviderConfigurationId,
      table.result,
      table.parkedUntilOriginalTransactionId,
    ),
  ],
);

export const InAppOwnershipType = {
  FamilyShared: 1,
  Purchased: 2,
} as const;

export type InAppOwnershipTypeValue = (typeof InAppOwnershipType)[keyof typeof InAppOwnershipType];

export const OfferDiscountType = {
  FreeTrial: 1,
  PayAsYouGo: 2,
  PayUpFront: 3,
} as const;

export type OfferDiscountTypeValue = (typeof OfferDiscountType)[keyof typeof OfferDiscountType];

export const OfferType = {
  IntroductoryOffer: 1,
  OfferWithSubscriptionOfferCode: 3,
  PromotionalOffer: 2,
  WinBackOffer: 4,
} as const;

export type OfferTypeValue = (typeof OfferType)[keyof typeof OfferType];

export const RevocationReason = {
  OtherReason: 1,
  PerceivedIssue: 2,
} as const;

export type RevocationReasonValue = (typeof RevocationReason)[keyof typeof RevocationReason];

export const TransactionReason = {
  Purchase: 1,
  Renewal: 2,
} as const;

export type TransactionReasonValue = (typeof TransactionReason)[keyof typeof TransactionReason];

export const TransactionType = {
  AutoRenewableSubscription: 1,
  Consumable: 3,
  NonConsumable: 2,
  NonRenewingSubscription: 4,
} as const;

export type TransactionTypeValue = (typeof TransactionType)[keyof typeof TransactionType];

export const appStoreTransactions = pgTable(
  "app_store_transaction",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    transactionId: varchar("transaction_id", { length: 255 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    // Equivalent to providerEnvironment
    environment: smallint("environment").notNull().default(ProviderEnvironment.Production),
    expireDate: timestamp("expire_date", { withTimezone: true, precision: 3 }),
    inAppOwnershipType: smallint("in_app_ownership_type")
      .notNull()
      .default(InAppOwnershipType.Purchased),
    isUpgraded: boolean("is_upgraded"),
    offerDiscountType: smallint("offer_discount_type")
      .notNull()
      .default(OfferDiscountType.PayAsYouGo),
    offerIdentifier: varchar("offer_identifier", { length: 255 }),
    offerPeriod: varchar("offer_period", { length: 255 }), //ISO 8601 duration string
    offerType: smallint("offer_type").notNull().default(OfferType.IntroductoryOffer),
    originalPurchaseDate: timestamp("original_purchase_date", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    originalTransactionId: varchar("original_transaction_id", {
      length: 255,
    }).notNull(),
    /**
     * An integer value that represents the price multiplied by 1000 of the in-app purchase or subscription offer you configured in App Store Connect and that the system records at the time of the purchase.
     */
    price: integer("price").notNull(),
    productId: varchar("product_id", { length: 255 }).notNull(),
    purchaseDate: timestamp("purchase_date", { withTimezone: true, precision: 3 }).notNull(),
    quantity: integer("quantity").notNull(),
    revocationDate: timestamp("revocation_date", { withTimezone: true, precision: 3 }),
    revocationReason: smallint("revocation_reason").notNull().default(RevocationReason.OtherReason),
    /**
     * The three-letter code that represents the country or region associated with the App Store storefront for the purchase.
     */
    storefront: varchar("storefront", { length: 3 }).notNull(),
    storefrontId: varchar("storefront_id", { length: 255 }).notNull(),
    subscriptionGroupIdentifier: varchar("subscription_group_identifier", {
      length: 255,
    }),
    transactionReason: smallint("transaction_reason").notNull().default(TransactionReason.Purchase),
    type: smallint("type").notNull().default(TransactionType.AutoRenewableSubscription),
    webOrderLineItemId: varchar("web_order_line_item_id", {
      length: 255,
    }),
  },
  (table) => [uniqueIndex("transaction_id_idx").on(table.transactionId)],
);

// Design file
// biome-ignore lint/suspicious/noEmptyInterface: ok
export interface DesignFileMetadata {}

// Paywall source enum — how the paywall is authored.
// 1 = visual editor, 2 = code (CLI deploy, see docs/specs/paywall-deploy-contract.md)
export const PaywallSource = {
  editor: 1,
  code: 2,
} as const;

export type PaywallSourceValue = (typeof PaywallSource)[keyof typeof PaywallSource];

// Paywalls
export const paywalls = pgTable(
  "paywall",
  {
    archivedAt: timestamp("archived_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    designFileMetadata: jsonb("design_file_metadata").$type<DesignFileMetadata>(),
    id: varchar("id", { length: 255 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    source: smallint("source").notNull().default(PaywallSource.editor),
    // Public URL of the most recently rendered paywall thumbnail, including its
    // cache-busting `seq` query (null until the first idle render lands).
    // `thumbnailSeq` also provides the monotonic guard that keeps a late idle
    // render from overwriting a newer one (see PaywallThumbnailService).
    thumbnailUrl: text("thumbnail_url"),
    thumbnailSeq: bigint("thumbnail_seq", { mode: "number" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [uniqueIndex("paywall_slug_project_id_idx").on(table.slug, table.projectId)],
);

export const PaywallEditSessionStatus = {
  active: "active",
  finished: "finished",
  reverted: "reverted",
} as const;

export type PaywallEditSessionStatusValue =
  (typeof PaywallEditSessionStatus)[keyof typeof PaywallEditSessionStatus];

/**
 * A connected agentic authoring session for one paywall. The baseline is
 * captured when editing starts so the session's edits can be reverted.
 */
export const paywallEditSessions = pgTable(
  "paywall_edit_session",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    /** Durable internal agent session that owns this edit session, or null for MCP. */
    agentSessionId: varchar("agent_session_id", { length: 64 }),
    paywallId: varchar("paywall_id", { length: 255 }).notNull(),
    paywallSlug: varchar("paywall_slug", { length: 255 }).notNull(),
    baselineTree: jsonb("baseline_tree").$type<unknown>().notNull(),
    baselineVersion: integer("baseline_version").notNull(),
    lastAgentVersion: integer("last_agent_version").notNull(),
    revertSafe: boolean("revert_safe").default(true).notNull(),
    status: varchar("status", { length: 16 }).$type<PaywallEditSessionStatusValue>().notNull(),
    lastPreviewSignature: varchar("last_preview_signature", { length: 80 }),
    lastPreviewVersion: integer("last_preview_version"),
    reviewVerdict: text("review_verdict"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true, precision: 3 }),
  },
  (table) => [
    index("paywall_edit_session_project_idx").on(table.projectId),
    index("paywall_edit_session_paywall_idx").on(table.paywallId),
    index("paywall_edit_session_agent_session_idx").on(table.agentSessionId),
  ],
);

/**
 * Status of a cached component compile: `ready` carries a validated manifest,
 * `error` carries diagnostics (and a null manifest).
 */
export const PaywallComponentManifestStatus = {
  ready: "ready",
  error: "error",
} as const;

export type PaywallComponentManifestStatusValue =
  (typeof PaywallComponentManifestStatus)[keyof typeof PaywallComponentManifestStatus];

/**
 * One cached compile diagnostic. Structurally mirrors the browser
 * `CompileDiagnostic` (message + optional phase/line/column), but typed loosely
 * here because `packages/db` must not depend on the renderer/compile packages.
 */
export interface PaywallComponentManifestDiagnostic {
  readonly message: string;
  readonly phase?: string;
  readonly line?: number;
  readonly column?: number;
}

/**
 * Content-addressed cache of extracted component manifests, keyed by the
 * `sourceHash` of a code-component's TSX source (the SAME `hashSource` the
 * browser compile pipeline uses — see `@voidhash/paywall-workspace`).
 *
 * There is deliberately **no org/project scoping**: a manifest is a pure
 * derivation of source *content*, so identical source anywhere in the fleet
 * resolves to the same row. Rows are safe to share and safe to evict — a cache
 * miss simply degrades the server-side view of a paywall document (the referenced
 * component's props/actions are omitted), never leaks data, and is re-populated
 * the next time that source compiles in a designer session.
 *
 * Integrity comes from two properties, not from scoping. Rows are
 * **content-addressed** (the key is a SHA-256 of the source, so a row's value is
 * a function of its key) and writes are **first-write-wins**: a `ready` manifest
 * is immutable — a later writer cannot replace it (see
 * `ComponentManifestCacheService.record`'s conditional upsert; only an `error`
 * row may be upgraded). The `manifest` JSONB is validated against the core
 * `ComponentManifest` schema at write time; readers may still re-validate.
 * Server-verified compiles (Increment 3) will further harden this by removing
 * the reliance on client-uploaded manifests entirely.
 */
export const paywallComponentManifests = pgTable("paywall_component_manifest", {
  sourceHash: varchar("source_hash", { length: 64 }).primaryKey(),
  status: varchar("status", { length: 16 }).notNull().$type<PaywallComponentManifestStatusValue>(),
  manifest: jsonb("manifest").$type<unknown>(),
  previewTrees: jsonb("preview_trees").$type<Readonly<Record<string, unknown>>>(),
  diagnostics: jsonb("diagnostics").$type<ReadonlyArray<PaywallComponentManifestDiagnostic>>(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// Release Status enum
export const ReleaseStatus = {
  draft: 1,
  released: 2,
} as const;

export type ReleaseStatusValue = (typeof ReleaseStatus)[keyof typeof ReleaseStatus];

/**
 * Runtime configuration stamped on code-deployed paywall releases and
 * forwarded verbatim through SDK resolve (deploy contract §6). Null for
 * visual-editor releases.
 */
export interface PaywallReleaseRuntimeConfig {
  productSlugs: string[];
  variables: Record<string, string | number | boolean>;
}

// Paywall Releases (stores S3 references to published designs)
export const paywallReleases = pgTable(
  "paywall_release",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    paywallId: varchar("paywall_id", { length: 255 }).notNull(),

    // S3 reference
    s3Key: varchar("s3_key", { length: 512 }).notNull(),
    s3Bucket: varchar("s3_bucket", { length: 255 }).notNull(),

    // Version info
    version: integer("version").notNull(),
    schemaVersion: integer("schema_version").notNull(),

    // Code-deploy provenance (null for visual-editor releases).
    // contentHash is the §1.2 deployable identity (storage prefix/cache key).
    deployId: varchar("deploy_id", { length: 255 }),
    contentHash: varchar("content_hash", { length: 64 }),
    runtimeConfig: jsonb("runtime_config").$type<PaywallReleaseRuntimeConfig>(),

    // Metadata
    publishedBy: varchar("published_by", { length: 255 }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true, precision: 3 }).defaultNow(),

    // Only one version can be active per paywall
    isActive: boolean("is_active").notNull().default(false),

    // Status: 1 = Draft, 2 = Released
    status: smallint("status").notNull().default(ReleaseStatus.draft),
  },
  (table) => [
    index("paywall_release_paywall_id_idx").on(table.paywallId),
    uniqueIndex("paywall_release_version_status_idx").on(
      table.paywallId,
      table.version,
      table.status,
    ),
    index("paywall_release_status_idx").on(table.paywallId, table.status),
    index("paywall_release_paywall_id_content_hash_idx").on(table.paywallId, table.contentHash),
  ],
);

export const PaywallLocationShowingType = {
  paywallRelease: 1,
  featureFlag: 2,
} as const;

export type PaywallLocationShowingTypeValue =
  (typeof PaywallLocationShowingType)[keyof typeof PaywallLocationShowingType];

export const paywallLocations = pgTable(
  "paywall_location",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 1000 }),
    archivedAt: timestamp("archived_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("paywall_location_slug_project_id_idx").on(table.slug, table.projectId),
    index("paywall_location_project_id_idx").on(table.projectId),
    index("paywall_location_archived_at_idx").on(table.archivedAt),
  ],
);

export const paywallLocationShowings = pgTable(
  "paywall_location_showing",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    paywallLocationId: varchar("paywall_location_id", {
      length: 255,
    }).notNull(),
    type: smallint("type").notNull().default(PaywallLocationShowingType.paywallRelease),
    paywallId: varchar("paywall_id", { length: 255 }),
    paywallReleaseId: varchar("paywall_release_id", { length: 255 }),
    featureFlagId: varchar("feature_flag_id", { length: 255 }),
    startedAt: timestamp("started_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true, precision: 3 }),
    createdByUserId: varchar("created_by_user_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("paywall_location_showing_location_ended_started_idx").on(
      table.paywallLocationId,
      table.endedAt,
      table.startedAt,
    ),
    index("paywall_location_showing_project_location_started_idx").on(
      table.projectId,
      table.paywallLocationId,
      table.startedAt,
    ),
    index("paywall_location_showing_release_idx").on(table.paywallReleaseId),
  ],
);

// ============================================
// PAYWALL CODE DEPLOYS
// (docs/specs/paywall-deploy-contract.md)
// ============================================

// Paywall deploy status enum: 1 = pending (created, blobs uploading),
// 2 = ready (finalized — the immutable commit point).
export const PaywallDeployStatus = {
  pending: 1,
  ready: 2,
} as const;

export type PaywallDeployStatusValue =
  (typeof PaywallDeployStatus)[keyof typeof PaywallDeployStatus];

/**
 * One CLI `voidhash deploy` invocation. `manifest` stores the full §1 deploy
 * manifest JSON; `manifestHash` is the sha256 of its canonical (sorted-key)
 * serialization and dedupes idempotent re-POSTs per project.
 */
export const paywallDeploys = pgTable(
  "paywall_deploy",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    schemaVersion: integer("schema_version").notNull(),
    cliVersion: varchar("cli_version", { length: 255 }).notNull(),
    runtimeVersion: varchar("runtime_version", { length: 255 }).notNull(),
    manifestHash: varchar("manifest_hash", { length: 64 }).notNull(),
    manifest: jsonb("manifest").$type<unknown>().notNull(),
    status: smallint("status").notNull().default(PaywallDeployStatus.pending),
    createdByName: varchar("created_by_name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("paywall_deploy_project_id_created_at_idx").on(table.projectId, table.createdAt),
    uniqueIndex("paywall_deploy_project_id_manifest_hash_idx").on(
      table.projectId,
      table.manifestHash,
    ),
  ],
);

/**
 * Content-addressed blob ledger, deduped per project: a sha256 already
 * uploaded by an earlier deploy is never re-uploaded (contract §4.1
 * `missing`). `storageKey` is the artifact-store key the raw bytes live at.
 */
export const paywallDeployBlobs = pgTable(
  "paywall_deploy_blob",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    bytes: integer("bytes").notNull(),
    contentType: varchar("content_type", { length: 255 }),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("paywall_deploy_blob_project_id_sha256_idx").on(table.projectId, table.sha256),
  ],
);

// Role a manifest-listed file plays within a deploy (contract §1).
export const PaywallDeployFileRole = {
  paywallHtml: 1,
  paywallJs: 2,
  asset: 3,
  source: 4,
  config: 5,
  componentManifest: 6,
  componentPreview: 7,
  componentRuntime: 8,
  componentPanel: 9,
} as const;

export type PaywallDeployFileRoleValue =
  (typeof PaywallDeployFileRole)[keyof typeof PaywallDeployFileRole];

/**
 * Flattened per-deploy view of every file the manifest references; used to
 * authorize blob uploads (a sha must be declared by the deploy) and to
 * compute the `missing` set.
 */
export const paywallDeployFiles = pgTable(
  "paywall_deploy_file",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    deployId: varchar("deploy_id", { length: 255 }).notNull(),
    role: smallint("role").notNull(),
    logicalPath: varchar("logical_path", { length: 512 }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
  },
  (table) => [index("paywall_deploy_file_deploy_id_idx").on(table.deployId)],
);

/** Code component upserted by deploy finalize (contract §4.3, per component). */
export const paywallComponents = pgTable(
  "paywall_component",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("paywall_component_project_id_slug_idx").on(table.projectId, table.slug)],
);

/**
 * Immutable component version created at finalize when the §1.2 contentHash
 * changed; `manifest` stores the validated §2 component manifest JSON.
 */
export const paywallComponentVersions = pgTable(
  "paywall_component_version",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    componentId: varchar("component_id", { length: 255 }).notNull(),
    deployId: varchar("deploy_id", { length: 255 }).notNull(),
    version: integer("version").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    manifest: jsonb("manifest").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("paywall_component_version_component_version_idx").on(
      table.componentId,
      table.version,
    ),
    index("paywall_component_version_component_hash_idx").on(table.componentId, table.contentHash),
  ],
);

// ============================================
// BILLING TABLES
// ============================================

export const BillingTier = {
  Enterprise: 3,
  Free: 1,
  Pro: 2,
} as const;

export type BillingTierValue = (typeof BillingTier)[keyof typeof BillingTier];

export const BillingSubscriptionStatus = {
  Active: 1,
  Canceled: 2,
  None: 0,
  PastDue: 3,
  Trialing: 4,
} as const;

export type BillingSubscriptionStatusValue =
  (typeof BillingSubscriptionStatus)[keyof typeof BillingSubscriptionStatus];

/**
 * Links organizations to their billing configuration and provider customer
 */
export const organizationBilling = pgTable(
  "organization_billing",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 255 }).notNull(),

    /** Current billing tier */
    tier: smallint("tier").notNull().default(BillingTier.Free),

    /** Billing provider (e.g., 'polar', 'stripe') */
    billingProviderId: varchar("billing_provider_id", { length: 50 }).notNull().default("polar"),

    /** External customer ID in the billing provider (e.g., Polar customer ID) */
    externalCustomerId: varchar("external_customer_id", { length: 255 }),

    /** Subscription status synced from provider */
    subscriptionStatus: smallint("subscription_status")
      .notNull()
      .default(BillingSubscriptionStatus.None),

    /** External subscription ID in the billing provider */
    externalSubscriptionId: varchar("external_subscription_id", {
      length: 255,
    }),

    /** Current billing period start */
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true, precision: 3 }),

    /** Current billing period end */
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, precision: 3 }),

    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("organization_id_unique_idx").on(table.organizationId),
    index("external_customer_id_idx").on(table.externalCustomerId),
    index("billing_provider_id_idx").on(table.billingProviderId),
  ],
);

/**
 * Local usage records - stored locally first, then synced to provider asynchronously
 */
export const usageRecords = pgTable(
  "usage_record",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 255 }).notNull(),

    /** Metric identifier (e.g., 'paywall_conversions', 'monthly_tracked_revenue') */
    metricId: varchar("metric_id", { length: 100 }).notNull(),

    /** Usage value */
    value: bigint("value", { mode: "number" }).notNull(),

    /** Billing period this usage belongs to */
    periodStart: timestamp("period_start", { withTimezone: true, precision: 3 }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true, precision: 3 }).notNull(),

    /** Whether this record has been synced to the billing provider */
    syncedToProvider: boolean("synced_to_provider").notNull().default(false),
    syncedAt: timestamp("synced_at", { withTimezone: true, precision: 3 }),
    syncError: varchar("sync_error", { length: 500 }),

    /** Additional context for the usage event */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    /** When the usage event occurred */
    occurredAt: timestamp("occurred_at", { withTimezone: true, precision: 3 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
  },
  (table) => [
    index("org_metric_period_idx").on(
      table.organizationId,
      table.metricId,
      table.periodStart,
      table.periodEnd,
    ),
    index("synced_to_provider_idx").on(table.syncedToProvider),
  ],
);

/**
 * Pre-computed usage aggregates for performance
 */
export const usageAggregates = pgTable(
  "usage_aggregate",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 255 }).notNull(),

    /** Metric identifier */
    metricId: varchar("metric_id", { length: 100 }).notNull(),

    /** Billing period */
    periodStart: timestamp("period_start", { withTimezone: true, precision: 3 }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true, precision: 3 }).notNull(),

    /** Aggregated total value for the period */
    totalValue: bigint("total_value", { mode: "number" }).notNull().default(0),

    /** Limit for this metric (null = unlimited) */
    limitValue: bigint("limit_value", { mode: "number" }),

    /** Threshold at which to show warnings */
    warnThreshold: bigint("warn_threshold", { mode: "number" }),

    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("org_metric_period_unique_idx").on(
      table.organizationId,
      table.metricId,
      table.periodStart,
    ),
  ],
);

/**
 * Billing webhook events for idempotency tracking
 */
export const billingWebhookEvents = pgTable(
  "billing_webhook_event",
  {
    id: varchar("id", { length: 255 }).primaryKey(),

    /** Billing provider ID (e.g., 'polar', 'stripe') */
    providerId: varchar("provider_id", { length: 50 }).notNull(),

    /** External event ID from the provider */
    externalEventId: varchar("external_event_id", { length: 255 }).notNull(),

    /** Event type (e.g., 'subscription.created') */
    eventType: varchar("event_type", { length: 100 }).notNull(),

    /** Full event payload */
    payload: jsonb("payload").$type<object>(),

    /** When the event was processed (null = not yet processed) */
    processedAt: timestamp("processed_at", { withTimezone: true, precision: 3 }),

    /** Error message if processing failed */
    error: varchar("error", { length: 500 }),

    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
  },
  (table) => [
    uniqueIndex("provider_event_unique_idx").on(table.providerId, table.externalEventId),
    index("processed_at_idx").on(table.processedAt),
  ],
);

/**
 * WorkOS webhook events — idempotency tracking for the `/api/webhooks/workos`
 * endpoint. Insert with `processedAt = null`, mutate on success, leave the
 * `error` column populated on failure so WorkOS retries land on the same row
 * and the unique index drops duplicate deliveries.
 */
export const workosWebhookEvents = pgTable(
  "workos_webhook_event",
  {
    id: varchar("id", { length: 255 }).primaryKey(),

    /** WorkOS event id (from event.id) */
    externalEventId: varchar("external_event_id", { length: 255 }).notNull(),

    /** Event type (e.g., 'organization.created') */
    eventType: varchar("event_type", { length: 128 }).notNull(),

    /** Full event payload */
    payload: jsonb("payload").$type<object>(),

    /** When the event was processed (null = not yet processed) */
    processedAt: timestamp("processed_at", { withTimezone: true, precision: 3 }),

    /** Error message if processing failed */
    error: varchar("error", { length: 500 }),

    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
  },
  (table) => [
    uniqueIndex("workos_event_unique_idx").on(table.externalEventId),
    index("workos_event_processed_at_idx").on(table.processedAt),
  ],
);

/**
 * Billing provider meters - tracks meter sync status with provider
 */
export const billingProviderMeters = pgTable(
  "billing_provider_meter",
  {
    id: varchar("id", { length: 255 }).primaryKey(),

    /** Billing provider ID (e.g., 'polar', 'stripe') */
    providerId: varchar("provider_id", { length: 50 }).notNull(),

    /** Internal metric ID */
    metricId: varchar("metric_id", { length: 100 }).notNull(),

    /** External meter ID in the provider */
    externalMeterId: varchar("external_meter_id", { length: 255 }).notNull(),

    /** External meter slug (Polar-specific) */
    externalMeterSlug: varchar("external_meter_slug", { length: 255 }),

    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [uniqueIndex("provider_metric_unique_idx").on(table.providerId, table.metricId)],
);

// ============================================
// WEBHOOK TABLES
// ============================================

export const WebhookEndpointStatus = {
  Active: 1,
  Disabled: 2,
  Failed: 3,
} as const;

export type WebhookEndpointStatusValue =
  (typeof WebhookEndpointStatus)[keyof typeof WebhookEndpointStatus];

/**
 * Webhook endpoint configuration per project
 */
export const webhookEndpoints = pgTable(
  "webhook_endpoint",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 }).notNull(),

    /** User-defined name for the endpoint */
    name: varchar("name", { length: 255 }).notNull(),

    /** The URL to send webhooks to */
    url: varchar("url", { length: 2048 }).notNull(),

    /** HMAC secret for signing payloads (whsec_xxx) */
    secret: varchar("secret", { length: 255 }).notNull(),

    /** Endpoint status */
    status: smallint("status").notNull().default(WebhookEndpointStatus.Active),

    /** Events to subscribe to (JSON array of event types) */
    events: jsonb("events").$type<string[]>().notNull(),

    /** Optional description */
    description: varchar("description", { length: 500 }),

    /** Consecutive failure count for auto-disable */
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),

    /** Last successful delivery timestamp */
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true, precision: 3 }),

    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [index("webhook_endpoint_project_status_idx").on(table.projectId, table.status)],
);

export const WebhookDeliveryStatus = {
  Pending: 1,
  InProgress: 2,
  Succeeded: 3,
  Failed: 4,
  Exhausted: 5,
} as const;

export type WebhookDeliveryStatusValue =
  (typeof WebhookDeliveryStatus)[keyof typeof WebhookDeliveryStatus];

/**
 * Webhook delivery record (one per event per endpoint)
 */
export const webhookDeliveries = pgTable(
  "webhook_delivery",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    webhookEndpointId: varchar("webhook_endpoint_id", {
      length: 255,
    }).notNull(),
    projectId: varchar("project_id", { length: 255 }).notNull(),

    /** Event type (e.g., "person.created") */
    eventType: varchar("event_type", { length: 100 }).notNull(),

    /** The payload to deliver */
    payload: jsonb("payload").$type<object>().notNull(),

    /** Delivery status */
    status: smallint("status").notNull().default(WebhookDeliveryStatus.Pending),

    /** Number of attempts made */
    attemptCount: integer("attempt_count").notNull().default(0),

    /** Maximum retry attempts */
    maxAttempts: integer("max_attempts").notNull().default(5),

    /** Next scheduled attempt */
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, precision: 3 }),

    /** When the event occurred (for ordering) */
    eventOccurredAt: timestamp("event_occurred_at", { withTimezone: true, precision: 3 }).notNull(),

    /** When delivery completed (success or exhausted) */
    completedAt: timestamp("completed_at", { withTimezone: true, precision: 3 }),

    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
  },
  (table) => [
    index("webhook_delivery_endpoint_status_idx").on(table.webhookEndpointId, table.status),
    index("webhook_delivery_next_attempt_idx").on(table.nextAttemptAt),
  ],
);

/**
 * Webhook delivery attempt log (for debugging/history)
 */
export const webhookDeliveryAttempts = pgTable(
  "webhook_delivery_attempt",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    webhookDeliveryId: varchar("webhook_delivery_id", {
      length: 255,
    }).notNull(),

    /** Attempt number (1, 2, 3, ...) */
    attemptNumber: integer("attempt_number").notNull(),

    /** HTTP status code returned */
    statusCode: integer("status_code"),

    /** Response body (truncated) */
    responseBody: varchar("response_body", { length: 2048 }),

    /** Error message if failed */
    errorMessage: varchar("error_message", { length: 500 }),

    /** Request duration in milliseconds */
    durationMs: integer("duration_ms"),

    /** Whether this attempt succeeded */
    succeeded: boolean("succeeded").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
  },
  (table) => [index("webhook_attempt_delivery_idx").on(table.webhookDeliveryId)],
);

// ============================================
// AUDIT LOG TABLE
// ============================================

export const AuditLogEntityType = {
  ApiKey: "api_key",
  Person: "person",
  Experiment: "experiment",
  ExperimentVariant: "experiment_variant",
  ExperimentTreatment: "experiment_treatment",
  FeatureFlag: "feature_flag",
  FeatureFlagOverride: "feature_flag_override",
  FeatureFlagTarget: "feature_flag_target",
  FeatureFlagVariant: "feature_flag_variant",
  Organization: "organization",
  PaymentProviderConfiguration: "payment_provider_configuration",
  PaymentProviderProduct: "payment_provider_product",
  Paywall: "paywall",
  PaywallComponent: "paywall_component",
  PaywallDeploy: "paywall_deploy",
  PaywallLocation: "paywall_location",
  PaywallRelease: "paywall_release",
  Perk: "perk",
  Product: "product",
  ProductPerk: "product_perk",
  Project: "project",
  PushDeviceToken: "push_device_token",
  PushNotificationConfiguration: "push_notification_configuration",
  WebhookEndpoint: "webhook_endpoint",
} as const;

export type AuditLogEntityTypeValue = (typeof AuditLogEntityType)[keyof typeof AuditLogEntityType];

export const AuditLogAction = {
  Archived: "archived",
  Completed: "completed",
  Created: "created",
  Deleted: "deleted",
  Disabled: "disabled",
  Enabled: "enabled",
  OverrideRemoved: "override_removed",
  OverrideSet: "override_set",
  Paused: "paused",
  Published: "published",
  Restored: "restored",
  Started: "started",
  TargetAdded: "target_added",
  TargetRemoved: "target_removed",
  Updated: "updated",
} as const;

export type AuditLogActionValue = (typeof AuditLogAction)[keyof typeof AuditLogAction];

export const AuditLogActorType = {
  ApiKey: 2,
  System: 3,
  User: 1,
} as const;

export type AuditLogActorTypeValue = (typeof AuditLogActorType)[keyof typeof AuditLogActorType];

export const auditLogs = pgTable(
  "audit_log",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    parentEntityId: varchar("parent_entity_id", { length: 255 }),
    action: varchar("action", { length: 50 }).notNull(),
    actorUserId: varchar("actor_user_id", { length: 255 }),
    actorType: smallint("actor_type").notNull().default(AuditLogActorType.User),
    changes: jsonb("changes").$type<unknown>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
  },
  (table) => [
    index("audit_project_created_idx").on(table.projectId, table.createdAt),
    index("audit_entity_created_idx").on(table.entityType, table.entityId, table.createdAt),
    index("audit_project_entity_type_created_idx").on(
      table.projectId,
      table.entityType,
      table.createdAt,
    ),
    index("audit_actor_created_idx").on(table.actorUserId, table.createdAt),
  ],
);

// ============================================
// FEATURE FLAG TABLES
// ============================================

export const FeatureFlagTargetListType = {
  Allow: 1,
  Deny: 2,
} as const;

export type FeatureFlagTargetListTypeValue =
  (typeof FeatureFlagTargetListType)[keyof typeof FeatureFlagTargetListType];

export const FeatureFlagIdentityType = {
  PersonId: 1,
  DistinctId: 2,
  Email: 3,
  ExternalId: 4,
} as const;

export type FeatureFlagIdentityTypeValue =
  (typeof FeatureFlagIdentityType)[keyof typeof FeatureFlagIdentityType];

export const FeatureFlagType = {
  Boolean: "boolean",
  Json: "json",
  Number: "number",
  String: "string",
} as const;

export type FeatureFlagTypeValue = (typeof FeatureFlagType)[keyof typeof FeatureFlagType];

export const featureFlags = pgTable(
  "feature_flag",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    key: varchar("key", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 1000 }),
    type: varchar("type", { length: 20 })
      .$type<FeatureFlagTypeValue>()
      .notNull()
      .default(FeatureFlagType.Boolean),
    enabled: boolean("enabled").notNull().default(false),
    rolloutBps: integer("rollout_bps").notNull().default(10000),
    salt: varchar("salt", { length: 255 }).notNull(),
    internal: boolean("internal").notNull().default(false),
    ownerType: varchar("owner_type", { length: 50 }),
    ownerId: varchar("owner_id", { length: 255 }),
    archivedAt: timestamp("archived_at", { withTimezone: true, precision: 3 }),
    createdByUserId: varchar("created_by_user_id", { length: 255 }),
    updatedByUserId: varchar("updated_by_user_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("ff_key_project_id_idx").on(table.key, table.projectId),
    index("ff_project_id_idx").on(table.projectId),
  ],
);

export const featureFlagTargets = pgTable(
  "feature_flag_target",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    featureFlagId: varchar("feature_flag_id", { length: 255 }).notNull(),
    listType: smallint("list_type").notNull(),
    identityType: smallint("identity_type").notNull(),
    identityValue: varchar("identity_value", { length: 255 }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("ff_target_unique_idx").on(
      table.featureFlagId,
      table.listType,
      table.identityType,
      table.identityValue,
    ),
    index("ff_target_identity_idx").on(table.identityType, table.identityValue),
  ],
);

export const featureFlagOverrides = pgTable(
  "feature_flag_override",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    featureFlagId: varchar("feature_flag_id", { length: 255 }).notNull(),
    identityType: smallint("identity_type").notNull(),
    identityValue: varchar("identity_value", { length: 255 }).notNull(),
    forcedEnabled: boolean("forced_enabled"),
    // When set, pins the subject to this variant key (bypasses variant bucketing).
    // Primarily used to force a QA tester into a specific experiment arm.
    forcedVariantKey: varchar("forced_variant_key", { length: 255 }),
    note: varchar("note", { length: 1000 }),
    createdByUserId: varchar("created_by_user_id", { length: 255 }),
    updatedByUserId: varchar("updated_by_user_id", { length: 255 }),
    archivedAt: timestamp("archived_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("ff_override_unique_idx").on(
      table.featureFlagId,
      table.identityType,
      table.identityValue,
    ),
    index("ff_override_identity_idx").on(table.identityType, table.identityValue),
  ],
);

export const featureFlagVariants = pgTable(
  "feature_flag_variant",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    featureFlagId: varchar("feature_flag_id", { length: 255 }).notNull(),
    key: varchar("key", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    weightBps: integer("weight_bps").notNull().default(0),
    payload: jsonb("payload").$type<unknown>(),
    archivedAt: timestamp("archived_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("ff_variant_flag_key_idx").on(table.featureFlagId, table.key),
    index("ff_variant_flag_id_idx").on(table.featureFlagId),
  ],
);

/**
 * Internal (voidhash-internal) feature flags — per-organization on/off
 * overrides for our OWN unreleased product features. The set of available
 * flags and their code defaults live in code (`@voidhash/rpc`'s
 * `INTERNAL_FEATURE_FLAGS`); a row here records an explicit per-org override on
 * top of that default. Absence of a row means "use the code default".
 *
 * ⚠️ Distinct from `featureFlags` above, which is the customer-facing
 * feature-flag product (project-scoped, evaluated per end-user via the SDK).
 */
export const internalFeatureFlagOverrides = pgTable(
  "internal_feature_flag_override",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    flagKey: varchar("flag_key", { length: 100 }).notNull(),
    enabled: boolean("enabled").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("internal_feature_flag_override_org_key_uidx").on(
      table.organizationId,
      table.flagKey,
    ),
    index("internal_feature_flag_override_org_idx").on(table.organizationId),
  ],
);

/**
 * Organization-scoped image asset library. Users upload images (via the paywall
 * designer) that are stored in the public file store under
 * `paywall-assets/<organizationId>/<sha256>.<ext>`; the resulting public URL is
 * reused as a paywall background image. Content-addressed keys make uploads
 * deduplicating per org — the `key` unique index guarantees a single row per
 * stored object, which keeps best-effort object deletion on row-delete safe.
 */
export const paywallAsset = pgTable(
  "paywall_asset",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Display name; defaults to the original filename client-side. */
    name: varchar("name", { length: 255 }).notNull(),
    /** Object key in the public file store. */
    key: text("key").notNull(),
    /** Absolute public URL serving the object. */
    url: text("url").notNull(),
    contentType: varchar("content_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** Client-supplied intrinsic dimensions; optional. */
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("paywall_asset_key_uidx").on(table.key),
    index("paywall_asset_org_idx").on(table.organizationId),
  ],
);

/** Legacy pre-Pi chat rows retained while historical data ages out. */
export const voidhashAiChat = pgTable(
  "voidhash_ai_chat",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    /** Studio surface this chat belongs to (e.g. "designer"). */
    surface: varchar("surface", { length: 64 }).notNull(),
    /** "persistent" (listed, resumable) | "single_use" (stored, never listed). */
    chatType: varchar("chat_type", { length: 32 }).notNull(),
    /** Context scope for persistent chats (the paywall id in the designer). */
    paywallId: varchar("paywall_id", { length: 64 }),
    /** Creating user id (from the authenticated session); null if unknown. */
    userId: varchar("user_id", { length: 64 }),
    /** Short title derived from the first user message. */
    title: varchar("title", { length: 255 }).notNull(),
    /** Legacy JSON-encoded UI messages. */
    messages: text("messages").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("voidhash_ai_chat_org_idx").on(table.organizationId),
    // Backs the history list: a paywall/surface's persistent chats, newest first.
    index("voidhash_ai_chat_scope_idx").on(
      table.projectId,
      table.surface,
      table.paywallId,
      table.chatType,
    ),
    index("voidhash_ai_chat_updated_idx").on(table.updatedAt),
  ],
);

/** Legacy pre-Pi turn checkpoints retained with their historical chats. */
export const voidhashAiCheckpoint = pgTable(
  "voidhash_ai_checkpoint",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    /** The chat this checkpoint belongs to (cascade-deleted with the chat). */
    chatId: varchar("chat_id", { length: 64 })
      .notNull()
      .references(() => voidhashAiChat.id, { onDelete: "cascade" }),
    /** Groups the pre-images captured within one legacy chat turn. */
    turnId: varchar("turn_id", { length: 128 }).notNull(),
    /** The mimic document / paywall this pre-image belongs to. */
    paywallId: varchar("paywall_id", { length: 64 }).notNull(),
    /** The document's pre-write RAW encoded tree (mimic `TreeValue`). */
    tree: jsonb("tree").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
  },
  (table) => [
    // First-write-wins: one pre-image per (chat, turn, document). Backs the
    // ON CONFLICT DO NOTHING capture so only the FIRST write to a document in a
    // turn records the pre-turn image, and also serves the revert lookup.
    uniqueIndex("voidhash_ai_checkpoint_turn_doc_idx").on(
      table.chatId,
      table.turnId,
      table.paywallId,
    ),
    // Backs "last turn" discovery: a chat's turns, newest first.
    index("voidhash_ai_checkpoint_chat_idx").on(table.chatId, table.createdAt),
  ],
);

/**
 * Searchable metadata for durable Pi agent sessions. Conversation entries stay
 * in durable-entity storage; this table only backs scoped history and ownership.
 */
export const voidhashAgentSession = pgTable(
  "voidhash_agent_session",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    surface: varchar("surface", { length: 64 }).notNull(),
    paywallId: varchar("paywall_id", { length: 64 }),
    userId: varchar("user_id", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
  },
  (table) => [
    index("voidhash_agent_session_scope_idx").on(
      table.projectId,
      table.surface,
      table.paywallId,
      table.updatedAt,
    ),
    index("voidhash_agent_session_user_idx").on(table.userId, table.updatedAt),
  ],
);

// ============================================
// EXPERIMENT (A/B TESTING) TABLES
// ============================================

export const ExperimentStatus = {
  draft: 1,
  running: 2,
  paused: 3,
  concluded: 4,
} as const;

export type ExperimentStatusValue = (typeof ExperimentStatus)[keyof typeof ExperimentStatus];

/**
 * An experiment is an authoring + analysis layer that compiles down to a
 * backing customer feature flag (the runtime assignment artifact). The backing
 * flag is linked both ways: `experiment.featureFlagId` here, and, on the flag,
 * `feature_flag.ownerType='experiment'` / `ownerId=<experimentId>` /
 * `internal=true` (which hides it from the customer Feature Flags list and
 * blocks direct customer edits).
 */
export const experiments = pgTable(
  "experiment",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    featureFlagId: varchar("feature_flag_id", { length: 255 }).notNull(),
    key: varchar("key", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 1000 }),
    hypothesis: varchar("hypothesis", { length: 2000 }),
    status: smallint("status").notNull().default(ExperimentStatus.draft),
    primaryMetricEventName: varchar("primary_metric_event_name", { length: 255 }).notNull(),
    secondaryMetricEventNames: jsonb("secondary_metric_event_names").$type<string[]>(),
    startedAt: timestamp("started_at", { withTimezone: true, precision: 3 }),
    endedAt: timestamp("ended_at", { withTimezone: true, precision: 3 }),
    winningVariantId: varchar("winning_variant_id", { length: 255 }),
    createdByUserId: varchar("created_by_user_id", { length: 255 }),
    updatedByUserId: varchar("updated_by_user_id", { length: 255 }),
    archivedAt: timestamp("archived_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("experiment_key_project_id_idx").on(table.key, table.projectId),
    // 1:1 backing flag.
    uniqueIndex("experiment_feature_flag_id_idx").on(table.featureFlagId),
    index("experiment_project_id_idx").on(table.projectId),
  ],
);

/**
 * The arms of an experiment. This is the source of truth for variant identity
 * and weights; it is synced 1:1 (by `key`) into `feature_flag_variant` rows on
 * the backing flag so the existing deterministic bucketing engine assigns them.
 */
export const experimentVariants = pgTable(
  "experiment_variant",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    experimentId: varchar("experiment_id", { length: 255 }).notNull(),
    key: varchar("key", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    isControl: boolean("is_control").notNull().default(false),
    weightBps: integer("weight_bps").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("experiment_variant_experiment_key_idx").on(table.experimentId, table.key),
    index("experiment_variant_experiment_id_idx").on(table.experimentId),
  ],
);

/** Config for a `paywall_location` treatment: which paywall release to serve at
 * a given location for the owning variant. */
export interface PaywallLocationTreatmentConfig {
  readonly paywallLocationId: string;
  readonly paywallId: string;
  readonly paywallReleaseId: string;
}

/**
 * Config payload for an experiment treatment, discriminated at the service
 * layer by `experiment_treatment.treatmentType`. Kept as typed jsonb (rather
 * than hoisted columns) so new experiment surfaces (notification flows,
 * automations, …) add zero schema churn. Grows into a union as surfaces land.
 */
export type ExperimentTreatmentConfig = PaywallLocationTreatmentConfig;

/**
 * The extensible "change" primitive: one row per variant × surface target. For
 * v1 `treatmentType='paywall_location'` and `config` names the paywall release
 * to serve at a location for that variant. Compiled into the backing flag's
 * variant payload at authoring time. Uniqueness of (variantId, treatmentType,
 * target) is enforced at the service layer since the target lives inside jsonb.
 */
export const experimentTreatments = pgTable(
  "experiment_treatment",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    experimentId: varchar("experiment_id", { length: 255 }).notNull(),
    variantId: varchar("variant_id", { length: 255 }).notNull(),
    treatmentType: varchar("treatment_type", { length: 50 }).notNull(),
    config: jsonb("config").$type<ExperimentTreatmentConfig>().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("experiment_treatment_experiment_id_idx").on(table.experimentId),
    index("experiment_treatment_variant_id_idx").on(table.variantId),
  ],
);

/**
 * INTERNAL voidhash product feedback submitted from the studio navbar widget —
 * our own dogfooding channel, NOT a customer-facing feature. The `voidhash_`
 * prefix marks it as an internal table (like a future customer "feedback
 * collection" product could own a plain `feedback` table without colliding).
 *
 * Every row is a point-in-time snapshot: the submitter's identity and the
 * org/project/page they were on are copied in (not joined) so the overwatch
 * inbox stays readable even after the user, org, or project is renamed or
 * deleted. Org/project columns are nullable because feedback can be sent from
 * account-level pages that are not scoped to either. `topic`/`sentiment`/`status`
 * map to the const enums in `@voidhash/lib`.
 */
export const voidhashFeedback = pgTable(
  "voidhash_feedback",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    /** A `FeedbackTopic` product-area slug (see `@voidhash/lib`). */
    topic: varchar("topic", { length: 32 }).notNull(),
    /** Optional ordinal 1–4 `FeedbackSentiment`; null when the user skipped it. */
    sentiment: smallint("sentiment"),
    message: text("message").notNull(),
    /** Triage state (`FeedbackStatus`): 0 New, 1 Read, 2 Archived. */
    status: smallint("status").notNull().default(0),
    // Submitter snapshot (from the authenticated session, not the client).
    userId: varchar("user_id", { length: 255 }),
    userEmail: varchar("user_email", { length: 255 }),
    userName: varchar("user_name", { length: 255 }),
    // Organization context snapshot (nullable — account-level pages have none).
    organizationId: varchar("organization_id", { length: 255 }),
    organizationSlug: varchar("organization_slug", { length: 255 }),
    organizationName: varchar("organization_name", { length: 255 }),
    // Project context snapshot (nullable — org-level pages have none).
    projectId: varchar("project_id", { length: 255 }),
    projectSlug: varchar("project_slug", { length: 255 }),
    projectName: varchar("project_name", { length: 255 }),
    /** The route/path the user was on when they submitted (e.g. `/studio/…`). */
    pathname: varchar("pathname", { length: 1024 }),
    /** Browser user-agent, for reproducing UI reports. */
    userAgent: varchar("user_agent", { length: 512 }),
    /** Set when the inbox first transitions the row out of `New`. */
    readAt: timestamp("read_at", { withTimezone: true, precision: 3 }),
    /** Set when the inbox archives the row. */
    archivedAt: timestamp("archived_at", { withTimezone: true, precision: 3 }),
  },
  (table) => [
    index("voidhash_feedback_status_created_idx").on(table.status, table.createdAt),
    index("voidhash_feedback_created_idx").on(table.createdAt),
    index("voidhash_feedback_organization_idx").on(table.organizationId),
  ],
);

/**
 * A saved VoidQL analytics insight (docs/analytics-access-layer.html §15). Stores
 * the VoidQL *text* plus the catalog `schema_version` it was authored against —
 * NOT a frozen compiled statement — so it is re-validated and re-compiled on every
 * read, and the current tenant-injection + allow-list always apply.
 */
export const analyticsSavedQuery = pgTable(
  "analytics_saved_query",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    voidqlText: text("voidql_text").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("analytics_saved_query_org_idx").on(table.organizationId)],
);

/** A project-scoped saved product-analytics insight definition. */
export const analyticsInsights = pgTable(
  "analytics_insight",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 255 }).notNull(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    kind: varchar("kind", { length: 32 }).notNull(),
    definition: jsonb("definition").$type<unknown>().notNull(),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
  },
  (table) => [
    index("analytics_insight_project_idx").on(table.projectId, table.updatedAt),
    index("analytics_insight_organization_idx").on(table.organizationId),
  ],
);

/** A reusable, project-scoped set of analytics people. */
export const analyticsCohorts = pgTable(
  "analytics_cohort",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 255 }).notNull(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
  },
  (table) => [
    index("analytics_cohort_project_idx").on(table.projectId, table.updatedAt),
    index("analytics_cohort_organization_idx").on(table.organizationId),
  ],
);

/** Static person membership for a reusable analytics cohort. */
export const analyticsCohortMembers = pgTable(
  "analytics_cohort_member",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    cohortId: varchar("cohort_id", { length: 255 }).notNull(),
    personId: varchar("person_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("analytics_cohort_member_person_idx").on(table.cohortId, table.personId),
    index("analytics_cohort_member_cohort_idx").on(table.cohortId),
  ],
);

/** A project-scoped dashboard that arranges saved analytics insights. */
export const analyticsDashboards = pgTable(
  "analytics_dashboard",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 255 }).notNull(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
  },
  (table) => [
    index("analytics_dashboard_project_idx").on(table.projectId, table.updatedAt),
    index("analytics_dashboard_organization_idx").on(table.organizationId),
  ],
);

export interface AnalyticsDashboardItemLayout {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

/** A saved analytics insight or VoidQL query placement on a dashboard. */
export const analyticsDashboardItems = pgTable(
  "analytics_dashboard_item",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    dashboardId: varchar("dashboard_id", { length: 255 }).notNull(),
    sourceType: varchar("source_type", { length: 32 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    position: integer("position").notNull(),
    layout: jsonb("layout").$type<AnalyticsDashboardItemLayout>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("analytics_dashboard_item_source_idx").on(
      table.dashboardId,
      table.sourceType,
      table.sourceId,
    ),
    index("analytics_dashboard_item_position_idx").on(table.dashboardId, table.position),
  ],
);

/* ──────────────────────────────────────────────────────────────────────────
 * Push notifications
 *
 * Every identifier here uses the `push_` namespace to avoid colliding with the
 * entrenched payment-provider webhook domain (`paymentProviderNotification`,
 * prefix `ppn`). Only the three product-owner-fixed service class names keep
 * the word "Notification"; nothing in the data/ID layer does.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Per-(project, provider) push-credential store. Structural clone of
 * `paymentProviderConfigurations` — the `activeProviderId` generated column +
 * unique index gives exactly one active config per (project, provider) while
 * permitting unlimited soft-deleted rows (Postgres null-distinct semantics).
 * Secrets live encrypted inside `configuration`; the dashboard read DTO omits
 * them (write-only secrets).
 */
export const pushNotificationConfigs = pgTable(
  "push_notification_config",
  {
    id: varchar("id", { length: 255 }).primaryKey(), // push_conf_*
    projectId: varchar("project_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 50 }).notNull(), // 'fcm' | 'apns'
    /** Derived external key — FCM project_id / APNs bundleId. */
    pushProviderKey: varchar("push_provider_key", { length: 255 }).notNull().default("empty"),
    enabled: boolean("enabled").notNull().default(false),
    name: varchar("name", { length: 255 }).notNull().default("Unknown"),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
    activeProviderId: varchar("active_provider_id", { length: 50 }).generatedAlwaysAs(
      sql`(case when deleted_at is null then provider_id else null end)`,
    ),
  },
  (table) => [
    index("push_notification_config_project_id_idx").on(table.projectId),
    uniqueIndex("push_notification_config_project_active_provider_uidx").on(
      table.projectId,
      table.activeProviderId,
    ),
  ],
);

/**
 * The UUID ⟷ platform-credential mapping. `id` (`push_tok_*`) is the universal
 * device identifier above the `NotificationTokenService` boundary; routing is
 * driven by the `provider` column, never by `platform`. The dedup unique index
 * includes the coalesced `environment` so a sandbox APNs token never collides
 * with — or mis-routes against — a production one; re-registration revives a row
 * by clearing `invalidatedAt`/`deletedAt`.
 */
export const pushDeviceTokens = pgTable(
  "push_device_token",
  {
    id: varchar("id", { length: 255 }).primaryKey(), // push_tok_* (OUR device UUID)
    projectId: varchar("project_id", { length: 255 }).notNull(),
    platform: varchar("platform", { length: 20 }).notNull(), // 'ios' | 'android'
    provider: varchar("provider", { length: 20 }).notNull(), // 'fcm' | 'apns' (ROUTES BY THIS)
    platformToken: varchar("platform_token", { length: 1024 }).notNull(),
    bundleId: varchar("bundle_id", { length: 255 }), // required for apns
    environment: varchar("environment", { length: 20 }), // 'sandbox' | 'production', apns; in dedup key
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true, precision: 3 }),
    invalidationReason: varchar("invalidation_reason", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    // Freshness clock for invalidation gating — see NotificationTokenService.invalidate.
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
  },
  (table) => [
    uniqueIndex("push_device_token_dedup_uidx").on(
      table.projectId,
      table.provider,
      table.platformToken,
      sql`coalesce(${table.environment}, '')`,
    ),
    index("push_device_token_project_invalidated_idx").on(table.projectId, table.invalidatedAt),
  ],
);

/**
 * Person ⟷ device link (one person : many devices; one device : exactly one
 * current owner). `personId` is re-pointed to the merge survivor inside the
 * merge transaction (like `personIdentities.personId`); the send-time loader
 * also expands canonical persons to their merged-loser set as belt-and-suspenders.
 */
export const pushPersonDeviceTokens = pgTable(
  "push_person_device_token",
  {
    id: varchar("id", { length: 255 }).primaryKey(), // push_person_tok_*
    projectId: varchar("project_id", { length: 255 }).notNull(), // denormalized for tenant isolation
    personId: varchar("person_id", { length: 255 }).notNull(), // references persons.id; re-pointed on merge
    pushDeviceTokenId: varchar("push_device_token_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).$onUpdate(
      () => new Date(),
    ),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
  },
  (table) => [
    uniqueIndex("push_person_device_token_uidx").on(table.personId, table.pushDeviceTokenId),
    index("push_person_device_token_person_idx").on(table.personId, table.deletedAt),
    index("push_person_device_token_token_idx").on(table.pushDeviceTokenId, table.deletedAt),
  ],
);

/** Parent send roll-up status (a pure aggregate of the child deliveries). */
export const PushNotificationSendStatus = {
  Pending: 1,
  InProgress: 2,
  Succeeded: 3,
  PartialFailed: 4,
  Failed: 5,
  NoRecipients: 6,
} as const;

export type PushNotificationSendStatusValue =
  (typeof PushNotificationSendStatus)[keyof typeof PushNotificationSendStatus];

/**
 * One row per `NotificationSendingService.send` call — the analog of a webhook
 * "event". Holds per-status counts so `NoRecipients` ("reached nobody") is
 * distinguishable from `Succeeded` ("all delivered"), records
 * `unresolvedDistinctIds` (targeting an identity with no mapping never fails the
 * send), and supports an optional caller `idempotencyKey` collapsing retries.
 * `message` is PII-at-rest and TTL-purged.
 */
export const pushNotificationSends = pgTable(
  "push_notification_send",
  {
    id: varchar("id", { length: 255 }).primaryKey(), // push_send_*
    projectId: varchar("project_id", { length: 255 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    message: jsonb("message").$type<Record<string, unknown>>().notNull(), // PII
    requestedPersonIds: jsonb("requested_person_ids").$type<string[]>().notNull().default([]),
    requestedDistinctIds: jsonb("requested_distinct_ids").$type<string[]>().notNull().default([]),
    unresolvedDistinctIds: jsonb("unresolved_distinct_ids").$type<string[]>().notNull().default([]),
    status: smallint("status").notNull().default(PushNotificationSendStatus.Pending),
    deviceCount: integer("device_count").notNull().default(0),
    succeededCount: integer("succeeded_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    messagePurgedAt: timestamp("message_purged_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, precision: 3 }),
  },
  (table) => [
    index("push_notification_send_project_created_idx").on(table.projectId, table.createdAt),
    // Partial: collapse client retries only when a key was supplied.
    uniqueIndex("push_notification_send_idempotency_uidx")
      .on(table.projectId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
  ],
);

/** Per-device delivery status — mirrors `webhook_delivery`, incl. `Exhausted`. */
export const PushNotificationDeliveryStatus = {
  Pending: 1,
  InProgress: 2,
  Succeeded: 3,
  Failed: 4,
  Exhausted: 5,
} as const;

export type PushNotificationDeliveryStatusValue =
  (typeof PushNotificationDeliveryStatus)[keyof typeof PushNotificationDeliveryStatus];

/**
 * One row per `(send, device)`. The atomic `Pending|Failed -> InProgress`
 * claim/CAS on this row is the idempotency guard against double-delivery. The
 * consumer routes on the `provider` column copied from the token row;
 * `nextAttemptAt` is observability-only (the Queue, not a poller, schedules
 * retries).
 */
export const pushNotificationDeliveries = pgTable(
  "push_notification_delivery",
  {
    id: varchar("id", { length: 255 }).primaryKey(), // push_del_*
    pushNotificationSendId: varchar("push_notification_send_id", { length: 255 }).notNull(),
    projectId: varchar("project_id", { length: 255 }).notNull(),
    personId: varchar("person_id", { length: 255 }).notNull(),
    pushDeviceTokenId: varchar("push_device_token_id", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 20 }).notNull(), // consumer routes by THIS
    status: smallint("status").notNull().default(PushNotificationDeliveryStatus.Pending),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, precision: 3 }),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    lastError: varchar("last_error", { length: 500 }),
    completedAt: timestamp("completed_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
  },
  (table) => [
    // Per-(send,device) idempotency: no double-delivery ROW within a send.
    uniqueIndex("push_notification_delivery_send_device_uidx").on(
      table.pushNotificationSendId,
      table.pushDeviceTokenId,
    ),
    // Race-free parent roll-up via GROUP BY status.
    index("push_notification_delivery_send_status_idx").on(
      table.pushNotificationSendId,
      table.status,
    ),
    // Observability / backstop only — NOT a retry poller.
    index("push_notification_delivery_next_attempt_idx").on(table.status, table.nextAttemptAt),
  ],
);

/**
 * Append-only attempt log, one row per attempt — mirrors
 * `webhook_delivery_attempt`. `responseBody` may echo the payload, so it is
 * PII-at-rest and TTL-purged alongside `send.message`.
 */
export const pushNotificationDeliveryAttempts = pgTable(
  "push_notification_delivery_attempt",
  {
    id: varchar("id", { length: 255 }).primaryKey(), // push_att_*
    pushNotificationDeliveryId: varchar("push_notification_delivery_id", {
      length: 255,
    }).notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    statusCode: integer("status_code"), // FCM/APNs HTTP code
    providerErrorCode: varchar("provider_error_code", { length: 100 }),
    responseBody: varchar("response_body", { length: 2048 }), // truncated; TTL-purged
    errorMessage: varchar("error_message", { length: 500 }),
    durationMs: integer("duration_ms"),
    succeeded: boolean("succeeded").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
  },
  (table) => [
    index("push_notification_delivery_attempt_delivery_idx").on(table.pushNotificationDeliveryId),
  ],
);
