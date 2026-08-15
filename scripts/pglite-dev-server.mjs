import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { PGlite } from "@electric-sql/pglite";
import { NodeFS } from "@electric-sql/pglite/nodefs";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Clock, Config, Console, Effect, FileSystem, Path } from "effect";

const program = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const host = yield* Config.string("PGLITE_HOST").pipe(Config.withDefault("127.0.0.1"));
  const port = yield* Config.port("PGLITE_PORT").pipe(Config.withDefault(5432));
  const configuredDataDir = yield* Config.string("PGLITE_DATA_DIR").pipe(
    Config.withDefault(".pglite/dev"),
  );
  const dataDir = path.resolve(configuredDataDir);

  yield* fileSystem.makeDirectory(dataDir, { recursive: true });

  const database = yield* Effect.acquireRelease(
    Effect.sync(() => new PGlite({ fs: new NodeFS(dataDir) })).pipe(
      Effect.tap((database) => Effect.promise(() => database.waitReady)),
    ),
    (database) => Effect.promise(() => database.close()).pipe(Effect.ignore),
  );
  const server = yield* Effect.acquireRelease(
    Effect.succeed(
      new PGLiteSocketServer({
        db: database,
        host,
        port,
        maxConnections: 100,
      }),
    ),
    (server) => Effect.promise(() => server.stop()).pipe(Effect.ignore),
  );

  yield* Effect.promise(() => server.start());
  const started = yield* Clock.currentTimeMillis;
  yield* Console.log(`PGlite ready at http://${host}:${port}/?started=${started}`);
  return yield* Effect.never;
});

program.pipe(Effect.scoped, Effect.provide(NodeServices.layer), NodeRuntime.runMain);
