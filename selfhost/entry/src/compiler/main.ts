import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { NodeRuntime } from "@effect/platform-node";
import { Effect, Schema, Semaphore } from "effect";

import { makeNodeComponentCompiler } from "./CompilerCore.ts";
import { CompilerRequest } from "./CompilerProtocol.ts";

const maximumBodyBytes = 1_048_576;
const compiler = makeNodeComponentCompiler();
const compilerPermits = Semaphore.makeUnsafe(2);
const decodeRequest = Schema.decodeUnknownEffect(CompilerRequest);

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

const readBody = (request: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    request.on("data", (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > maximumBodyBytes) {
        reject(new Error("compiler request exceeds 1 MiB"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "text/plain" }).end("OK");
    return;
  }
  if (request.method !== "POST" || request.url !== "/compile") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  try {
    const input = await readBody(request).then((body) =>
      Effect.runPromise(decodeRequest(body)),
    );
    const result = await Effect.runPromise(
      compilerPermits.withPermit(
        input.mode === "check"
          ? compiler.compileCheck(input.source)
          : compiler.compileAndExtract(input.source),
      ),
    );
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const port = Number(process.env.COMPILER_PORT ?? "5002");
const host = process.env.COMPILER_HOST?.trim() || "0.0.0.0";

NodeRuntime.runMain(
  Effect.scoped(
    Effect.acquireRelease(
      Effect.callback<Server, Error>((resume) => {
        const server = createServer((request, response) => {
          void handleRequest(request, response);
        });
        server.once("error", (error) => resume(Effect.fail(error)));
        server.listen(port, host, () => resume(Effect.succeed(server)));
      }),
      (server) =>
        Effect.callback<void>((resume) => {
          server.close(() => resume(Effect.void));
        }),
    ).pipe(
      Effect.tap(() => Effect.logInfo(`Component compiler listening on ${host}:${port}`)),
      Effect.andThen(Effect.never),
    ),
  ) as never,
);
