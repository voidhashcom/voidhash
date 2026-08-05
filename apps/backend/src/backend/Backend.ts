import {
  BackendNoopIdentityProjectionPublisherLive,
  BackendPaymentProviderStubsLive,
  BackendSnapshotImageRendererStubLive,
  type InfraServices,
} from "@voidhash/backend/BackendApp";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import type { AuthTokenVerifier } from "@voidhash/core/services/auth/AuthTokenVerifier";
import { IdentityProvider } from "@voidhash/core/services/auth/IdentityProvider";
import {
  StandaloneAuthTokenVerifierLive,
  StandaloneIdentityProviderLive,
} from "@voidhash/core/services/auth/StandaloneIdentityProvider";
import { StandaloneOrgDirectoryLive } from "@voidhash/core/services/organizations/StandaloneOrgDirectory";
import { OrgDirectoryPort } from "@voidhash/core/services/organizations/OrgDirectoryPort";
import { SnapshotImageRenderer } from "@voidhash/core/services/paywallThumbnails/SnapshotImageRenderer";
import type { PublicFileStore } from "@voidhash/core/services/storage/PublicFileStore";
import { PaywallAssetConfig } from "@voidhash/core/services/paywallLocations/PaywallAssetConfig";
import { Db } from "@voidhash/db";
import { HostServiceTag } from "@voidhash/mimic-db/app/hostService";
import { SelfhostPlatformRuntimeLive } from "@voidhash/platform-selfhost/PlatformRuntime";
import { Effect, Layer, Redacted } from "effect";

import type { SelfhostAuthConfig, SelfhostRuntimeConfig } from "../config.ts";
import { makeHttpComponentCompilerLive } from "../compiler/CompilerClient.ts";
import { makeBackendMimicHostLive } from "./MimicHost.ts";
import {
  makePaywallArtifactStoreLive,
  makePublicFileStoreLive,
} from "./ObjectStores.ts";
import { MemoryProjectSchemaCacheLive } from "./ProjectSchemaCache.ts";

/**
 * The identity-provider half of the infrastructure graph: the HS256 token
 * provider for the root identity plus a database-only organization directory.
 * Self-host has no external directory, so there is nothing else to wire.
 */
export interface SelfhostAuthLayers {
  readonly authTokenVerifier: Layer.Layer<AuthTokenVerifier>;
  readonly identity: Layer.Layer<IdentityProvider | OrgDirectoryPort, never, Db>;
}

/** Builds the auth layers for the standalone identity provider. */
export const makeSelfhostAuthLayers = (config: SelfhostAuthConfig): SelfhostAuthLayers => {
  const secret = Redacted.value(config.secret);
  return {
    authTokenVerifier: StandaloneAuthTokenVerifierLive(secret),
    identity: Layer.mergeAll(StandaloneIdentityProviderLive(secret), StandaloneOrgDirectoryLive),
  };
};

/** Builds the provider-neutral backend infrastructure for the Node runtime. */
export const makeBackendInfrastructureLive = (
  config: SelfhostRuntimeConfig,
  identity: SelfhostAuthLayers["identity"],
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
  ).pipe(Layer.provide(SelfhostPlatformRuntimeLive));
  const db = Db.layer(config.database);

  return Layer.mergeAll(
    db,
    identity.pipe(Layer.provide(db)),
    Layer.succeed(PaywallAssetConfig, {
      cdnUrl: config.publicBaseUrl,
      publicBaseUrl: config.publicBaseUrl,
    }),
    makePaywallArtifactStoreLive(config.artifactObjectStore).pipe(
      Layer.provide(SelfhostPlatformRuntimeLive),
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
