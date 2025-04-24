import { sql, relations } from "drizzle-orm";
import {
	boolean,
	varchar,
	index,
	mysqlEnum,
	primaryKey,
	timestamp,
	json,
	uniqueIndex,
} from "drizzle-orm/mysql-core";
import { mysqlTable } from "drizzle-orm/mysql-core";
import { organization, user } from "./auth-schema";

export * from "./auth-schema";

export const projects = mysqlTable(
	"projects",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		slug: varchar("slug", { length: 255 }).notNull(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organization.id),
		createdByUserId: varchar("created_by", { length: 255 })
			.notNull()
			.references(() => user.id),
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

export const apiKeys = mysqlTable("api_keys", {
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
	projectId: varchar("project_id", { length: 255 })
		.notNull()
		.references(() => projects.id, {
			onDelete: "cascade",
		}),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
	project: one(projects, {
		fields: [apiKeys.projectId],
		references: [projects.id],
	}),
}));

export const customer = mysqlTable(
	"customer",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		name: varchar("name", { length: 255 }),
		// Connecting customer to user in app
		appUserId: varchar("app_user_id", { length: 255 }),
		email: varchar("email", { length: 255 }),
		projectId: varchar("project_id", { length: 255 })
			.notNull()
			.references(() => projects.id),
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

export const projectPaymentProviderConfiguration = mysqlTable(
	"project_payment_provider_configuration",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		providerId: varchar("provider_id", { length: 255 }),
		projectId: varchar("project_id", { length: 255 })
			.notNull()
			.references(() => projects.id, {
				onDelete: "cascade",
			}),
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

export const product = mysqlTable("product", {
	id: varchar("id", { length: 255 }).primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	projectId: varchar("project_id", { length: 255 })
		.notNull()
		.references(() => projects.id),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const productProviderConfiguration = mysqlTable(
	"product_provider_configuration",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		providerProductKey: varchar("provider_product_key", {
			length: 255,
		}).notNull(),
		productId: varchar("product_id", { length: 255 })
			.notNull()
			.references(() => product.id, {
				onDelete: "cascade",
			}),
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
export const paywall = mysqlTable("paywall", {
	id: varchar("id", { length: 255 }).primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	projectId: varchar("project_id", { length: 255 })
		.notNull()
		.references(() => projects.id),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const paywallProduct = mysqlTable(
	"paywall_product",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		paywallId: varchar("paywall_id", { length: 255 })
			.notNull()
			.references(() => paywall.id),
		productId: varchar("product_id", { length: 255 })
			.notNull()
			.references(() => product.id),
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

export const paywallProductRelations = relations(paywallProduct, ({ one }) => ({
	product: one(product, {
		fields: [paywallProduct.productId],
		references: [product.id],
	}),
}));
