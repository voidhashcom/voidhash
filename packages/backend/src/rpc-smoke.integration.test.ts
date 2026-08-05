/**
 * Backend RPC smoke, run IN-PROCESS against the real backend
 * stack provisioned once by `packages/core/test/_testing/globalSetup.ts` (the
 * same deploy the core service integration tests use). Nothing is deployed or
 * called over the wire here:
 *
 *  - **RPC cases** dispatch through the production handler graph
 *    (`buildBackendRpcServices`) via `RpcTest.makeClient(RpcGroups)` — an
 *    in-memory client↔server with no HTTP/serialization. The `rpcSmokeCases`
 *    manifest, its payloads, and the `runRpcSmokeCase` runner are reused
 *    unchanged; only the transport differs from the old over-the-wire client.
 *  - **Raw route cases** feed synthetic requests to the real
 *    `buildBackendFetch` route graph via a synthetic `HttpServerRequest`.
 *
 * Infra is real where the deployed stack is real: `Db`/`Clickhouse`
 * are built from the gated `testConnections`. Only the genuine external/platform
 * seams are doubled — `OrgDirectoryPort` is faked so organization RPCs never
 * touch a real directory; payment providers use local stubs; the webhook manager
 * stays a thin DB-backed stub (the production
 * `webhook-rpcs.ts` passes `projectId: ""`, which the tolerant stub accepts).
 * The smoke fixture is seeded in-process via `seedSmokeData` (formerly the
 * `/__test/seed` route).
 */
import { Effect, Layer } from "effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { RpcClient, RpcTest } from "effect/unstable/rpc";
import { describe, expect, inject, test } from "vitest";

import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { PaywallArtifactStore } from "@voidhash/core/services";
import { StandaloneIdentityProviderLive } from "@voidhash/core/services/auth/StandaloneIdentityProvider";
import { Db } from "@voidhash/db";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";

import {
  BackendComponentCompilerStubLive,
  BackendMimicHostStubLive,
  BackendNoopIdentityProjectionPublisherLive,
  BackendPaymentProviderStubsLive,
  BackendPaywallArtifactStoreStubLive,
  BackendPaywallAssetConfigLive,
  BackendPublicFileStoreStubLive,
  BackendSnapshotImageRendererStubLive,
  NoBackendFeatures,
  NoBackendRpcExtension,
  buildBackendFetch,
  buildBackendRpcServices,
} from "./BackendApp.ts";
import { BackendRpcGroups as RpcGroups } from "./BackendRpcGroups.ts";
import {
  TestClickhouseLive,
  TestProjectSchemaCacheLive,
  TestWebhookManagerServiceLive,
  TestWorkflowPortsLive,
  TestOrgDirectoryLive,
} from "./testing/TestLayers.ts";
import { TestRpcAuthLive } from "./testing/TestRpcAuth.ts";
import type { BackendTestConnections } from "./testing/BackendTestConnections.ts";
import {
  assertRpcSmokeManifestCoverage,
  makeRpcSmokeContext,
  rpcSmokeCases,
  type RpcSmokeCase,
  type RpcSmokeContext,
  type RpcSmokeRole,
} from "./testing/rpc-smoke-cases.ts";
import { makeSmokeIds, SMOKE_ROLE_HEADER, SMOKE_RUN_ID_HEADER } from "./testing/smoke-ids.ts";
import { seedSmokeData } from "./testing/smoke-seed.ts";

/**
 * Read the gated connection credentials shared by the once-per-run deploy. Fails
 * loudly when absent or null — that means `globalSetup` failed, or it ran on a
 * production/preview stage (where `testConnections` is intentionally withheld).
 */
/** Signing key for the standalone session tokens this smoke mints. */
const SMOKE_AUTH_SECRET = "rpc-smoke-standalone-auth-secret";

const requireTestConnections = (): BackendTestConnections => {
  const tc = inject("coreStackOutput")?.testConnections ?? null;
  if (tc === null) {
    throw new Error(
      "rpc-smoke: shared deploy output missing or testConnections is null — globalSetup failed, or it ran on a production/preview stage.",
    );
  }
  return tc;
};

/**
 * Minimal {@link PlatformRuntime} stub — discharges the runtime-phase marker the
 * push-dispatch port colors its effects with (the noop dispatch never reads it).
 */
const SmokePlatformRuntimeStub = Layer.succeed(PlatformRuntime, PlatformRuntime.of({}));

const SmokePaywallArtifactStoreLive = Layer.sync(PaywallArtifactStore, () => {
  const objects = new Map<
    string,
    { readonly body: Uint8Array; readonly contentType: string | null }
  >();
  return PaywallArtifactStore.of({
    bucketName: "rpc-smoke-paywall-artifacts",
    getObject: (key) => Effect.succeed(objects.get(key) ?? null),
    head: (key) =>
      Effect.succeed(objects.has(key) ? { size: objects.get(key)?.body.length ?? 0 } : null),
    putObject: ({ body, contentType, key }) =>
      Effect.sync(() => {
        objects.set(key, { body, contentType: contentType ?? null });
      }),
  });
});

/**
 * In-process infrastructure for the RPC handler graph: real `Db`/`Clickhouse`
 * from the deployed stack, an in-memory schema cache, a faked
 * `OrgDirectoryPort`, and local payment/paywall/identity stubs.
 */
const makeRpcInfra = (tc: BackendTestConnections) =>
  Layer.mergeAll(
    Db.layer(tc.db),
    ClickhouseWebClient.layer(tc.clickhouse).pipe(Layer.orDie),
    StandaloneIdentityProviderLive(SMOKE_AUTH_SECRET),
    TestProjectSchemaCacheLive,
    TestOrgDirectoryLive,
    BackendMimicHostStubLive,
    BackendComponentCompilerStubLive,
    BackendSnapshotImageRendererStubLive,
    BackendPaymentProviderStubsLive,
    BackendPaywallAssetConfigLive,
    SmokePaywallArtifactStoreLive,
    BackendPublicFileStoreStubLive,
    BackendNoopIdentityProjectionPublisherLive,
  );

/**
 * In-process infrastructure for the raw route graph: real `Db` plus the same
 * stubs as the RPC graph (these routes need no ClickHouse, so a no-op stands
 * in).
 */
const makeRouteInfra = (tc: BackendTestConnections) =>
  Layer.mergeAll(
    Db.layer(tc.db),
    TestClickhouseLive,
    TestProjectSchemaCacheLive,
    TestOrgDirectoryLive,
    BackendMimicHostStubLive,
    BackendComponentCompilerStubLive,
    BackendSnapshotImageRendererStubLive,
    BackendPaymentProviderStubsLive,
    BackendPaywallAssetConfigLive,
    BackendPaywallArtifactStoreStubLive,
    BackendPublicFileStoreStubLive,
    BackendNoopIdentityProjectionPublisherLive,
    StandaloneIdentityProviderLive(SMOKE_AUTH_SECRET),
  );

const smokeHeaders = (context: RpcSmokeContext, role: RpcSmokeRole) => ({
  [SMOKE_ROLE_HEADER]: role,
  [SMOKE_RUN_ID_HEADER]: context.runId,
});

const formatFailure = (failure: unknown): string => {
  if (failure instanceof Error) {
    const entries = Object.entries(failure as unknown as Record<string, unknown>);
    const details = entries.length > 0 ? ` ${JSON.stringify(Object.fromEntries(entries))}` : "";
    return `${failure.name}: ${failure.message}${details}`;
  }
  try {
    return JSON.stringify(failure);
  } catch {
    return String(failure);
  }
};

const runRpcSmokeCase = (
  client: Record<string, (payload?: unknown) => Effect.Effect<unknown, unknown>>,
  smokeCase: RpcSmokeCase,
  context: RpcSmokeContext,
) =>
  Effect.gen(function* () {
    const payload = smokeCase.payload?.(context);
    const request = client[smokeCase.tag];
    if (!request) {
      throw new Error(`RPC client is missing ${smokeCase.tag}`);
    }

    const result = yield* request(payload).pipe(
      RpcClient.withHeaders(smokeHeaders(context, smokeCase.role)),
      Effect.match({
        onFailure: (failure) => ({ _tag: "Failure" as const, failure }),
        onSuccess: (value) => ({ _tag: "Success" as const, value }),
      }),
    );
    const expected = smokeCase.expected ?? { success: true };

    if ("errorTag" in expected) {
      expect(result._tag, `${smokeCase.tag} should fail`).toBe("Failure");
      if (result._tag === "Failure") {
        const actual = result.failure as { readonly _tag?: string };
        expect(actual._tag, `${smokeCase.tag} error tag`).toBe(expected.errorTag);
      }
      return;
    }

    if (result._tag === "Failure") {
      throw new Error(`${smokeCase.tag} failed unexpectedly: ${formatFailure(result.failure)}`);
    }
    expect(result._tag, `${smokeCase.tag} should succeed`).toBe("Success");
    if (result._tag === "Success") {
      smokeCase.afterSuccess?.(context, result.value);
    }
  });

/**
 * Run id that namespaces the seeded fixtures so independent runs against the
 * shared database don't collide; set `VOIDHASH_RPC_SMOKE_RUN_ID` to reproduce a
 * specific run.
 */
const runId =
  (process.env.VOIDHASH_RPC_SMOKE_RUN_ID ?? crypto.randomUUID())
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, "")
    .slice(0, 10) || "default";

describe("Backend RPC smoke", () => {
  test("dispatches every RPC against the in-process handler graph", async () => {
    const tc = requireTestConnections();
    assertRpcSmokeManifestCoverage();

    // Seed the fixture in-process (formerly the `/__test/seed` HTTP route).
    await Effect.runPromise(seedSmokeData(runId).pipe(Effect.provide(Db.layer(tc.db))));

    const ids = makeSmokeIds(runId);
    const context = makeRpcSmokeContext(runId, ids, "https://example.test/webhook-target");

    const infra = makeRpcInfra(tc);
    const rpcServices = buildBackendRpcServices({
      auth: TestRpcAuthLive,
      features: NoBackendFeatures,
      rpcExtension: NoBackendRpcExtension,
      infrastructure: infra,
      webhookManager: TestWebhookManagerServiceLive.pipe(Layer.provide(infra)),
    });

    // The infra layer (incl. `Db`) is scoped: its `Db.make` finalizer closes
    // the mysql2 connection when the scope it was built into closes. It must
    // therefore be provided to the WHOLE block — `makeClient` *and* the
    // dispatch loop — not just to `makeClient`. Providing it to `makeClient`
    // alone ties the layer's scope to `makeClient`'s completion, so the Db
    // connection is closed the instant the client resolves; the first
    // dispatch then dies with "Can't add new command when connection is in
    // closed state". The in-memory server captures the handler context at
    // build time, so the loop only needs the backing resources to stay live.
    await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(RpcGroups);

        for (const smokeCase of rpcSmokeCases) {
          yield* runRpcSmokeCase(client as never, smokeCase, context);
        }
      }).pipe(Effect.provide(rpcServices), Effect.provide(TestWorkflowPortsLive), Effect.scoped),
    );
  }, 600_000);
});

/**
 * Sends a request to the real backend route graph in-process: builds
 * `buildBackendFetch`, feeds it a synthetic `HttpServerRequest`, and reads the
 * response back as a web `Response`. Mirrors how the deployed worker invokes the
 * built handler (provide the workflow-port no-ops to both the build and the
 * per-request handler).
 */
const requestBackend = (tc: BackendTestConnections, path: string, init: RequestInit) =>
  Effect.scoped(
    Effect.gen(function* () {
      const handler = yield* buildBackendFetch({
        auth: TestRpcAuthLive,
        features: NoBackendFeatures,
        rpcExtension: NoBackendRpcExtension,
        infrastructure: makeRouteInfra(tc),
      }).pipe(Effect.provide(TestWorkflowPortsLive));

      const request = HttpServerRequest.fromWeb(new Request(`http://backend.local${path}`, init));
      const response = yield* handler.pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, request),
        Effect.provide(TestWorkflowPortsLive),
        // The push send path colors its effects with the runtime-phase marker
        // (queue dispatch); the deployed worker's fetch provides it, so mirror
        // that here with a minimal stub.
        Effect.provide(SmokePlatformRuntimeStub),
      );

      const web = HttpServerResponse.toWeb(response);
      const text = yield* Effect.promise(() => web.text());
      return { status: web.status, text };
      // The auth middleware now resolves `Db` ambiently, so its requirement
      // surfaces on the built handler (exactly as in the deployed worker, which
      // provides `Db` at the outer fetch scope). Provide it here to match.
    }).pipe(Effect.provide(Db.layer(tc.db))),
  );

describe("Backend runtime capabilities", () => {
  test("keeps Enterprise UI capabilities dormant in the core-only composition", async () => {
    const tc = requireTestConnections();
    const { status, text } = await Effect.runPromise(
      requestBackend(tc, "/api/runtime-capabilities", { method: "GET" }),
    );

    expect(status).toBe(200);
    expect(JSON.parse(text)).toEqual({ enterprise: {} });
  });
});

