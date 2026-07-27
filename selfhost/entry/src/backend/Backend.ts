import {
  BackendNoopIdentityProjectionPublisherLive,
  BackendPaymentProviderStubsLive,
  BackendSnapshotImageRendererStubLive,
  type InfraServices,
} from "@voidhash/backend/src/BackendApp.ts";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { Workos } from "@voidhash/core/services/auth/Workos";
import { SnapshotImageRenderer } from "@voidhash/core/services/paywallThumbnails/SnapshotImageRenderer";
import type { PublicFileStore } from "@voidhash/core/services/storage/PublicFileStore";
import { PaywallAssetConfig } from "@voidhash/core/services/paywallLocations/PaywallAssetConfig";
import { Db } from "@voidhash/db";
import { HostServiceTag } from "@voidhash/mimic-db/app/hostService";
import { NodePlatformRuntimeLive } from "@voidhash/platform-node/PlatformRuntime";
import { Effect, Layer } from "effect";

import type { SelfhostRuntimeConfig, SelfhostWorkosConfig } from "../config.ts";
import { makeHttpComponentCompilerLive } from "../compiler/CompilerClient.ts";
import { makeBackendMimicHostLive } from "./MimicHost.ts";
import {
  makePaywallArtifactStoreLive,
  makePublicFileStoreLive,
} from "./ObjectStores.ts";
import { MemoryProjectSchemaCacheLive } from "./ProjectSchemaCache.ts";
import { WorkosOrgPortLive } from "./Workos.ts";

/** Builds the WorkOS SDK service from operator-provided credentials. */
export const makeSelfhostWorkosLive = (config: SelfhostWorkosConfig): Layer.Layer<Workos> =>
  Workos.layer({
    apiKey: Effect.succeed(config.apiKey),
    clientId: Effect.succeed(config.clientId),
    cookieName: Effect.succeed(config.cookieName),
    cookiePassword: Effect.succeed(config.cookiePassword),
    webhookSecret: Effect.succeed(config.webhookSecret),
  });

/** Builds the provider-neutral backend infrastructure for the Node runtime. */
export const makeBackendInfrastructureLive = (
  config: SelfhostRuntimeConfig,
  workos: Layer.Layer<Workos>,
  clickhouse?: Layer.Layer<ClickhouseWebClient.ClickhouseWebClient>,
  snapshotImageRenderer: Layer.Layer<
    SnapshotImageRenderer,
    never,
    PublicFileStore
  > = BackendSnapshotImageRendererStubLive,
): Layer.Layer<InfraServices, never, HostServiceTag> => {
  const publicFileStore = makePublicFileStoreLive(
    config.publicObjectStore,
    config.publicFilesBaseUrl,
  ).pipe(Layer.provide(NodePlatformRuntimeLive));

  return Layer.mergeAll(
    Db.layer(config.database),
    workos,
    WorkosOrgPortLive.pipe(Layer.provide(workos)),
    Layer.succeed(PaywallAssetConfig, {
      cdnUrl: config.publicBaseUrl,
      publicBaseUrl: config.publicBaseUrl,
    }),
    makePaywallArtifactStoreLive(config.artifactObjectStore).pipe(
      Layer.provide(NodePlatformRuntimeLive),
    ),
    publicFileStore,
    BackendPaymentProviderStubsLive,
    BackendNoopIdentityProjectionPublisherLive,
    makeBackendMimicHostLive(config.publicBaseUrl),
    makeHttpComponentCompilerLive(config.componentCompilerUrl),
    // `mergeAll` does not cross-wire siblings; the renderer's asset inlining
    // reads the same store instance merged above (memoized by reference).
    snapshotImageRenderer.pipe(Layer.provide(publicFileStore)),
    MemoryProjectSchemaCacheLive,
    clickhouse ?? Layer.empty,
  );
};
