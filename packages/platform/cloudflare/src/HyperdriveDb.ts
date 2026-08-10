import type * as Cloudflare from "alchemy/Cloudflare";
import type { RuntimeContext } from "alchemy/RuntimeContext";
import { Db } from "@voidhash/db";
import { Effect, Layer, Redacted } from "effect";

const isRuntimeHyperdriveHost = (host: string): boolean =>
  host.trim().toLowerCase().endsWith(".hyperdrive.local");

/**
 * For layer graphs that must expose {@link Db} while deferring the concrete
 * runtime implementation to an enclosing
 * `Effect.provide(HyperdriveDbLayer.make(conn))`.
 */
export const DbFromContextLive: Layer.Layer<Db, never, Db> = Layer.effect(Db)(Db);

/**
 * Build a {@link Db} layer from a bound Cloudflare Hyperdrive connection.
 * Hyperdrive credentials carry Alchemy's runtime-phase marker, so this effect
 * can only be run inside Worker/runtime code.
 */
export const makeHyperdriveDbLayer = (
  conn: Cloudflare.Hyperdrive.ConnectClient,
): Effect.Effect<Layer.Layer<Db>, never, RuntimeContext> =>
  Effect.gen(function* () {
    const host = yield* conn.host;
    const username = yield* conn.user;
    const password = yield* conn.password;
    const databaseName = yield* conn.database;
    const port = yield* conn.port;

    const dbConfig = {
      databaseName,
      host,
      password: Redacted.value(password),
      port,
      username,
    };

    if (isRuntimeHyperdriveHost(host)) return Db.layer({ ...dbConfig, ssl: undefined });
    return Db.layer(dbConfig);
  });

/**
 * Builds a request/task-scoped {@link Db} layer from a bound Cloudflare
 * Hyperdrive connection.
 *
 * The layer keeps `RuntimeContext` as a requirement (Hyperdrive credentials
 * carry Alchemy's runtime-phase marker), so it can only be built inside
 * Worker/Workflow runtime code. Provide it with `Effect.provide` to satisfy
 * {@link Db} dependencies — the layer is scoped, so `Effect.provide` releases
 * the connection automatically and callers do NOT need `Effect.scoped`.
 */
export const HyperdriveDbLayer = {
  make: (conn: Cloudflare.Hyperdrive.ConnectClient): Layer.Layer<Db, never, RuntimeContext> =>
    Layer.unwrap(makeHyperdriveDbLayer(conn)),
};
