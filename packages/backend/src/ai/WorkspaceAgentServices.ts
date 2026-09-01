import {
  ComponentManifestCacheService,
  PaywallDeployService,
  PaywallEditSessionService,
  PaywallService,
  PaywallWorkspaceService,
} from "@voidhash/core/services";
import * as Layer from "effect/Layer";

const PaywallServiceLive = PaywallService.layer;
const ComponentManifestCacheServiceLive = ComponentManifestCacheService.layer;
const PaywallWorkspaceServiceLive = PaywallWorkspaceService.layer.pipe(
  Layer.provide(PaywallServiceLive),
);

/** Builds only the domain services required by durable workspace agents. */
export const WorkspaceAgentServicesLive = Layer.mergeAll(
  PaywallServiceLive,
  ComponentManifestCacheServiceLive,
  PaywallDeployService.layer,
  PaywallWorkspaceServiceLive,
  PaywallEditSessionService.layer.pipe(Layer.provide(PaywallWorkspaceServiceLive)),
);
