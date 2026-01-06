import { ProductType, PurchaseType, SubscriptionStatus } from '@voidhash/lib';
import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  int,
  json,
  mysqlTable,
  timestamp,
  tinyint,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core';
import { organization } from './auth-schema';

export * from './auth-schema';

export const projects = mysqlTable(
  'project',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    organizationId: varchar('organization_id', { length: 255 }).notNull(),
    createdByUserId: varchar('created_by', { length: 255 }),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [
    index('organization_id_idx').on(table.organizationId),
    uniqueIndex('slug_oragnization_id_idx').on(table.slug, table.organizationId)
  ]
);

export const projectsRelations = relations(projects, ({ one }) => ({
  organization: one(organization, {
    fields: [projects.organizationId],
    references: [organization.id]
  })
}));

export const apiKeys = mysqlTable('api_key', {
  id: varchar('id', { length: 255 }).primaryKey(),

  name: varchar('name', { length: 255 }).notNull(),

  /**
   * Shows the first few characters of the API key
   * This allows you to show those few characters in the UI to make it easier for users to identify the API key.
   */
  end: varchar('start', { length: 255 }).notNull(),
  /**
   * The full API key.
   */
  key: varchar('key', { length: 255 }).notNull(),
  /**
   * The prefix of the key.
   */
  prefix: varchar('prefix', { length: 16 }).notNull(),
  /**
   * Whether the API key is public. Public keys are not hashed and are visible to users.
   */
  isPublic: boolean('is_public').notNull().default(false),
  /**
   * The environment of the API key.
   */
  projectId: varchar('project_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').onUpdateNow()
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  project: one(projects, {
    fields: [apiKeys.projectId],
    references: [projects.id]
  })
}));

export const CustomerType = {
  Anonymous: 1,
  Identified: 2
} as const;

export type CustomerTypeValue =
  (typeof CustomerType)[keyof typeof CustomerType];

export const CustomerOrigin = {
  Dashboard: 1,
  IOS: 2,
  Android: 3,
  Stripe: 4,
  API: 5
} as const;

export type CustomerOriginValue =
  (typeof CustomerOrigin)[keyof typeof CustomerOrigin];

export type AdditionalCustomerAttributes = {
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
};

export const customers = mysqlTable(
  'customer',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    type: tinyint('type').notNull().default(CustomerType.Anonymous),
    name: varchar('name', { length: 255 }),
    // Connecting customer to user in app
    appUserId: varchar('app_user_id', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    additionalAttributes: json(
      'additional_attributes'
    ).$type<AdditionalCustomerAttributes>(),

    /**
     * From where the customer was created
     */
    origin: tinyint('origin').notNull().default(CustomerOrigin.Dashboard),
    projectId: varchar('project_id', { length: 255 }).notNull(),
    parentCustomerId: varchar('parent_customer_id', { length: 255 }), // When Identified, we store the parent customer id
    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [
    uniqueIndex('app_user_id_project_id_environment_idx').on(
      table.appUserId,
      table.projectId
    ),
    index('parent_customer_id_idx').on(table.parentCustomerId)
  ]
);

export const customerRelations = relations(customers, ({ many, one }) => ({
  externalIdentifiers: many(externalCustomerIdentifiers),
  parentCustomer: one(customers, {
    fields: [customers.parentCustomerId],
    references: [customers.id]
  })
}));

export const CustomerUnlockedPerkStatus = {
  Active: 1,
  Expired: 2
} as const;

export type CustomerUnlockedPerkStatusValue =
  (typeof CustomerUnlockedPerkStatus)[keyof typeof CustomerUnlockedPerkStatus];

export const customerUnlockedPerks = mysqlTable(
  'customer_unlocked_perk',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    status: tinyint('status')
      .notNull()
      .default(CustomerUnlockedPerkStatus.Active),
    customerId: varchar('customer_id', { length: 255 }).notNull(),
    perkId: varchar('perk_id', { length: 255 }).notNull(),
    // Controls the lifetime of the perk
    unlockedByPurchaseId: varchar('unlocked_by_purchase_id', {
      length: 255
    }),
    unlockedBySubscriptionId: varchar('unlocked_by_subscription_id', {
      length: 255
    }),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [
    uniqueIndex('customer_id_perk_id_idx').on(table.customerId, table.perkId)
  ]
);

export const externalCustomerIdentifiers = mysqlTable(
  'external_customer_identifier',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    customerId: varchar('customer_id', { length: 255 }).notNull(),
    serviceId: varchar('service_id', { length: 255 }).notNull(), // stripe, appstore, slack etc
    isDefault: boolean('is_default').notNull(),
    identifier: varchar('identifier', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [
    index('customer_id_service_id_identifier_idx').on(
      table.customerId,
      table.serviceId,
      table.identifier
    )
  ]
);
export const externalCustomerIdentifiersRelations = relations(
  externalCustomerIdentifiers,
  ({ one }) => ({
    customer: one(customers, {
      fields: [externalCustomerIdentifiers.customerId],
      references: [customers.id]
    })
  })
);

export const paymentProviderConfigurations = mysqlTable(
  'payment_provider_configuration',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    providerId: varchar('provider_id', { length: 255 }).notNull(),
    projectId: varchar('project_id', { length: 255 }).notNull(),
    /** Key generated based on configuration. Used as an external identifier for the payment provider configuration. For example, for App Store, it is the bundleId. */
    paymentProviderKey: varchar('payment_provider_key', {
      length: 255
    }).notNull(),
    enabled: boolean('enabled').notNull().default(false),
    name: varchar('name', { length: 255 }).notNull().default('Unknown'),
    configuration: json('configuration').$type<object>(),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow(),
    deletedAt: timestamp('deleted_at')
  },
  (table) => [
    index('project_id_idx').on(table.projectId),
    index('provider_id_idx').on(table.providerId)
  ]
);

export const paymentProviderConfigurationRelations = relations(
  paymentProviderConfigurations,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [paymentProviderConfigurations.projectId],
      references: [projects.id]
    }),
    paymentProviderConfigurationProducts: many(
      paymentProviderConfigurationProducts
    )
  })
);

// Perk
export const perks = mysqlTable(
  'perk',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    slug: varchar('slug', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    projectId: varchar('project_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [
    uniqueIndex('slug_project_id_idx').on(table.slug, table.projectId)
  ]
);

export const perkRelations = relations(perks, ({ many }) => ({
  productPerks: many(productPerks)
}));

export const products = mysqlTable('product', {
  id: varchar('id', { length: 255 }).primaryKey(),
  type: tinyint('type').notNull().default(ProductType.Subscription),
  name: varchar('name', { length: 255 }).notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').onUpdateNow()
});

export const productRelations = relations(products, ({ many }) => ({
  perks: many(productPerks),
  checkoutSessions: many(checkoutSessions),
  paymentProviderConfigurationProducts: many(
    paymentProviderConfigurationProducts
  )
}));

export const productPerks = mysqlTable(
  'product_perk',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    productId: varchar('product_id', { length: 255 }).notNull(),
    perkId: varchar('perk_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [
    uniqueIndex('product_id_perk_id_idx').on(table.productId, table.perkId)
  ]
);

export const productPerkRelations = relations(productPerks, ({ one }) => ({
  product: one(products, {
    fields: [productPerks.productId],
    references: [products.id]
  }),
  perk: one(perks, {
    fields: [productPerks.perkId],
    references: [perks.id]
  })
}));

export const paymentProviderConfigurationProducts = mysqlTable(
  'payment_provider_configuration_product',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    paymentProviderConfigurationId: varchar(
      'payment_provider_configuration_id',
      {
        length: 255
      }
    ).notNull(),
    providerProductKey: varchar('provider_product_key', {
      length: 255
    }).notNull(),
    productId: varchar('product_id', { length: 255 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    configuration: json('configuration').$type<object>(),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [
    uniqueIndex('product_provider_configuration_ext_pk_idx').on(
      table.paymentProviderConfigurationId,
      table.providerProductKey,
      table.productId
    ),
    index('payment_provider_configuration_id_idx').on(
      table.paymentProviderConfigurationId
    )
  ]
);

export const paymentProviderConfigurationProductRelations = relations(
  paymentProviderConfigurationProducts,
  ({ one, many }) => ({
    product: one(products, {
      fields: [paymentProviderConfigurationProducts.productId],
      references: [products.id]
    }),
    paymentProviderConfiguration: one(paymentProviderConfigurations, {
      fields: [
        paymentProviderConfigurationProducts.paymentProviderConfigurationId
      ],
      references: [paymentProviderConfigurations.id]
    }),
    subscriptions: many(subscriptions)
  })
);

export const CheckoutSessionStatus = {
  Pending: 1,
  Processing: 2,
  Success: 3,
  Error: 4,
  Cancelled: 5
};

export const checkoutSessions = mysqlTable('checkout_session', {
  id: varchar('id', { length: 255 }).primaryKey(),
  customerId: varchar('customer_id', { length: 255 }).notNull(),
  paymentProviderConfigurationProductId: varchar(
    'payment_provider_configuration_product_id',
    {
      length: 255
    }
  ).notNull(),
  status: tinyint('status').notNull().default(CheckoutSessionStatus.Pending),
  successCallbackUrl: varchar('success_callback_url', {
    length: 255
  })
    .notNull()
    .default('LEGACY'),
  errorCallbackUrl: varchar('error_callback_url', { length: 255 })
    .notNull()
    .default('LEGACY'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').onUpdateNow()
});

export const checkoutSessionRelations = relations(
  checkoutSessions,
  ({ one }) => ({
    customer: one(customers, {
      fields: [checkoutSessions.customerId],
      references: [customers.id]
    }),
    paymentProviderConfigurationProduct: one(
      paymentProviderConfigurationProducts,
      {
        fields: [checkoutSessions.paymentProviderConfigurationProductId],
        references: [paymentProviderConfigurationProducts.id]
      }
    )
  })
);

export const outbox = mysqlTable('outbox', {
  id: varchar('id', { length: 255 }).primaryKey(),
  topic: varchar('topic', { length: 255 }).notNull(),
  payload: json('payload').$type<object>(),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`)
});

// App Store
export const ProviderEnvironment = {
  Production: 1,
  Sandbox: 2
} as const;

export type ProviderEnvironmentValue =
  (typeof ProviderEnvironment)[keyof typeof ProviderEnvironment];

export const purchases = mysqlTable(
  'purchase',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    customerId: varchar('customer_id', { length: 255 }).notNull(),
    providerKey: varchar('provider_key', { length: 255 }).notNull(),
    type: tinyint('type').notNull().default(PurchaseType.OneTime),
    paymentProviderConfigurationProductId: varchar(
      'payment_provider_configuration_product_id',
      {
        length: 255
      }
    ).notNull(),

    /**
     * The environment the subscription was purchased in
     */
    providerEnvironment: tinyint('provider_environment')
      .notNull()
      .default(ProviderEnvironment.Production),

    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [uniqueIndex('provider_key_idx').on(table.providerKey)]
);

export const subscriptions = mysqlTable(
  'subscription',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    customerId: varchar('customer_id', { length: 255 }).notNull(),
    status: tinyint('status').notNull().default(SubscriptionStatus.Active),
    initialTransactionId: varchar('initial_transaction_id', {
      length: 255
    }).notNull(),
    latestTransactionId: varchar('latest_transaction_id', {
      length: 255
    }).notNull(),
    /**
     * - This is the 'original_transaction_id' for Apple, or 'subscription_id' for Google
     */
    storeSubscriptionId: varchar('store_subscription_id', {
      length: 255
    }).notNull(),

    paymentProviderConfigurationProductId: varchar(
      'payment_provider_configuration_product_id',
      {
        length: 255
      }
    ).notNull(),

    /**
     * The environment the subscription was purchased in
     */
    providerEnvironment: tinyint('provider_environment')
      .notNull()
      .default(ProviderEnvironment.Production),

    isTrial: boolean('is_trial').notNull().default(false),

    /**
     * The date the subscription started
     */
    startsAt: timestamp('starts_at').notNull(),
    /**
     * The date the subscription expires. Null if the subscription is not set to expire or if it is a one-time purchase
     */
    expiresAt: timestamp('expires_at'),
    /**
     * The date the subscription was purchased
     */
    purchasedAt: timestamp('purchased_at').notNull(),
    /**
     * Whether the subscription is set to cancel at the end of the current period
     */
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    /**
     * The date the subscription was canceled
     */
    canceledAt: timestamp('canceled_at'),

    cancellationReason: varchar('cancellation_reason', { length: 255 }),

    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [
    index('status_starts_at_idx').on(table.status, table.startsAt),
    index('canceled_at_idx').on(table.canceledAt),
    index('customer_id_idx').on(table.customerId)
  ]
);

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  paymentProviderConfigurationProduct: one(
    paymentProviderConfigurationProducts,
    {
      fields: [subscriptions.paymentProviderConfigurationProductId],
      references: [paymentProviderConfigurationProducts.id]
    }
  )
}));

export const transactions = mysqlTable(
  'transaction',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    customerId: varchar('customer_id', { length: 255 }).notNull(),
    amount: int('amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    /**
     * Amount converted to USD cents for analytics.
     * Populated at transaction ingestion time using exchange rates.
     */
    amountUsd: int('amount_usd'),
    /**
     * Exchange rate used for USD conversion.
     * Stored as rate * 1,000,000 for precision.
     * e.g., 1.25 USD/EUR stored as 1250000
     */
    exchangeRate: int('exchange_rate'),

    paymentProviderConfigurationProductId: varchar(
      'payment_provider_product_configuration_id',
      {
        length: 255
      }
    ).notNull(),
    providerEnvironment: tinyint('provider_environment')
      .notNull()
      .default(ProviderEnvironment.Production),
    storeTransactionId: varchar('store_transaction_id', {
      length: 255
    }),
    occurredAt: timestamp('occurred_at').notNull(),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [index('occurred_at_idx').on(table.occurredAt)]
);

export const InAppOwnershipType = {
  FamilyShared: 1,
  Purchased: 2
} as const;

export type InAppOwnershipTypeValue =
  (typeof InAppOwnershipType)[keyof typeof InAppOwnershipType];

export const OfferDiscountType = {
  FreeTrial: 1,
  PayAsYouGo: 2,
  PayUpFront: 3
} as const;

export type OfferDiscountTypeValue =
  (typeof OfferDiscountType)[keyof typeof OfferDiscountType];

export const OfferType = {
  IntroductoryOffer: 1,
  PromotionalOffer: 2,
  OfferWithSubscriptionOfferCode: 3,
  WinBackOffer: 4
} as const;

export type OfferTypeValue = (typeof OfferType)[keyof typeof OfferType];

export const RevocationReason = {
  OtherReason: 1,
  PerceivedIssue: 2
} as const;

export type RevocationReasonValue =
  (typeof RevocationReason)[keyof typeof RevocationReason];

export const TransactionReason = {
  Purchase: 1,
  Renewal: 2
} as const;

export type TransactionReasonValue =
  (typeof TransactionReason)[keyof typeof TransactionReason];

export const TransactionType = {
  AutoRenewableSubscription: 1,
  NonConsumable: 2,
  Consumable: 3,
  NonRenewingSubscription: 4
} as const;

export type TransactionTypeValue =
  (typeof TransactionType)[keyof typeof TransactionType];

export const appStoreTransactions = mysqlTable(
  'app_store_transaction',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    transactionId: varchar('transaction_id', { length: 255 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    // Equivalent to providerEnvironment
    environment: tinyint('environment')
      .notNull()
      .default(ProviderEnvironment.Production),
    expireDate: timestamp('expire_date'),
    inAppOwnershipType: tinyint('in_app_ownership_type')
      .notNull()
      .default(InAppOwnershipType.Purchased),
    isUpgraded: boolean('is_upgraded'),
    offerDiscountType: tinyint('offer_discount_type')
      .notNull()
      .default(OfferDiscountType.PayAsYouGo),
    offerIdentifier: varchar('offer_identifier', { length: 255 }),
    offerPeriod: varchar('offer_period', { length: 255 }), //ISO 8601 duration string
    offerType: tinyint('offer_type')
      .notNull()
      .default(OfferType.IntroductoryOffer),
    originalPurchaseDate: timestamp('original_purchase_date').notNull(),
    originalTransactionId: varchar('original_transaction_id', {
      length: 255
    }).notNull(),
    /**
     * An integer value that represents the price multiplied by 1000 of the in-app purchase or subscription offer you configured in App Store Connect and that the system records at the time of the purchase.
     */
    price: int('price').notNull(),
    productId: varchar('product_id', { length: 255 }).notNull(),
    purchaseDate: timestamp('purchase_date').notNull(),
    quantity: int('quantity').notNull(),
    revocationDate: timestamp('revocation_date'),
    revocationReason: tinyint('revocation_reason')
      .notNull()
      .default(RevocationReason.OtherReason),
    /**
     * The three-letter code that represents the country or region associated with the App Store storefront for the purchase.
     */
    storefront: varchar('storefront', { length: 3 }).notNull(),
    storefrontId: varchar('storefront_id', { length: 255 }).notNull(),
    subscriptionGroupIdentifier: varchar('subscription_group_identifier', {
      length: 255
    }),
    transactionReason: tinyint('transaction_reason')
      .notNull()
      .default(TransactionReason.Purchase),
    type: tinyint('type')
      .notNull()
      .default(TransactionType.AutoRenewableSubscription),
    webOrderLineItemId: varchar('web_order_line_item_id', {
      length: 255
    })
  },
  (table) => [uniqueIndex('transaction_id_idx').on(table.transactionId)]
);

// Design file
export type DesignFileMetadata = {};

// Paywalls
export const paywalls = mysqlTable(
  'paywall',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    slug: varchar('slug', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    designFileMetadata: json(
      'design_file_metadata'
    ).$type<DesignFileMetadata>(),
    projectId: varchar('project_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [
    uniqueIndex('slug_project_id_idx').on(table.slug, table.projectId)
  ]
);

export const paywallRelations = relations(paywalls, ({ one }) => ({
  project: one(projects, {
    fields: [paywalls.projectId],
    references: [projects.id]
  })
}));

// Paywall Edit Tokens (short-lived tokens for mimic auth)
export const paywallEditTokens = mysqlTable(
  'paywall_edit_token',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    paywallId: varchar('paywall_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    index('paywall_id_idx').on(table.paywallId),
    index('expires_at_idx').on(table.expiresAt)
  ]
);

export const paywallEditTokenRelations = relations(
  paywallEditTokens,
  ({ one }) => ({
    paywall: one(paywalls, {
      fields: [paywallEditTokens.paywallId],
      references: [paywalls.id]
    })
  })
);

// ============================================
// BILLING TABLES
// ============================================

export const BillingTier = {
  Free: 1,
  Pro: 2,
  Enterprise: 3
} as const;

export type BillingTierValue = (typeof BillingTier)[keyof typeof BillingTier];

export const BillingSubscriptionStatus = {
  None: 0,
  Active: 1,
  Canceled: 2,
  PastDue: 3,
  Trialing: 4
} as const;

export type BillingSubscriptionStatusValue =
  (typeof BillingSubscriptionStatus)[keyof typeof BillingSubscriptionStatus];

/**
 * Links organizations to their billing configuration and provider customer
 */
export const organizationBilling = mysqlTable(
  'organization_billing',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 }).notNull(),

    /** Current billing tier */
    tier: tinyint('tier').notNull().default(BillingTier.Free),

    /** Billing provider (e.g., 'polar', 'stripe') */
    billingProviderId: varchar('billing_provider_id', { length: 50 })
      .notNull()
      .default('polar'),

    /** External customer ID in the billing provider (e.g., Polar customer ID) */
    externalCustomerId: varchar('external_customer_id', { length: 255 }),

    /** Subscription status synced from provider */
    subscriptionStatus: tinyint('subscription_status')
      .notNull()
      .default(BillingSubscriptionStatus.None),

    /** External subscription ID in the billing provider */
    externalSubscriptionId: varchar('external_subscription_id', {
      length: 255
    }),

    /** Current billing period start */
    currentPeriodStart: timestamp('current_period_start'),

    /** Current billing period end */
    currentPeriodEnd: timestamp('current_period_end'),

    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [
    uniqueIndex('organization_id_unique_idx').on(table.organizationId),
    index('external_customer_id_idx').on(table.externalCustomerId),
    index('billing_provider_id_idx').on(table.billingProviderId)
  ]
);

export const organizationBillingRelations = relations(
  organizationBilling,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationBilling.organizationId],
      references: [organization.id]
    })
  })
);

/**
 * Local usage records - stored locally first, then synced to provider asynchronously
 */
export const usageRecords = mysqlTable(
  'usage_record',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 }).notNull(),

    /** Metric identifier (e.g., 'paywall_conversions', 'monthly_tracked_revenue') */
    metricId: varchar('metric_id', { length: 100 }).notNull(),

    /** Usage value */
    value: bigint('value', { mode: 'number' }).notNull(),

    /** Billing period this usage belongs to */
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),

    /** Whether this record has been synced to the billing provider */
    syncedToProvider: boolean('synced_to_provider').notNull().default(false),
    syncedAt: timestamp('synced_at'),
    syncError: varchar('sync_error', { length: 500 }),

    /** Additional context for the usage event */
    metadata: json('metadata').$type<Record<string, unknown>>(),

    /** When the usage event occurred */
    occurredAt: timestamp('occurred_at').notNull(),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    index('org_metric_period_idx').on(
      table.organizationId,
      table.metricId,
      table.periodStart,
      table.periodEnd
    ),
    index('synced_to_provider_idx').on(table.syncedToProvider)
  ]
);

/**
 * Pre-computed usage aggregates for performance
 */
export const usageAggregates = mysqlTable(
  'usage_aggregate',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 }).notNull(),

    /** Metric identifier */
    metricId: varchar('metric_id', { length: 100 }).notNull(),

    /** Billing period */
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),

    /** Aggregated total value for the period */
    totalValue: bigint('total_value', { mode: 'number' }).notNull().default(0),

    /** Limit for this metric (null = unlimited) */
    limitValue: bigint('limit_value', { mode: 'number' }),

    /** Threshold at which to show warnings */
    warnThreshold: bigint('warn_threshold', { mode: 'number' }),

    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [
    uniqueIndex('org_metric_period_unique_idx').on(
      table.organizationId,
      table.metricId,
      table.periodStart
    )
  ]
);

/**
 * Billing webhook events for idempotency tracking
 */
export const billingWebhookEvents = mysqlTable(
  'billing_webhook_event',
  {
    id: varchar('id', { length: 255 }).primaryKey(),

    /** Billing provider ID (e.g., 'polar', 'stripe') */
    providerId: varchar('provider_id', { length: 50 }).notNull(),

    /** External event ID from the provider */
    externalEventId: varchar('external_event_id', { length: 255 }).notNull(),

    /** Event type (e.g., 'subscription.created') */
    eventType: varchar('event_type', { length: 100 }).notNull(),

    /** Full event payload */
    payload: json('payload').$type<object>(),

    /** When the event was processed (null = not yet processed) */
    processedAt: timestamp('processed_at'),

    /** Error message if processing failed */
    error: varchar('error', { length: 500 }),

    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    uniqueIndex('provider_event_unique_idx').on(
      table.providerId,
      table.externalEventId
    ),
    index('processed_at_idx').on(table.processedAt)
  ]
);

/**
 * Billing provider meters - tracks meter sync status with provider
 */
export const billingProviderMeters = mysqlTable(
  'billing_provider_meter',
  {
    id: varchar('id', { length: 255 }).primaryKey(),

    /** Billing provider ID (e.g., 'polar', 'stripe') */
    providerId: varchar('provider_id', { length: 50 }).notNull(),

    /** Internal metric ID */
    metricId: varchar('metric_id', { length: 100 }).notNull(),

    /** External meter ID in the provider */
    externalMeterId: varchar('external_meter_id', { length: 255 }).notNull(),

    /** External meter slug (Polar-specific) */
    externalMeterSlug: varchar('external_meter_slug', { length: 255 }),

    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').onUpdateNow()
  },
  (table) => [
    uniqueIndex('provider_metric_unique_idx').on(
      table.providerId,
      table.metricId
    )
  ]
);
