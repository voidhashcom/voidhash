import { sql, relations } from "drizzle-orm";
import {
	boolean,
	varchar,
	index,
	mysqlEnum,
	timestamp,
	json,
	uniqueIndex,
} from "drizzle-orm/mysql-core";
import { mysqlTable } from "drizzle-orm/mysql-core";
import { organization } from "./auth-schema";
import { PRODUCT_TYPES, SUBSCRIPTION_STATUSES } from "@voidhash/lib";
export * from "./auth-schema";

export const projects = mysqlTable(
	"project",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		slug: varchar("slug", { length: 255 }).notNull(),
		organizationId: varchar("organization_id", { length: 255 }).notNull(),
		createdByUserId: varchar("created_by", { length: 255 }),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		index("organization_id_idx").on(table.organizationId),
		uniqueIndex("slug_oragnization_id_idx").on(
			table.slug,
			table.organizationId
		),
	]
);

export const projectsRelations = relations(projects, ({ one }) => ({
	organization: one(organization, {
		fields: [projects.organizationId],
		references: [organization.id],
	}),
}));

export const apiKeys = mysqlTable("api_key", {
	id: varchar("id", { length: 255 }).primaryKey(),

	name: varchar("name", { length: 255 }).notNull(),

	/**
	 * Shows the first few characters of the API key
	 * This allows you to show those few characters in the UI to make it easier for users to identify the API key.
	 */
	end: varchar("start", { length: 255 }).notNull(),
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
	environment: mysqlEnum("environment", ["production", "testing"]).notNull(),
	projectId: varchar("project_id", { length: 255 }).notNull(),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
	project: one(projects, {
		fields: [apiKeys.projectId],
		references: [projects.id],
	}),
}));

export const customers = mysqlTable(
	"customer",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		name: varchar("name", { length: 255 }),
		// Connecting customer to user in app
		appUserId: varchar("app_user_id", { length: 255 }),
		email: varchar("email", { length: 255 }),
		/**
		 * From where the customer was created
		 */
		origin: mysqlEnum("origin", [
			"dashboard",
			"ios",
			"android",
			"stripe",
			"api",
		]).notNull(),
		projectId: varchar("project_id", { length: 255 }).notNull(),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		uniqueIndex("app_user_id_project_id_idx").on(
			table.appUserId,
			table.projectId
		),
	]
);

export const customersUnlockedPerks = mysqlTable(
	"customer_unlocked_perk",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		customerId: varchar("customer_id", { length: 255 }).notNull(),
		perkId: varchar("perk_id", { length: 255 }).notNull(),
		// Controls the lifetime of the perk
		unlockedByCustomerProductId: varchar("unlocked_by_purchase_id", {
			length: 255,
		}).notNull(),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		uniqueIndex("customer_id_perk_id_idx").on(table.customerId, table.perkId),
	]
);

export const purchases = mysqlTable(
	"purchase",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		customerId: varchar("customer_id", { length: 255 }).notNull(),

		providerKey: varchar("provider_key", { length: 255 }).notNull(),

		/**
		 * Subscription status - can be active, trialing, or canceled
		 */
		type: mysqlEnum("type", PRODUCT_TYPES).default("subscription").notNull(),

		status: mysqlEnum("status", SUBSCRIPTION_STATUSES).default("active"),

		providerProductId: varchar("provider_product_id", {
			length: 255,
		}).notNull(),
		/**
		 * The environment the subscription was purchased in
		 */
		environment: mysqlEnum("environment", ["production", "sandbox"]).default(
			"production"
		),
		/**
		 * The date the subscription started
		 */
		startsAt: timestamp("starts_at").notNull(),
		/**
		 * The date the subscription expires. Null if the subscription is not set to expire or if it is a one-time purchase
		 */
		expiresAt: timestamp("expires_at"),
		/**
		 * The date the subscription was purchased
		 */
		purchasedAt: timestamp("purchased_at").notNull(),
		/**
		 * Whether the subscription is set to cancel at the end of the current period
		 */
		cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
		/**
		 * The date the subscription was canceled
		 */
		canceledAt: timestamp("canceled_at"),

		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [uniqueIndex("provider_key_idx").on(table.providerKey)]
);

export const customerRelations = relations(customers, ({ many }) => ({
	externalIdentifiers: many(externalCustomerIdentifiers),
}));

export const externalCustomerIdentifiers = mysqlTable(
	"external_customer_identifier",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		customerId: varchar("customer_id", { length: 255 }).notNull(),
		serviceId: varchar("service_id", { length: 255 }).notNull(), // stripe, appstore, slack etc
		isDefault: boolean("is_default").notNull(),
		identifier: varchar("identifier", { length: 255 }).notNull(),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		index("customer_id_service_id_identifier_idx").on(
			table.customerId,
			table.serviceId,
			table.identifier
		),
	]
);
export const externalCustomerIdentifiersRelations = relations(
	externalCustomerIdentifiers,
	({ one }) => ({
		customer: one(customers, {
			fields: [externalCustomerIdentifiers.customerId],
			references: [customers.id],
		}),
	})
);

export const projectPaymentProviderConfigurations = mysqlTable(
	"project_payment_provider_configuration",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		providerId: varchar("provider_id", { length: 255 }),
		projectId: varchar("project_id", { length: 255 }).notNull(),
		enabled: boolean("enabled").notNull().default(false),
		configuration: json("configuration").$type<object>(),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		uniqueIndex("project_id_provider_id_idx").on(
			table.projectId,
			table.providerId
		),
		index("project_id_idx").on(table.projectId),
		index("provider_id_idx").on(table.providerId),
	]
);

// Perk
export const perks = mysqlTable(
	"perk",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		slug: varchar("slug", { length: 255 }).notNull(),
		name: varchar("name", { length: 255 }).notNull(),
		projectId: varchar("project_id", { length: 255 }).notNull(),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		uniqueIndex("slug_project_id_idx").on(table.slug, table.projectId),
	]
);

export const products = mysqlTable("product", {
	id: varchar("id", { length: 255 }).primaryKey(),
	type: mysqlEnum("type", PRODUCT_TYPES).default("subscription").notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	projectId: varchar("project_id", { length: 255 }).notNull(),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const productPerks = mysqlTable(
	"product_perk",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		productId: varchar("product_id", { length: 255 }).notNull(),
		perkId: varchar("perk_id", { length: 255 }).notNull(),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		uniqueIndex("product_id_perk_id_idx").on(table.productId, table.perkId),
	]
);

export const productProviderConfigurations = mysqlTable(
	"product_provider_configuration",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		providerProductKey: varchar("provider_product_key", {
			length: 255,
		}).notNull(),
		productId: varchar("product_id", { length: 255 }).notNull(),
		isActive: boolean("is_active").notNull().default(true),
		providerId: varchar("provider_id", { length: 255 }).notNull(),
		configuration: json("configuration").$type<object>(),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		uniqueIndex("product_id_provider_id_provider_product_key_idx").on(
			table.productId,
			table.providerId,
			table.providerProductKey
		),
		index("provider_id_idx").on(table.providerId),
	]
);

// Paywall
export const paywalls = mysqlTable("paywall", {
	id: varchar("id", { length: 255 }).primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	projectId: varchar("project_id", { length: 255 }).notNull(),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const paywallProducts = mysqlTable(
	"paywall_product",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		paywallId: varchar("paywall_id", { length: 255 })
			.notNull()
			.references(() => paywalls.id),
		productId: varchar("product_id", { length: 255 })
			.notNull()
			.references(() => products.id),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		uniqueIndex("paywall_id_product_id_idx").on(
			table.paywallId,
			table.productId
		),
	]
);

export const paywallProductRelations = relations(
	paywallProducts,
	({ one }) => ({
		product: one(products, {
			fields: [paywallProducts.productId],
			references: [products.id],
		}),
	})
);

// Paywall Locations
export const paywallLocations = mysqlTable(
	"paywall_location",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		slug: varchar("slug", { length: 255 }).notNull(),
		name: varchar("name", { length: 255 }).notNull(),
		defaultPaywallId: varchar("default_paywall_id", {
			length: 255,
		}).notNull(),
		projectId: varchar("project_id", { length: 255 }).notNull(),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		uniqueIndex("slug_project_id_idx").on(table.slug, table.projectId),
	]
);
