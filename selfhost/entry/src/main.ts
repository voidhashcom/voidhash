import { createServer } from "node:http";

import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { EventCaptureApi } from "@voidhash/api-contracts/event-capture";
import { LinksApi } from "@voidhash/api-contracts/links";
import {
  buildBackendFetch,
  buildBackendAgentServices,
  NoBackendFeatures,
  NoBackendRpcExtension,
} from "@voidhash/backend/src/BackendApp.ts";
import { RpcAuthLive } from "@voidhash/backend/src/RpcMiddlewares.ts";
import { AuthTokenVerifier } from "@voidhash/core/services/auth/AuthTokenVerifier";
import { EventCaptureService } from "@voidhash/core/services/analyticsIngest/EventCaptureService";
import { LinkRedirectService } from "@voidhash/core/services/measurement/LinkRedirectService";
import { PushDeliveryDispatch } from "@voidhash/core/services/notifications/PushDeliveryDispatch";
import { PaywallThumbnailService } from "@voidhash/core/services/paywallThumbnails/PaywallThumbnailService";
import { HostServiceTag } from "@voidhash/mimic-db/app/hostService";
import { getConfig as getMimicConfig } from "@voidhash/mimic-db/config";
import { makeRoutesLive } from "@voidhash/mimic-db/http/rpc-app";
import { DurableEntityHost } from "@voidhash/platform/DurableEntity";
import { NodeDurableEntityControl } from "@voidhash/platform-node/DurableEntity";
import { SmtpMailerLive } from "@voidhash/platform-node/Mailer";
import { Context, Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { EventCaptureGroupLive } from "@voidhash/backend/src/routes/event-capture.ts";
import { LinksGroupLive } from "@voidhash/backend/src/routes/links.ts";
import {
  makeSelfhostAnalyticsRuntimeLive,
  runSelfhostAnalyticsConsumers,
} from "./backend/Analytics.ts";
import { WorkosAuthTokenVerifierLive } from "./backend/AuthTokenVerifier.ts";
import { runSelfhostCronJobs } from "./backend/Background.ts";
import { makeBackendInfrastructureLive, makeSelfhostWorkosLive } from "./backend/Backend.ts";
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
import {
  makeSelfhostWorkflowRuntimeLive,
  registerSelfhostWorkflows,
} from "./backend/WorkflowPorts.ts";
import { getSelfhostRuntimeConfig } from "./config.ts";
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

const isLinksRequest = (url: string | undefined): boolean => {
  const pathname = new URL(url ?? "/", "http://selfhost.local").pathname;
  return pathname === "/l" || pathname.startsWith("/l/");
};

const linkClick = (url: string | undefined): { readonly linkId: string; readonly token: string } | undefined => {
  const parsed = new URL(url ?? "/", "http://selfhost.local");
  const matched = /^\/l\/([^/]+)$/.exec(parsed.pathname);
  const token = parsed.searchParams.get("token");
  if (!matched?.[1] || !token) return undefined;
  return { linkId: decodeURIComponent(matched[1]), token };
};

NodeRuntime.runMain(
  Effect.scoped(
    Effect.gen(function* () {
      const config = getSelfhostRuntimeConfig();
      yield* Effect.logInfo("Community Edition active");
      const mimicConfig = getMimicConfig();
      const hostContext = yield* Layer.build(makeMimicNodeHostLive(getMimicNodeConfig()));
      const host = Context.get(hostContext, HostServiceTag);
      const entities = Context.get(hostContext, DurableEntityHost);
      const entityControl = Context.get(hostContext, NodeDurableEntityControl);
      const hostLayer = Layer.succeed(HostServiceTag, host);
      const workos = makeSelfhostWorkosLive(config.workos);
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
      const infrastructure = makeBackendInfrastructureLive(
        config,
        workos,
        clickhouse?.readOnly,
        chromiumConfig === undefined
          ? undefined
          : makeSelfhostSnapshotImageRendererLive(chromiumConfig),
      ).pipe(Layer.provide(hostLayer));
      const authContext = yield* Layer.build(
        WorkosAuthTokenVerifierLive.pipe(Layer.provide(workos)),
      );
      const authTokenVerifier = Context.get(authContext, AuthTokenVerifier);
      const workflowRuntime = makeSelfhostWorkflowRuntimeLive(config);
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
            features: NoBackendFeatures,
            infrastructure,
            pushDeliveryDispatch,
          }),
          infrastructure,
        ),
      );
      yield* registerSelfhostWorkflows(config).pipe(Effect.provide(runtimeContext));
      yield* Effect.forkScoped(
        runSelfhostAnalyticsConsumers(config, clickhouse?.readWrite).pipe(
          Effect.provide(runtimeContext),
        ),
      );
      yield* Effect.forkScoped(
        runSelfhostPushDeliveryConsumers(config).pipe(Effect.provide(runtimeContext)),
      );
      yield* Effect.forkScoped(
        runSelfhostCronJobs(config, clickhouse?.readWrite).pipe(Effect.provide(runtimeContext)),
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
        features: NoBackendFeatures,
        rpcExtension: NoBackendRpcExtension,
        infrastructure,
        ...(clickhouse === undefined ? {} : { analyticsQueryClient: clickhouse.analyticsQuery }),
        pushDeliveryDispatch,
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
      const linkService = Context.get(runtimeContext, LinkRedirectService);
      const linksEffect = yield* HttpApiBuilder.layer(LinksApi, {
        openapiPath: "/l/docs/openapi.json",
      }).pipe(
        Layer.provide(LinksGroupLive),
        Layer.provide(Layer.succeed(LinkRedirectService, linkService)),
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
      const linksHandler = yield* NodeHttpServer.makeHandler(linksEffect, { scope });
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
        const click = linkClick(request.url);
        if (click) {
          const header = (name: string): string => {
            const value = request.headers[name];
            return Array.isArray(value) ? value[0] ?? "" : value ?? "";
          };
          Effect.runPromise(linkService.click({
            clickId: `click_${crypto.randomUUID()}`,
            linkId: click.linkId,
            referer: header("referer") || undefined,
            token: click.token,
            userAgent: header("user-agent"),
          })).then((result) => {
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("Referrer-Policy", "no-referrer");
            if (!result) {
              response.statusCode = 404;
              response.end("Link not found");
              return;
            }
            response.statusCode = 302;
            response.setHeader("Location", result.destination);
            response.end();
          }).catch(() => {
            response.statusCode = 503;
            response.end("Link service unavailable");
          });
          return;
        }
        if (isLinksRequest(request.url)) {
          linksHandler(request, response);
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
  ) as never,
);
