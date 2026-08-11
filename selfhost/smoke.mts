import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Clock, Config, Console, Crypto, Data, Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

import { causeMessage, stringOr } from "../packages/lib/src/lang/index.ts";
import { Primitive } from "../packages/mimic-core/src/index.ts";
import { MimicSDK } from "../packages/mimic-server/src/index.ts";
import WebSocket from "ws";

class SmokeError extends Data.TaggedError("SmokeError")<{
  readonly message: string;
}> {}

const SocketMessage = Schema.Struct({
  type: Schema.optional(Schema.Unknown),
  version: Schema.optional(Schema.Unknown),
  value: Schema.optional(Schema.Unknown),
  success: Schema.optional(Schema.Unknown),
});

const AgentFrame = Schema.Struct({
  type: Schema.optional(Schema.Unknown),
  message: Schema.optional(Schema.Unknown),
  event: Schema.optional(
    Schema.NullOr(Schema.Struct({ type: Schema.optional(Schema.Unknown) })),
  ),
});

/** JSON text for WebSocket frames that were previously `JSON.stringify`d. */
const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

const decodeJson = Schema.decodeEffect(Schema.UnknownFromJsonString);
const decodeSocketMessage = Schema.decodeSync(Schema.fromJsonString(SocketMessage));
const decodeAgentFrame = Schema.decodeSync(Schema.fromJsonString(AgentFrame));

const envString = (name: string, fallback: string): Effect.Effect<string> =>
  Config.string(name).pipe(Config.withDefault(fallback), Effect.orDie);

/**
 * Decodes a `ws` frame payload, which arrives as a Buffer, an ArrayBuffer, or a
 * list of Buffers depending on how the server framed the message.
 */
const socketText = (data: WebSocket.RawData): string => {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  return Buffer.from(data).toString("utf8");
};

/** The snapshot version to base the smoke transaction on, defaulting to the first. */
const snapshotVersion = (version: unknown): number => {
  if (typeof version === "number") return version;
  return 1;
};

const isSuccessStatus = (status: number): boolean => status >= 200 && status <= 299;

const attempt = <A,>(label: string, run: () => Promise<A>): Effect.Effect<A, SmokeError> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new SmokeError({ message: `${label}: ${causeMessage(cause)}` }),
  });

/** Polls the health endpoint until the compose stack answers, mirroring the previous loop. */
const waitForHealth = (url: string) =>
  Effect.gen(function* () {
    const deadline = (yield* Clock.currentTimeMillis) + 60_000;
    while ((yield* Clock.currentTimeMillis) < deadline) {
      // The compose service may still be starting, so transport failures keep polling.
      const healthy = yield* HttpClient.get(`${url}/health`).pipe(
        Effect.map((response) => isSuccessStatus(response.status)),
        Effect.orElseSucceed(() => false),
      );
      if (healthy) return;
      yield* Effect.sleep("500 millis");
    }
    return yield* new SmokeError({ message: `Timed out waiting for ${url}/health` });
  });

const assertApplicationSurface = (url: string) =>
  Effect.gen(function* () {
    const capabilitiesResponse = yield* HttpClient.get(`${url}/api/runtime-capabilities`);
    const capabilitiesBody = yield* capabilitiesResponse.text;
    if (!isSuccessStatus(capabilitiesResponse.status)) {
      return yield* new SmokeError({
        message: `Runtime capabilities returned ${capabilitiesResponse.status}`,
      });
    }
    const capabilities = yield* decodeJson(capabilitiesBody);
    if (encodeJson(capabilities) !== encodeJson({ enterprise: {} })) {
      return yield* new SmokeError({
        message: `Unexpected Community capabilities: ${encodeJson(capabilities)}`,
      });
    }

    const wwwResponse = yield* HttpClient.get(`${url}/`);
    if (!isSuccessStatus(wwwResponse.status)) {
      return yield* new SmokeError({ message: `WWW returned ${wwwResponse.status}` });
    }
  });

/**
 * Authenticates over the mimic WebSocket transport, submits one edit, and
 * returns every frame the server sent so the caller can assert the handshake.
 */
const authenticateSocket = (
  socketUrl: string,
  token: string,
  transactionId: string,
): Effect.Effect<ReadonlyArray<typeof SocketMessage.Type>, SmokeError> =>
  Effect.callback<ReadonlyArray<typeof SocketMessage.Type>, SmokeError>((resume) => {
    const socket = new WebSocket(socketUrl);
    const messages: Array<typeof SocketMessage.Type> = [];
    socket.once("error", (cause) =>
      resume(Effect.fail(new SmokeError({ message: causeMessage(cause) }))),
    );
    socket.once("open", () => socket.send(encodeJson({ type: "auth", token })));
    socket.on("message", (data) => {
      const message = decodeSocketMessage(socketText(data));
      messages.push(message);
      if (message.type === "snapshot") {
        socket.send(
          encodeJson({
            type: "submit",
            transaction: {
              id: transactionId,
              baseVersion: snapshotVersion(message.version),
              commands: [{ kind: "value.set", path: [], value: message.value }],
            },
          }),
        );
      }
      if (message.type === "transaction") {
        socket.close(1000, "smoke complete");
        resume(Effect.succeed(messages));
      }
    });
    return Effect.sync(() => socket.close());
  }).pipe(
    Effect.timeoutOrElse({
      duration: "10 seconds",
      orElse: () =>
        Effect.fail(
          new SmokeError({ message: "Timed out waiting for the WebSocket transaction" }),
        ),
    }),
  );

/**
 * Exercises the durable agent WebSocket when the optional smoke credentials are
 * configured; otherwise it is a no-op.
 */
const smokeAgentSession = (url: string) =>
  Effect.gen(function* () {
    const platformCrypto = yield* Crypto.Crypto;
    const token = (yield* envString("SELFHOST_AGENT_SMOKE_BEARER_TOKEN", "")).trim();
    const organizationId = (
      yield* envString("SELFHOST_AGENT_SMOKE_ORGANIZATION_ID", "")
    ).trim();
    const projectId = (yield* envString("SELFHOST_AGENT_SMOKE_PROJECT_ID", "")).trim();
    if (!token && !organizationId && !projectId) return;
    if (!token || !organizationId || !projectId) {
      return yield* new SmokeError({
        message:
          "SELFHOST_AGENT_SMOKE_BEARER_TOKEN, SELFHOST_AGENT_SMOKE_ORGANIZATION_ID, and SELFHOST_AGENT_SMOKE_PROJECT_ID must be set together",
      });
    }
    const suffix = (yield* platformCrypto.randomUUIDv4).replaceAll("-", "");
    const sessionId = `agent_smoke_${suffix}`;
    const socketUrl = new URL(`/api/agent/sessions/${sessionId}/ws`, url.replace(/^http/, "ws"));
    socketUrl.searchParams.set("organizationId", organizationId);
    socketUrl.searchParams.set("projectId", projectId);
    socketUrl.searchParams.set("surface", "designer");
    const paywallId = (yield* envString("SELFHOST_AGENT_SMOKE_PAYWALL_ID", "")).trim();
    if (paywallId) socketUrl.searchParams.set("paywallId", paywallId);

    yield* Effect.callback<void, SmokeError>((resume) => {
      const socket = new WebSocket(socketUrl, {
        headers: { authorization: `Bearer ${token}` },
      });
      socket.once("error", (cause) =>
        resume(Effect.fail(new SmokeError({ message: causeMessage(cause) }))),
      );
      socket.once("open", () => {
        socket.send(
          encodeJson({
            v: 1,
            type: "prompt",
            requestId: "compose-agent-smoke",
            text: "Reply with a short confirmation without modifying anything.",
          }),
        );
      });
      socket.on("message", (data) => {
        const frame = decodeAgentFrame(socketText(data));
        if (frame.type === "error") {
          socket.close();
          resume(
            Effect.fail(
              new SmokeError({ message: stringOr(frame.message, "Agent session failed") }),
            ),
          );
        }
        if (frame.type === "event" && frame.event?.type === "agent_end") {
          socket.close(1000, "agent smoke complete");
          resume(Effect.void);
        }
      });
      return Effect.sync(() => socket.close());
    }).pipe(
      Effect.timeoutOrElse({
        duration: "60 seconds",
        orElse: () =>
          Effect.fail(
            new SmokeError({ message: "Timed out waiting for the durable agent round-trip" }),
          ),
      }),
    );
  });

const program = Effect.gen(function* () {
  const platformCrypto = yield* Crypto.Crypto;

  const url = yield* envString("MIMIC_URL", "http://127.0.0.1:5001");
  const username = yield* envString("MIMIC_ROOT_USERNAME", "root");
  const password = yield* envString("MIMIC_ROOT_PASSWORD", "password");

  yield* waitForHealth(url);
  yield* assertApplicationSurface(url);

  const sdk = new MimicSDK({ url, username, password });
  const databaseSuffix = yield* platformCrypto.randomUUIDv4;
  const database = yield* attempt("Create database", () =>
    sdk.createDatabase({
      name: `compose-smoke-${databaseSuffix}`,
      description: "self-host compose smoke",
    }),
  );
  const documentShape = () => Primitive.Struct({ title: Primitive.String().required() });
  let collectionId: string | undefined;
  let documentId: string | undefined;

  const smoke = Effect.gen(function* () {
    const collection = yield* attempt("Create collection", () =>
      database.createCollection("documents", documentShape()),
    );
    collectionId = collection.id;
    const document = yield* attempt("Create document", () =>
      collection.create({ title: "compose is live" }),
    );
    documentId = document.id;
    const authentication = yield* attempt("Set up document authentication", () =>
      collection.setupDocumentAuthentication({
        documentId: document.id,
        permission: "write",
        origins: [],
        expiresInSeconds: 60,
      }),
    );
    const transactionId = `smoke-${yield* platformCrypto.randomUUIDv4}`;
    const messages = yield* authenticateSocket(
      authentication.url,
      authentication.token,
      transactionId,
    );
    const authenticated = messages.some(
      (message) => message.type === "auth_result" && message.success === true,
    );
    const snapshot = messages.some((message) => message.type === "snapshot");
    const transaction = messages.some((message) => message.type === "transaction");
    if (!authenticated || !snapshot || !transaction) {
      return yield* new SmokeError({
        message: "WebSocket authentication, snapshot, or transaction message was missing",
      });
    }
    yield* smokeAgentSession(url);
    yield* Console.log("Self-host compose smoke passed");
  });

  const cleanup = Effect.gen(function* () {
    const createdCollectionId = collectionId;
    if (createdCollectionId) {
      const collection = database.collection(createdCollectionId, documentShape());
      const createdDocumentId = documentId;
      if (createdDocumentId) {
        yield* attempt("Delete document", () => collection.delete(createdDocumentId));
      }
      yield* attempt("Delete collection", () =>
        database.deleteCollection(createdCollectionId),
      );
    }
    yield* attempt("Delete database", () => sdk.deleteDatabase(database.id));
    yield* attempt("Dispose the mimic SDK", () => sdk.dispose());
  }).pipe(Effect.orDie);

  yield* smoke.pipe(Effect.ensuring(cleanup));
});

NodeRuntime.runMain(program.pipe(Effect.provide([NodeServices.layer, FetchHttpClient.layer])));
