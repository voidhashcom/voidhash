import {
  type KeyValuePutOptions,
  KeyValueStore,
  KeyValueStoreError,
  type KeyValueStoreShape,
} from "@voidhash/platform/KeyValueStore";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { Effect, Layer, Option, SchemaParser } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { PgPlatformClientLive, type PgPlatformConfig } from "./Postgres.ts";

interface ValueRow {
  readonly value: unknown;
}

interface KeyRow {
  readonly key: string;
}

const ensureTable = (sql: SqlClient.SqlClient) =>
  sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`SELECT pg_advisory_xact_lock(hashtext('voidhash_platform_kv_schema_v1'))`;
      yield* sql`
        CREATE TABLE IF NOT EXISTS platform_key_value (
          namespace TEXT NOT NULL,
          key TEXT NOT NULL,
          value_json JSONB NOT NULL,
          expires_at_ms BIGINT,
          updated_at_ms BIGINT NOT NULL,
          PRIMARY KEY (namespace, key)
        )
      `;
      yield* sql`
        CREATE INDEX IF NOT EXISTS platform_key_value_expiry_idx
        ON platform_key_value (expires_at_ms)
        WHERE expires_at_ms IS NOT NULL
      `;
    }),
  );

const expiry = (now: number, options: KeyValuePutOptions | undefined): number | null => {
  const ttl = options?.ttlMillis;
  return typeof ttl === "number" && Number.isFinite(ttl) && ttl > 0
    ? now + Math.floor(ttl)
    : null;
};

const encodeJson = (value: unknown): Effect.Effect<string, unknown> =>
  Effect.try({
    try: () => {
      const encoded = JSON.stringify(value);
      if (encoded === undefined) {
        throw new TypeError("Key-value entries must be JSON-serializable");
      }
      return encoded;
    },
    catch: (cause) => cause,
  });

const storeError = (namespace: string, operation: string, cause: unknown) =>
  new KeyValueStoreError({ namespace, operation, cause: String(cause) });

const makeStore = (sql: SqlClient.SqlClient): KeyValueStoreShape => ({
  get: (namespace, key, schema) =>
    PlatformRuntime.pipe(
      Effect.andThen(
        Effect.suspend(() => {
          const now = Date.now();
          return sql<ValueRow>`
            SELECT value_json AS "value"
            FROM platform_key_value
            WHERE namespace = ${namespace}
              AND key = ${key}
              AND (expires_at_ms IS NULL OR expires_at_ms > ${now})
          `;
        }),
      ),
      Effect.flatMap((rows) =>
        rows[0]
          ? SchemaParser.decodeUnknownEffect(schema)(rows[0].value).pipe(Effect.map(Option.some))
          : Effect.succeedNone,
      ),
      Effect.mapError((cause) => storeError(namespace, "get", cause)),
    ),
  put: (namespace, key, value, schema, options) =>
    PlatformRuntime.pipe(
      Effect.andThen(SchemaParser.encodeUnknownEffect(schema)(value)),
      Effect.flatMap(encodeJson),
      Effect.flatMap((encoded) => {
        const now = Date.now();
        const expiresAt = expiry(now, options);
        return sql`
          INSERT INTO platform_key_value (
            namespace, key, value_json, expires_at_ms, updated_at_ms
          ) VALUES (
            ${namespace}, ${key}, ${encoded}::jsonb, ${expiresAt}, ${now}
          )
          ON CONFLICT (namespace, key)
          DO UPDATE SET value_json = EXCLUDED.value_json,
                        expires_at_ms = EXCLUDED.expires_at_ms,
                        updated_at_ms = EXCLUDED.updated_at_ms
        `;
      }),
      Effect.asVoid,
      Effect.mapError((cause) => storeError(namespace, "put", cause)),
    ),
  putMany: (namespace, entries, schema, options) =>
    PlatformRuntime.pipe(
      Effect.andThen(
        Effect.forEach(entries, ({ key, value }) =>
          SchemaParser.encodeUnknownEffect(schema)(value).pipe(
            Effect.flatMap(encodeJson),
            Effect.map((encoded) => ({ key, encoded })),
          ),
        ),
      ),
      Effect.flatMap((encodedEntries) => {
        const now = Date.now();
        const expiresAt = expiry(now, options);
        return sql.withTransaction(
          Effect.forEach(
            encodedEntries,
            ({ key, encoded }) =>
              sql`
                INSERT INTO platform_key_value (
                  namespace, key, value_json, expires_at_ms, updated_at_ms
                ) VALUES (
                  ${namespace}, ${key}, ${encoded}::jsonb, ${expiresAt}, ${now}
                )
                ON CONFLICT (namespace, key)
                DO UPDATE SET value_json = EXCLUDED.value_json,
                              expires_at_ms = EXCLUDED.expires_at_ms,
                              updated_at_ms = EXCLUDED.updated_at_ms
              `,
            { discard: true },
          ),
        );
      }),
      Effect.mapError((cause) => storeError(namespace, "putMany", cause)),
    ),
  existingKeys: (namespace, keys) => {
    if (keys.length === 0) return Effect.succeed(new Set<string>());
    return PlatformRuntime.pipe(
      Effect.andThen(
        Effect.suspend(() => {
          const now = Date.now();
          return sql<KeyRow>`
            SELECT key
            FROM platform_key_value
            WHERE namespace = ${namespace}
              AND ${sql.in("key", keys)}
              AND (expires_at_ms IS NULL OR expires_at_ms > ${now})
          `;
        }),
      ),
      Effect.map((rows) => new Set(rows.map(({ key }) => key))),
      Effect.mapError((cause) => storeError(namespace, "existingKeys", cause)),
    );
  },
  delete: (namespace, key) =>
    PlatformRuntime.pipe(
      Effect.andThen(sql`DELETE FROM platform_key_value WHERE namespace = ${namespace} AND key = ${key}`),
      Effect.asVoid,
      Effect.mapError((cause) => storeError(namespace, "delete", cause)),
    ),
  deleteMany: (namespace, keys) => {
    if (keys.length === 0) return Effect.void;
    return PlatformRuntime.pipe(
      Effect.andThen(
        sql`
          DELETE FROM platform_key_value
          WHERE namespace = ${namespace} AND ${sql.in("key", keys)}
        `,
      ),
      Effect.asVoid,
      Effect.mapError((cause) => storeError(namespace, "deleteMany", cause)),
    );
  },
  increment: (namespace, key, options) =>
    PlatformRuntime.pipe(
      Effect.andThen(
        Effect.suspend(() => {
          const now = Date.now();
          const expiresAt = expiry(now, options);
          return sql<ValueRow>`
            INSERT INTO platform_key_value (
              namespace, key, value_json, expires_at_ms, updated_at_ms
            ) VALUES (
              ${namespace}, ${key}, '1'::jsonb, ${expiresAt}, ${now}
            )
            ON CONFLICT (namespace, key)
            DO UPDATE SET
              value_json = to_jsonb(
                CASE
                  WHEN platform_key_value.expires_at_ms IS NOT NULL
                    AND platform_key_value.expires_at_ms <= ${now}
                    THEN 1
                  WHEN jsonb_typeof(platform_key_value.value_json) = 'number'
                    THEN (platform_key_value.value_json #>> '{}')::BIGINT + 1
                  ELSE 1
                END
              ),
              expires_at_ms = EXCLUDED.expires_at_ms,
              updated_at_ms = EXCLUDED.updated_at_ms
            RETURNING value_json AS "value"
          `;
        }),
      ),
      Effect.map((rows) => Number(rows[0]?.value ?? 0)),
      Effect.mapError((cause) => storeError(namespace, "increment", cause)),
    ),
  pruneExpired: (limit) =>
    PlatformRuntime.pipe(
      Effect.andThen(
        Effect.suspend(() => {
          const now = Date.now();
          const rowLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
          return sql<KeyRow>`
            WITH expired AS (
              SELECT namespace, key
              FROM platform_key_value
              WHERE expires_at_ms IS NOT NULL AND expires_at_ms <= ${now}
              ORDER BY expires_at_ms ASC
              LIMIT ${rowLimit}
              FOR UPDATE SKIP LOCKED
            )
            DELETE FROM platform_key_value AS value
            USING expired
            WHERE value.namespace = expired.namespace AND value.key = expired.key
            RETURNING value.key
          `;
        }),
      ),
      Effect.map((rows) => rows.length),
      Effect.mapError((cause) => storeError("*", "pruneExpired", cause)),
    ),
});

/** Postgres-backed typed key-value store with TTL and atomic counters. */
export const PgKeyValueStoreLive = (
  config: PgPlatformConfig,
): Layer.Layer<KeyValueStore> =>
  Layer.effect(
    KeyValueStore,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* ensureTable(sql);
      return makeStore(sql);
    }),
  ).pipe(Layer.provide(PgPlatformClientLive(config)), Layer.orDie);
