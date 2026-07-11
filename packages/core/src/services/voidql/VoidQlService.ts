/**
 * {@link VoidQlService} — the public VoidQL surface (§13): `runQuery`,
 * `validateQuery`, `getSchema`, `saveInsight`.
 *
 * The hot path is `authorize → buildAuthorizedScope → compile (pure ①–⑥, incl.
 * verify) → execute → audit`. Scope is derived **server-side** from the
 * authenticated session (never the request body) and inlined as the bound
 * `{pOrg}`/`{pPids}` literals by the compiler — there is no tenant setting for a
 * jailbroken agent to re-point (§14). Execution runs under the locked-down
 * `analytics_query` ClickHouse user with a server-random `withQueryId` (the KILL
 * handle) and a stable per-principal `withQuotaKey` (so the shared user's
 * `KEYED BY client_key` quota isolates tenants); `readonly=1` + the CONST caps come
 * from the profile, NOT a per-request setting (§7 L3).
 *
 * ClickHouse execution errors are mapped to a constant {@link VoidQlExecutionError}
 * — never forwarding raw messages or row counts, which would be a side-channel
 * (§18 gap #7). When ClickHouse is not configured, authorized queries fail
 * closed to an empty result while schema, validation, and saved-query metadata
 * remain available.
 */
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { Db, analyticsSavedQuery } from "@voidhash/db";
import { Context, Effect, Layer, Option } from "effect";

import { AuthSession } from "../../domain/auth/Auth.ts";
import { checkOrganizationPermission } from "../../utils/permissions.ts";
import { generateId } from "../../utils/generate-id.ts";
import { CATALOG, CATALOG_SCHEMA_VERSION } from "./catalog/index.ts";
import type { Capability, ColumnSpec } from "./catalog/types.ts";
import { compileVoidQl } from "./compile.ts";
import {
  type Diagnostic,
  isVoidQlCompileError,
  toDiagnostic,
  VoidQlExecutionError,
} from "./errors.ts";
import { registeredFunctionNames } from "./functions.ts";
import { toStatement } from "./ir.ts";
import { type AuthorizedScope, makeAuthorizedScope } from "./scope.ts";

export interface VoidQlPrincipal {
  readonly kind: "user" | "agent";
  readonly id: string;
}

export interface RunQueryInput {
  readonly organizationId: string;
  readonly text: string;
  readonly principal: VoidQlPrincipal;
}

export interface RunQueryResult {
  readonly columns: readonly ColumnSpec[];
  readonly rows: ReadonlyArray<Record<string, unknown>>;
}

export interface ValidateResult {
  readonly valid: boolean;
  readonly columns?: readonly ColumnSpec[];
  readonly diagnostic?: Diagnostic;
}

export interface SchemaDescriptor {
  readonly dialect: string;
  readonly tables: ReadonlyArray<{
    readonly name: string;
    readonly columns: ReadonlyArray<{
      readonly name: string;
      readonly type: string;
      readonly pii: boolean;
      readonly doc: string;
    }>;
    readonly namespaces: ReadonlyArray<{
      readonly name: string;
      readonly pii: boolean;
      readonly doc: string;
    }>;
  }>;
  readonly functions: readonly string[];
}

const DIALECT_REFERENCE =
  "VoidQL is a read-only SQL subset over events|persons|revenue. " +
  "SELECT … FROM … [JOIN … ON …] [WHERE] [GROUP BY] [HAVING] [ORDER BY] [LIMIT]; CTEs and subqueries supported. " +
  "No organization_id, no SETTINGS, no table functions — tenant scope is applied automatically.";

/** Cheap, non-cryptographic FNV-1a hash for the audit log (text fingerprint only). */
const fnv1a = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
};

const buildSchemaDescriptor = (): SchemaDescriptor => ({
  dialect: DIALECT_REFERENCE,
  tables: Object.values(CATALOG).map((table) => ({
    name: table.name,
    columns: Object.values(table.columns).map((c) => ({
      name: c.name,
      type: c.type,
      pii: c.requires.includes("pii"),
      doc: c.doc,
    })),
    namespaces: Object.values(table.namespaces).map((n) => ({
      name: n.name,
      pii: n.requires.includes("pii"),
      doc: n.doc,
    })),
  })),
  functions: registeredFunctionNames(),
});

export class VoidQlService extends Context.Service<VoidQlService>()("VoidQlService", {
  make: Effect.gen(function* () {
    // The locked-down `analytics_query` user (readonly=1 + CONST caps + no row
    // policy). In production the VoidQL RPC path must be provided this client as
    // its ambient ClickhouseWebClient — running under the RLS readonly user would
    // fail-closed to zero rows, since VoidQL injects no `SQL_organization_id`.
    const ch = Option.getOrUndefined(
      yield* Effect.serviceOption(ClickhouseWebClient.ClickhouseWebClient),
    );
    const db = yield* Db;

    /** Authorize the claimed org against the session, then derive scope from Postgres. */
    const buildAuthorizedScope = Effect.fn("voidql.buildScope")(function* (organizationId: string) {
      yield* checkOrganizationPermission(organizationId, "organization:all", "VoidQL read denied");
      const projects = yield* db.query.projects.findMany({
        columns: { id: true },
        where: { organizationId },
      });
      return makeAuthorizedScope({
        organizationId,
        availableProjectIds: projects.map((p) => p.id),
      });
    });

    const capabilitiesFor = (principal: VoidQlPrincipal): ReadonlySet<Capability> =>
      // AI agents never get `pii` by default (§9, §14); authorized users do.
      new Set<Capability>(principal.kind === "user" ? ["pii"] : []);

    const auditRun = (
      input: RunQueryInput,
      scope: AuthorizedScope,
      queryId: string,
      rowCount: number,
    ) =>
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
        yield* Effect.annotateCurrentSpan("voidhash.voidql.principal.kind", input.principal.kind);
        yield* Effect.annotateCurrentSpan("voidhash.voidql.principal.id", input.principal.id);
        yield* Effect.annotateCurrentSpan("voidhash.voidql.text_hash", fnv1a(input.text));
        yield* Effect.annotateCurrentSpan("voidhash.voidql.query_id", queryId);
        yield* Effect.annotateCurrentSpan("voidhash.voidql.row_count", rowCount);
        yield* Effect.annotateCurrentSpan(
          "voidhash.voidql.project_ids.count",
          scope.availableProjectIds.length,
        );
      });

    const runQuery = Effect.fn("voidql.runQuery")(
      function* (input: RunQueryInput) {
        const scope = yield* buildAuthorizedScope(input.organizationId);
        // Fail-closed: an org with no readable projects can read nothing.
        if (scope.availableProjectIds.length === 0) {
          return { columns: [], rows: [] } satisfies RunQueryResult;
        }
        if (ch === undefined) {
          return { columns: [], rows: [] } satisfies RunQueryResult;
        }
        const compiled = yield* compileVoidQl(input.text, scope, capabilitiesFor(input.principal));
        // Stable per-principal quota key: the shared `analytics_query` user's
        // `KEYED BY client_key` DoS quota only isolates tenants when each request
        // carries one (otherwise every request shares the empty-key global bucket).
        const quotaKey = `${input.organizationId}:${input.principal.kind}:${input.principal.id}`;
        const rows = yield* toStatement(ch, compiled.pieces).pipe(
          ch.withQueryId(compiled.queryId),
          ch.withQuotaKey(quotaKey),
        );
        yield* auditRun(input, scope, compiled.queryId, rows.length);
        return { columns: compiled.columns, rows } satisfies RunQueryResult;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            SqlError: () =>
              // Constant message — never forward CH internals / row counts (§18 #7).
              Effect.fail(
                new VoidQlExecutionError({
                  cause: "clickhouse",
                  message: "The query could not be executed.",
                }),
              ),
            EffectDrizzleQueryError: () =>
              Effect.fail(
                new VoidQlExecutionError({
                  cause: "database",
                  message: "The query could not be executed.",
                }),
              ),
          }),
        ),
    );

    const validateQuery = Effect.fn("voidql.validateQuery")(
      function* (input: RunQueryInput) {
        const scope = yield* buildAuthorizedScope(input.organizationId);
        return yield* compileVoidQl(input.text, scope, capabilitiesFor(input.principal)).pipe(
          Effect.map((compiled): ValidateResult => ({ valid: true, columns: compiled.columns })),
          // User-facing compile errors are surfaced as diagnostics (data), not
          // failures — this is what the agent repair loop / editor lint consume.
          // BUT an isolation-verifier failure is a COMPILER DEFECT, never user
          // error: it must alarm server-side (matching the run path, which maps it
          // to an opaque execution error), not be folded into a benign {valid:false}
          // diagnostic an attacker/repair-loop can iterate against — so we Effect.die.
          Effect.catchIf(
            isVoidQlCompileError,
            (error): Effect.Effect<ValidateResult> =>
              error._tag === "VoidQlIsolationError"
                ? Effect.die(error)
                : Effect.succeed({ valid: false, diagnostic: toDiagnostic(error) }),
          ),
        );
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: () =>
              Effect.fail(
                new VoidQlExecutionError({
                  cause: "database",
                  message: "The query could not be validated.",
                }),
              ),
          }),
        ),
    );

    const getSchema = Effect.fn("voidql.getSchema")(() =>
      Effect.succeed(buildSchemaDescriptor()),
    );

    const saveInsight = Effect.fn("voidql.saveInsight")(
      function* (input: {
        readonly organizationId: string;
        readonly name: string;
        readonly text: string;
      }) {
        const session = yield* AuthSession;
        const scope = yield* buildAuthorizedScope(input.organizationId);
        // Re-validate before persisting; a save of a non-compiling query is rejected.
        yield* compileVoidQl(input.text, scope, new Set<Capability>(["pii"]));
        const id = generateId("analyticsSavedQuery");
        yield* db.insert(analyticsSavedQuery).values({
          id,
          organizationId: input.organizationId,
          name: input.name,
          voidqlText: input.text,
          schemaVersion: CATALOG_SCHEMA_VERSION,
          createdBy: session?.user?.id ?? "system",
        });
        return { id };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: () =>
              Effect.fail(
                new VoidQlExecutionError({
                  cause: "database",
                  message: "The insight could not be saved.",
                }),
              ),
          }),
        ),
    );

    return { runQuery, validateQuery, getSchema, saveInsight } as const;
  }),
}) {
  static layer: Layer.Layer<VoidQlService, never, Db> = Layer.effect(VoidQlService)(
    VoidQlService.make,
  );
}
