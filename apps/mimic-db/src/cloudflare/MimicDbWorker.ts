import { HostServiceTag } from "../app/hostService.ts";
import type { ControlStoreApi } from "../core/store.ts";
import { makeRoutesLive } from "../http/rpc-app.ts";
import { makeDurableHostService, type DocumentStub } from "../worker/durable-host-service.ts";
import type { MigrationRegistry } from "@voidhash/mimic-server/migrate";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { RuntimeContext } from "alchemy/RuntimeContext";
import { Cause, Effect, Layer, Option } from "effect";
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import { stringOr } from "@voidhash/lib/lang";

import { makeMimicDocumentObject, type MimicDocumentObjectOptions } from "./MimicDocumentObject.ts";
import { makeMimicHostObject } from "./MimicHostObject.ts";
import { publishIdleMessage } from "./IdleQueueProducer.ts";
import type { MimicDocumentIdleQueue } from "./MimicDocumentIdleQueue.ts";

/** `APP_ENV` mirrors the stage for the two hosted stages, everything else is development. */
const appEnvForStage = (stage: string): string => {
  if (stage === "production" || stage === "preview") return stage;
  return "development";
};

/** Deployment-specific resources composed into the shared mimic-db Worker. */
export interface MimicDbWorkerOptions {
  readonly devPort?: number;
  readonly hyperdrive: Effect.Effect<Cloudflare.Hyperdrive.Connection, never, any>;
  readonly idleQueue?: typeof MimicDocumentIdleQueue;
  readonly main: string;
  readonly migrations: MigrationRegistry;
  readonly telemetry?: (
    env: Record<string, unknown> | undefined,
    stage: string,
  ) => Layer.Layer<never>;
  readonly workerEnv?: Effect.Effect<Record<string, unknown>, never, any>;
}

/**
 * The mimic-db Cloudflare Worker — the single fetch entrypoint that replaces
 * the standalone/gateway/worker Node processes.
 *
 * - `/rpc/v1` → the `MimicRpcGroup` over NDJSON + Basic auth, backed by a
 *   `HostService` that routes control ops to {@link MimicHostObject} and
 *   document ops to per-document {@link MimicDocumentObject}s.
 * - `/ws/v1/databases/:db/collections/:col/documents/:doc` → forwarded to the
 *   document DO, which handles the WebSocket directly (hibernatable).
 *
 * Cloudflare adapter for the portable mimic-db application.
 */
export const makeMimicDbWorker = (options: MimicDbWorkerOptions) => {
  const MimicHostObject = makeMimicHostObject(options.migrations);
  const documentObjectOptions: MimicDocumentObjectOptions = {
    hostObject: MimicHostObject,
    migrations: options.migrations,
  };
  if (options.telemetry !== undefined) {
    Object.assign(documentObjectOptions, { telemetry: options.telemetry });
  }
  if (options.idleQueue !== undefined) {
    Object.assign(documentObjectOptions, { publishIdleMessage });
  }
  const MimicDocumentObject = makeMimicDocumentObject(documentObjectOptions);

  const workerProps = Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;
    let workerEnv: Record<string, unknown> = {};
    if (options.workerEnv !== undefined) {
      workerEnv = yield* options.workerEnv;
    }

    return {
      main: options.main,
      workersDev: { enabled: true, previewsEnabled: false },
      compatibility: { date: "2026-03-17", flags: ["nodejs_compat"] },
      dev: { port: options.devPort ?? 5001, strictPort: true },
      env: {
        ...workerEnv,
        APP_ENV: appEnvForStage(stage),
      },
    };
  }).pipe(Effect.orDie);

  class MimicDbWorker extends Cloudflare.Worker<MimicDbWorker>()(
    "MimicDbWorker",
    // oxlint-disable-next-line effect/noAs -- Alchemy beta.66's three-argument Worker overload omits Effect-backed props even though the runtime accepts them.
    workerProps as unknown as Cloudflare.WorkerProps,
    Effect.gen(function* () {
      const hosts = yield* MimicHostObject;
      const docs = yield* MimicDocumentObject;
      const runtimeContext = yield* RuntimeContext;
      const workerEnv = yield* Effect.serviceOption(Cloudflare.WorkerEnvironment);
      const provideRuntimeContext = <A, E>(
        effect: Effect.Effect<A, E, RuntimeContext>,
      ): Effect.Effect<A, E> => effect.pipe(Effect.provideService(RuntimeContext, runtimeContext));
      // Declare the shared Hyperdrive binding on the Worker (Hyperdrive can only
      // bind to a Worker host). The per-document DOs read it from the Worker env
      // to persist snapshots + command log in Postgres.
      yield* Cloudflare.Hyperdrive.Connect(options.hyperdrive);
      // Declare the idle-notification queue binding on the Worker so it appears in
      // the Worker env. The per-document DOs read the raw binding off the env and
      // publish when a document's collaborative session goes idle while dirty.
      if (options.idleQueue !== undefined) {
        const idleQueue = yield* options.idleQueue;
        yield* Cloudflare.Queues.WriteQueue(idleQueue);
      }

      // Durable Object stubs resolve their runtime binding lazily: `getByName`
      // reads the env binding, which only exists per-request — calling it at
      // Worker init (plan/dev eval) crashes. The control store forwards each call
      // to a freshly-resolved host stub at request time; `docStub` is likewise
      // only invoked inside request handlers.
      // oxlint-disable-next-line effect/noAs -- the Proxy target is an intentionally empty object standing in for ControlStoreApi whose methods are supplied entirely by the get trap; `satisfies` cannot type an unimplemented stub.
      const controlStore = new Proxy({} as ControlStoreApi, {
        get:
          (_target, prop: string) =>
          (...args: unknown[]) =>
            // oxlint-disable-next-line effect/noAs -- the Durable Object stub's RPC method names are only known at runtime, so the trap needs an index-signature view of the freshly-resolved host stub to forward the call (see comment above).
            (hosts.getByName("default") as unknown as Record<string, (...a: unknown[]) => unknown>)[
              prop
            ]!(...args),
      });

      const host = makeDurableHostService({
        controlStore,
        migrations: options.migrations,
        docStub: (collectionId, documentId) => {
          const identity = { collectionId, documentId };
          const stub = docs.getByName(`${collectionId}:${documentId}`);
          return {
            create: (_collectionId, value, schemaVersion, migrationVersion) =>
              provideRuntimeContext(stub.create(identity, value, schemaVersion, migrationVersion)),
            getSnapshot: () => provideRuntimeContext(stub.getSnapshot(identity)),
            submitRpc: (envelope) => provideRuntimeContext(stub.submitRpc(identity, envelope)),
            openConnection: (connectionId, entry, leaseMs) =>
              provideRuntimeContext(stub.openConnection(identity, connectionId, entry, leaseMs)),
            getConnectionSnapshot: (connectionId, leaseMs) =>
              provideRuntimeContext(stub.getConnectionSnapshot(identity, connectionId, leaseMs)),
            heartbeatConnection: (connectionId, leaseMs) =>
              provideRuntimeContext(stub.heartbeatConnection(identity, connectionId, leaseMs)),
            closeConnection: (connectionId) =>
              provideRuntimeContext(stub.closeConnection(identity, connectionId)),
            submitConnection: (connectionId, leaseMs, envelope) =>
              provideRuntimeContext(
                stub.submitConnection(identity, connectionId, leaseMs, envelope),
              ),
            remove: () => provideRuntimeContext(stub.remove(identity)),
          } satisfies DocumentStub;
        },
      });

      const rpcFetch = makeRoutesLive(Layer.succeed(HostServiceTag, host)).pipe(
        Layer.provide(HttpServer.layerServices),
        HttpRouter.toHttpEffect,
      );

      // Optional telemetry is provided around each request so an exporter can
      // flush on scope close before the isolate freezes. Without a deployment
      // hook, Effect's no-op tracer remains in place.
      const env: Record<string, unknown> | undefined = Option.getOrUndefined(workerEnv);
      const TelemetryLive =
        options.telemetry?.(env, stringOr(env?.APP_ENV, "development")) ?? Layer.empty;

      return {
        fetch: Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const url = new URL(request.url, "http://mimic");
          if (url.pathname.startsWith("/ws/v1/")) {
            if (request.headers["upgrade"] !== "websocket") {
              return HttpServerResponse.text("Expected Upgrade: websocket", { status: 426 });
            }
            const parts = url.pathname.split("/").filter(Boolean);
            const collectionId = decodeURIComponent(parts[5] ?? "");
            const documentId = decodeURIComponent(parts[7] ?? "");
            return yield* docs.getByName(`${collectionId}:${documentId}`).fetch(request);
          }
          // `toHttpEffect` yields a builder Effect that returns the request
          // handler; run it to produce the response (mirrors apps/backend).
          const handler = yield* rpcFetch;
          return yield* handler;
        }).pipe(
          // `HttpMiddleware.tracer` gives the standard `http.server <METHOD>` root
          // span (same shape the backend worker emits); `service.name` is what
          // distinguishes this worker in the traces dataset.
          HttpMiddleware.tracer,
          // The 500 net logs the full cause INSIDE the telemetry scope so the
          // failure reaches the logs dataset instead of being discarded.
          Effect.catchCause((cause) =>
            Effect.gen(function* () {
              yield* Effect.logError(`mimic-db fetch error: ${Cause.pretty(cause)}`);
              return HttpServerResponse.text("Internal Server Error", { status: 500 });
            }),
          ),
          Effect.provide(TelemetryLive),
        ),
      };
    }).pipe(
      Effect.provide(
        Layer.mergeAll(Cloudflare.Hyperdrive.ConnectBinding, Cloudflare.Queues.WriteQueueBinding),
      ),
    ),
  ) {}

  return MimicDbWorker;
};
