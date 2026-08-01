import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { Workos } from "@voidhash/core/services/auth/Workos";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import { generateId } from "@voidhash/core/utils";
import {
  AuditLogPort,
  AuditLogPortError,
  ProjectSchemaCache,
  PublicFileStore,
  SchemaCacheInvalidationService,
} from "@voidhash/core/services";
import { AuditLogActorType, Db, auditLogs } from "@voidhash/db";
import { Effect, Layer, Option } from "effect";
import { inject, test as vitestTest } from "vitest";
import type { CoreTestConnections } from "./CoreTestConnections.ts";

import type {} from "./provided-context.d.ts";

/**
 * The common services every core integration test gets for free. The harness
 * provides infra (`Db`, `ClickhouseWebClient`, `Workos`) plus the cross-cutting support
 * services (`ProjectSchemaCache` stub, database-backed `AuditLogPort`,
 * `SchemaCacheInvalidationService`) that most feature-service layers depend on.
 * A test still provides its own service-under-test layer (e.g.
 * `Effect.provide(PerkService.layer)`); its remaining requirements must fall
 * within this set, which the wrapped {@link CoreIntegrationTestHarness} `test`
 * enforces via `R extends HarnessServices`.
 */
type HarnessServices =
  | Db
  | ClickhouseWebClient.ClickhouseWebClient
  | Workos
  | ProjectSchemaCache
  | AuditLogPort
  | PublicFileStore
  | SchemaCacheInvalidationService;

/** Default per-test timeout; the heavy deploy already happened in globalSetup. */
const DEFAULT_TEST_TIMEOUT = 120_000;

/**
 * In-memory {@link ProjectSchemaCache} — a fresh per-test map so cached
 * schemas never leak between tests. Mirrors the Durable Object port the
 * Cloudflare backend provides at runtime.
 */
const makeProjectSchemaCacheStub = () => {
  const store = new Map<string, unknown>();
  return {
    getByName: (projectId: string) => ({
      get: () => Effect.sync(() => store.get(projectId) ?? null),
      set: (schema: unknown) =>
        Effect.sync(() => {
          store.set(projectId, schema);
        }),
      invalidate: () =>
        Effect.sync(() => {
          store.delete(projectId);
        }),
    }),
  };
};

const ProjectSchemaCacheStubLive = Layer.effect(
  ProjectSchemaCache,
  Effect.sync(makeProjectSchemaCacheStub),
);

/** Stable public base for the in-memory {@link PublicFileStore} stub. */
const PUBLIC_FILE_STORE_BASE_URL = "https://files.test.invalid";

/**
 * In-memory {@link PublicFileStore} — a fresh per-test map so stored avatars
 * never leak between tests. Mirrors the R2 adapter the Cloudflare backend
 * provides at runtime; URLs resolve under a stable, obviously-non-routable base.
 */
const makePublicFileStoreStub = () => {
  const store = new Map<string, { body: Uint8Array; contentType: string | null }>();
  return {
    publicBaseUrl: PUBLIC_FILE_STORE_BASE_URL,
    publicUrl: (key: string) => `${PUBLIC_FILE_STORE_BASE_URL}/files/${key}`,
    putObject: (input: { key: string; body: Uint8Array; contentType: string | undefined }) =>
      Effect.sync(() => {
        store.set(input.key, { body: input.body, contentType: input.contentType ?? null });
      }),
    getObject: (key: string) => Effect.sync(() => store.get(key) ?? null),
    deleteObject: (key: string) =>
      Effect.sync(() => {
        store.delete(key);
      }),
  };
};

const PublicFileStoreStubLive = Layer.effect(PublicFileStore, Effect.sync(makePublicFileStoreStub));

/** Test-only audit writer that preserves mutation side-effect assertions without an EE dependency. */
const AuditLogPortTestLive: Layer.Layer<AuditLogPort, never, Db> = Layer.effect(
  AuditLogPort,
  Effect.gen(function* () {
    const db = yield* Db;
    return AuditLogPort.of({
      append: (input) =>
        Effect.gen(function* () {
          const maybeSession = yield* Effect.serviceOption(AuthSession);
          const session = Option.isSome(maybeSession) ? maybeSession.value : null;
          yield* db.insert(auditLogs).values({
            action: input.action,
            actorType: input.actorType ?? AuditLogActorType.User,
            actorUserId: session?.user?.id ?? null,
            changes: input.changes ?? null,
            entityId: input.entityId,
            entityType: input.entityType,
            id: generateId("auditLog"),
            metadata: input.metadata ?? null,
            parentEntityId: input.parentEntityId ?? null,
            projectId: input.projectId,
          });
        }).pipe(Effect.mapError((error) => new AuditLogPortError({ cause: String(error.cause) }))),
    });
  }),
);

/**
 * Build the live infra + support layer from the shared
 * {@link CoreTestConnections}. Every credential is real (Db/Clickhouse over
 * the network, Workos SDK); only the schema cache is a stub.
 */
const makeHarnessLayer = (tc: CoreTestConnections): Layer.Layer<HarnessServices> => {
  const DbLive: Layer.Layer<Db> = Db.layer(tc.db);
  const ClickhouseLive = ClickhouseWebClient.layer(tc.clickhouse).pipe(Layer.orDie);
  const WorkosLive: Layer.Layer<Workos> = Workos.layer({
    apiKey: Effect.succeed(tc.workos.apiKey),
    clientId: Effect.succeed(tc.workos.clientId),
    cookieName: Effect.succeed(tc.workos.cookieName),
    cookiePassword: Effect.succeed(tc.workos.cookiePassword),
    webhookSecret: Effect.succeed(tc.workos.webhookSecret),
  });

  const InfraLayer = Layer.mergeAll(
    DbLive,
    ClickhouseLive,
    WorkosLive,
    ProjectSchemaCacheStubLive,
    PublicFileStoreStubLive,
  );

  const AuditLogSupportLayer = AuditLogPortTestLive.pipe(Layer.provide(InfraLayer));

  const SupportLayer = Layer.mergeAll(
    AuditLogSupportLayer,
    SchemaCacheInvalidationService.layer,
  ).pipe(Layer.provide(InfraLayer));

  return Layer.mergeAll(InfraLayer, SupportLayer);
};

const timeoutOf = (options: number | { timeout?: number } | undefined): number =>
  (typeof options === "number" ? options : options?.timeout) ?? DEFAULT_TEST_TIMEOUT;

export const CoreIntegrationTestHarness = {
  /**
   * Returns a lean `test` that injects the common core services into every test
   * (and `stack`, the once-per-run deploy output shared via `globalSetup`).
   * Tests just `yield*` a service and assert; provide the service-under-test's
   * own layer and authenticate via `CoreAuthSession.authenticate()`:
   *
   * ```ts
   * const { test } = CoreIntegrationTestHarness.make();
   * test("…", Effect.gen(function* () { … })
   *   .pipe(Effect.provide(PerkService.layer), CoreAuthSession.authenticate()));
   * ```
   *
   * The environment is provisioned once per run by the active composition's
   * `globalSetup` (locally: `test/_testing/globalSetup.ts` over the self-host
   * stack) and shared through vitest's `provide`/`inject` channel.
   */
  make: () => {
    // Resolved lazily inside each test/effect: vitest's injected context is set
    // by globalSetup before any file runs, but `inject` must be read at runtime.
    const stack = Effect.suspend(() => Effect.succeed(inject("coreStackOutput")));

    const test = <E, R extends HarnessServices>(
      name: string,
      eff: Effect.Effect<void, E, R>,
      options?: number | { timeout?: number },
    ): void =>
      vitestTest(
        name,
        async () => {
          const testConnections = inject("coreStackOutput")?.testConnections ?? null;
          if (testConnections === null) {
            throw new Error(
              "CoreIntegrationTestHarness: coreStackOutput missing or testConnections is null — globalSetup failed, or the composition refused to expose credentials.",
            );
          }
          // `R extends HarnessServices` guarantees the layer satisfies every
          // requirement, but TS won't reduce `Exclude<R, HarnessServices>` to
          // `never` for a generic `R`, so assert the discharged type.
          await Effect.runPromise(
            eff.pipe(Effect.provide(makeHarnessLayer(testConnections))) as Effect.Effect<void, E>,
          );
        },
        timeoutOf(options),
      );

    return { stack, test };
  },
};
