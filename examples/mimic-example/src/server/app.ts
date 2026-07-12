import { Effect, Layer, Schedule } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { MimicSDK } from "@voidhash/mimic-server/effect";
import { MimicExampleSchema } from "../shared";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const HOST_URL = process.env.HOST_URL;
const HOST_USERNAME = process.env.HOST_USERNAME;
const HOST_PASSWORD = process.env.HOST_PASSWORD;

const DATABASE_NAME = "example";
const COLLECTION_NAME = "todos";
const DOCUMENT_ID = "kanban-board";

const sdk = new MimicSDK({
  url: HOST_URL ?? "http://localhost:5001",
  username: HOST_USERNAME ?? "root",
  password: HOST_PASSWORD ?? "password",
});

const ensureDatabase = Effect.gen(function* () {
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

const ensureCollection = (dbHandle: ReturnType<typeof sdk.database>) =>
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
  yield* Effect.log("Startup: ensuring database...");
  const dbHandle = yield* ensureDatabase;
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
            type: "board" as const,
            name: "My Board",
            children: [
              { type: "column" as const, name: "Todo", children: [] },
              { type: "column" as const, name: "In Progress", children: [] },
              { type: "column" as const, name: "Done", children: [] },
            ],
          },
        ],
        { id: DOCUMENT_ID },
      );
    }),
  );

  yield* Effect.log(`Ready: db=${dbHandle.id} col=${colHandle.id} doc=${DOCUMENT_ID}`);

  return { dbHandle, colHandle } as const;
}).pipe(
  Effect.tapCause((cause) => Effect.log(`Startup failed: ${cause}`)),
  Effect.retry(Schedule.exponential("1 second").pipe(Schedule.both(Schedule.recurs(15)))),
);

// ---------------------------------------------------------------------------
// HTTP routes
// ---------------------------------------------------------------------------

const TokenRoute = Layer.effectDiscard(
  Effect.gen(function* () {
    const { colHandle } = yield* startup;

    const router = yield* HttpRouter.HttpRouter;
    yield* router.add(
      "GET",
      "/api/token",
      Effect.gen(function* () {
        const { token, url } = yield* colHandle.setupDocumentAuthentication({
          documentId: DOCUMENT_ID,
          permission: "write",
          origins: corsAllowedOrigins(),
        });

        return yield* HttpServerResponse.json({
          token,
          url,
        });
      }),
    );
  }),
);

const corsAllowedOrigins = (): ReadonlyArray<string> => {
  const env = process.env.CORS_ORIGINS?.trim();
  if (!env) {
    return [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:4173",
      "http://localhost:4460",
      "http://localhost:3003",
    ];
  }
  return env.split(",").map((o) => o.trim());
};

const AllRoutes = Layer.mergeAll(TokenRoute).pipe(
  Layer.provide(
    HttpRouter.cors({
      allowedOrigins: corsAllowedOrigins(),
      credentials: true,
    }),
  ),
);

export const AppLive = HttpRouter.serve(AllRoutes);
