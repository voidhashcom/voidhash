import { Context, Crypto, Effect, Layer, Schema } from "effect";
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
  type VoidQlStatement,
} from "./voidql/index.ts";

export const VoidQlPrincipal = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["agent", "user"]),
});

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
  ) => Effect.Effect<typeof SavedVoidQlInsight.Type | undefined, AnalyticsPortError>;
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
    tables: Object.values(CATALOG).map((table) => ({
      name: table.name,
      columns: Object.values(table.columns).map((column) => ({
        name: column.name,
        type: column.type,
        pii: column.requires.includes("pii"),
        doc: column.doc,
      })),
      namespaces: Object.values(table.namespaces).map((namespace) => ({
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
  }) => Effect.Effect<VoidQlValidateResult, VoidQlExecutionError, AuthSession>;
}

const makeVoidQlQuery = Effect.gen(function* () {
  const authorizer = yield* AnalyticsAuthorizer;
  const executor = yield* VoidQlExecutor;
  const insights = yield* VoidQlInsightRepository;
  const crypto = yield* Crypto.Crypto;
  const executionError = (message: string) => (error: AnalyticsPortError) =>
    new VoidQlExecutionError({ cause: String(error.cause), message });
  const scopeFor = (organizationId: string) =>
    authorizer.organizationProjects(organizationId).pipe(
      Effect.map((availableProjectIds) =>
        makeAuthorizedScope({ organizationId, availableProjectIds }),
      ),
      Effect.mapError(executionError("The query could not be authorized.")),
    );
  const capabilitiesFor = (principal: typeof VoidQlPrincipal.Type) => {
    if (principal.kind === "user") return new Set<Capability>(["pii"]);
    return new Set<Capability>();
  };
  const compile = (
    text: string,
    scope: ReturnType<typeof makeAuthorizedScope>,
    capabilities: ReadonlySet<Capability>,
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
    );

  const run = (request: {
    readonly organizationId: string;
    readonly principal: typeof VoidQlPrincipal.Type;
    readonly text: string;
  }) =>
    Effect.gen(function* () {
      const scope = yield* scopeFor(request.organizationId);
      if (scope.availableProjectIds.length === 0) return { columns: [], rows: [] };
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
      Effect.flatMap((insight) => {
        if (insight) return Effect.succeed(insight);
        return Effect.fail(
          new VoidQlExecutionError({
            cause: "not_found",
            message: "The saved query was not found.",
          }),
        );
      }),
    );

  return {
    deleteInsight: (id) =>
      Effect.gen(function* () {
        const insight = yield* load(id);
        yield* scopeFor(insight.organizationId);
        const deleted = yield* insights
          .delete(id)
          .pipe(Effect.mapError(executionError("The saved query could not be deleted.")));
        return { deleted };
      }),
    getSchema: () => Effect.succeed(schemaDescriptor()),
    listInsights: (organizationId) =>
      scopeFor(organizationId).pipe(
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
        const scope = yield* scopeFor(request.organizationId);
        yield* compile(request.text, scope, new Set<Capability>(["pii"]));
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
        const scope = yield* scopeFor(request.organizationId);
        return yield* compile(request.text, scope, capabilitiesFor(request.principal)).pipe(
          Effect.map(
            (compiled) =>
              ({
                valid: true,
                columns: compiled.columns,
              }) satisfies VoidQlValidateResult,
          ),
          Effect.catchIf(isVoidQlCompileError, (error) => {
            if (error._tag === "VoidQlIsolationError") return Effect.die(error);
            return Effect.succeed({ valid: false, diagnostic: toDiagnostic(error) });
          }),
        );
      }),
  } satisfies VoidQlQueryShape;
});

/** VoidQL use case whose implementation dependencies are supplied by layers. */
export class VoidQlQuery extends Context.Service<VoidQlQuery, VoidQlQueryShape>()(
  "@voidhash/core-v2/analytics/VoidQlQuery",
  { make: makeVoidQlQuery },
) {
  /** Layer constructor that leaves all implementation dependencies explicit. */
  static readonly layer = Layer.effect(VoidQlQuery)(VoidQlQuery.make);
}
