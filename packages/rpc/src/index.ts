import { RpcGroup } from '@effect/rpc';
import { ApiKeyRpcsDef } from './groups/api-key-rpcs-def';
import { CustomerRpcsDef } from './groups/customer-rpcs-def';
import { OrganizationRpcsDef } from './groups/organization-rpcs-def';
import { PerkRpcsDef } from './groups/perk-rpcs-def';
import { ProductPerkRpcsDef } from './groups/product-perk-rpcs-def';
import { ProductRpcsDef } from './groups/product-rpcs-def';
import { ProjectRpcsDef } from './groups/project-rpcs-def';
import { UserRpcsDef } from './groups/user-rpcs-def';

export const RpcGroups = RpcGroup.make().merge(
  ApiKeyRpcsDef,
  CustomerRpcsDef,
  OrganizationRpcsDef,
  PerkRpcsDef,
  ProductPerkRpcsDef,
  ProductRpcsDef,
  ProjectRpcsDef,
  UserRpcsDef
);

export * from './groups/api-key-rpcs-def';
export * from './groups/customer-rpcs-def';
export * from './groups/organization-rpcs-def';
export * from './groups/perk-rpcs-def';
export * from './groups/product-perk-rpcs-def';
export * from './groups/product-rpcs-def';
export * from './groups/project-rpcs-def';
export * from './groups/user-rpcs-def';
export * from './middlewares';
