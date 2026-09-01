import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { DevelopmentDatabase } from "./PGlite.ts";

const logicalId = "CommunityDatabaseHyperdrive";

const runtimeReference = Cloudflare.Hyperdrive.Connection.ref(logicalId);

const databaseOrigin = Effect.fn("databaseOrigin")(function* () {
  const host = yield* Config.string("DATABASE_HOST").pipe(Config.withDefault("127.0.0.1"));
  const port = yield* Config.number("DATABASE_PORT").pipe(Config.withDefault(5432));
  const database = yield* Config.string("DATABASE_NAME").pipe(Config.withDefault("voidhash"));
  const user = yield* Config.string("DATABASE_USERNAME").pipe(Config.withDefault("voidhash"));
  const password = yield* Config.redacted("DATABASE_PASSWORD").pipe(
    Config.withDefault(Redacted.make("password")),
  );
  const origin: Cloudflare.Hyperdrive.PublicOrigin = {
    scheme: "postgres",
    host,
    port,
    database,
    user,
    password,
  };
  return origin;
})();

/**
 * Hyperdrive connection shared by the Community Worker and managed compositions.
 *
 * Live deployments read their origin from the `DATABASE_*` deployment
 * configuration. Alchemy development uses PGlite by default, while
 * `DATABASE_MODE=pg` selects that configured PostgreSQL origin. Either
 * connection is passed directly to the local Hyperdrive binding.
 */
export const DatabaseHyperdrive: Effect.Effect<Cloudflare.Hyperdrive.Connection, never, any> =
  Effect.fn("DatabaseHyperdrive")(function* () {
    if (globalThis.__ALCHEMY_RUNTIME__) return yield* runtimeReference;

    const context = yield* Effect.serviceOption(Alchemy.AlchemyContext);
    if (Option.isNone(context)) return yield* runtimeReference;

    if (context.value.dev) {
      const origin = yield* DevelopmentDatabase;
      return yield* Cloudflare.Hyperdrive.Connection(logicalId, {
        caching: { disabled: true },
        origin,
        dev: origin,
      });
    }

    const origin = yield* databaseOrigin.pipe(Effect.orDie);
    return yield* Cloudflare.Hyperdrive.Connection(logicalId, {
      caching: { disabled: true },
      origin,
    });
  })();
