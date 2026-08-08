// oxlint-disable-next-line effect/noNodeBuiltinImport -- the created server value is handed to the `@effect/platform-node` HTTP adapter, which requires a real `node:http` Server instance.
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { NodeRuntime } from "@effect/platform-node";
import { causeMessage } from "@voidhash/lib/lang";
import { Cause, Config, Data, Effect, Schema, Semaphore } from "effect";

import { makeNodeComponentCompiler } from "./CompilerCore.ts";
import { CompilerRequest } from "./CompilerProtocol.ts";

const maximumBodyBytes = 1_048_576;
const compiler = makeNodeComponentCompiler();
const compilerPermits = Semaphore.makeUnsafe(2);
const decodeRequest = Schema.decodeUnknownEffect(CompilerRequest);
const decodeJson = Schema.decodeUnknownEffect(Schema.UnknownFromJsonString);
const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

class CompilerBodyError extends Data.TaggedError("CompilerBodyError")<{
  readonly message: string;
}> {}

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(encodeJson(body));
};

const readBody = (request: IncomingMessage): Effect.Effect<unknown, CompilerBodyError> =>
  Effect.callback<unknown, CompilerBodyError>((resume) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    request.on("data", (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > maximumBodyBytes) {
        resume(
          Effect.fail(new CompilerBodyError({ message: "compiler request exceeds 1 MiB" })),
        );
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      resume(
        decodeJson(Buffer.concat(chunks).toString("utf8")).pipe(
          Effect.mapError((cause) => new CompilerBodyError({ message: causeMessage(cause) })),
        ),
      );
    });
    request.on("error", (error) => {
      resume(Effect.fail(new CompilerBodyError({ message: causeMessage(error) })));
    });
  });

const compileRequest = (input: typeof CompilerRequest.Type) => {
  if (input.mode === "check") return compiler.compileCheck(input.source);
  return compiler.compileAndExtract(input.source);
};

const handleRequest = (
  request: IncomingMessage,
  response: ServerResponse,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "text/plain" }).end("OK");
      return;
    }
    if (request.method !== "POST" || request.url !== "/compile") {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    const body = yield* readBody(request);
    const input = yield* decodeRequest(body);
    const result = yield* compilerPermits.withPermit(compileRequest(input));
    sendJson(response, 200, result);
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        sendJson(response, 500, { error: causeMessage(Cause.squash(cause)) });
      }),
    ),
  );

NodeRuntime.runMain(
  Effect.scoped(
    Effect.gen(function* () {
      const port = yield* Config.port("COMPILER_PORT").pipe(
        Config.withDefault(5002),
        Effect.orDie,
      );
      const configuredHost = yield* Config.string("COMPILER_HOST").pipe(
        Config.withDefault("0.0.0.0"),
        Effect.orDie,
      );
      const host = configuredHost.trim() || "0.0.0.0";

      return yield* Effect.acquireRelease(
        Effect.callback<Server, Error>((resume) => {
          const server = createServer((request, response) => {
            Effect.runFork(handleRequest(request, response));
          });
          server.once("error", (error) => resume(Effect.fail(error)));
          server.listen(port, host, () => resume(Effect.succeed(server)));
        }),
        (server) =>
          Effect.callback<void>((resume) => {
            server.close(() => resume(Effect.void));
          }),
      ).pipe(
        Effect.tap(() =>
          Effect.logInfo(`Component compiler listening on ${host}:${port}`),
        ),
        Effect.andThen(Effect.never),
      );
    }),
  ),
);
