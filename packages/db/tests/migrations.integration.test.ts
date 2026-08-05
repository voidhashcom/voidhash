import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DbConfig } from "../src/db.ts";
import { runAppDatabaseMigrations } from "../src/migrations.ts";

const adminConfig = {
  database: "postgres",
  host: process.env.DATABASE_HOST ?? "127.0.0.1",
  password: process.env.DATABASE_PASSWORD ?? "password",
  port: Number(process.env.DATABASE_PORT ?? "5432"),
  user: process.env.DATABASE_USERNAME ?? "voidhash",
};
const databaseName = `voidhash_migrations_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
const config: DbConfig = {
  databaseName,
  host: adminConfig.host,
  password: adminConfig.password,
  port: adminConfig.port,
  username: adminConfig.user,
};

const withAdminClient = async (run: (client: Client) => Promise<void>) => {
  const client = new Client(adminConfig);
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
};

describe("application database migrations", () => {
  beforeAll(() =>
    withAdminClient(async (client) => {
      await client.query(`CREATE DATABASE "${databaseName}"`);
    }),
  );

  afterAll(() =>
    withAdminClient(async (client) => {
      await client.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
        [databaseName],
      );
      await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    }),
  );

  it("serializes concurrent runners and records an idempotent later run", async () => {
    const concurrent = await Promise.all([
      Effect.runPromise(runAppDatabaseMigrations(config)),
      Effect.runPromise(runAppDatabaseMigrations(config)),
    ]);
    const applied = concurrent.flatMap((result) => result.applied);
    const later = await Effect.runPromise(runAppDatabaseMigrations(config));

    expect(applied.length).toBeGreaterThan(0);
    expect(new Set(applied).size).toBe(applied.length);
    expect(concurrent.some((result) => result.applied.length === 0)).toBe(true);
    expect(later.applied).toEqual([]);
    expect(later.skipped).toBe(applied.length);

    const client = new Client({ ...adminConfig, database: databaseName });
    await client.connect();
    try {
      const tracker = await client.query<{ readonly count: string }>(
        "SELECT count(*)::text AS count FROM __alchemy_migrations",
      );
      const tables = await client.query<{ readonly organization: string | null }>(
        "SELECT to_regclass('public.organization')::text AS organization",
      );
      expect(Number(tracker.rows[0]?.count)).toBe(applied.length);
      expect(tables.rows[0]?.organization).toBe("organization");
    } finally {
      await client.end();
    }
  });
});
