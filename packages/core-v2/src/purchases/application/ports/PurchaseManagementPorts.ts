import type { AuthSession } from "@voidhash/rpc";
import { Context, Schema, type Effect } from "effect";

import type { PaymentProviderConfiguration } from "../../domain/ProviderConfiguration.ts";
import type {
  PaymentProviderProduct,
  ProjectPaymentProviderProduct,
} from "../../domain/ProviderProduct.ts";
import type { PurchasePortError } from "./PurchasePortError.ts";
import type { PurchaseActionForbiddenError } from "./PurchaseQueryStore.ts";

export const PurchaseCatalogProduct = Schema.Struct({
  id: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
});

export type PurchaseCatalogProduct = typeof PurchaseCatalogProduct.Type;

export interface PurchaseManagementRepositoryShape {
  readonly listConfigurations: (
    projectId: string,
  ) => Effect.Effect<ReadonlyArray<typeof PaymentProviderConfiguration.Type>, PurchasePortError>;
  readonly findScopedConfiguration: (input: {
    readonly id: string;
    readonly projectIds: ReadonlyArray<string>;
  }) => Effect.Effect<typeof PaymentProviderConfiguration.Type | undefined, PurchasePortError>;
  readonly findConfiguration: (
    id: string,
  ) => Effect.Effect<typeof PaymentProviderConfiguration.Type | undefined, PurchasePortError>;
  readonly findConfigurationByProjectProvider: (input: {
    readonly projectId: string;
    readonly providerId: string;
  }) => Effect.Effect<typeof PaymentProviderConfiguration.Type | undefined, PurchasePortError>;
  readonly findConfigurationKeyConflict: (input: {
    readonly excludeId: string;
    readonly paymentProviderKey: string;
    readonly projectId: string;
    readonly providerId: string;
  }) => Effect.Effect<typeof PaymentProviderConfiguration.Type | undefined, PurchasePortError>;
  readonly insertConfiguration: (input: {
    readonly configuration: Record<string, unknown>;
    readonly enabled: boolean;
    readonly name: string;
    readonly paymentProviderKey: string;
    readonly projectId: string;
    readonly providerId: string;
  }) => Effect.Effect<{ readonly id: string }, PurchasePortError>;
  readonly updateConfiguration: (input: {
    readonly configuration: Record<string, unknown>;
    readonly enabled: boolean;
    readonly id: string;
    readonly name?: string;
    readonly paymentProviderKey?: string;
  }) => Effect.Effect<void, PurchasePortError>;
  readonly configurationHasMappings: (id: string) => Effect.Effect<boolean, PurchasePortError>;
  readonly softDeleteConfiguration: (id: string) => Effect.Effect<void, PurchasePortError>;
  readonly findProduct: (
    id: string,
  ) => Effect.Effect<PurchaseCatalogProduct | undefined, PurchasePortError>;
  readonly listProviderProductsByProject: (
    projectId: string,
  ) => Effect.Effect<ReadonlyArray<typeof ProjectPaymentProviderProduct.Type>, PurchasePortError>;
  readonly listProviderProductsByProduct: (
    productId: string,
  ) => Effect.Effect<ReadonlyArray<typeof PaymentProviderProduct.Type>, PurchasePortError>;
  readonly findProviderProduct: (
    id: string,
  ) => Effect.Effect<typeof PaymentProviderProduct.Type | undefined, PurchasePortError>;
  readonly findActiveProviderProductByKey: (input: {
    readonly paymentProviderConfigurationId: string;
    readonly providerProductKey: string;
  }) => Effect.Effect<typeof PaymentProviderProduct.Type | undefined, PurchasePortError>;
  readonly findProviderProductByNaturalKey: (input: {
    readonly paymentProviderConfigurationId: string;
    readonly productId: string;
    readonly providerProductKey: string;
  }) => Effect.Effect<typeof PaymentProviderProduct.Type | undefined, PurchasePortError>;
  readonly insertProviderProduct: (input: {
    readonly configuration: Record<string, unknown>;
    readonly paymentProviderConfigurationId: string;
    readonly productId: string;
    readonly providerProductKey: string;
  }) => Effect.Effect<{ readonly id: string }, PurchasePortError>;
  readonly setActiveProviderProduct: (input: {
    readonly id: string;
    readonly paymentProviderConfigurationId: string;
    readonly productId: string;
  }) => Effect.Effect<void, PurchasePortError>;
  readonly updateProviderProduct: (input: {
    readonly configuration: Record<string, unknown>;
    readonly id: string;
    readonly providerProductKey: string;
  }) => Effect.Effect<void, PurchasePortError>;
  readonly providerProductHasHistory: (id: string) => Effect.Effect<boolean, PurchasePortError>;
  readonly deleteProviderProduct: (id: string) => Effect.Effect<void, PurchasePortError>;
}

/** Database boundary for payment-provider catalog management. */
export class PurchaseManagementRepository extends Context.Service<
  PurchaseManagementRepository,
  PurchaseManagementRepositoryShape
>()("@voidhash/core-v2/purchases/PurchaseManagementRepository") {}

export interface PurchaseAuditEntry {
  readonly action: "created" | "updated" | "deleted";
  readonly changes?: Record<string, unknown>;
  readonly entityId: string;
  readonly entityType: "payment-provider-configuration" | "payment-provider-product";
  readonly parentEntityId?: string;
  readonly projectId: string;
}

export interface PurchaseAuditLogShape {
  readonly append: (entry: PurchaseAuditEntry) => Effect.Effect<void, PurchasePortError>;
}

/** Audit boundary used by provider-management orchestration. */
export class PurchaseAuditLog extends Context.Service<PurchaseAuditLog, PurchaseAuditLogShape>()(
  "@voidhash/core-v2/purchases/PurchaseAuditLog",
) {}

export interface ProjectPermissionCheckShape {
  readonly requireProjectAll: (
    projectId: string,
    message: string,
  ) => Effect.Effect<void, PurchaseActionForbiddenError, AuthSession>;
}

/** Request-scoped project permission boundary for purchase management. */
export class ProjectPermissionCheck extends Context.Service<
  ProjectPermissionCheck,
  ProjectPermissionCheckShape
>()("@voidhash/core-v2/purchases/ProjectPermissionCheck") {}

export interface SchemaCacheInvalidationShape {
  readonly invalidate: (projectId: string) => Effect.Effect<void, PurchasePortError>;
}

/** Schema cache invalidation boundary for managed purchase catalog changes. */
export class SchemaCacheInvalidation extends Context.Service<
  SchemaCacheInvalidation,
  SchemaCacheInvalidationShape
>()("@voidhash/core-v2/purchases/SchemaCacheInvalidation") {}
