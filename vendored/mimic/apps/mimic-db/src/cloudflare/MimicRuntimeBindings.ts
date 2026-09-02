import * as Arr from "effect/Array";
import * as R from "effect/Record";
import * as P from "effect/Predicate";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { makePgDocumentConfig, type PgDocumentConfig } from "../core/pg-store.ts";

/** Raw Cloudflare Hyperdrive binding read from the mimic Worker environment. */
export interface RawHyperdrive {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

/** Indicates that a Worker environment has no usable Hyperdrive binding. */
export class HyperdriveBindingNotFoundError extends Schema.TaggedErrorClass<HyperdriveBindingNotFoundError>(
  "HyperdriveBindingNotFoundError",
)("HyperdriveBindingNotFoundError", {
  message: Schema.String,
}) {}

const isRawHyperdrive = (value: unknown): value is RawHyperdrive =>
  P.isObject(value) && value !== null && "host" in value && "user" in value && "database" in value;

/** Locates the Hyperdrive binding on a Cloudflare Worker environment. */
export const findHyperdrive = (env: Record<string, unknown>): RawHyperdrive => {
  const named = Arr.findFirst(["DatabaseHyperdrive", "DatabaseHyperdriveMain"], (key) =>
    isRawHyperdrive(env[key]),
  ).pipe(Option.map((key) => env[key]));
  if (Option.isSome(named) && isRawHyperdrive(named.value)) return named.value;
  const discovered = Arr.findFirst(
    R.values(env),
    (candidate) => isRawHyperdrive(candidate) && "connectionString" in candidate,
  );
  if (Option.isSome(discovered)) return discovered.value;
  throw new HyperdriveBindingNotFoundError({
    message: "Hyperdrive binding not found in Worker environment",
  });
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
