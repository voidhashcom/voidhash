import type {
  DueDurableEntityAlarm,
  DurableEntityAddress,
} from "@voidhash/platform/DurableEntity";
import { Context, Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";

/**
 * Storage for entity alarms that can also be *enumerated*.
 *
 * Effect's persistence key-value store has no key enumeration, so an alarm
 * written there can never be found again by a scheduler. Alarms therefore get
 * their own indexed store, kept separate from entity values.
 */
export interface DurableEntityAlarmStoreShape {
  readonly get: (address: DurableEntityAddress) => Effect.Effect<number | undefined>;
  readonly set: (address: DurableEntityAddress, scheduledTime: number) => Effect.Effect<void>;
  readonly delete: (address: DurableEntityAddress) => Effect.Effect<void>;
  readonly listDue: (
    now: number,
    limit: number,
  ) => Effect.Effect<ReadonlyArray<DueDurableEntityAlarm>>;
}

/** Indexed alarm storage shared by the entity host and its control plane. */
export class DurableEntityAlarmStore extends Context.Service<
  DurableEntityAlarmStore,
  DurableEntityAlarmStoreShape
>()("@voidhash/platform-selfhost/DurableEntityAlarmStore") {}

interface AlarmRow {
  readonly type: string;
  readonly id: string;
  readonly scheduledTime: number | string;
}

const ensureTable = (sql: SqlClient.SqlClient) =>
  sql.withTransaction(
    Effect.gen(function* () {
      // PostgreSQL's IF NOT EXISTS DDL can still race in its catalog, so host
      // processes serialize this tiny bootstrap migration with an advisory lock.
      yield* sql`SELECT pg_advisory_xact_lock(hashtext('voidhash_platform_entity_alarm_schema_v1'))`;
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

const makeSqlStore = (sql: SqlClient.SqlClient): DurableEntityAlarmStoreShape => ({
  get: (address) =>
    sql<AlarmRow>`
      SELECT entity_type AS "type", entity_id AS "id", scheduled_time AS "scheduledTime"
      FROM platform_entity_alarms
      WHERE entity_type = ${address.type} AND entity_id = ${address.id}
    `.pipe(
      Effect.map((rows) => {
        const row = rows[0];
        if (!row) return undefined;
        return Number(row.scheduledTime);
      }),
      Effect.orDie,
    ),
  set: (address, scheduledTime) =>
    sql`
      INSERT INTO platform_entity_alarms (entity_type, entity_id, scheduled_time)
      VALUES (${address.type}, ${address.id}, ${scheduledTime})
      ON CONFLICT (entity_type, entity_id)
      DO UPDATE SET scheduled_time = EXCLUDED.scheduled_time
    `.pipe(Effect.asVoid, Effect.orDie),
  delete: (address) =>
    sql`
      DELETE FROM platform_entity_alarms
      WHERE entity_type = ${address.type} AND entity_id = ${address.id}
    `.pipe(Effect.asVoid, Effect.orDie),
  listDue: (now, limit) =>
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
 * Postgres alarm index. The table is created on first build, so a deployment
 * needs no separate migration step for it.
 */
export const PgEntityAlarmStoreLive: Layer.Layer<
  DurableEntityAlarmStore,
  never,
  SqlClient.SqlClient
> = Layer.effect(
  DurableEntityAlarmStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* ensureTable(sql);
    return makeSqlStore(sql);
  }),
).pipe(Layer.orDie);

/** Builds a process-local alarm index for tests and ephemeral development. */
export const makeMemoryEntityAlarmStore = (): DurableEntityAlarmStoreShape => {
  const alarms = new Map<string, DueDurableEntityAlarm>();
  const key = (address: DurableEntityAddress): string => `${address.type}\u0000${address.id}`;
  return {
    get: (address) => Effect.sync(() => alarms.get(key(address))?.scheduledTime),
    set: (address, scheduledTime) =>
      Effect.sync(() => void alarms.set(key(address), { address, scheduledTime })),
    delete: (address) => Effect.sync(() => void alarms.delete(key(address))),
    listDue: (now, limit) =>
      Effect.sync(() =>
        [...alarms.values()]
          .filter((alarm) => alarm.scheduledTime <= now)
          .sort((left, right) => left.scheduledTime - right.scheduledTime)
          .slice(0, Math.max(0, Math.floor(limit))),
      ),
  };
};

/** In-memory alarm index layer. State does not survive the process. */
export const MemoryEntityAlarmStoreLive: Layer.Layer<DurableEntityAlarmStore> = Layer.sync(
  DurableEntityAlarmStore,
  makeMemoryEntityAlarmStore,
);
