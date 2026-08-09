import { RpcGroup } from "effect/unstable/rpc";

import { AgentSessionRpcsDef } from "./groups/AgentSessionRpcsDef.ts";
import { AnalyticsRpcsDef } from "./groups/AnalyticsRpcsDef.ts";
import { ApiKeyRpcsDef } from "./groups/ApiKeyRpcsDef.ts";
import { PersonRpcsDef } from "./groups/PersonRpcsDef.ts";
import { OrganizationRpcsDef } from "./groups/OrganizationRpcsDef.ts";
import { PaymentProviderConfigurationRpcsDef } from "./groups/PaymentProviderConfigurationRpcsDef.ts";
import { PaymentProviderProductRpcsDef } from "./groups/PaymentProviderProductRpcsDef.ts";
import { PushNotificationConfigurationRpcsDef } from "./groups/PushNotificationConfigurationRpcsDef.ts";
import { PushNotificationSendRpcsDef } from "./groups/PushNotificationSendRpcsDef.ts";
import { PaywallAssetRpcsDef } from "./groups/PaywallAssetRpcsDef.ts";
import { PaywallComponentRpcsDef } from "./groups/PaywallComponentRpcsDef.ts";
import { PaywallDeployRpcsDef } from "./groups/PaywallDeployRpcsDef.ts";
import { PaywallLocationRpcsDef } from "./groups/PaywallLocationRpcsDef.ts";
import { PaywallRpcsDef } from "./groups/PaywallRpcsDef.ts";
import { PaywallWorkspaceRpcsDef } from "./groups/PaywallWorkspaceRpcsDef.ts";
import { PerkRpcsDef } from "./groups/PerkRpcsDef.ts";
import { ProductPerkRpcsDef } from "./groups/ProductPerkRpcsDef.ts";
import { ProductRpcsDef } from "./groups/ProductRpcsDef.ts";
import { ProjectRpcsDef } from "./groups/ProjectRpcsDef.ts";
import { UserRpcsDef } from "./groups/UserRpcsDef.ts";
import { WebhookRpcsDef } from "./groups/WebhookRpcsDef.ts";
import { FeatureFlagRpcsDef } from "./groups/FeatureFlagRpcsDef.ts";
import { FeedbackRpcsDef } from "./groups/FeedbackRpcsDef.ts";
import { ExperimentRpcsDef } from "./groups/ExperimentRpcsDef.ts";

export const RpcGroups = RpcGroup.make().merge(
  AgentSessionRpcsDef,
  AnalyticsRpcsDef,
  ApiKeyRpcsDef,
  PersonRpcsDef,
  ExperimentRpcsDef,
  FeatureFlagRpcsDef,
  FeedbackRpcsDef,
  OrganizationRpcsDef,
  PaymentProviderConfigurationRpcsDef,
  PaymentProviderProductRpcsDef,
  PushNotificationConfigurationRpcsDef,
  PushNotificationSendRpcsDef,
  PaywallAssetRpcsDef,
  PaywallComponentRpcsDef,
  PaywallDeployRpcsDef,
  PaywallLocationRpcsDef,
  PerkRpcsDef,
  ProductPerkRpcsDef,
  ProductRpcsDef,
  ProjectRpcsDef,
  PaywallRpcsDef,
  PaywallWorkspaceRpcsDef,
  UserRpcsDef,
  WebhookRpcsDef,
);

export * from "./auth.ts";
export * from "./errors/index.ts";
export * from "./groups/AgentSessionRpcsDef.ts";
export * from "./groups/AnalyticsRpcsDef.ts";
export * from "./groups/ApiKeyRpcsDef.ts";
export * from "./groups/PersonRpcsDef.ts";
export * from "./groups/OrganizationRpcsDef.ts";
export * from "./groups/PaymentProviderConfigurationRpcsDef.ts";
export * from "./groups/PaymentProviderProductRpcsDef.ts";
export * from "./groups/PushNotificationConfigurationRpcsDef.ts";
export * from "./groups/PushNotificationSendRpcsDef.ts";
export * from "./groups/PaywallAssetRpcsDef.ts";
export * from "./groups/PaywallComponentRpcsDef.ts";
export * from "./groups/PaywallDeployRpcsDef.ts";
export * from "./groups/PaywallLocationRpcsDef.ts";
export * from "./groups/PaywallRpcsDef.ts";
export * from "./groups/PaywallWorkspaceRpcsDef.ts";
export * from "./groups/PerkRpcsDef.ts";
export * from "./groups/ProductPerkRpcsDef.ts";
export * from "./groups/ProductRpcsDef.ts";
export * from "./groups/ProjectRpcsDef.ts";
export * from "./groups/UserRpcsDef.ts";
export * from "./groups/VoidQlRpcsDef.ts";
export * from "./groups/WebhookRpcsDef.ts";
export * from "./groups/FeatureFlagRpcsDef.ts";
export * from "./groups/FeedbackRpcsDef.ts";
export * from "./groups/ExperimentRpcsDef.ts";
export * from "./experimentTreatmentTypes.ts";
export * from "./internalFeatureFlags.ts";
export * from "./middlewares.ts";
