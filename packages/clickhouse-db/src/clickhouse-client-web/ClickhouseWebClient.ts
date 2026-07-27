/**
 * ClickHouse client implementation for Effect SQL, backed by
 * `@clickhouse/client-web`.
 *
 * This module mirrors `@effect/sql-clickhouse`'s `ClickhouseClient` surface
 * while avoiding Node-only APIs so it can run in Cloudflare Workers.
 */
import * as Clickhouse from "@clickhouse/client-web";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as Client from "effect/unstable/sql/SqlClient";
import type { Connection } from "effect/unstable/sql/SqlConnection";
import {
  AuthenticationError,
  AuthorizationError,
  ConnectionError,
  SqlError,
  SqlSyntaxError,
  StatementTimeoutError,
  UnknownError,
} from "effect/unstable/sql/SqlError";
import * as Statement from "effect/unstable/sql/Statement";

const ATTR_DB_SYSTEM_NAME = "db.system.name";
const ATTR_DB_NAMESPACE = "db.namespace";

const clickhouseCodeFromCause = (cause: unknown): number | undefined => {
  if (typeof cause !== "object" || cause === null || !("code" in cause)) {
    return undefined;
  }
  const code = cause.code;
  if (typeof code === "number") {
    return code;
  }
  if (typeof code === "string") {
    const parsed = Number(code);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const clickhouseSyntaxErrorCodes = new Set([36, 60, 62, 242]);

const messageFromCause = (cause: unknown): string | undefined => {
  if (typeof cause === "string") {
    const trimmed = cause.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof cause === "object" && cause !== null && "message" in cause) {
    const message = cause.message;
    if (typeof message === "string") {
      const trimmed = message.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
  }
  return undefined;
};

const withCauseMessage = (message: string, cause: unknown): string => {
  const causeMessage = messageFromCause(cause);
  return causeMessage && causeMessage !== message ? `${message}: ${causeMessage}` : message;
};

const classifyError = (
  cause: unknown,
  message: string,
  operation: string,
  fallback: "connection" | "unknown" = "unknown",
) => {
  const props = { cause, message: withCauseMessage(message, cause), operation };
  const code = clickhouseCodeFromCause(cause);
  if (code !== undefined) {
    if (code === 516) {
      return new AuthenticationError(props);
    }
    if (code === 497) {
      return new AuthorizationError(props);
    }
    if (clickhouseSyntaxErrorCodes.has(code)) {
      return new SqlSyntaxError(props);
    }
    if (code === 159 || code === 469) {
      return new StatementTimeoutError(props);
    }
  }
  return fallback === "connection" ? new ConnectionError(props) : new UnknownError(props);
};

const makeQueryId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `clickhouse-web-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Build the per-request HTTP headers that carry a ClickHouse quota key. ClickHouse
 * reads the quota bucket from the `X-ClickHouse-Quota` header, so a `KEYED BY
 * client_key` quota only isolates principals when this is set per request;
 * `undefined` (the default) sends no override and falls back to the empty key.
 */
const quotaHeaders = (quotaKey: string | undefined): Record<string, string> | undefined =>
  quotaKey ? { "X-ClickHouse-Quota": quotaKey } : undefined;

type WebInsertValues<T> =
  | ReadonlyArray<T>
  | Clickhouse.InputJSON<T>
  | Clickhouse.InputJSONObjectEachRow<T>;

/**
 * Unique runtime identifier used to tag `ClickhouseWebClient` values.
 */
export const TypeId: TypeId = "~@voidhash/clickhouse-db/ClickhouseWebClient";

/**
 * Type-level literal for the `ClickhouseWebClient` runtime identifier.
 */
export type TypeId = "~@voidhash/clickhouse-db/ClickhouseWebClient";

/**
 * ClickHouse-specific `SqlClient` extension backed by `@clickhouse/client-web`.
 */
export interface ClickhouseWebClient extends Client.SqlClient {
  readonly [TypeId]: TypeId;
  readonly config: ClickhouseWebClientConfig;
  readonly param: (dataType: string, value: unknown) => Statement.Fragment;
  readonly asCommand: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
  readonly insertQuery: <T = unknown>(options: {
    readonly table: string;
    readonly values: WebInsertValues<T>;
    readonly format?: Clickhouse.DataFormat;
  }) => Effect.Effect<Clickhouse.InsertResult, SqlError>;
  readonly withQueryId: {
    (queryId: string): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
    <A, E, R>(effect: Effect.Effect<A, E, R>, queryId: string): Effect.Effect<A, E, R>;
  };
  /**
   * Tag the wrapped statements with a ClickHouse quota key (sent as the
   * `X-ClickHouse-Quota` header). A `KEYED BY client_key` quota only isolates
   * principals when each request carries a stable per-principal key.
   */
  readonly withQuotaKey: {
    (quotaKey: string): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
    <A, E, R>(effect: Effect.Effect<A, E, R>, quotaKey: string): Effect.Effect<A, E, R>;
  };
  readonly withClickhouseSettings: {
    (
      settings: NonNullable<Clickhouse.BaseQueryParams["clickhouse_settings"]>,
    ): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
    <A, E, R>(
      effect: Effect.Effect<A, E, R>,
      settings: NonNullable<Clickhouse.BaseQueryParams["clickhouse_settings"]>,
    ): Effect.Effect<A, E, R>;
  };
}

/**
 * Context service tag for accessing the active `ClickhouseWebClient`.
 */
export const ClickhouseWebClient = Context.Service<ClickhouseWebClient>(
  "@voidhash/clickhouse-db/ClickhouseWebClient",
);

/**
 * Configuration for creating a web ClickHouse client.
 */
export interface ClickhouseWebClientConfig extends Clickhouse.ClickHouseClientConfigOptions {
  readonly spanAttributes?: Record<string, unknown> | undefined;
  readonly transformResultNames?: ((str: string) => string) | undefined;
  readonly transformQueryNames?: ((str: string) => string) | undefined;
}

/**
 * Creates a scoped `ClickhouseWebClient` and verifies connectivity.
 */
export const make = (
  options: ClickhouseWebClientConfig,
): Effect.Effect<ClickhouseWebClient, SqlError, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function* () {
    const compiler = makeCompiler(options.transformQueryNames);
    const transformRows = options.transformResultNames
      ? Statement.defaultTransforms(options.transformResultNames).array
      : undefined;

    const client = Clickhouse.createClient(options);

    yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const result = await client.ping();
          if (!result.success) {
            throw result.error;
          }
        },
        catch: (cause) =>
          new SqlError({
            reason: classifyError(
              cause,
              "ClickhouseWebClient: Failed to connect",
              "connect",
              "connection",
            ),
          }),
      }),
      () => Effect.promise(() => client.close()),
    ).pipe(
      Effect.timeoutOrElse({
        duration: Duration.seconds(5),
        orElse: () =>
          Effect.fail(
            new SqlError({
              reason: new ConnectionError({
                message: "ClickhouseWebClient: Connection timeout",
                cause: new Error("connection timeout"),
                operation: "connect",
              }),
            }),
          ),
      }),
    );

    class ConnectionImpl implements Connection {
      private conn: Clickhouse.ClickHouseClient;

      constructor(conn: Clickhouse.ClickHouseClient) {
        this.conn = conn;
      }

      private runRaw(
        sql: string,
        params: ReadonlyArray<unknown>,
        format: Clickhouse.DataFormat = "JSON",
      ) {
        const paramsObj: Record<string, unknown> = {};
        for (let i = 0; i < params.length; i++) {
          paramsObj[`p${i + 1}`] = params[i];
        }
        return Effect.withFiber<
          Clickhouse.ResultSet<Clickhouse.DataFormat> | Clickhouse.CommandResult,
          SqlError
        >((fiber) => {
          const method = fiber.getRef(ClientMethod);
          return Effect.callback<
            Clickhouse.ResultSet<Clickhouse.DataFormat> | Clickhouse.CommandResult,
            SqlError
          >((resume) => {
            const queryId = fiber.getRef(QueryId) ?? makeQueryId();
            const settings = fiber.getRef(ClickhouseSettings);
            const controller = new AbortController();
            if (method === "command") {
              this.conn
                .command({
                  query: sql,
                  query_params: paramsObj,
                  abort_signal: controller.signal,
                  query_id: queryId,
                  clickhouse_settings: settings,
                  http_headers: quotaHeaders(fiber.getRef(QuotaKey)),
                })
                .then(
                  (result) => resume(Effect.succeed(result)),
                  (cause) =>
                    resume(
                      Effect.fail(
                        new SqlError({
                          reason: classifyError(cause, "Failed to execute statement", "execute"),
                        }),
                      ),
                    ),
                );
            } else {
              this.conn
                .query({
                  query: sql,
                  query_params: paramsObj,
                  abort_signal: controller.signal,
                  query_id: queryId,
                  clickhouse_settings: settings,
                  http_headers: quotaHeaders(fiber.getRef(QuotaKey)),
                  format,
                })
                .then(
                  (result) => resume(Effect.succeed(result)),
                  (cause) =>
                    resume(
                      Effect.fail(
                        new SqlError({
                          reason: classifyError(cause, "Failed to execute statement", "execute"),
                        }),
                      ),
                    ),
                );
            }
            return Effect.suspend(() => {
              controller.abort();
              return Effect.promise(() =>
                this.conn.command({ query: `KILL QUERY WHERE query_id = '${queryId}'` }),
              );
            });
          });
        });
      }

      private run(sql: string, params: ReadonlyArray<unknown>, format?: Clickhouse.DataFormat) {
        return this.runRaw(sql, params, format).pipe(
          Effect.flatMap((result) => {
            if ("json" in result) {
              return Effect.promise(() =>
                result.json().then(
                  (result) => ("data" in result ? result.data : result) as ReadonlyArray<any>,
                  () => [],
                ),
              );
            }
            return Effect.succeed([]);
          }),
        );
      }

      execute(
        sql: string,
        params: ReadonlyArray<unknown>,
        transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined,
      ) {
        return transformRows
          ? Effect.map(this.run(sql, params), transformRows)
          : this.run(sql, params);
      }

      executeRaw(sql: string, params: ReadonlyArray<unknown>) {
        return this.runRaw(sql, params);
      }

      executeValues(sql: string, params: ReadonlyArray<unknown>) {
        return this.run(sql, params, "JSONCompact");
      }

      executeUnprepared(sql: string, params: ReadonlyArray<unknown>, transformRows?: any) {
        return this.execute(sql, params, transformRows);
      }

      executeStream(
        sql: string,
        params: ReadonlyArray<unknown>,
        transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined,
      ) {
        return this.runRaw(sql, params, "JSONEachRow").pipe(
          Effect.map((result) => {
            if (!("stream" in result)) {
              return Stream.empty;
            }
            return Stream.fromAsyncIterable(
              result.stream() as AsyncIterable<ReadonlyArray<Clickhouse.Row<any, "JSONEachRow">>>,
              (cause) =>
                new SqlError({
                  reason: classifyError(cause, "Failed to execute stream", "stream"),
                }),
            );
          }),
          Stream.unwrap,
          Stream.mapEffect((rows) =>
            Effect.try({
              try: () => {
                const parsed = rows.map((row) => row.json());
                return transformRows ? transformRows(parsed) : parsed;
              },
              catch: (cause) =>
                new SqlError({
                  reason: classifyError(cause, "Failed to parse row", "parseRow"),
                }),
            }),
          ),
          Stream.flattenIterable,
        );
      }
    }

    const connection = new ConnectionImpl(client);

    return Object.assign(
      yield* Client.make({
        acquirer: Effect.succeed(connection),
        compiler,
        spanAttributes: [
          ...(options.spanAttributes ? Object.entries(options.spanAttributes) : []),
          [ATTR_DB_SYSTEM_NAME, "clickhouse"],
          [ATTR_DB_NAMESPACE, options.database ?? "default"],
        ],
        beginTransaction: "BEGIN TRANSACTION",
        transformRows,
      }),
      {
        [TypeId]: TypeId as TypeId,
        config: options,
        param(dataType: string, value: unknown) {
          return Statement.fragment([clickhouseParam(dataType, value)]);
        },
        asCommand<A, E, R>(effect: Effect.Effect<A, E, R>) {
          return Effect.provideService(effect, ClientMethod, "command");
        },
        insertQuery<T = unknown>(options: {
          readonly table: string;
          readonly values: WebInsertValues<T>;
          readonly format?: Clickhouse.DataFormat;
        }) {
          return Effect.callback<Clickhouse.InsertResult, SqlError>((resume) => {
            const fiber = Fiber.getCurrent()!;
            const queryId = fiber.getRef(QueryId) ?? makeQueryId();
            const settings = fiber.getRef(ClickhouseSettings);
            const controller = new AbortController();
            client
              .insert({
                format: "JSONEachRow",
                ...options,
                abort_signal: controller.signal,
                query_id: queryId,
                clickhouse_settings: settings,
              })
              .then(
                (result) => resume(Effect.succeed(result)),
                (cause) =>
                  resume(
                    Effect.fail(
                      new SqlError({
                        reason: classifyError(cause, "Failed to insert data", "insert"),
                      }),
                    ),
                  ),
              );
            return Effect.suspend(() => {
              controller.abort();
              return Effect.promise(() =>
                client.command({ query: `KILL QUERY WHERE query_id = '${queryId}'` }),
              );
            });
          });
        },
        withQueryId: dual(2, <A, E, R>(effect: Effect.Effect<A, E, R>, queryId: string) =>
          Effect.provideService(effect, QueryId, queryId),
        ),
        withQuotaKey: dual(2, <A, E, R>(effect: Effect.Effect<A, E, R>, quotaKey: string) =>
          Effect.provideService(effect, QuotaKey, quotaKey),
        ),
        withClickhouseSettings: dual(
          2,
          <A, E, R>(
            effect: Effect.Effect<A, E, R>,
            settings: NonNullable<Clickhouse.BaseQueryParams["clickhouse_settings"]>,
          ) => Effect.provideService(effect, ClickhouseSettings, settings),
        ),
      },
    );
  });

/**
 * Like {@link make}, but builds the underlying `@clickhouse/client-web` client
 * lazily on first statement and performs NO connectivity check (`ping`).
 *
 * This makes a `ClickhouseWebClient` value safe to materialize eagerly even
 * when the connection vars are not yet available — e.g. during Alchemy's plan
 * phase, where a Worker's `env` bindings are still empty. `createClient` is
 * cheap and connectionless, so deferring both it and the `getConfig` read to
 * the first query means no network call happens until runtime. Because nothing
 * is eagerly acquired it needs no `Scope` (only `Reactivity`); the web client is
 * HTTP/stateless and requires no explicit close.
 *
 * `getConfig` is a thunk so the connection vars can be read from the Worker
 * environment at first use rather than at construction time. It is invoked at
 * most once (memoised), and its result is also exposed via the returned
 * client's `config` getter.
 */
export const makeUnchecked = (
  getConfig: () => ClickhouseWebClientConfig,
): Effect.Effect<ClickhouseWebClient, never, Reactivity.Reactivity> =>
  Effect.gen(function* () {
    let resolvedConfig: ClickhouseWebClientConfig | undefined;
    const configOnce = () => (resolvedConfig ??= getConfig());
    let clientRef: Clickhouse.ClickHouseClient | undefined;
    const clientOnce = () => (clientRef ??= Clickhouse.createClient(configOnce()));

    const compiler = makeCompiler();

    class ConnectionImpl implements Connection {
      private runRaw(
        sql: string,
        params: ReadonlyArray<unknown>,
        format: Clickhouse.DataFormat = "JSON",
      ) {
        const paramsObj: Record<string, unknown> = {};
        for (let i = 0; i < params.length; i++) {
          paramsObj[`p${i + 1}`] = params[i];
        }
        return Effect.withFiber<
          Clickhouse.ResultSet<Clickhouse.DataFormat> | Clickhouse.CommandResult,
          SqlError
        >((fiber) => {
          const method = fiber.getRef(ClientMethod);
          return Effect.callback<
            Clickhouse.ResultSet<Clickhouse.DataFormat> | Clickhouse.CommandResult,
            SqlError
          >((resume) => {
            const conn = clientOnce();
            const queryId = fiber.getRef(QueryId) ?? makeQueryId();
            const settings = fiber.getRef(ClickhouseSettings);
            const controller = new AbortController();
            if (method === "command") {
              conn
                .command({
                  query: sql,
                  query_params: paramsObj,
                  abort_signal: controller.signal,
                  query_id: queryId,
                  clickhouse_settings: settings,
                  http_headers: quotaHeaders(fiber.getRef(QuotaKey)),
                })
                .then(
                  (result) => resume(Effect.succeed(result)),
                  (cause) =>
                    resume(
                      Effect.fail(
                        new SqlError({
                          reason: classifyError(cause, "Failed to execute statement", "execute"),
                        }),
                      ),
                    ),
                );
            } else {
              conn
                .query({
                  query: sql,
                  query_params: paramsObj,
                  abort_signal: controller.signal,
                  query_id: queryId,
                  clickhouse_settings: settings,
                  http_headers: quotaHeaders(fiber.getRef(QuotaKey)),
                  format,
                })
                .then(
                  (result) => resume(Effect.succeed(result)),
                  (cause) =>
                    resume(
                      Effect.fail(
                        new SqlError({
                          reason: classifyError(cause, "Failed to execute statement", "execute"),
                        }),
                      ),
                    ),
                );
            }
            return Effect.suspend(() => {
              controller.abort();
              return Effect.promise(() =>
                clientOnce().command({ query: `KILL QUERY WHERE query_id = '${queryId}'` }),
              );
            });
          });
        });
      }

      private run(sql: string, params: ReadonlyArray<unknown>, format?: Clickhouse.DataFormat) {
        return this.runRaw(sql, params, format).pipe(
          Effect.flatMap((result) => {
            if ("json" in result) {
              return Effect.promise(() =>
                result.json().then(
                  (result) => ("data" in result ? result.data : result) as ReadonlyArray<any>,
                  () => [],
                ),
              );
            }
            return Effect.succeed([]);
          }),
        );
      }

      execute(
        sql: string,
        params: ReadonlyArray<unknown>,
        transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined,
      ) {
        return transformRows
          ? Effect.map(this.run(sql, params), transformRows)
          : this.run(sql, params);
      }

      executeRaw(sql: string, params: ReadonlyArray<unknown>) {
        return this.runRaw(sql, params);
      }

      executeValues(sql: string, params: ReadonlyArray<unknown>) {
        return this.run(sql, params, "JSONCompact");
      }

      executeUnprepared(sql: string, params: ReadonlyArray<unknown>, transformRows?: any) {
        return this.execute(sql, params, transformRows);
      }

      executeStream(
        sql: string,
        params: ReadonlyArray<unknown>,
        transformRows: (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined,
      ) {
        return this.runRaw(sql, params, "JSONEachRow").pipe(
          Effect.map((result) => {
            if (!("stream" in result)) {
              return Stream.empty;
            }
            return Stream.fromAsyncIterable(
              result.stream() as AsyncIterable<ReadonlyArray<Clickhouse.Row<any, "JSONEachRow">>>,
              (cause) =>
                new SqlError({
                  reason: classifyError(cause, "Failed to execute stream", "stream"),
                }),
            );
          }),
          Stream.unwrap,
          Stream.mapEffect((rows) =>
            Effect.try({
              try: () => {
                const parsed = rows.map((row) => row.json());
                return transformRows ? transformRows(parsed) : parsed;
              },
              catch: (cause) =>
                new SqlError({
                  reason: classifyError(cause, "Failed to parse row", "parseRow"),
                }),
            }),
          ),
          Stream.flattenIterable,
        );
      }
    }

    const connection = new ConnectionImpl();

    const client = Object.assign(
      yield* Client.make({
        acquirer: Effect.succeed(connection),
        compiler,
        spanAttributes: [
          [ATTR_DB_SYSTEM_NAME, "clickhouse"],
          [ATTR_DB_NAMESPACE, "default"],
        ],
        beginTransaction: "BEGIN TRANSACTION",
      }),
      {
        [TypeId]: TypeId as TypeId,
        param(dataType: string, value: unknown) {
          return Statement.fragment([clickhouseParam(dataType, value)]);
        },
        asCommand<A, E, R>(effect: Effect.Effect<A, E, R>) {
          return Effect.provideService(effect, ClientMethod, "command");
        },
        insertQuery<T = unknown>(options: {
          readonly table: string;
          readonly values: WebInsertValues<T>;
          readonly format?: Clickhouse.DataFormat;
        }) {
          return Effect.callback<Clickhouse.InsertResult, SqlError>((resume) => {
            const fiber = Fiber.getCurrent()!;
            const conn = clientOnce();
            const queryId = fiber.getRef(QueryId) ?? makeQueryId();
            const settings = fiber.getRef(ClickhouseSettings);
            const controller = new AbortController();
            conn
              .insert({
                format: "JSONEachRow",
                ...options,
                abort_signal: controller.signal,
                query_id: queryId,
                clickhouse_settings: settings,
              })
              .then(
                (result) => resume(Effect.succeed(result)),
                (cause) =>
                  resume(
                    Effect.fail(
                      new SqlError({
                        reason: classifyError(cause, "Failed to insert data", "insert"),
                      }),
                    ),
                  ),
              );
            return Effect.suspend(() => {
              controller.abort();
              return Effect.promise(() =>
                clientOnce().command({ query: `KILL QUERY WHERE query_id = '${queryId}'` }),
              );
            });
          });
        },
        withQueryId: dual(2, <A, E, R>(effect: Effect.Effect<A, E, R>, queryId: string) =>
          Effect.provideService(effect, QueryId, queryId),
        ),
        withQuotaKey: dual(2, <A, E, R>(effect: Effect.Effect<A, E, R>, quotaKey: string) =>
          Effect.provideService(effect, QuotaKey, quotaKey),
        ),
        withClickhouseSettings: dual(
          2,
          <A, E, R>(
            effect: Effect.Effect<A, E, R>,
            settings: NonNullable<Clickhouse.BaseQueryParams["clickhouse_settings"]>,
          ) => Effect.provideService(effect, ClickhouseSettings, settings),
        ),
      },
    );

    // `config` is exposed lazily so reading it never forces the `getConfig`
    // thunk (and thus the Worker env read) before the first real use.
    Object.defineProperty(client, "config", { get: configOnce, enumerable: true });

    return client as ClickhouseWebClient;
  });

/**
 * Fiber reference read by the low-level ClickHouse connection to choose query
 * or command execution for statements; defaults to `query`.
 */
export const ClientMethod = Context.Reference<"query" | "command" | "insert">(
  "@voidhash/clickhouse-db/ClickhouseWebClient/ClientMethod",
  {
    defaultValue: () => "query",
  },
);

/**
 * Fiber reference for the ClickHouse `query_id` applied to queries and inserts.
 */
export const QueryId = Context.Reference<string | undefined>(
  "@voidhash/clickhouse-db/ClickhouseWebClient/QueryId",
  { defaultValue: () => undefined },
);

/**
 * Fiber reference for the ClickHouse quota key (`X-ClickHouse-Quota` header)
 * applied to queries, commands, and inserts. Defaults to `undefined` (no header,
 * empty-key bucket) so existing callers are unaffected.
 */
export const QuotaKey = Context.Reference<string | undefined>(
  "@voidhash/clickhouse-db/ClickhouseWebClient/QuotaKey",
  { defaultValue: () => undefined },
);

/**
 * Fiber reference containing ClickHouse settings to attach to queries,
 * commands, and inserts.
 */
export const ClickhouseSettings: Context.Reference<
  NonNullable<Clickhouse.BaseQueryParams["clickhouse_settings"]>
> = Context.Reference("@voidhash/clickhouse-db/ClickhouseWebClient/ClickhouseSettings", {
  defaultValue: () => ({}),
});

/**
 * Provides both `ClickhouseWebClient` and generic `SqlClient` services from a
 * `Config`-backed ClickHouse client configuration.
 */
export const layerConfig: (
  config: Config.Wrap<ClickhouseWebClientConfig>,
) => Layer.Layer<ClickhouseWebClient | Client.SqlClient, Config.ConfigError | SqlError> = (
  config: Config.Wrap<ClickhouseWebClientConfig>,
): Layer.Layer<ClickhouseWebClient | Client.SqlClient, Config.ConfigError | SqlError> =>
  Layer.effectContext(
    Config.unwrap(config).pipe(
      Effect.flatMap(make),
      Effect.map((client) =>
        Context.make(ClickhouseWebClient, client).pipe(Context.add(Client.SqlClient, client)),
      ),
    ),
  ).pipe(Layer.provide(Reactivity.layer));

/**
 * Provides both `ClickhouseWebClient` and generic `SqlClient` services from a
 * ClickHouse client configuration.
 */
export const layer = (
  config: ClickhouseWebClientConfig,
): Layer.Layer<ClickhouseWebClient | Client.SqlClient, Config.ConfigError | SqlError> =>
  Layer.effectContext(
    Effect.map(make(config), (client) =>
      Context.make(ClickhouseWebClient, client).pipe(Context.add(Client.SqlClient, client)),
    ),
  ).pipe(Layer.provide(Reactivity.layer));

const typeFromUnknown = (value: unknown): string => {
  if (Statement.isFragment(value)) {
    return typeFromUnknown(value.segments[0]);
  } else if (isClickhouseParam(value)) {
    return value.paramA;
  } else if (Array.isArray(value)) {
    return `Array(${typeFromUnknown(value[0])})`;
  }
  switch (typeof value) {
    case "number":
      return "Decimal";
    case "bigint":
      return "Int64";
    case "boolean":
      return "Bool";
    case "object":
      if (value instanceof Date) {
        return "DateTime()";
      }
      return "String";
    default:
      return "String";
  }
};

/**
 * Creates the SQL statement compiler for ClickHouse.
 */
export const makeCompiler = (transform?: (_: string) => string) =>
  Statement.makeCompiler<ClickhouseCustom>({
    dialect: "sqlite",
    placeholder(i, u) {
      return `{p${i}: ${typeFromUnknown(u)}}`;
    },
    onIdentifier: transform
      ? function (value, withoutTransform) {
          return withoutTransform ? escape(value) : escape(transform(value));
        }
      : escape,
    onRecordUpdate() {
      return ["", []];
    },
    onCustom(type, placeholder) {
      return [placeholder(type), [type.paramB]];
    },
  });

const escape = Statement.defaultEscape('"');

/**
 * Custom SQL fragment type used for ClickHouse typed parameters created by
 * `ClickhouseWebClient.param`.
 */
export type ClickhouseCustom = ClickhouseParam;

interface ClickhouseParam extends Statement.Custom<"ClickhouseParam", string, unknown> {}

const clickhouseParam = Statement.custom<ClickhouseParam>("ClickhouseParam");
const isClickhouseParam = Statement.isCustom<ClickhouseParam>("ClickhouseParam");
