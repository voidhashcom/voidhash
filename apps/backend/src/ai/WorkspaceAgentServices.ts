import {
  ComponentManifestCacheService,
  PaywallDeployService,
  PaywallEditChangeSetService,
  PaywallService,
  PaywallWorkspaceService,
} from "@voidhash/core/services";
import { Layer } from "effect";

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
  PaywallEditChangeSetService.layer.pipe(Layer.provide(PaywallWorkspaceServiceLive)),
);
