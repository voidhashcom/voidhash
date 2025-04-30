import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type * as schema from "./schema";

export type Project = InferSelectModel<typeof schema.projects>;
export type InsertProject = InferInsertModel<typeof schema.projects>;

export type ApiKey = InferSelectModel<typeof schema.apiKeys>;
export type InsertApiKey = InferInsertModel<typeof schema.apiKeys>;

export type Customer = InferSelectModel<typeof schema.customers>;
export type InsertCustomer = InferInsertModel<typeof schema.customers>;

export type ProjectPaymentProviderConfiguration = InferSelectModel<
	typeof schema.projectPaymentProviderConfigurations
>;
export type InsertProjectPaymentProviderConfiguration = InferInsertModel<
	typeof schema.projectPaymentProviderConfigurations
>;

export type Product = InferSelectModel<typeof schema.products>;
export type InsertProduct = InferInsertModel<typeof schema.products>;

export type ProductProviderConfiguration = InferSelectModel<
	typeof schema.productProviderConfigurations
>;
export type InsertProductProviderConfiguration = InferInsertModel<
	typeof schema.productProviderConfigurations
>;

export type Paywall = InferSelectModel<typeof schema.paywalls>;
export type InsertPaywall = InferInsertModel<typeof schema.paywalls>;

export type PaywallProduct = InferSelectModel<typeof schema.paywallProducts>;
export type InsertPaywallProduct = InferInsertModel<
	typeof schema.paywallProducts
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
