import * as PgClient from "@effect/sql-pg/PgClient";
import type { Redacted } from "effect";
import type { ConnectionOptions } from "node:tls";

/** Postgres connection parameters shared by single-node Orbian adapters. */
export interface PgPlatformConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: Redacted.Redacted<string>;
  readonly ssl?: boolean | ConnectionOptions;
}

/** Builds a Postgres client layer for a single-node Orbian adapter. */
export const PgPlatformClientLive = (config: PgPlatformConfig) =>
  PgClient.layer({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    ssl: config.ssl,
  });
