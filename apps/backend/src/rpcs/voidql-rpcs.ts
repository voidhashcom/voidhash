/**
 * Backend handlers for the VoidQL RPC group. Each handler calls
 * {@link VoidQlService} and translates the core `VoidQl*` domain errors into
 * their `Rpc/`-prefixed counterparts. The internal `VoidQlIsolationError` (a
 * compiler defect) is mapped to the opaque {@link RpcVoidQlExecutionError} so it
 * never leaks a reason to the client.
 *
 * NOTE: VoidQL must execute under the locked-down `analytics_query` ClickHouse
 * user; {@link VoidQlService} reads the ambient `ClickhouseWebClient`, so the
 * worker provides this layer the `analyticsQuery` client (see BackendWorker).
 */
import { VoidQlService } from "@voidhash/core/services";
// Imported so the inferred layer type (whose requirements include the
// ClickhouseWebClient VoidQlService binds) is nameable in the emitted
// declarations — the client is re-exported as a namespace (TS2883).
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import {
  AuthSession,
  RpcActionForbiddenError,
  RpcVoidQlComplexityError,
  RpcVoidQlExecutionError,
  RpcVoidQlPiiError,
  RpcVoidQlSchemaError,
  RpcVoidQlSyntaxError,
  RpcVoidQlUnknownFieldError,
  RpcVoidQlUnsupportedError,
  VoidQlRpcsDef,
} from "@voidhash/rpc";
import { Effect } from "effect";

export const VoidQlRpcsLive = VoidQlRpcsDef.toLayer(
  Effect.gen(function* VoidQlRpcsLive() {
    const voidql = yield* VoidQlService;

    return {
      RunVoidQlQuery: ({ organizationId, text }) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          return yield* voidql.runQuery({
            organizationId,
            text,
            principal: { kind: "user", id: session?.user?.id ?? "api-key" },
          });
        }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            VoidQlSyntaxError: (error) =>
              Effect.fail(new RpcVoidQlSyntaxError({ message: error.message, hint: error.hint })),
            VoidQlUnsupportedError: (error) =>
              Effect.fail(
                new RpcVoidQlUnsupportedError({ message: error.message, hint: error.hint }),
              ),
            VoidQlSchemaError: (error) =>
              Effect.fail(new RpcVoidQlSchemaError({ message: error.message })),
            VoidQlUnknownFieldError: (error) =>
              Effect.fail(
                new RpcVoidQlUnknownFieldError({
                  field: error.field,
                  message: error.message,
                  suggestion: error.suggestion,
                }),
              ),
            VoidQlPiiError: (error) =>
              Effect.fail(new RpcVoidQlPiiError({ message: error.message })),
            VoidQlComplexityError: (error) =>
              Effect.fail(new RpcVoidQlComplexityError({ message: error.message })),
            VoidQlIsolationError: () =>
              Effect.fail(
                new RpcVoidQlExecutionError({
                  cause: "internal",
                  message: "The query could not be executed.",
                }),
              ),
            VoidQlExecutionError: (error) =>
              Effect.fail(
                new RpcVoidQlExecutionError({ cause: error.cause, message: error.message }),
              ),
          }),
        ),

      ValidateVoidQlQuery: ({ organizationId, text }) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          return yield* voidql.validateQuery({
            organizationId,
            text,
            principal: { kind: "user", id: session?.user?.id ?? "api-key" },
          });
        }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            VoidQlExecutionError: (error) =>
              Effect.fail(
                new RpcVoidQlExecutionError({ cause: error.cause, message: error.message }),
              ),
          }),
        ),

      GetVoidQlSchema: () => voidql.getSchema(),

      SaveVoidQlInsight: ({ organizationId, name, text }) =>
        voidql.saveInsight({ organizationId, name, text }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            VoidQlSyntaxError: (error) =>
              Effect.fail(new RpcVoidQlSyntaxError({ message: error.message, hint: error.hint })),
            VoidQlUnsupportedError: (error) =>
              Effect.fail(
                new RpcVoidQlUnsupportedError({ message: error.message, hint: error.hint }),
              ),
            VoidQlSchemaError: (error) =>
              Effect.fail(new RpcVoidQlSchemaError({ message: error.message })),
            VoidQlUnknownFieldError: (error) =>
              Effect.fail(
                new RpcVoidQlUnknownFieldError({
                  field: error.field,
                  message: error.message,
                  suggestion: error.suggestion,
                }),
              ),
            VoidQlPiiError: (error) =>
              Effect.fail(new RpcVoidQlPiiError({ message: error.message })),
            VoidQlComplexityError: (error) =>
              Effect.fail(new RpcVoidQlComplexityError({ message: error.message })),
            VoidQlIsolationError: () =>
              Effect.fail(
                new RpcVoidQlExecutionError({
                  cause: "internal",
                  message: "The insight could not be saved.",
                }),
              ),
            VoidQlExecutionError: (error) =>
              Effect.fail(
                new RpcVoidQlExecutionError({ cause: error.cause, message: error.message }),
              ),
          }),
        ),
    };
  }),
);
