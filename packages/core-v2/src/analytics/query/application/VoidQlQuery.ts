import * as Arr from "effect/Array";
import * as R from "effect/Record";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { AuthSession } from "@voidhash/rpc";

import { AnalyticsAuthorizer } from "../../application/ports.ts";
import type { AnalyticsPortError } from "../../application/ports.ts";
import {
  CATALOG,
  CATALOG_SCHEMA_VERSION,
  compileVoidQl,
  isVoidQlCompileError,
  makeAuthorizedScope,
  registeredFunctionNames,
  toDiagnostic,
  toStatement,
  type Capability,
  type ColumnSpec,
  type Diagnostic,
  type VoidQlCompileError,
  VoidQlExecutionError,
  VoidQlIsolationError,
  type VoidQlStatement,
} from "./voidql/index.ts";

export const VoidQlPrincipal = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["agent", "user"]),
});
export type VoidQlPrincipal = typeof VoidQlPrincipal.Type;

/** VoidQL execution capabilities supplied by a storage adapter. */
export interface VoidQlExecutorShape {
  readonly execute: (input: {
    readonly queryId: string;
    readonly quotaKey: string;
    readonly statement: VoidQlStatement;
  }) => Effect.Effect<ReadonlyArray<Record<string, unknown>>, AnalyticsPortError>;
}

/** Storage-neutral VoidQL execution boundary. */
export class VoidQlExecutor extends Context.Service<VoidQlExecutor, VoidQlExecutorShape>()(
  "@voidhash/core-v2/analytics/VoidQlExecutor",
) {}

export const SavedVoidQlInsight = Schema.Struct({
  createdAt: Schema.Date,
  createdBy: Schema.String,
  id: Schema.String,
  name: Schema.String,
  organizationId: Schema.String,
  schemaVersion: Schema.Int,
  text: Schema.String,
  updatedAt: Schema.Date,
});
export type SavedVoidQlInsight = typeof SavedVoidQlInsight.Type;

/** Saved VoidQL insight repository capabilities. */
export interface VoidQlInsightRepositoryShape {
  readonly create: (input: {
    readonly createdBy: string;
    readonly name: string;
    readonly organizationId: string;
    readonly schemaVersion: number;
    readonly text: string;
  }) => Effect.Effect<{ readonly id: string }, AnalyticsPortError>;
  readonly delete: (id: string) => Effect.Effect<boolean, AnalyticsPortError>;
  readonly get: (
    id: string,
  ) => Effect.Effect<Option.Option<typeof SavedVoidQlInsight.Type>, AnalyticsPortError>;
  readonly list: (
    organizationId: string,
  ) => Effect.Effect<ReadonlyArray<typeof SavedVoidQlInsight.Type>, AnalyticsPortError>;
}

/** Saved-query metadata boundary supplied by the application runtime. */
export class VoidQlInsightRepository extends Context.Service<
  VoidQlInsightRepository,
  VoidQlInsightRepositoryShape
>()("@voidhash/core-v2/analytics/VoidQlInsightRepository") {}

export interface VoidQlRunResult {
  readonly columns: readonly ColumnSpec[];
  readonly rows: ReadonlyArray<Record<string, unknown>>;
}

export interface VoidQlValidateResult {
  readonly valid: boolean;
  readonly columns?: readonly ColumnSpec[];
  readonly diagnostic?: Diagnostic;
}

export interface VoidQlSchemaDescriptor {
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

const schemaDescriptor = () =>
  ({
    dialect:
      "VoidQL is a read-only SQL subset over events, persons, and revenue; tenant scope is injected automatically.",
    tables: R.values(CATALOG).map((table) => ({
      name: table.name,
      columns: R.values(table.columns).map((column) => ({
        name: column.name,
        type: column.type,
        pii: column.requires.includes("pii"),
        doc: column.doc,
      })),
      namespaces: R.values(table.namespaces).map((namespace) => ({
        name: namespace.name,
        pii: namespace.requires.includes("pii"),
        doc: namespace.doc,
      })),
    })),
    functions: registeredFunctionNames(),
  }) satisfies VoidQlSchemaDescriptor;

/** Authorized VoidQL query and saved-insight capabilities. */
export interface VoidQlQueryShape {
  readonly deleteInsight: (
    id: string,
  ) => Effect.Effect<{ readonly deleted: boolean }, VoidQlExecutionError, AuthSession>;
  readonly getSchema: () => Effect.Effect<VoidQlSchemaDescriptor>;
  readonly listInsights: (
    organizationId: string,
  ) => Effect.Effect<
    ReadonlyArray<typeof SavedVoidQlInsight.Type>,
    VoidQlExecutionError,
    AuthSession
  >;
  readonly run: (input: {
    readonly organizationId: string;
    readonly principal: typeof VoidQlPrincipal.Type;
    readonly text: string;
  }) => Effect.Effect<VoidQlRunResult, VoidQlCompileError | VoidQlExecutionError, AuthSession>;
  readonly runSaved: (input: {
    readonly id: string;
    readonly principal: typeof VoidQlPrincipal.Type;
  }) => Effect.Effect<VoidQlRunResult, VoidQlCompileError | VoidQlExecutionError, AuthSession>;
  readonly saveInsight: (input: {
    readonly createdBy: string;
    readonly name: string;
    readonly organizationId: string;
    readonly text: string;
  }) => Effect.Effect<
    { readonly id: string },
    VoidQlCompileError | VoidQlExecutionError,
    AuthSession
  >;
  readonly validate: (input: {
    readonly organizationId: string;
    readonly principal: typeof VoidQlPrincipal.Type;
    readonly text: string;
  }) => Effect.Effect<
    VoidQlValidateResult,
    VoidQlIsolationError | VoidQlExecutionError,
    AuthSession
  >;
}

const makeVoidQlQuery = Effect.fn("makeVoidQlQuery")(function* () {
  const authorizer = yield* AnalyticsAuthorizer;
  const executor = yield* VoidQlExecutor;
  const insights = yield* VoidQlInsightRepository;
  const crypto = yield* Crypto.Crypto;
  const executionError =
    (message: string) => (error: { readonly cause?: unknown; readonly message: string }) =>
      new VoidQlExecutionError({ cause: String(error.cause), message });
  const scopeFor = (organizationId: string) =>
    authorizer.organizationProjects(organizationId).pipe(
      Effect.map((availableProjectIds) =>
        makeAuthorizedScope({ organizationId, availableProjectIds }),
      ),
      Effect.mapError(executionError("The query could not be authorized.")),
    );
  // An empty tenant scope authorizes nothing; every method must reject it with the
  // same typed error instead of short-circuiting to an empty success.
  const emptyScopeError = () =>
    new VoidQlExecutionError({
      cause: "empty_scope",
      message: "The organization has no projects available for this request.",
    });
  const ensureScope = (organizationId: string) =>
    Effect.flatMap(scopeFor(organizationId), (scope) => {
      if (Arr.isReadonlyArrayEmpty(scope.availableProjectIds))
        return Effect.fail(emptyScopeError());
      return Effect.succeed(scope);
    });
  const piiCapability: Capability = "pii";
  const capabilitiesFor = (principal: typeof VoidQlPrincipal.Type) => {
    if (principal.kind === "user") return HashSet.make(piiCapability);
    return HashSet.empty<Capability>();
  };
  const compile = (
    text: string,
    scope: ReturnType<typeof makeAuthorizedScope>,
    capabilities: HashSet.HashSet<Capability>,
  ) =>
    compileVoidQl(text, scope, capabilities).pipe(
      Effect.provideService(Crypto.Crypto, crypto),
      Effect.catchTag("PlatformError", (error) =>
        Effect.fail(
          new VoidQlExecutionError({
            cause: String(error.cause),
            message: "The query identifier could not be generated.",
          }),
        ),
      ),
      // Never leak verifier internals (occurrence counts, physical table names) to
      // callers; the typed failure carries a generic, sanitized message.
      Effect.catchTag("VoidQlIsolationError", () =>
        Effect.fail(new VoidQlIsolationError({ message: "The query failed isolation checks." })),
      ),
    );

  const run = (request: {
    readonly organizationId: string;
    readonly principal: typeof VoidQlPrincipal.Type;
    readonly text: string;
  }) =>
    Effect.gen(function* () {
      const scope = yield* ensureScope(request.organizationId);
      const compiled = yield* compile(request.text, scope, capabilitiesFor(request.principal));
      const rows = yield* executor
        .execute({
          queryId: compiled.queryId,
          quotaKey: `${request.organizationId}:${request.principal.kind}:${request.principal.id}`,
          statement: toStatement(compiled.pieces),
        })
        .pipe(Effect.mapError(executionError("The query could not be executed.")));
      return { columns: compiled.columns, rows };
    });

  const load = (id: string) =>
    insights.get(id).pipe(
      Effect.mapError(executionError("The saved query could not be loaded.")),
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.fail(
          new VoidQlExecutionError({
            cause: "not_found",
            message: "The saved query was not found.",
          }),
          ),
          onSome: Effect.succeed,
        }),
      ),
    );

  return {
    deleteInsight: (id) =>
      Effect.gen(function* () {
        const insight = yield* load(id);
        yield* ensureScope(insight.organizationId);
        const deleted = yield* insights
          .delete(id)
          .pipe(Effect.mapError(executionError("The saved query could not be deleted.")));
        return { deleted };
      }),
    getSchema: () => Effect.succeed(schemaDescriptor()),
    listInsights: (organizationId) =>
      ensureScope(organizationId).pipe(
        Effect.flatMap(() => insights.list(organizationId)),
        Effect.mapError((error) => {
          if (error instanceof VoidQlExecutionError) return error;
          return executionError("The saved queries could not be listed.")(error);
        }),
      ),
    run,
    runSaved: (request) =>
      load(request.id).pipe(
        Effect.flatMap((insight) =>
          run({
            organizationId: insight.organizationId,
            principal: request.principal,
            text: insight.text,
          }),
        ),
      ),
    saveInsight: (request) =>
      Effect.gen(function* () {
        const scope = yield* ensureScope(request.organizationId);
        yield* compile(request.text, scope, HashSet.make(piiCapability));
        return yield* insights
          .create({
            createdBy: request.createdBy,
            name: request.name,
            organizationId: request.organizationId,
            schemaVersion: CATALOG_SCHEMA_VERSION,
            text: request.text,
          })
          .pipe(Effect.mapError(executionError("The insight could not be saved.")));
      }),
    validate: (request) =>
      Effect.gen(function* () {
        const scope = yield* ensureScope(request.organizationId);
        return yield* compile(request.text, scope, capabilitiesFor(request.principal)).pipe(
          Effect.map(
            (compiled) =>
              ({
                valid: true,
                columns: compiled.columns,
              }) satisfies VoidQlValidateResult,
          ),
          Effect.catchIf(isVoidQlCompileError, (error) => {
            // Isolation failures surface as a typed (sanitized) failure, not a
            // defect and not internal details.
            if (error instanceof VoidQlIsolationError) {
              return Effect.fail(
                new VoidQlIsolationError({ message: "The query failed isolation checks." }),
              );
            }
            return Effect.succeed({ valid: false, diagnostic: toDiagnostic(error) });
          }),
        );
      }),
  } satisfies VoidQlQueryShape;
})();

/** VoidQL use case whose implementation dependencies are supplied by layers. */
export class VoidQlQuery extends Context.Service<VoidQlQuery, VoidQlQueryShape>()(
  "@voidhash/core-v2/analytics/VoidQlQuery",
  { make: makeVoidQlQuery },
) {
  /** Layer constructor that leaves all implementation dependencies explicit. */
  static readonly layer = Layer.effect(VoidQlQuery)(VoidQlQuery.make);
}
