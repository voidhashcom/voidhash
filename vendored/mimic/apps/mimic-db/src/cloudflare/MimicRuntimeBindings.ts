import * as Effect from "effect/Effect";
import { makePgDocumentConfig, type PgDocumentConfig } from "../core/pg-store.ts";

/** Raw Cloudflare Hyperdrive binding read from the mimic Worker environment. */
export interface RawHyperdrive {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

const isRawHyperdrive = (value: unknown): value is RawHyperdrive =>
  typeof value === "object" &&
  value !== null &&
  "host" in value &&
  "user" in value &&
  "database" in value;

/** Locates the Hyperdrive binding on a Cloudflare Worker environment. */
export const findHyperdrive = (env: Record<string, unknown>): RawHyperdrive => {
  for (const key of ["DatabaseHyperdrive", "DatabaseHyperdriveMain"]) {
    const candidate = env[key];
    if (isRawHyperdrive(candidate)) return candidate;
  }
  for (const candidate of Object.values(env)) {
    if (isRawHyperdrive(candidate) && "connectionString" in candidate) return candidate;
  }
  return Effect.runSync(
    Effect.die(new Error("Hyperdrive binding not found in Worker environment")),
  );
};

/** Converts a runtime Hyperdrive binding into the mimic Postgres port config. */
export const pgConfigFromHyperdrive = (binding: RawHyperdrive): PgDocumentConfig =>
  makePgDocumentConfig({
    host: binding.host,
    port: binding.port,
    database: binding.database,
    username: binding.user,
    password: binding.password,
  });
