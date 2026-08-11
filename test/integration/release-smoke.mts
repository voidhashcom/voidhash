import { fileURLToPath } from "node:url";

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Clock, Config, Console, Crypto, Data, DateTime, Effect, Schema, Stream } from "effect";
import { FetchHttpClient, HttpBody, HttpClient } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { causeMessage } from "../../packages/lib/src/lang/index.ts";
import {
  createInitialPaywallDocumentInput,
  PaywallDesignerDocument,
} from "../../packages/mimic-schema/src/index.ts";
import { MimicSDK } from "../../packages/mimic-server/src/index.ts";
import WebSocket from "ws";

const socketText = (data: Buffer | ArrayBuffer | Buffer[]): string => {
  if (Array.isArray(data)) return data.map((chunk) => chunk.toString()).join("");
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  return data.toString();
};

class ReleaseSmokeError extends Data.TaggedError("ReleaseSmokeError")<{
  readonly message: string;
}> {}

const PublishedRelease = Schema.Struct({
  htmlUrl: Schema.String,
  releaseId: Schema.String,
  version: Schema.Number,
});

const PublishedReleaseResult = Schema.Struct({
  draft: Schema.Struct({
    releaseId: Schema.String,
    version: Schema.Number,
  }),
  published: PublishedRelease,
});

const ResolvedPaywall = Schema.NullOr(
  Schema.Struct({
    location: Schema.optional(Schema.Struct({ slug: Schema.optional(Schema.String) })),
    showing: Schema.optional(
      Schema.Struct({ paywallRelease: Schema.optional(Schema.NullOr(PublishedRelease)) }),
    ),
  }),
);

const CaptureResult = Schema.Struct({
  accepted: Schema.Number,
  rejected: Schema.Number,
});

const SocketMessage = Schema.Struct({
  type: Schema.optional(Schema.String),
  version: Schema.optional(Schema.Number),
});

/** JSON text for request bodies and WebSocket frames that were previously `JSON.stringify`d. */
const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

const decodePublishedReleaseResult = Schema.decodeEffect(
  Schema.fromJsonString(PublishedReleaseResult),
);
const decodeResolvedPaywall = Schema.decodeEffect(Schema.fromJsonString(ResolvedPaywall));
const decodeCaptureResult = Schema.decodeEffect(Schema.fromJsonString(CaptureResult));
const decodeSocketMessage = Schema.decodeSync(Schema.fromJsonString(SocketMessage));

const envString = (name: string, fallback: string): Effect.Effect<string> =>
  Config.string(name).pipe(Config.withDefault(fallback), Effect.orDie);

const quoteSql = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const tupleOnlyFlags = (tuplesOnly: boolean): ReadonlyArray<string> => {
  if (tuplesOnly) return ["-A", "-t"];
  return [];
};

/**
 * Runs a command to completion, returning its standard output and failing when
 * the command exits with a non-zero status, mirroring `execFileSync`.
 */
const runCommand = (command: string, args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(ChildProcess.make(command, args));
    const [stdout, stderr] = yield* Effect.all(
      [
        Stream.mkString(Stream.decodeText(handle.stdout)),
        Stream.mkString(Stream.decodeText(handle.stderr)),
      ],
      { concurrency: 2 },
    );
    const exitCode = yield* handle.exitCode;
    if (exitCode !== 0) {
      return yield* new ReleaseSmokeError({
        message: `${command} exited with ${exitCode}: ${stderr}`,
      });
    }
    return stdout;
  }).pipe(Effect.scoped);

/**
 * Polls `load` until it produces a value or the timeout elapses, replacing the
 * previous `Date.now()`/`setTimeout` polling loop.
 */
const waitFor = <A, E, R>(
  load: Effect.Effect<A | undefined, E, R>,
  message: string,
  timeoutMs = 30_000,
): Effect.Effect<A, E | ReleaseSmokeError, R> =>
  Effect.gen(function* () {
    const deadline = (yield* Clock.currentTimeMillis) + timeoutMs;
    while ((yield* Clock.currentTimeMillis) < deadline) {
      const value = yield* load;
      if (value !== undefined) return value;
      yield* Effect.sleep("250 millis");
    }
    return yield* new ReleaseSmokeError({ message });
  });

const attempt = <A,>(label: string, run: () => Promise<A>): Effect.Effect<A, ReleaseSmokeError> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new ReleaseSmokeError({ message: `${label}: ${causeMessage(cause)}` }),
  });

/**
 * Submits a single document edit over the mimic WebSocket transport and resolves
 * once the server acknowledges the transaction.
 */
const submitEdit = (
  socketUrl: string,
  token: string,
  transactionId: string,
  value: unknown,
): Effect.Effect<void, ReleaseSmokeError> =>
  Effect.callback<void, ReleaseSmokeError>((resume) => {
    const socket = new WebSocket(socketUrl);
    socket.once("error", (cause) =>
      resume(Effect.fail(new ReleaseSmokeError({ message: causeMessage(cause) }))),
    );
    socket.once("open", () => socket.send(encodeJson({ type: "auth", token })));
    socket.on("message", (data) => {
      const message = decodeSocketMessage(socketText(data));
      if (message.type === "snapshot") {
        socket.send(
          encodeJson({
            type: "submit",
            transaction: {
              id: transactionId,
              baseVersion: message.version ?? 1,
              commands: [{ kind: "value.set", path: [], value }],
            },
          }),
        );
      }
      if (message.type === "transaction") {
        socket.close(1000, "release smoke edit complete");
        resume(Effect.void);
      }
    });
    return Effect.sync(() => socket.close());
  }).pipe(
    Effect.timeoutOrElse({
      duration: "10 seconds",
      orElse: () =>
        Effect.fail(
          new ReleaseSmokeError({ message: "Timed out waiting for the paywall transaction" }),
        ),
    }),
  );

const program = Effect.gen(function* () {
  const platformCrypto = yield* Crypto.Crypto;

  const url = yield* envString("MIMIC_URL", "http://127.0.0.1:5001");
  const username = yield* envString("MIMIC_ROOT_USERNAME", "root");
  const password = yield* envString("MIMIC_ROOT_PASSWORD", "password");
  const databaseUsername = yield* envString("DATABASE_USERNAME", "voidhash");
  const databaseName = yield* envString("DATABASE_NAME", "voidhash");

  const composeFile = fileURLToPath(new URL("./docker-compose.yml", import.meta.url));
  const suffix = yield* platformCrypto.randomUUIDv4;
  const projectId = `project_release_smoke_${suffix}`;
  const paywallId = suffix;
  const apiKeyId = `api_key_release_smoke_${suffix}`;
  const apiKey = `vh_pk_${suffix.replaceAll("-", "")}`;
  const locationId = `location_release_smoke_${suffix}`;
  const locationSlug = `release-smoke-${suffix}`;
  const showingId = `showing_release_smoke_${suffix}`;
  const releaseUserId = `user_release_smoke_${suffix}`;

  const runPostgres = (sql: string, tuplesOnly = false) =>
    runCommand("docker", [
      "compose",
      "-f",
      composeFile,
      "exec",
      "-T",
      "postgres",
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      ...tupleOnlyFlags(tuplesOnly),
      "-U",
      databaseUsername,
      "-d",
      databaseName,
      "-c",
      sql,
    ]).pipe(Effect.map((output) => output.trim()));

  const publishRelease = Effect.gen(function* () {
    const output = yield* runCommand("docker", [
      "compose",
      "-f",
      composeFile,
      "exec",
      "-T",
      "-e",
      `SELFHOST_RELEASE_PAYWALL_ID=${paywallId}`,
      "-e",
      `SELFHOST_RELEASE_PROJECT_ID=${projectId}`,
      "-e",
      `SELFHOST_RELEASE_USER_ID=${releaseUserId}`,
      "app",
      "./node_modules/.bin/tsx",
      "src/release-smoke.ts",
    ]);
    const prefix = "SELFHOST_RELEASE_RESULT ";
    const resultLine = output.split(/\r?\n/).find((line) => line.startsWith(prefix));
    if (!resultLine) {
      return yield* new ReleaseSmokeError({
        message: `Release publisher returned no result: ${output}`,
      });
    }
    return yield* decodePublishedReleaseResult(resultLine.slice(prefix.length));
  });

  const resolvePaywallThroughSdk = Effect.gen(function* () {
    const response = yield* HttpClient.post(`${url}/api/v1/sdk/resolve-paywall`, {
      body: HttpBody.jsonUnsafe({ locationSlug }),
      headers: {
        "x-client-bundle-id": "com.voidhash.selfhost-release-smoke",
        "x-distinct-id": `person_release_smoke_${suffix}`,
        "x-is-backgrounded": "false",
        "x-is-debug-build": "true",
        "x-observer-mode": "false",
        "x-platform": "ios",
        "x-platform-flavor": "native",
        "x-publishable-key": apiKey,
        "x-sdk": "react-native",
        "x-sdk-version": "selfhost-release-smoke",
      },
    });
    const body = yield* response.text;
    if (response.status < 200 || response.status > 299) {
      return yield* new ReleaseSmokeError({
        message: `SDK paywall resolve returned ${response.status}: ${body}`,
      });
    }
    const resolved = yield* decodeResolvedPaywall(body);
    const published = resolved?.showing?.paywallRelease;
    if (resolved?.location?.slug !== locationSlug || !published) {
      return yield* new ReleaseSmokeError({
        message: `SDK resolved an unexpected paywall: ${body}`,
      });
    }
    return published;
  });

  const countCapturedEvents = runPostgres(
    `SELECT count(*) FROM analytics_event WHERE project_id = ${quoteSql(projectId)}`,
    true,
  ).pipe(Effect.map(Number));

  const sdk = new MimicSDK({ url, username, password });
  let paywallDocumentCreated = false;

  const smoke = Effect.gen(function* () {
    yield* runPostgres(`
    INSERT INTO project (id, name, organization_id, slug)
    VALUES (${quoteSql(projectId)}, 'Release smoke', ${quoteSql(
      `organization_release_smoke_${suffix}`,
    )}, ${quoteSql(`release-smoke-${suffix}`)});
    INSERT INTO paywall (id, name, project_id, slug)
    VALUES (${quoteSql(paywallId)}, 'Release smoke paywall', ${quoteSql(
      projectId,
    )}, ${quoteSql(`release-smoke-${suffix}`)});
    INSERT INTO api_key (id, name, "end", key, prefix, is_public, project_id)
    VALUES (${quoteSql(apiKeyId)}, 'Release smoke', ${quoteSql(
      apiKey.slice(-4),
    )}, ${quoteSql(apiKey)}, 'vh_pk_', true, ${quoteSql(projectId)});
  `);

    const databases = yield* attempt("List databases", () => sdk.listDatabases());
    const databaseInfo = databases.find((database) => database.name === "voidhash");
    const database = yield* Effect.suspend(() => {
      if (databaseInfo === undefined) {
        return attempt("Create database", () =>
          sdk.createDatabase({
            description: "Voidhash paywall documents",
            name: "voidhash",
          }),
        );
      }
      return Effect.succeed(
        sdk.database(databaseInfo.id, databaseInfo.name, databaseInfo.description),
      );
    });
    const collections = yield* attempt("List collections", () => database.listCollections());
    const collectionInfo = collections.find((candidate) => candidate.name === "paywalls");
    const collection = yield* Effect.suspend(() => {
      if (collectionInfo === undefined) {
        return attempt("Create collection", () =>
          database.createCollection("paywalls", PaywallDesignerDocument),
        );
      }
      return Effect.succeed(database.collection(collectionInfo.id, PaywallDesignerDocument));
    });
    const initial = createInitialPaywallDocumentInput();
    yield* attempt("Create paywall document", () => collection.create(initial, { id: paywallId }));
    paywallDocumentCreated = true;
    const authentication = yield* attempt("Set up document authentication", () =>
      collection.setupDocumentAuthentication({
        documentId: paywallId,
        expiresInSeconds: 60,
        origins: [],
        permission: "write",
      }),
    );
    const transactionId = `release-smoke-${yield* platformCrypto.randomUUIDv4}`;
    yield* submitEdit(
      authentication.url,
      authentication.token,
      transactionId,
      PaywallDesignerDocument.encode([
        {
          ...initial[0],
          name: "Release smoke paywall — edited live",
        },
      ]),
    );

    const thumbnailUrl = yield* waitFor(
      runPostgres(
        `SELECT thumbnail_url FROM paywall WHERE id = ${quoteSql(paywallId)};`,
        true,
      ).pipe(Effect.map((value) => value || undefined)),
      "Timed out waiting for the paywall thumbnail",
      45_000,
    );
    const thumbnail = yield* HttpClient.get(thumbnailUrl);
    if (thumbnail.status < 200 || thumbnail.status > 299) {
      return yield* new ReleaseSmokeError({
        message: `Paywall thumbnail returned ${thumbnail.status}`,
      });
    }
    const thumbnailContentType = thumbnail.headers["content-type"];
    if (thumbnailContentType !== "image/png") {
      return yield* new ReleaseSmokeError({
        message: `Unexpected thumbnail content type: ${thumbnailContentType}`,
      });
    }
    const png = new Uint8Array(yield* thumbnail.arrayBuffer);
    if (
      png.length < 8 ||
      ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => png[index] === byte)
    ) {
      return yield* new ReleaseSmokeError({ message: "Paywall thumbnail is not a PNG" });
    }

    const release = yield* publishRelease;
    if (
      release.draft.releaseId === release.published.releaseId ||
      release.draft.version !== 1 ||
      release.published.version !== 1
    ) {
      return yield* new ReleaseSmokeError({
        message: `Unexpected release result: ${encodeJson(release)}`,
      });
    }
    yield* runPostgres(`
    INSERT INTO paywall_location (id, project_id, slug, name)
    VALUES (${quoteSql(locationId)}, ${quoteSql(projectId)}, ${quoteSql(
      locationSlug,
    )}, 'Release smoke location');
    INSERT INTO paywall_location_showing (
      id, project_id, paywall_location_id, type, paywall_id,
      paywall_release_id, started_at, created_by_user_id
    ) VALUES (
      ${quoteSql(showingId)}, ${quoteSql(projectId)}, ${quoteSql(locationId)}, 1,
      ${quoteSql(paywallId)}, ${quoteSql(release.published.releaseId)}, NOW(),
      ${quoteSql(releaseUserId)}
    );
  `);
    const sdkRelease = yield* resolvePaywallThroughSdk;
    if (
      sdkRelease.releaseId !== release.published.releaseId ||
      sdkRelease.htmlUrl !== release.published.htmlUrl ||
      sdkRelease.version !== release.published.version
    ) {
      return yield* new ReleaseSmokeError({
        message: `SDK release did not match the published release: ${encodeJson(sdkRelease)}`,
      });
    }
    const publishedHtml = yield* HttpClient.get(sdkRelease.htmlUrl);
    const publishedBody = yield* publishedHtml.text;
    if (publishedHtml.status < 200 || publishedHtml.status > 299) {
      return yield* new ReleaseSmokeError({
        message: `Published paywall returned ${publishedHtml.status}: ${publishedBody}`,
      });
    }
    if (!publishedBody.includes("Release smoke paywall — edited live")) {
      return yield* new ReleaseSmokeError({
        message: "Published paywall did not contain the live-edited document",
      });
    }

    const sentAt = (yield* DateTime.nowAsDate).toISOString();
    const capture = yield* HttpClient.post(`${url}/i/v1/capture`, {
      body: HttpBody.jsonUnsafe({
        context: { runtime: "selfhost" },
        distinct_id: `person_release_smoke_${suffix}`,
        event: "$app_opened",
        properties: { paywall_id: paywallId },
        sent_at: sentAt,
        timestamp: sentAt,
        token: apiKey,
        uuid: `event_release_smoke_${suffix}`,
      }),
    });
    const captureBody = yield* capture.text;
    if (capture.status !== 202) {
      return yield* new ReleaseSmokeError({
        message: `Event capture returned ${capture.status}: ${captureBody}`,
      });
    }
    const result = yield* decodeCaptureResult(captureBody);
    if (result.accepted !== 1 || result.rejected !== 0) {
      return yield* new ReleaseSmokeError({
        message: `Unexpected event capture response: ${captureBody}`,
      });
    }
    yield* waitFor(
      countCapturedEvents.pipe(
        Effect.map((total) => {
          if (total > 0) return true;
          return undefined;
        }),
      ),
      "Timed out waiting for the analytics event in PostgreSQL",
    );

    yield* Console.log("Self-host release smoke passed");
  });

  const cleanup = Effect.gen(function* () {
    if (!paywallDocumentCreated) return;
    const databases = yield* attempt("List databases", () => sdk.listDatabases());
    const databaseInfo = databases.find((database) => database.name === "voidhash");
    if (!databaseInfo) return;
    const database = sdk.database(databaseInfo.id, databaseInfo.name, databaseInfo.description);
    const collections = yield* attempt("List collections", () => database.listCollections());
    const collectionInfo = collections.find((candidate) => candidate.name === "paywalls");
    if (!collectionInfo) return;
    yield* attempt("Delete paywall document", () =>
      database.collectionRaw(collectionInfo.id).deleteDocument(paywallId),
    );
  }).pipe(
    Effect.ensuring(
      Effect.gen(function* () {
        yield* attempt("Dispose the mimic SDK", () => sdk.dispose());
        yield* runPostgres(`
      DELETE FROM paywall_location_showing WHERE id = ${quoteSql(showingId)};
      DELETE FROM paywall_location WHERE id = ${quoteSql(locationId)};
      DELETE FROM paywall_release WHERE paywall_id = ${quoteSql(paywallId)};
      DELETE FROM api_key WHERE id = ${quoteSql(apiKeyId)};
      DELETE FROM person_identity WHERE project_id = ${quoteSql(projectId)};
      DELETE FROM person WHERE project_id = ${quoteSql(projectId)};
      DELETE FROM paywall WHERE id = ${quoteSql(paywallId)};
      DELETE FROM project WHERE id = ${quoteSql(projectId)};
      -- The cluster queue driver hands the store a JSON string, which the store
      -- then JSON-encodes into the element column, so the body is doubly
      -- encoded: unwrap the outer JSON scalar with #>> '{}' before reading the
      -- payload's fields.
      DELETE FROM effect_queue
      WHERE (element::jsonb #>> '{}')::jsonb -> 'envelope' ->> 'projectId' = ${quoteSql(projectId)}
         OR (element::jsonb #>> '{}')::jsonb ->> 'documentId' = ${quoteSql(paywallId)};
    `);
      }).pipe(Effect.orDie),
    ),
    Effect.orDie,
  );

  yield* smoke.pipe(Effect.ensuring(cleanup));
});

NodeRuntime.runMain(program.pipe(Effect.provide([NodeServices.layer, FetchHttpClient.layer])));
