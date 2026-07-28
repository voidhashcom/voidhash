import type { InferInsertModel, InferSelectModel, Table } from "drizzle-orm";

import type * as schema from "./schema.ts";

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

export type Person = InferSelectModel<typeof schema.persons>;
export type InsertPerson = InferInsertModel<typeof schema.persons>;
export type UpdatePerson = InferUpdateModel<typeof schema.persons>;

export type PersonIdentity = InferSelectModel<typeof schema.personIdentities>;
export type InsertPersonIdentity = InferInsertModel<typeof schema.personIdentities>;
export type UpdatePersonIdentity = InferUpdateModel<typeof schema.personIdentities>;

export type PersonPersonlessIdentity = InferSelectModel<typeof schema.personPersonlessIdentities>;
export type InsertPersonPersonlessIdentity = InferInsertModel<
  typeof schema.personPersonlessIdentities
>;

export type IdentityAssertion = InferSelectModel<typeof schema.identityAssertions>;
export type InsertIdentityAssertion = InferInsertModel<typeof schema.identityAssertions>;

export type PersonUnlockedPerk = InferSelectModel<typeof schema.personUnlockedPerks>;
export type InsertPersonUnlockedPerk = InferInsertModel<typeof schema.personUnlockedPerks>;
export type UpdatePersonUnlockedPerk = InferUpdateModel<typeof schema.personUnlockedPerks>;

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
export type InsertCheckoutSession = InferInsertModel<typeof schema.checkoutSessions>;

export type Transaction = InferSelectModel<typeof schema.transactions>;
export type InsertTransaction = InferInsertModel<typeof schema.transactions>;

export type FxRate = InferSelectModel<typeof schema.fxRates>;
export type InsertFxRate = InferInsertModel<typeof schema.fxRates>;

export type PurchaseLedger = InferSelectModel<typeof schema.purchaseLedger>;
export type InsertPurchaseLedger = InferInsertModel<typeof schema.purchaseLedger>;
export type UpdatePurchaseLedger = InferUpdateModel<typeof schema.purchaseLedger>;

export type AnalyticsIngestDlq = InferSelectModel<typeof schema.analyticsIngestDlq>;
export type InsertAnalyticsIngestDlq = InferInsertModel<typeof schema.analyticsIngestDlq>;
export type UpdateAnalyticsIngestDlq = InferUpdateModel<typeof schema.analyticsIngestDlq>;

export type PaymentProviderNotificationProcessed = InferSelectModel<
  typeof schema.paymentProviderNotificationProcessed
>;
export type InsertPaymentProviderNotificationProcessed = InferInsertModel<
  typeof schema.paymentProviderNotificationProcessed
>;
export type UpdatePaymentProviderNotificationProcessed = InferUpdateModel<
  typeof schema.paymentProviderNotificationProcessed
>;

export type AppStoreTransaction = InferSelectModel<typeof schema.appStoreTransactions>;
export type InsertAppStoreTransaction = InferInsertModel<typeof schema.appStoreTransactions>;

export type Paywall = InferSelectModel<typeof schema.paywalls>;
export type InsertPaywall = InferInsertModel<typeof schema.paywalls>;
export type PaywallLocation = InferSelectModel<typeof schema.paywallLocations>;
export type InsertPaywallLocation = InferInsertModel<typeof schema.paywallLocations>;
export type UpdatePaywallLocation = InferUpdateModel<typeof schema.paywallLocations>;

export type PaywallLocationShowing = InferSelectModel<typeof schema.paywallLocationShowings>;
export type InsertPaywallLocationShowing = InferInsertModel<typeof schema.paywallLocationShowings>;
export type UpdatePaywallLocationShowing = InferUpdateModel<typeof schema.paywallLocationShowings>;

// WorkOS Webhook Types
export type WorkosWebhookEvent = InferSelectModel<typeof schema.workosWebhookEvents>;
export type InsertWorkosWebhookEvent = InferInsertModel<typeof schema.workosWebhookEvents>;

// Feature Flag Types
export type FeatureFlag = InferSelectModel<typeof schema.featureFlags>;
export type InsertFeatureFlag = InferInsertModel<typeof schema.featureFlags>;

export type FeatureFlagTarget = InferSelectModel<typeof schema.featureFlagTargets>;
export type InsertFeatureFlagTarget = InferInsertModel<typeof schema.featureFlagTargets>;

export type FeatureFlagOverride = InferSelectModel<typeof schema.featureFlagOverrides>;
export type InsertFeatureFlagOverride = InferInsertModel<typeof schema.featureFlagOverrides>;

export type FeatureFlagVariant = InferSelectModel<typeof schema.featureFlagVariants>;
export type InsertFeatureFlagVariant = InferInsertModel<typeof schema.featureFlagVariants>;

export type Experiment = InferSelectModel<typeof schema.experiments>;
export type InsertExperiment = InferInsertModel<typeof schema.experiments>;
export type UpdateExperiment = InferUpdateModel<typeof schema.experiments>;

export type ExperimentVariant = InferSelectModel<typeof schema.experimentVariants>;
export type InsertExperimentVariant = InferInsertModel<typeof schema.experimentVariants>;

export type ExperimentTreatment = InferSelectModel<typeof schema.experimentTreatments>;
export type InsertExperimentTreatment = InferInsertModel<typeof schema.experimentTreatments>;

export type AuditLog = InferSelectModel<typeof schema.auditLogs>;
export type InsertAuditLog = InferInsertModel<typeof schema.auditLogs>;
