import { createServer } from "node:http";

import { NodeHttpServer } from "@effect/platform-node";
import { EventCaptureApi } from "@voidhash/api-contracts/event-capture";
import {
  buildBackendFetch,
  buildBackendAgentServices,
  type BackendFeatureComposition,
  type BackendRpcExtension,
  type BackendRuntimeLayers,
} from "@voidhash/backend/BackendApp";
import type { McpOAuth } from "@voidhash/backend/McpOAuth";
import { RpcAuthLive } from "@voidhash/backend/RpcMiddlewares";
import { AuthTokenVerifier } from "@voidhash/core/services/auth/AuthTokenVerifier";
import { EventCaptureService } from "@voidhash/core/services/analyticsIngest/EventCaptureService";
import { AnalyticsDispatchService } from "@voidhash/core/services/analyticsIngest/AnalyticsDispatchService";
import { PushDeliveryDispatch } from "@voidhash/core/services/notifications/PushDeliveryDispatch";
import { PaywallThumbnailService } from "@voidhash/core/services/paywallThumbnails/PaywallThumbnailService";
import { backendWorkflows } from "@voidhash/core/workflows/registry";
import { Db } from "@voidhash/db";
import { HostServiceTag } from "@voidhash/mimic-db/app/hostService";
import { getConfig as getMimicConfig } from "@voidhash/mimic-db/config";
import { makeRoutesLive } from "@voidhash/mimic-db/http/rpc-app";
import { DurableEntityAlarmControl, DurableEntityHost } from "@voidhash/platform/DurableEntity";
import { SmtpMailerLive } from "@voidhash/platform-selfhost/Mailer";
import { Context, Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import type * as Rpc from "effect/unstable/rpc/Rpc";

import { EventCaptureGroupLive } from "@voidhash/backend/routes/event-capture";
import {
  makeSelfhostAnalyticsRuntimeLive,
  runSelfhostAnalyticsConsumers,
} from "./backend/Analytics.ts";
import { runSelfhostCronJobs } from "./backend/Background.ts";
import { makeBackendInfrastructureLive, makeSelfhostAuthLayers } from "./backend/Backend.ts";
import { makeSelfhostClickhouseLayers } from "./backend/Clickhouse.ts";
import {
  runSelfhostPushDeliveryConsumers,
  SelfhostPushDeliveryDispatchLive,
} from "./backend/Push.ts";
import {
  makeSelfhostPaywallThumbnailServiceLive,
  makeSelfhostSnapshotImageRendererLive,
  runSelfhostPaywallThumbnailConsumer,
} from "./backend/Thumbnails.ts";
import { makeSelfhostPlatformLayers } from "./backend/PlatformProfile.ts";
import { getSelfhostRuntimeConfig, type SelfhostRuntimeConfig } from "./config.ts";
import { installAgentNodeWebSocketServer } from "./agent/AgentNodeWebSocket.ts";
import { makeSelfhostMimicDocumentIdlePublisher } from "./mimic/MimicDocumentIdleQueue.ts";
import { installMimicNodeWebSocketServer } from "./mimic/MimicNodeWebSocket.ts";
import { makeMimicNodeHostLive } from "./mimic/MimicNode.ts";
import { getMimicNodeConfig } from "./mimic/config.ts";
import { isWwwRequest, loadWwwRequestHandler } from "./www/Www.ts";

const isMimicRequest = (url: string | undefined): boolean => {
  const pathname = new URL(url ?? "/", "http://selfhost.local").pathname;
  return pathname === "/rpc/v1" || pathname.startsWith("/rpc/v1/");
};

const isCaptureRequest = (url: string | undefined): boolean => {
  const pathname = new URL(url ?? "/", "http://selfhost.local").pathname;
  return pathname === "/i" || pathname.startsWith("/i/");
};

/**
 * The runtime values a composition root can only obtain from inside the server
 * boot sequence, handed to the option factories that need them.
 */
export interface SelfhostServerRuntime {
  readonly authTokenVerifier: AuthTokenVerifier["Service"];
  readonly config: SelfhostRuntimeConfig;
}

/**
 * Everything a composition root chooses about a self-host process.
 *
 * The Community entrypoint passes the core-only defaults; a private
 * distribution passes its own feature bundle, admin RPC surface, identity
 * directory, webhook routes, and MCP authorization server. No application code
 * differs between the two — only the values below.
 */
export interface SelfhostServerOptions<
  RFeatureRpcs extends Rpc.Any = never,
  RFeatureServices = never,
  RExtensionRpcs extends Rpc.Any = never,
  RIdentityDirectory = never,
> {
  /** Edition name logged once at boot, e.g. `"Community Edition"`. */
  readonly edition: string;
  readonly features: BackendFeatureComposition<RFeatureRpcs, RFeatureServices>;
  /**
   * Built after the identity layers resolve, because an admin RPC surface
   * typically authenticates against the same token verifier the transport uses.
   */
  readonly rpcExtension: (runtime: SelfhostServerRuntime) => BackendRpcExtension<RExtensionRpcs>;
  /**
   * External directory merged into the infrastructure graph so raw routes and
   * feature ports can resolve it at request time. Self-host's own identity
   * provider is always the standalone one; this is the *directory* a private
   * composition projects users and organizations from.
   */
  readonly identityDirectory?: Layer.Layer<RIdentityDirectory>;
  readonly routeExtension?: BackendRuntimeLayers["routeExtension"];
  readonly mcpOAuth?: Layer.Layer<McpOAuth>;
}

/**
 * Boots the single-process self-host runtime: HTTP transport, mimic document
 * host, analytics capture, background consumers, and WebSocket upgrades.
 *
 * Runs until interrupted; the returned effect owns every resource in its scope.
 */
export const runSelfhostServer = <
  RFeatureRpcs extends Rpc.Any = never,
  RFeatureServices = never,
  RExtensionRpcs extends Rpc.Any = never,
  RIdentityDirectory = never,
>(
  options: SelfhostServerOptions<
    RFeatureRpcs,
    RFeatureServices,
    RExtensionRpcs,
    RIdentityDirectory
  >,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const config = getSelfhostRuntimeConfig();
      yield* Effect.logInfo(`${options.edition} active`);
      const mimicConfig = getMimicConfig();
      const platform = makeSelfhostPlatformLayers(config);
      const hostContext = yield* Layer.build(
        makeMimicNodeHostLive(getMimicNodeConfig(), platform.durableEntities),
      );
      const host = Context.get(hostContext, HostServiceTag);
      const entities = Context.get(hostContext, DurableEntityHost);
      const entityControl = Context.get(hostContext, DurableEntityAlarmControl);
      const hostLayer = Layer.succeed(HostServiceTag, host);
      const authLayers = makeSelfhostAuthLayers(config.auth);
      yield* Effect.logInfo(
        `Identity provider: standalone (root user ${config.auth.rootUsername})`,
      );
      const clickhouse = config.clickhouse
        ? makeSelfhostClickhouseLayers(config.clickhouse)
        : undefined;
      const chromiumExecutablePath = process.env.CHROMIUM_EXECUTABLE_PATH?.trim();
      const chromiumConfig = chromiumExecutablePath
        ? {
            disableSandbox: process.env.CHROMIUM_DISABLE_SANDBOX === "true",
            executablePath: chromiumExecutablePath,
          }
        : undefined;
      const infrastructure = Layer.mergeAll(
        makeBackendInfrastructureLive(
          config,
          authLayers.identity,
          clickhouse?.readOnly,
          chromiumConfig === undefined
            ? undefined
            : makeSelfhostSnapshotImageRendererLive(chromiumConfig),
        ),
        options.identityDirectory ?? Layer.empty,
      ).pipe(Layer.provide(hostLayer));
      const authContext = yield* Layer.build(authLayers.authTokenVerifier);
      const authTokenVerifier = Context.get(authContext, AuthTokenVerifier);
      const rpcExtension = options.rpcExtension({ authTokenVerifier, config });
      const workflowRuntime = Layer.merge(platform.workflowRunner, platform.runtime);
      const analyticsRuntime = makeSelfhostAnalyticsRuntimeLive(config);
      const runtimeContext = yield* Layer.build(
        Layer.mergeAll(
          infrastructure,
          workflowRuntime,
          analyticsRuntime,
          SmtpMailerLive(config.mailer),
        ),
      );
      const publishIdleDocument = yield* makeSelfhostMimicDocumentIdlePublisher.pipe(
        Effect.provide(runtimeContext),
      );
      const pushDispatchContext = yield* Layer.build(SelfhostPushDeliveryDispatchLive).pipe(
        Effect.provide(runtimeContext),
      );
      const pushDeliveryDispatch = Layer.succeed(
        PushDeliveryDispatch,
        Context.get(pushDispatchContext, PushDeliveryDispatch),
      );
      const agentServices = yield* Layer.build(
        Layer.mergeAll(
          buildBackendAgentServices({
            features: options.features,
            infrastructure,
            pushDeliveryDispatch,
            ...(options.mcpOAuth === undefined ? {} : { mcpOAuth: options.mcpOAuth }),
          }),
          infrastructure,
        ),
      );
      const workflowInfra = Layer.mergeAll(
        Db.layer(config.database),
        Layer.succeed(
          AnalyticsDispatchService,
          Context.get(runtimeContext, AnalyticsDispatchService),
        ),
      );
      yield* Effect.forEach(
        backendWorkflows,
        (registration) => registration.register(workflowInfra),
        { discard: true },
      ).pipe(Effect.provide(runtimeContext), Effect.orDie);
      yield* Effect.forkScoped(
        runSelfhostAnalyticsConsumers(config, clickhouse?.readWrite).pipe(
          Effect.provide(runtimeContext),
        ),
      );
      yield* Effect.forkScoped(
        runSelfhostPushDeliveryConsumers(config).pipe(Effect.provide(runtimeContext)),
      );
      yield* Effect.forkScoped(
        runSelfhostCronJobs(clickhouse?.readWrite).pipe(Effect.provide(runtimeContext)),
      );
      if (chromiumConfig !== undefined) {
        const thumbnailContext = yield* Layer.build(
          makeSelfhostPaywallThumbnailServiceLive(chromiumConfig),
        ).pipe(Effect.provide(runtimeContext));
        const thumbnailService = Context.get(thumbnailContext, PaywallThumbnailService);
        yield* Effect.forkScoped(
          runSelfhostPaywallThumbnailConsumer.pipe(
            Effect.provide(runtimeContext),
            Effect.provideService(PaywallThumbnailService, thumbnailService),
          ),
        );
      } else {
        yield* Effect.logWarning(
          "Paywall thumbnail rendering is disabled because CHROMIUM_EXECUTABLE_PATH is unset",
        );
      }

      const backendEffect = yield* buildBackendFetch({
        auth: RpcAuthLive(authTokenVerifier),
        features: options.features,
        rpcExtension,
        infrastructure,
        ...(clickhouse === undefined ? {} : { analyticsQueryClient: clickhouse.analyticsQuery }),
        pushDeliveryDispatch,
        ...(options.routeExtension === undefined ? {} : { routeExtension: options.routeExtension }),
        ...(options.mcpOAuth === undefined ? {} : { mcpOAuth: options.mcpOAuth }),
      }).pipe(Effect.provide(runtimeContext));
      const mimicEffect = yield* makeRoutesLive(hostLayer).pipe(
        Layer.provide(NodeHttpServer.layerHttpServices),
        HttpRouter.toHttpEffect,
      );
      const captureService = Context.get(runtimeContext, EventCaptureService);
      const captureEffect = yield* HttpApiBuilder.layer(EventCaptureApi, {
        openapiPath: "/i/docs/openapi.json",
      }).pipe(
        Layer.provide(EventCaptureGroupLive),
        Layer.provide(Layer.succeed(EventCaptureService, captureService)),
        Layer.provide(NodeHttpServer.layerHttpServices),
        HttpRouter.toHttpEffect,
      );

      const scope = yield* Effect.scope;
      const backendHandler = yield* NodeHttpServer.makeHandler(
        backendEffect.pipe(Effect.provide(runtimeContext)),
        { scope },
      );
      const mimicHandler = yield* NodeHttpServer.makeHandler(mimicEffect, { scope });
      const captureHandler = yield* NodeHttpServer.makeHandler(
        captureEffect.pipe(Effect.provide(runtimeContext)),
        { scope },
      );
      const wwwServerEntry = process.env.WWW_SERVER_ENTRY?.trim();
      const wwwClientDirectory = process.env.WWW_CLIENT_DIRECTORY?.trim();
      if ((wwwServerEntry === undefined) !== (wwwClientDirectory === undefined)) {
        return yield* Effect.fail(
          new Error("WWW_SERVER_ENTRY and WWW_CLIENT_DIRECTORY must be configured together"),
        );
      }
      const wwwHandler =
        wwwServerEntry && wwwClientDirectory
          ? yield* Effect.tryPromise({
              try: () => loadWwwRequestHandler(wwwServerEntry, wwwClientDirectory),
              catch: (cause) => new Error("Failed to load the WWW server bundle", { cause }),
            })
          : undefined;
      const server = createServer((request, response) => {
        if (isMimicRequest(request.url)) {
          mimicHandler(request, response);
          return;
        }
        if (isCaptureRequest(request.url)) {
          captureHandler(request, response);
          return;
        }
        if (wwwHandler !== undefined && isWwwRequest(request.url)) {
          wwwHandler(request, response).catch((error) => {
            console.error("WWW request failed", error);
            if (!response.headersSent) {
              response.statusCode = 500;
            }
            response.end();
          });
          return;
        }
        backendHandler(request, response);
      });
      const agentWebSockets = installAgentNodeWebSocketServer(
        server,
        entities,
        agentServices,
        authTokenVerifier,
        config.agent,
      );
      const closeMimicWebSockets = installMimicNodeWebSocketServer(server, host, entities, {
        control: entityControl,
        debounceMs: mimicConfig.idleNotifyDebounceMs,
        publish: publishIdleDocument,
        additionalAlarmHandlers: agentWebSockets.alarmHandlers,
      });

      yield* Effect.acquireRelease(
        Effect.callback<void, Error>((resume) => {
          const onError = (error: Error) => resume(Effect.fail(error));
          server.once("error", onError);
          server.listen(config.port, config.host, () => {
            server.off("error", onError);
            resume(Effect.void);
          });
        }),
        () =>
          Effect.callback<void>((resume) => {
            agentWebSockets.close();
            closeMimicWebSockets();
            if (!server.listening) {
              resume(Effect.void);
              return;
            }
            server.close(() => resume(Effect.void));
          }),
      );
      yield* Effect.logInfo(`Self-host runtime listening on ${config.publicBaseUrl}`);
      yield* Effect.never;
    }),
  );
