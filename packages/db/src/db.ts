import * as PgClient from "@effect/sql-pg/PgClient";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Context, Effect, Layer, Redacted } from "effect";
import type { ConnectionOptions } from "node:tls";

import { relations } from "./relations.ts";

// Primitives
const localDatabaseHosts = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "host.docker.internal",
  "standalone_postgres",
]);

const isLocalDatabaseHost = (host: string): boolean => {
  const normalizedHost = host.trim().toLowerCase();
  return (
    localDatabaseHosts.has(normalizedHost) ||
    normalizedHost.endsWith(".localhost") ||
    // Cloudflare Hyperdrive's local proxy socket is plaintext (it terminates TLS
    // upstream), so a `.hyperdrive.local` host must never default to TLS.
    normalizedHost.endsWith(".hyperdrive.local")
  );
};

const getDefaultSsl = (host: string): boolean | ConnectionOptions | undefined =>
  isLocalDatabaseHost(host) ? undefined : { rejectUnauthorized: true };

/**
 * Plain connection config consumed by {@link Db.layer}. Built from the bound
 * Cloudflare Hyperdrive origin (or the local docker Postgres in dev / tests).
 */
export interface DbConfig {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password: string;
  readonly databaseName: string;
  readonly ssl?: boolean | ConnectionOptions;
}

/**
 * The native `drizzle-orm/effect-postgres` database, built over `@effect/sql-pg`'s
 * `PgClient`. Every query builder is an `Effect` — `yield* db.insert(t).values(v)`,
 * `yield* db.query.persons.findFirst({ where: { id } })` — and transactions are
 * native (`db.transaction((tx) => …)`). Requires only a `PgClient`; the no-op
 * cache + logger come from `PgDrizzle.DefaultServices`.
 */
const makeDb = PgDrizzle.make({ relations }).pipe(Effect.provide(PgDrizzle.DefaultServices));

/** The native effect-postgres database value (query builders return Effects). */
export type Database = Effect.Success<typeof makeDb>;

/** A live transaction handle — the same query surface as {@link Database}. */
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** The tagged error every `Db` query fails with (`EffectDrizzleQueryError`). */
export type DbError = PgDrizzle.EffectPgQueryEffectHKT["error"];

const pgClientLayer = (config: DbConfig) =>
  PgClient.layer({
    host: config.host,
    port: config.port,
    database: config.databaseName,
    username: config.username,
    password: Redacted.make(config.password),
    ssl: "ssl" in config ? config.ssl : getDefaultSsl(config.host),
  });

/**
 * The application database service. Inject with {@link Db.layer}; consume it
 * natively:
 *
 * ```ts
 * const db = yield* Db;
 * const person = yield* db.query.persons.findFirst({ where: { id } });
 * yield* db.insert(persons).values(row);
 * yield* db.transaction((tx) => tx.update(persons).set(patch).where(eq(persons.id, id)));
 * ```
 */
export class Db extends Context.Service<Db, Database>()("app/Db") {
  static readonly layer = (config: DbConfig): Layer.Layer<Db> =>
    Layer.effect(Db, makeDb).pipe(Layer.provide(pgClientLayer(config)), Layer.orDie);
}
