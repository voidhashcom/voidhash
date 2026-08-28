import type { AuthSession } from "@voidhash/rpc";
import { Context, type Effect } from "effect";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import type { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";

import type {
  PaymentProviderAlreadyExistsError,
  PaymentProviderConfiguration,
  PaymentProviderConfigurationInUseError,
  PaymentProviderConfigurationKeyUnavailableError,
  PaymentProviderConfigurationNotFoundError,
  PaymentProviderConfigurationServiceError,
  PaymentProviderConfigurationValidationError,
} from "../../domain/ProviderConfiguration.ts";
import type {
  PaymentProviderProduct,
  PaymentProviderProductNotFoundError,
  PaymentProviderProductServiceError,
  PaymentProviderProductValidationError,
  ProjectPaymentProviderProduct,
} from "../../domain/ProviderProduct.ts";
import type { PurchaseActionForbiddenError } from "./PurchaseQueryStore.ts";

export type PaymentProviderConfigurationError =
  | PaymentProviderAlreadyExistsError
  | PaymentProviderConfigurationInUseError
  | PaymentProviderConfigurationKeyUnavailableError
  | PaymentProviderConfigurationNotFoundError
  | PaymentProviderConfigurationServiceError
  | PaymentProviderConfigurationValidationError
  | PurchaseActionForbiddenError;

export interface PaymentProviderConfigurationOperationsShape {
  readonly createPaymentProviderConfiguration: (input: {
    readonly projectId: string;
    readonly providerId: string;
  }) => Effect.Effect<
    { readonly id: string },
    | PaymentProviderAlreadyExistsError
    | PaymentProviderConfigurationServiceError
    | PaymentProviderConfigurationValidationError
    | PurchaseActionForbiddenError,
    AuthSession
  >;
  readonly deletePaymentProviderConfiguration: (input: {
    readonly paymentProviderConfigurationId: string;
  }) => Effect.Effect<
    void,
    | PaymentProviderConfigurationInUseError
    | PaymentProviderConfigurationNotFoundError
    | PaymentProviderConfigurationServiceError
    | PurchaseActionForbiddenError,
    AuthSession
  >;
  readonly getPaymentProviderConfigurationById: (
    id: string,
  ) => Effect.Effect<
    typeof PaymentProviderConfiguration.Type,
    | PaymentProviderConfigurationNotFoundError
    | PaymentProviderConfigurationServiceError
    | PurchaseActionForbiddenError,
    AuthSession
  >;
  readonly getPaymentProviderConfigurations: (
    projectId: string,
  ) => Effect.Effect<
    ReadonlyArray<typeof PaymentProviderConfiguration.Type>,
    PaymentProviderConfigurationServiceError | PurchaseActionForbiddenError,
    AuthSession
  >;
  readonly updatePaymentProviderConfiguration: (input: {
    readonly configuration: Record<string, unknown>;
    readonly enabled: boolean;
    readonly id: string;
    readonly name?: string;
  }) => Effect.Effect<
    { readonly id: string },
    | PaymentProviderConfigurationKeyUnavailableError
    | PaymentProviderConfigurationNotFoundError
    | PaymentProviderConfigurationServiceError
    | PaymentProviderConfigurationValidationError
    | PurchaseActionForbiddenError,
    AuthSession
  >;
}

export class PaymentProviderConfigurationOperations extends Context.Service<
  PaymentProviderConfigurationOperations,
  PaymentProviderConfigurationOperationsShape
>()("@voidhash/core-v2/purchases/PaymentProviderConfigurationOperations") {}

export type PaymentProviderProductError =
  | PaymentProviderProductNotFoundError
  | PaymentProviderProductServiceError
  | PaymentProviderProductValidationError
  | PurchaseActionForbiddenError;

export interface PaymentProviderProductOperationsShape {
  readonly createPaymentProviderProduct: (input: {
    readonly configuration: Record<string, unknown>;
    readonly paymentProviderConfigurationId: string;
    readonly productId: string;
  }) => Effect.Effect<
    { readonly id: string },
    | PaymentProviderProductServiceError
    | PaymentProviderProductValidationError
    | PurchaseActionForbiddenError,
    AuthSession | WorkflowRunner | PlatformRuntime
  >;
  readonly deletePaymentProviderProduct: (input: {
    readonly id: string;
  }) => Effect.Effect<
    void,
    | PaymentProviderProductServiceError
    | PaymentProviderProductValidationError
    | PurchaseActionForbiddenError,
    AuthSession
  >;
  readonly getProviderProductById: (
    id: string,
  ) => Effect.Effect<
    typeof PaymentProviderProduct.Type,
    | PaymentProviderProductNotFoundError
    | PaymentProviderProductServiceError
    | PaymentProviderProductValidationError
    | PurchaseActionForbiddenError,
    AuthSession
  >;
  readonly getProviderProductsByProductId: (
    productId: string,
  ) => Effect.Effect<
    ReadonlyArray<typeof PaymentProviderProduct.Type>,
    | PaymentProviderProductServiceError
    | PaymentProviderProductValidationError
    | PurchaseActionForbiddenError,
    AuthSession
  >;
  readonly getProviderProductsByProjectId: (
    projectId: string,
  ) => Effect.Effect<
    ReadonlyArray<typeof ProjectPaymentProviderProduct.Type>,
    PaymentProviderProductServiceError | PurchaseActionForbiddenError,
    AuthSession
  >;
  readonly setActivePaymentProviderProduct: (input: {
    readonly paymentProviderConfigurationId: string;
    readonly productId: string;
    readonly providerProductKey: string;
  }) => Effect.Effect<
    void,
    | PaymentProviderProductServiceError
    | PaymentProviderProductValidationError
    | PurchaseActionForbiddenError,
    AuthSession | WorkflowRunner | PlatformRuntime
  >;
  readonly updatePaymentProviderProduct: (input: {
    readonly configuration: Record<string, unknown>;
    readonly id: string;
  }) => Effect.Effect<
    void,
    | PaymentProviderProductNotFoundError
    | PaymentProviderProductServiceError
    | PaymentProviderProductValidationError
    | PurchaseActionForbiddenError,
    AuthSession | WorkflowRunner | PlatformRuntime
  >;
}

export class PaymentProviderProductOperations extends Context.Service<
  PaymentProviderProductOperations,
  PaymentProviderProductOperationsShape
>()("@voidhash/core-v2/purchases/PaymentProviderProductOperations") {}
