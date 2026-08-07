import { Cause, Config, Effect, Layer, Schedule } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { MimicSDK } from "@voidhash/mimic-server/effect";
import { MimicExampleSchema } from "../shared";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATABASE_NAME = "example";
const COLLECTION_NAME = "todos";
const DOCUMENT_ID = "kanban-board";

const makeSdk = Effect.gen(function* () {
  const url = yield* Config.string("HOST_URL").pipe(Config.withDefault("http://localhost:5001"));
  const username = yield* Config.string("HOST_USERNAME").pipe(Config.withDefault("root"));
  const password = yield* Config.string("HOST_PASSWORD").pipe(Config.withDefault("password"));

  return new MimicSDK({ url, username, password });
});

const ensureDatabase = (sdk: MimicSDK) =>
  Effect.gen(function* () {
    const databases = yield* sdk.listDatabases();
    const existingDb = databases.find((database) => database.name === DATABASE_NAME);
    if (existingDb) {
      return sdk.database(existingDb.id, existingDb.name, existingDb.description);
    }
    return yield* sdk.createDatabase({
      name: DATABASE_NAME,
      description: "Example mimic database",
    });
  });

const ensureCollection = (dbHandle: ReturnType<MimicSDK["database"]>) =>
  Effect.gen(function* () {
    const collections = yield* dbHandle.listCollections();
    const existingCollection = collections.find(
      (collection) => collection.name === COLLECTION_NAME,
    );
    if (existingCollection) {
      return dbHandle.collection(existingCollection.id, MimicExampleSchema);
    }
    return yield* dbHandle.createCollection(COLLECTION_NAME, MimicExampleSchema);
  });

const startup = Effect.gen(function* () {
  const sdk = yield* makeSdk;

  yield* Effect.log("Startup: ensuring database...");
  const dbHandle = yield* ensureDatabase(sdk);
  yield* Effect.log(`Startup: db=${dbHandle.id}`);

  yield* Effect.log("Startup: ensuring collection...");
  const colHandle = yield* ensureCollection(dbHandle);
  yield* Effect.log(`Startup: col=${colHandle.id}`);

  // Seed default document if missing
  yield* Effect.log("Startup: checking document...");
  yield* colHandle.get(DOCUMENT_ID).pipe(
    Effect.tap(() => Effect.log("Startup: document exists")),
    Effect.catch(() => {
      return colHandle.create(
        [
          {
            type: "board",
            name: "My Board",
            children: [
              { type: "column", name: "Todo", children: [] },
              { type: "column", name: "In Progress", children: [] },
              { type: "column", name: "Done", children: [] },
            ],
          },
        ],
        { id: DOCUMENT_ID },
      );
    }),
  );

  yield* Effect.log(`Ready: db=${dbHandle.id} col=${colHandle.id} doc=${DOCUMENT_ID}`);

  return { dbHandle, colHandle };
}).pipe(
  Effect.tapCause((cause) => Effect.log(`Startup failed: ${Cause.pretty(cause)}`)),
  Effect.retry(Schedule.exponential("1 second").pipe(Schedule.upTo({ times: 15 }))),
);

// ---------------------------------------------------------------------------
// HTTP routes
// ---------------------------------------------------------------------------

const DEFAULT_CORS_ORIGINS: ReadonlyArray<string> = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://localhost:4460",
  "http://localhost:3003",
];

const corsAllowedOrigins = Effect.gen(function* () {
  const configured = yield* Config.string("CORS_ORIGINS").pipe(Config.withDefault(""));
  const trimmed = configured.trim();
  if (!trimmed) {
    return DEFAULT_CORS_ORIGINS;
  }
  return trimmed.split(",").map((o) => o.trim());
});

const TokenRoute = Layer.effectDiscard(
  Effect.gen(function* () {
    const { colHandle } = yield* startup;
    const origins = yield* corsAllowedOrigins;

    const router = yield* HttpRouter.HttpRouter;
    yield* router.add(
      "GET",
      "/api/token",
      Effect.gen(function* () {
        const { token, url } = yield* colHandle.setupDocumentAuthentication({
          documentId: DOCUMENT_ID,
          permission: "write",
          origins,
        });

        return yield* HttpServerResponse.json({
          token,
          url,
        });
      }),
    );
  }),
);

const CorsLive = Layer.unwrap(
  Effect.gen(function* () {
    const allowedOrigins = yield* corsAllowedOrigins;
    return HttpRouter.cors({
      allowedOrigins,
      credentials: true,
    });
  }),
);

const AllRoutes = Layer.mergeAll(TokenRoute).pipe(Layer.provide(CorsLive));

export const AppLive = HttpRouter.serve(AllRoutes);
