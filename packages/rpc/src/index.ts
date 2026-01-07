import { RpcGroup } from '@effect/rpc';
import { AnalyticsRpcsDef } from './groups/analytics-rpcs-def';
import { ApiKeyRpcsDef } from './groups/api-key-rpcs-def';
import { BillingRpcsDef } from './groups/billing-rpcs-def';
import { CustomerRpcsDef } from './groups/customer-rpcs-def';
import { OrganizationRpcsDef } from './groups/organization-rpcs-def';
import { PaymentProviderConfigurationRpcsDef } from './groups/payment-provider-configuration-rpcs-def';
import { PaymentProviderProductRpcsDef } from './groups/payment-provider-product-rpcs-def';
import { PaywallRpcsDef } from './groups/paywall-rpcs-def';
import { PerkRpcsDef } from './groups/perk-rpcs-def';
import { ProductPerkRpcsDef } from './groups/product-perk-rpcs-def';
import { ProductRpcsDef } from './groups/product-rpcs-def';
import { ProjectRpcsDef } from './groups/project-rpcs-def';
import { UserRpcsDef } from './groups/user-rpcs-def';

export const RpcGroups = RpcGroup.make().merge(
  AnalyticsRpcsDef,
  ApiKeyRpcsDef,
  BillingRpcsDef,
  CustomerRpcsDef,
  OrganizationRpcsDef,
  PaymentProviderConfigurationRpcsDef,
  PaymentProviderProductRpcsDef,
  PerkRpcsDef,
  ProductPerkRpcsDef,
  ProductRpcsDef,
  ProjectRpcsDef,
  PaywallRpcsDef,
  UserRpcsDef
);

export * from './groups/analytics-rpcs-def';
export * from './groups/api-key-rpcs-def';
export * from './groups/billing-rpcs-def';
export * from './groups/customer-rpcs-def';
export * from './groups/organization-rpcs-def';
export * from './groups/payment-provider-configuration-rpcs-def';
export * from './groups/payment-provider-product-rpcs-def';
export * from './groups/paywall-rpcs-def';
export * from './groups/perk-rpcs-def';
export * from './groups/product-perk-rpcs-def';
export * from './groups/product-rpcs-def';
export * from './groups/project-rpcs-def';
export * from './groups/user-rpcs-def';
export * from './middlewares';
