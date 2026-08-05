import { ClickhouseDbLive } from "@voidhash/clickhouse-db";
import { analyticsEventsMigrations } from "@voidhash/clickhouse-db/analytics/migration";
import {
  CLICKHOUSE_EVENTS_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_TABLE,
  CLICKHOUSE_PERSONS_TABLE,
} from "@voidhash/clickhouse-db/analytics/schema";
import { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import { Effect, Layer, Schedule } from "effect";
import { SqlClient } from "effect/unstable/sql";

import type { SelfhostClickhouseConfig } from "../config.ts";

const tenantTables = [
  CLICKHOUSE_EVENTS_TABLE,
  CLICKHOUSE_PERSONS_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_OVERRIDES_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
] as const;

const queryTables = [
  CLICKHOUSE_EVENTS_TABLE,
  CLICKHOUSE_PERSONS_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
] as const;

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

const assertIdentifier = (name: string, value: string): string => {
  if (!identifierPattern.test(value)) {
    throw new Error(`${name} must be a ClickHouse identifier`);
  }
  return value;
};

const makeClientLive = (config: SelfhostClickhouseConfig["readWrite"]) =>
  ClickhouseDbLive(config).pipe(Layer.orDie);

/** Builds the read-write, tenant-readonly, and hardened query client layers. */
export const makeSelfhostClickhouseLayers = (config: SelfhostClickhouseConfig) => ({
  analyticsQuery: makeClientLive(config.analyticsQuery),
  readOnly: makeClientLive(config.readOnly),
  readWrite: makeClientLive(config.readWrite),
});

const provisionSelfhostClickhouseAccess = (config: SelfhostClickhouseConfig) =>
  Effect.gen(function* () {
    const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
    const sql = yield* SqlClient.SqlClient;
    const database = assertIdentifier("CLICKHOUSE_DATABASE", config.admin.database);
    const adminUser = assertIdentifier("CLICKHOUSE_ADMIN_USERNAME", config.admin.username);
    const readWriteUser = assertIdentifier("CLICKHOUSE_USERNAME", config.readWrite.username);
    const readOnlyUser = assertIdentifier("CLICKHOUSE_RO_USERNAME", config.readOnly.username);
    const queryUser = assertIdentifier(
      "CLICKHOUSE_ANALYTICS_QUERY_USERNAME",
      config.analyticsQuery.username,
    );
    const readWriteRole = `${database}_app_role`;
    const readOnlyRole = `${database}_ro_role`;
    const queryRole = `${database}_query_role`;

    for (const [user, password] of [
      [readWriteUser, config.readWrite.password],
      [readOnlyUser, config.readOnly.password],
      [queryUser, config.analyticsQuery.password],
    ] as const) {
      yield* ch.asCommand(sql`
        CREATE USER IF NOT EXISTS ${sql(user)} IDENTIFIED WITH sha256_password BY ${password}
      `);
      yield* ch.asCommand(sql`
        ALTER USER ${sql(user)} IDENTIFIED WITH sha256_password BY ${password}
      `);
    }

    for (const role of [readWriteRole, readOnlyRole, queryRole]) {
      yield* ch.asCommand(sql`CREATE ROLE IF NOT EXISTS ${sql(role)}`);
    }
    yield* ch.asCommand(sql`GRANT ALL ON ${sql(database)}.* TO ${sql(readWriteRole)}`);
    for (const table of tenantTables) {
      yield* ch.asCommand(
        sql`GRANT SELECT ON ${sql(database)}.${sql(table)} TO ${sql(readOnlyRole)}`,
      );
    }
    for (const table of queryTables) {
      yield* ch.asCommand(
        sql`GRANT SELECT ON ${sql(database)}.${sql(table)} TO ${sql(queryRole)}`,
      );
    }
    yield* ch.asCommand(sql`GRANT ${sql(readWriteRole)} TO ${sql(readWriteUser)}`);
    yield* ch.asCommand(sql`GRANT ${sql(readOnlyRole)} TO ${sql(readOnlyUser)}`);
    yield* ch.asCommand(sql`GRANT ${sql(queryRole)} TO ${sql(queryUser)}`);
    yield* ch.asCommand(
      sql`ALTER USER ${sql(readWriteUser)} DEFAULT ROLE ${sql(readWriteRole)}`,
    );
    yield* ch.asCommand(sql`ALTER USER ${sql(readOnlyUser)} DEFAULT ROLE ${sql(readOnlyRole)}`);
    yield* ch.asCommand(sql`ALTER USER ${sql(queryUser)} DEFAULT ROLE ${sql(queryRole)}`);
    yield* ch.asCommand(sql`
      ALTER USER ${sql(readOnlyUser)} SETTINGS
        readonly = 1,
        SQL_organization_id = '' CHANGEABLE_IN_READONLY
    `);
    yield* ch.asCommand(sql`
      ALTER USER ${sql(queryUser)} SETTINGS
        readonly = 1,
        allow_ddl = 0,
        allow_introspection_functions = 0,
        max_execution_time = 30,
        max_result_rows = 100000
    `);

    for (const table of tenantTables) {
      const tenantPolicy = `${database}_${table}_tenant`;
      const unrestrictedPolicy = `${database}_${table}_unrestricted`;
      yield* ch.asCommand(sql`
        CREATE ROW POLICY OR REPLACE ${sql(tenantPolicy)}
        ON ${sql(database)}.${sql(table)}
        FOR SELECT
        USING getSetting('SQL_organization_id') != ''
          AND organization_id = getSetting('SQL_organization_id')
        TO ${sql(readOnlyRole)}
      `);
      yield* ch.asCommand(sql`
        CREATE ROW POLICY OR REPLACE ${sql(unrestrictedPolicy)}
        ON ${sql(database)}.${sql(table)}
        FOR SELECT USING 1
        TO ${sql(readWriteRole)}, ${sql(queryRole)}, ${sql(adminUser)}
      `);
    }
  });

/** Applies analytics schema migrations and reconciles local ClickHouse access roles. */
export const migrateSelfhostClickhouse = (config: SelfhostClickhouseConfig | undefined) => {
  if (config === undefined) return Effect.void;
  const admin = ClickhouseDbLive(config.admin, [analyticsEventsMigrations]);
  return provisionSelfhostClickhouseAccess(config).pipe(
    Effect.provide(admin),
    Effect.scoped,
    Effect.retry({ schedule: Schedule.spaced("1 second"), times: 30 }),
  );
};
