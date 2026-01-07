import type {
  InferInsertModel,
  InferSelectModel,
  Table,
} from "drizzle-orm";

import type * as schema from "./schema";

// biome-ignore lint/suspicious/noExplicitAny: should be ok
type InferUpdateModel<T extends Table<any>> = Partial<InferSelectModel<T>> & {
  id: string;
};

export type Project = InferSelectModel<typeof schema.projects>;
export type InsertProject = InferInsertModel<typeof schema.projects>;
export type UpdateProject = InferUpdateModel<typeof schema.projects>;

export type ApiKey = InferSelectModel<typeof schema.apiKeys>;
export type InsertApiKey = InferInsertModel<typeof schema.apiKeys>;
export type UpdateApiKey = InferUpdateModel<typeof schema.apiKeys>;

export type Customer = InferSelectModel<typeof schema.customers>;
export type InsertCustomer = InferInsertModel<typeof schema.customers>;
export type UpdateCustomer = InferUpdateModel<typeof schema.customers>;

export type CustomerUnlockedPerk = InferSelectModel<
  typeof schema.customerUnlockedPerks
>;
export type InsertCustomerUnlockedPerk = InferInsertModel<
  typeof schema.customerUnlockedPerks
>;
export type UpdateCustomerUnlockedPerk = InferUpdateModel<
  typeof schema.customerUnlockedPerks
>;

export type PaymentProviderConfiguration = InferSelectModel<
  typeof schema.paymentProviderConfigurations
>;
export type InsertPaymentProviderConfiguration = InferInsertModel<
  typeof schema.paymentProviderConfigurations
>;
export type UpdatePaymentProviderConfiguration = InferUpdateModel<
  typeof schema.paymentProviderConfigurations
>;

export type Product = InferSelectModel<typeof schema.products>;
export type InsertProduct = InferInsertModel<typeof schema.products>;
export type UpdateProduct = InferUpdateModel<typeof schema.products>;

export type PaymentProviderConfigurationProduct = InferSelectModel<
  typeof schema.paymentProviderConfigurationProducts
>;
export type InsertPaymentProviderConfigurationProduct = InferInsertModel<
  typeof schema.paymentProviderConfigurationProducts
>;
export type UpdatePaymentProviderConfigurationProduct = InferUpdateModel<
  typeof schema.paymentProviderConfigurationProducts
>;

// Auth Schema Types
export type User = InferSelectModel<typeof schema.user>;
export type InsertUser = InferInsertModel<typeof schema.user>;

export type Session = InferSelectModel<typeof schema.session>;
export type InsertSession = InferInsertModel<typeof schema.session>;

export type Account = InferSelectModel<typeof schema.account>;
export type InsertAccount = InferInsertModel<typeof schema.account>;

export type Verification = InferSelectModel<typeof schema.verification>;
export type InsertVerification = InferInsertModel<typeof schema.verification>;

export type Organization = InferSelectModel<typeof schema.organization>;
export type InsertOrganization = InferInsertModel<typeof schema.organization>;

export type Member = InferSelectModel<typeof schema.member>;
export type InsertMember = InferInsertModel<typeof schema.member>;

export type Invitation = InferSelectModel<typeof schema.invitation>;
export type InsertInvitation = InferInsertModel<typeof schema.invitation>;

export type Apikey = InferSelectModel<typeof schema.apikey>; // Note: different from apiKeys
export type InsertApikey = InferInsertModel<typeof schema.apikey>;

export type Perk = InferSelectModel<typeof schema.perks>;
export type InsertPerk = InferInsertModel<typeof schema.perks>;

export type ProductPerk = InferSelectModel<typeof schema.productPerks>;
export type InsertProductPerk = InferInsertModel<typeof schema.productPerks>;

export type Purchase = InferSelectModel<typeof schema.purchases>;
export type InsertPurchase = InferInsertModel<typeof schema.purchases>;

export type Subscription = InferSelectModel<typeof schema.subscriptions>;
export type InsertSubscription = InferInsertModel<typeof schema.subscriptions>;

export type CheckoutSession = InferSelectModel<typeof schema.checkoutSessions>;
export type InsertCheckoutSession = InferInsertModel<
  typeof schema.checkoutSessions
>;

export type Transaction = InferSelectModel<typeof schema.transactions>;
export type InsertTransaction = InferInsertModel<typeof schema.transactions>;

export type AppStoreTransaction = InferSelectModel<
  typeof schema.appStoreTransactions
>;
export type InsertAppStoreTransaction = InferInsertModel<
  typeof schema.appStoreTransactions
>;

export type Paywall = InferSelectModel<typeof schema.paywalls>;
export type InsertPaywall = InferInsertModel<typeof schema.paywalls>;

export type PaywallEditToken = InferSelectModel<
  typeof schema.paywallEditTokens
>;
export type InsertPaywallEditToken = InferInsertModel<
  typeof schema.paywallEditTokens
>;

// Billing Types
export type OrganizationBilling = InferSelectModel<
  typeof schema.organizationBilling
>;
export type InsertOrganizationBilling = InferInsertModel<
  typeof schema.organizationBilling
>;
export type UpdateOrganizationBilling = InferUpdateModel<
  typeof schema.organizationBilling
>;

export type UsageRecord = InferSelectModel<typeof schema.usageRecords>;
export type InsertUsageRecord = InferInsertModel<typeof schema.usageRecords>;

export type UsageAggregate = InferSelectModel<typeof schema.usageAggregates>;
export type InsertUsageAggregate = InferInsertModel<
  typeof schema.usageAggregates
>;
export type UpdateUsageAggregate = InferUpdateModel<
  typeof schema.usageAggregates
>;

export type BillingWebhookEvent = InferSelectModel<
  typeof schema.billingWebhookEvents
>;
export type InsertBillingWebhookEvent = InferInsertModel<
  typeof schema.billingWebhookEvents
>;

export type BillingProviderMeter = InferSelectModel<
  typeof schema.billingProviderMeters
>;
export type InsertBillingProviderMeter = InferInsertModel<
  typeof schema.billingProviderMeters
>;
