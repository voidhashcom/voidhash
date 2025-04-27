import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type * as schema from "./schema";

export type Project = InferSelectModel<typeof schema.projects>;
export type InsertProject = InferInsertModel<typeof schema.projects>;

export type ApiKey = InferSelectModel<typeof schema.apiKeys>;
export type InsertApiKey = InferInsertModel<typeof schema.apiKeys>;

export type Customer = InferSelectModel<typeof schema.customer>;
export type InsertCustomer = InferInsertModel<typeof schema.customer>;

export type ProjectPaymentProviderConfiguration = InferSelectModel<
	typeof schema.projectPaymentProviderConfiguration
>;
export type InsertProjectPaymentProviderConfiguration = InferInsertModel<
	typeof schema.projectPaymentProviderConfiguration
>;

export type Product = InferSelectModel<typeof schema.product>;
export type InsertProduct = InferInsertModel<typeof schema.product>;

export type ProductProviderConfiguration = InferSelectModel<
	typeof schema.productProviderConfiguration
>;
export type InsertProductProviderConfiguration = InferInsertModel<
	typeof schema.productProviderConfiguration
>;

export type Paywall = InferSelectModel<typeof schema.paywall>;
export type InsertPaywall = InferInsertModel<typeof schema.paywall>;

export type PaywallProduct = InferSelectModel<typeof schema.paywallProduct>;
export type InsertPaywallProduct = InferInsertModel<
	typeof schema.paywallProduct
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
