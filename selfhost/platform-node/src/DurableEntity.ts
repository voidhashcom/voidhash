import {
  DurableEntityHost,
  type DurableEntityAddress,
  type DurableEntityContext,
  type DurableEntityHostShape,
  type DurableEntitySession,
} from "@voidhash/platform/DurableEntity";
import { Context, Effect, Layer, Semaphore } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { createHash } from "node:crypto";

import { PgPlatformClientLive, type PgPlatformConfig } from "./Postgres.ts";

/** Postgres connection parameters for the single-node durable entity host. */
export type PgDurableEntityConfig = PgPlatformConfig;

/** A persisted entity alarm ready to be dispatched by the Node scheduler. */
export interface DueDurableEntityAlarm {
  readonly address: DurableEntityAddress;
  readonly scheduledTime: number;
}

/** Adapter control plane used by the single-node alarm scheduler. */
export interface NodeDurableEntityControlShape {
  readonly listDueAlarms: (
    now: number,
    limit: number,
  ) => Effect.Effect<ReadonlyArray<DueDurableEntityAlarm>>;
}

/** Exposes persisted alarms to the single-node scheduler. */
export class NodeDurableEntityControl extends Context.Service<
  NodeDurableEntityControl,
  NodeDurableEntityControlShape
>()("@voidhash/platform-node/NodeDurableEntityControl") {}

interface EntityRuntimeState {
  readonly lock: Semaphore.Semaphore;
  readonly sessions: Map<string, DurableEntitySession>;
}

interface KeyValueRow {
  readonly value: unknown;
}

interface AlarmRow {
  readonly type: string;
  readonly id: string;
  readonly scheduledTime: number | string;
}

const runtimeKey = (address: DurableEntityAddress): string =>
  `${address.type}\u0000${address.id}`;

const schemaName = (address: DurableEntityAddress): string =>
  `entity_${createHash("sha256").update(runtimeKey(address)).digest("hex").slice(0, 32)}`;

const encodeJson = (value: unknown): string => {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) {
    throw new TypeError("Durable entity values must be JSON-serializable");
  }
  return encoded;
};

const ensureTables = (sql: SqlClient.SqlClient) =>
  sql.withTransaction(
    Effect.gen(function* () {
      // PostgreSQL's IF NOT EXISTS DDL can still race in its catalog, so host
      // processes serialize this tiny bootstrap migration with an advisory lock.
      yield* sql`SELECT pg_advisory_xact_lock(hashtext('voidhash_platform_entity_schema_v1'))`;
      yield* sql`
        CREATE TABLE IF NOT EXISTS platform_entity_kv (
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value_json JSONB NOT NULL,
          PRIMARY KEY (entity_type, entity_id, key)
        )
      `;
      yield* sql`
        CREATE TABLE IF NOT EXISTS platform_entity_alarms (
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          scheduled_time BIGINT NOT NULL,
          PRIMARY KEY (entity_type, entity_id)
        )
      `;
      yield* sql`
        CREATE INDEX IF NOT EXISTS platform_entity_alarms_due_idx
        ON platform_entity_alarms (scheduled_time)
      `;
    }),
  );

const makePgHost = (sql: SqlClient.SqlClient): DurableEntityHostShape => {
  const runtimeStates = new Map<string, EntityRuntimeState>();
  const runDb = <A>(effect: Effect.Effect<A, unknown>): Effect.Effect<A> =>
    effect.pipe(Effect.orDie);

  const stateFor = (address: DurableEntityAddress): EntityRuntimeState => {
    const key = runtimeKey(address);
    let state = runtimeStates.get(key);
    if (!state) {
      state = { lock: Semaphore.makeUnsafe(1), sessions: new Map() };
      runtimeStates.set(key, state);
    }
    return state;
  };

  const contextFor = (
    address: DurableEntityAddress,
    state: EntityRuntimeState,
  ): DurableEntityContext => ({
    address,
    keyValue: {
      get: (key) =>
        runDb(
          sql<KeyValueRow>`
            SELECT value_json AS "value"
            FROM platform_entity_kv
            WHERE entity_type = ${address.type}
              AND entity_id = ${address.id}
              AND key = ${key}
          `.pipe(Effect.map((rows) => rows[0]?.value)),
        ),
      put: (key, value) =>
        runDb(
          Effect.suspend(() => {
            const encoded = encodeJson(value);
            return sql`
              INSERT INTO platform_entity_kv (entity_type, entity_id, key, value_json)
              VALUES (${address.type}, ${address.id}, ${key}, ${encoded}::jsonb)
              ON CONFLICT (entity_type, entity_id, key)
              DO UPDATE SET value_json = EXCLUDED.value_json
            `.pipe(Effect.asVoid);
          }),
        ),
      delete: (key) =>
        runDb(
          sql`
            DELETE FROM platform_entity_kv
            WHERE entity_type = ${address.type}
              AND entity_id = ${address.id}
              AND key = ${key}
          `.pipe(Effect.asVoid),
        ),
    },
    sql: {
      execute: <Row extends Readonly<Record<string, unknown>>>(
        statement: string,
        bindings: ReadonlyArray<unknown> = [],
      ) => {
        const schema = schemaName(address);
        return runDb(
          sql.withTransaction(
            Effect.gen(function* () {
              yield* sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
              yield* sql.unsafe(`SET LOCAL search_path TO ${schema}, public`);
              return yield* sql.unsafe<Row>(statement, bindings);
            }),
          ),
        );
      },
    },
    alarm: {
      get: runDb(
        sql<AlarmRow>`
          SELECT entity_type AS "type", entity_id AS "id", scheduled_time AS "scheduledTime"
          FROM platform_entity_alarms
          WHERE entity_type = ${address.type} AND entity_id = ${address.id}
        `.pipe(Effect.map((rows) => (rows[0] ? Number(rows[0].scheduledTime) : undefined))),
      ),
      set: (scheduledTime) =>
        runDb(
          sql`
            INSERT INTO platform_entity_alarms (entity_type, entity_id, scheduled_time)
            VALUES (${address.type}, ${address.id}, ${scheduledTime})
            ON CONFLICT (entity_type, entity_id)
            DO UPDATE SET scheduled_time = EXCLUDED.scheduled_time
          `.pipe(Effect.asVoid),
        ),
      delete: runDb(
        sql`
          DELETE FROM platform_entity_alarms
          WHERE entity_type = ${address.type} AND entity_id = ${address.id}
        `.pipe(Effect.asVoid),
      ),
    },
    sessions: {
      get: (sessionId) => Effect.sync(() => state.sessions.get(sessionId)),
      list: Effect.sync(() => [...state.sessions.values()]),
      attach: (session) =>
        Effect.sync(() => void state.sessions.set(session.id, session)),
      remove: (sessionId) => Effect.sync(() => void state.sessions.delete(sessionId)),
    },
  });

  return DurableEntityHost.of({
    run: (address, operation) =>
      Effect.suspend(() => {
        const state = stateFor(address);
        return state.lock.withPermit(
          Effect.suspend(() => operation(contextFor(address, state))),
        );
      }),
  });
};

const makeControl = (sql: SqlClient.SqlClient): NodeDurableEntityControlShape => ({
  listDueAlarms: (now, limit) =>
    sql<AlarmRow>`
      SELECT entity_type AS "type", entity_id AS "id", scheduled_time AS "scheduledTime"
      FROM platform_entity_alarms
      WHERE scheduled_time <= ${now}
      ORDER BY scheduled_time ASC, entity_type ASC, entity_id ASC
      LIMIT ${Math.max(0, Math.floor(limit))}
    `.pipe(
      Effect.map((rows) =>
        rows.map((row) => ({
          address: { type: row.type, id: row.id },
          scheduledTime: Number(row.scheduledTime),
        })),
      ),
      Effect.orDie,
    ),
});

/**
 * Postgres-backed single-node entity layer. Database state and alarms survive
 * process restarts; execution locks and active WebSocket sessions are local to
 * the one Node process.
 */
export const PgDurableEntityHostLive = (
  config: PgDurableEntityConfig,
): Layer.Layer<DurableEntityHost | NodeDurableEntityControl> =>
  Layer.effect(
    DurableEntityHost,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* ensureTables(sql);
      return makePgHost(sql);
    }),
  ).pipe(
    Layer.merge(
      Layer.effect(
        NodeDurableEntityControl,
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          return makeControl(sql);
        }),
      ),
    ),
    Layer.provide(PgPlatformClientLive(config)),
    Layer.orDie,
  );
