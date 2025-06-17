import { sql, relations } from "drizzle-orm";
import {
	boolean,
	varchar,
	index,
	mysqlEnum,
	timestamp,
	json,
	uniqueIndex,
	int,
} from "drizzle-orm/mysql-core";
import { mysqlTable } from "drizzle-orm/mysql-core";
import { organization } from "./auth-schema";
import {
	ENVIRONMENTS,
	PRODUCT_TYPES,
	SUBSCRIPTION_STATUSES,
} from "@voidhash/lib";
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
	environment: mysqlEnum("environment", ENVIRONMENTS)
		.default("production")
		.notNull(),
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
		type: mysqlEnum("type", ["anonymous", "identified"])
			.default("anonymous")
			.notNull(),
		name: varchar("name", { length: 255 }),
		// Connecting customer to user in app
		appUserId: varchar("app_user_id", { length: 255 }).notNull(),
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
		environment: mysqlEnum("environment", ENVIRONMENTS)
			.default("production")
			.notNull(),
		projectId: varchar("project_id", { length: 255 }).notNull(),
		parentCustomerId: varchar("parent_customer_id", { length: 255 }), // When Identified, we store the parent customer id
		archivedAt: timestamp("archived_at"),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		uniqueIndex("app_user_id_project_id_idx").on(
			table.appUserId,
			table.projectId
		),
		index("parent_customer_id_idx").on(table.parentCustomerId),
	]
);

export const customerRelations = relations(customers, ({ many, one }) => ({
	externalIdentifiers: many(externalCustomerIdentifiers),
	parentCustomer: one(customers, {
		fields: [customers.parentCustomerId],
		references: [customers.id],
	}),
}));

export const customersUnlockedPerks = mysqlTable(
	"customer_unlocked_perk",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		customerId: varchar("customer_id", { length: 255 }).notNull(),
		perkId: varchar("perk_id", { length: 255 }).notNull(),
		// Controls the lifetime of the perk
		unlockedByPurchaseId: varchar("unlocked_by_purchase_id", {
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

		paymentProviderConfigurationProductId: varchar(
			"payment_provider_configuration_product_id",
			{
				length: 255,
			}
		).notNull(),

		/**
		 * The environment the subscription was purchased in
		 */
		purchaseEnvironment: mysqlEnum("purchase_environment", [
			"production",
			"sandbox",
		])
			.default("production")
			.notNull(),
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

export const charges = mysqlTable("charge", {
	id: varchar("id", { length: 255 }).primaryKey(),
	customerId: varchar("customer_id", { length: 255 }).notNull(),
	amount: int("amount").notNull(),
	currency: varchar("currency", { length: 3 }).notNull(),
	paymentProviderConfigurationProductId: varchar(
		"payment_provider_product_configuration_id",
		{
			length: 255,
		}
	).notNull(),
	purchaseId: varchar("purchase_id", { length: 255 }).notNull(),
	environment: mysqlEnum("environment", ENVIRONMENTS)
		.default("production")
		.notNull(),
	purchaseEnvironment: mysqlEnum("purchase_environment", [
		"production",
		"sandbox",
	])
		.default("production")
		.notNull(),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at").onUpdateNow(),
});

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

export const paymentProviderConfigurations = mysqlTable(
	"payment_provider_configuration",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		providerId: varchar("provider_id", { length: 255 }).notNull(),
		projectId: varchar("project_id", { length: 255 }).notNull(),
		enabled: boolean("enabled").notNull().default(false),
		name: varchar("name", { length: 255 }).notNull().default("Unknown"),
		configuration: json("configuration").$type<object>(),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [
		index("project_id_idx").on(table.projectId),
		index("provider_id_idx").on(table.providerId),
	]
);

export const paymentProviderConfigurationRelations = relations(
	paymentProviderConfigurations,
	({ one, many }) => ({
		project: one(projects, {
			fields: [paymentProviderConfigurations.projectId],
			references: [projects.id],
		}),
		paymentProviderConfigurationProducts: many(
			paymentProviderConfigurationProducts
		),
	})
);

// Perk
export const perks = mysqlTable(
	"perk",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		slug: varchar("slug", { length: 255 }).notNull(),
		name: varchar("name", { length: 255 }).notNull(),
		environment: mysqlEnum("environment", ENVIRONMENTS)
			.default("production")
			.notNull(),
		projectId: varchar("project_id", { length: 255 }).notNull(),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		uniqueIndex("slug_project_id_idx").on(
			table.slug,
			table.projectId,
			table.environment
		),
	]
);

export const perkRelations = relations(perks, ({ many }) => ({
	productPerks: many(productPerks),
}));

export const products = mysqlTable("product", {
	id: varchar("id", { length: 255 }).primaryKey(),
	type: mysqlEnum("type", PRODUCT_TYPES).default("subscription").notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	environment: mysqlEnum("environment", ENVIRONMENTS)
		.default("production")
		.notNull(),
	projectId: varchar("project_id", { length: 255 }).notNull(),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const productRelations = relations(products, ({ many }) => ({
	perks: many(productPerks),
	paywallProducts: many(paywallProducts),
	checkoutSessions: many(checkoutSessions),
	paymentProviderConfigurationProducts: many(
		paymentProviderConfigurationProducts
	),
}));

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

export const productPerkRelations = relations(productPerks, ({ one }) => ({
	product: one(products, {
		fields: [productPerks.productId],
		references: [products.id],
	}),
	perk: one(perks, {
		fields: [productPerks.perkId],
		references: [perks.id],
	}),
}));

export const paymentProviderConfigurationProducts = mysqlTable(
	"payment_provider_configuration_product",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		paymentProviderConfigurationId: varchar(
			"payment_provider_configuration_id",
			{
				length: 255,
			}
		).notNull(),
		providerProductKey: varchar("provider_product_key", {
			length: 255,
		}).notNull(),
		productId: varchar("product_id", { length: 255 }).notNull(),
		environment: mysqlEnum("environment", ENVIRONMENTS)
			.default("production")
			.notNull(),
		isActive: boolean("is_active").notNull().default(true),
		configuration: json("configuration").$type<object>(),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		uniqueIndex("product_provider_configuration_ext_pk_idx").on(
			table.paymentProviderConfigurationId,
			table.providerProductKey,
			table.productId,
			table.environment
		),
		index("payment_provider_configuration_id_idx").on(
			table.paymentProviderConfigurationId
		),
	]
);

export const PaymentProviderConfigurationProductRelations = relations(
	paymentProviderConfigurationProducts,
	({ one }) => ({
		product: one(products, {
			fields: [paymentProviderConfigurationProducts.productId],
			references: [products.id],
		}),
		paymentProviderConfiguration: one(paymentProviderConfigurations, {
			fields: [
				paymentProviderConfigurationProducts.paymentProviderConfigurationId,
			],
			references: [paymentProviderConfigurations.id],
		}),
	})
);

// Paywall
export const paywalls = mysqlTable("paywall", {
	id: varchar("id", { length: 255 }).primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	environment: mysqlEnum("environment", ENVIRONMENTS)
		.default("production")
		.notNull(),
	projectId: varchar("project_id", { length: 255 }).notNull(),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const paywallRelations = relations(paywalls, ({ many }) => ({
	paywallProducts: many(paywallProducts),
}));

export const paywallProducts = mysqlTable(
	"paywall_product",
	{
		id: varchar("id", { length: 255 }).primaryKey(),
		displayName: varchar("display_name", { length: 255 })
			.notNull()
			.default("Unknown"),
		paywallId: varchar("paywall_id", { length: 255 }).notNull(),
		productId: varchar("product_id", { length: 255 }).notNull(),
		enableNativePurchase: boolean("enable_native_purchase")
			.notNull()
			.default(true),
		enableWebCheckout: boolean("enable_web_checkout").notNull().default(false),
		webCheckoutPaymentProviderConfigurationProductId: varchar(
			"web_checkout_payment_provider_product_configuration_id",
			{
				length: 255,
			}
		),
		order: int("order").notNull().default(0),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		uniqueIndex("paywall_id_product_id_idx").on(
			table.paywallId,
			table.productId
		),
		index("paywall_id_idx").on(table.paywallId),
		index("product_id_idx").on(table.productId),
		uniqueIndex("paywall_id_order_idx").on(table.paywallId, table.order),
	]
);

export const paywallProductRelations = relations(
	paywallProducts,
	({ one }) => ({
		product: one(products, {
			fields: [paywallProducts.productId],
			references: [products.id],
		}),
		paywall: one(paywalls, {
			fields: [paywallProducts.paywallId],
			references: [paywalls.id],
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
		environment: mysqlEnum("environment", ENVIRONMENTS)
			.default("production")
			.notNull(),
		projectId: varchar("project_id", { length: 255 }).notNull(),
		createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp("updated_at").onUpdateNow(),
	},
	(table) => [
		uniqueIndex("slug_project_id_idx").on(
			table.slug,
			table.projectId,
			table.environment
		),
	]
);

export const paywallLocationRelations = relations(
	paywallLocations,
	({ one }) => ({
		defaultPaywall: one(paywalls, {
			fields: [paywallLocations.defaultPaywallId],
			references: [paywalls.id],
		}),
	})
);

export const checkoutSessions = mysqlTable("checkout_session", {
	id: varchar("id", { length: 255 }).primaryKey(),
	customerId: varchar("customer_id", { length: 255 }).notNull(),
	paymentProviderConfigurationProductId: varchar(
		"payment_provider_configuration_product_id",
		{
			length: 255,
		}
	).notNull(),
	status: mysqlEnum("status", ["pending", "success", "error", "cancelled"])
		.notNull()
		.default("pending"),
	successCallbackUrl: varchar("success_callback_url", {
		length: 255,
	})
		.notNull()
		.default("LEGACY"),
	errorCallbackUrl: varchar("error_callback_url", { length: 255 })
		.notNull()
		.default("LEGACY"),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at").onUpdateNow(),
});

export const checkoutSessionRelations = relations(
	checkoutSessions,
	({ one }) => ({
		customer: one(customers, {
			fields: [checkoutSessions.customerId],
			references: [customers.id],
		}),
		paymentProviderConfigurationProduct: one(
			paymentProviderConfigurationProducts,
			{
				fields: [checkoutSessions.paymentProviderConfigurationProductId],
				references: [paymentProviderConfigurationProducts.id],
			}
		),
	})
);

export const outbox = mysqlTable("outbox", {
	id: varchar("id", { length: 255 }).primaryKey(),
	topic: varchar("topic", { length: 255 }).notNull(),
	payload: json("payload").$type<object>(),
	publishedAt: timestamp("published_at"),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});
