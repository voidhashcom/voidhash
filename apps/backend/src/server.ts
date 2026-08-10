// oxlint-disable-next-line effect/noNodeBuiltinImport -- the created server value is handed to the `@effect/platform-node` HTTP adapter, which requires a real `node:http` Server instance.
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
import { SmtpMailerLive } from "@voidhash/platform-node/Mailer";
import { causeMessage } from "@voidhash/lib/lang";
import { Config, Context, Data, Effect, Layer, Option } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import type * as Rpc from "effect/unstable/rpc/Rpc";

import { EventCaptureGroupLive } from "@voidhash/backend/routes/event-capture";
import { makeSelfhostAnalyticsRuntimeLive } from "./backend/Analytics.ts";
import { runSelfhostCronJobs } from "./backend/Background.ts";
import { makeBackendInfrastructureLive, makeSelfhostAuthLayers } from "./backend/Backend.ts";
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

/** Boot-time misconfiguration of the self-host process; never crosses a wire. */
class SelfhostServerBootError extends Data.TaggedError("SelfhostServerBootError")<{
  readonly message: string;
}> {}

/** Reads an optional environment variable, mirroring `process.env.X`. */
const optionalEnv = (name: string): Effect.Effect<string | undefined> =>
  Config.string(name).pipe(Config.option, Effect.map(Option.getOrUndefined), Effect.orDie);

/** Reads an optional environment variable, trimmed, mirroring `process.env.X?.trim()`. */
const optionalTrimmedEnv = (name: string): Effect.Effect<string | undefined> =>
  optionalEnv(name).pipe(Effect.map((value) => value?.trim()));

const makeChromiumConfig = (
  executablePath: string | undefined,
  disableSandbox: boolean,
): { readonly disableSandbox: boolean; readonly executablePath: string } | undefined => {
  if (!executablePath) return undefined;
  return { disableSandbox, executablePath };
};

const makeSnapshotImageRenderer = (
  chromiumConfig: { readonly disableSandbox: boolean; readonly executablePath: string } | undefined,
) => {
  if (chromiumConfig === undefined) return undefined;
  return makeSelfhostSnapshotImageRendererLive(chromiumConfig);
};

/** Loads the WWW handler when both of its environment variables are configured. */
const loadWwwHandler = (serverEntry: string | undefined, clientDirectory: string | undefined) =>
  Effect.gen(function* () {
    if (!serverEntry || !clientDirectory) return undefined;
    return yield* Effect.tryPromise({
      try: () => loadWwwRequestHandler(serverEntry, clientDirectory),
      catch: (cause) =>
        new SelfhostServerBootError({
          message: `Failed to load the WWW server bundle: ${causeMessage(cause)}`,
        }),
    });
  });

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
      const chromiumExecutablePath = yield* optionalTrimmedEnv("CHROMIUM_EXECUTABLE_PATH");
      const chromiumDisableSandbox = yield* optionalEnv("CHROMIUM_DISABLE_SANDBOX");
      const chromiumConfig = makeChromiumConfig(
        chromiumExecutablePath,
        chromiumDisableSandbox === "true",
      );
      const infrastructure = Layer.mergeAll(
        makeBackendInfrastructureLive(
          config,
          authLayers.identity,
          makeSnapshotImageRenderer(chromiumConfig),
        ),
        options.identityDirectory ?? Layer.empty,
      ).pipe(Layer.provide(hostLayer));
      const authContext = yield* Layer.build(authLayers.authTokenVerifier);
      const authTokenVerifier = Context.get(authContext, AuthTokenVerifier);
      const rpcExtension = options.rpcExtension({ authTokenVerifier, config });
      const platformRuntime = Layer.mergeAll(
        platform.workflowRunner,
        platform.runtime,
        platform.queue,
        platform.keyValueStore,
        platform.cronScheduler,
      );
      const analyticsRuntime = makeSelfhostAnalyticsRuntimeLive(config);
      const runtimeContext = yield* Layer.build(
        Layer.mergeAll(
          infrastructure,
          platformRuntime,
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
            mcpOAuth: options.mcpOAuth,
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
        runSelfhostPushDeliveryConsumers(config).pipe(Effect.provide(runtimeContext)),
      );
      yield* Effect.forkScoped(runSelfhostCronJobs.pipe(Effect.provide(runtimeContext)));
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
        pushDeliveryDispatch,
        routeExtension: options.routeExtension,
        mcpOAuth: options.mcpOAuth,
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
      const wwwServerEntry = yield* optionalTrimmedEnv("WWW_SERVER_ENTRY");
      const wwwClientDirectory = yield* optionalTrimmedEnv("WWW_CLIENT_DIRECTORY");
      if ((wwwServerEntry === undefined) !== (wwwClientDirectory === undefined)) {
        return yield* new SelfhostServerBootError({
          message: "WWW_SERVER_ENTRY and WWW_CLIENT_DIRECTORY must be configured together",
        });
      }
      const wwwHandler = yield* loadWwwHandler(wwwServerEntry, wwwClientDirectory);
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
          wwwHandler(request, response).catch((error: unknown) => {
            Effect.runFork(Effect.logError(`WWW request failed: ${causeMessage(error)}`));
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
