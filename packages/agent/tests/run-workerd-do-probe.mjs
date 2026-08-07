import { once } from "node:events";
import { createServer } from "node:net";

import { NodeRuntime, NodeServices, NodeSocket } from "@effect/platform-node";
import { Console, Effect, FileSystem, Layer, Path, Schema, Stream } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { ChildProcess } from "effect/unstable/process";
import { Socket } from "effect/unstable/socket";

const decodeFrame = Schema.decodeSync(Schema.fromJsonString(Schema.Unknown));
const encodeFrame = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

const freePort = Effect.gen(function* () {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  yield* Effect.promise(() => once(server, "listening"));
  const address = server.address();
  if (address === null || typeof address === "string") {
    return yield* Effect.die(new Error("Could not allocate a port"));
  }
  const { port } = address;
  server.close();
  yield* Effect.promise(() => once(server, "close"));
  return port;
});

const waitFor = (predicate, message, attempts = 150) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (yield* predicate()) return;
      yield* Effect.sleep("100 millis");
    }
    return yield* Effect.die(new Error(message));
  });

const probe = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const client = yield* HttpClient.HttpClient;
  const port = yield* freePort;
  const origin = `http://127.0.0.1:${port}`;
  const output = [];
  const persistTo = yield* fileSystem.makeTempDirectory({ prefix: "voidhash-agent-workerd-" });
  const wrangler = yield* ChildProcess.make(
    "pnpm",
    [
      "exec",
      "wrangler",
      "dev",
      "--config",
      "tests/wrangler-do-probe.jsonc",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--persist-to",
      persistTo,
    ],
    { cwd: path.join(import.meta.dirname, "..") },
  );
  yield* Effect.forkScoped(
    Effect.ignore(
      Stream.runForEach(Stream.decodeText(wrangler.all), (chunk) =>
        Effect.sync(() => output.push(chunk)),
      ),
    ),
  );

  // The wrangler dev process and its persistence directory outlive every
  // failure mode of the probe body below.
  const shutdown = Effect.gen(function* () {
    yield* Effect.ignore(wrangler.kill({ forceKillAfter: "2 seconds" }));
    yield* Effect.ignore(fileSystem.remove(persistTo, { force: true, recursive: true }));
  });

  yield* Effect.gen(function* () {
    yield* waitFor(
      () =>
        Effect.gen(function* () {
          if (!(yield* wrangler.isRunning)) {
            return yield* Effect.die(new Error(`wrangler exited early:\n${output.join("")}`));
          }
          return yield* Effect.orElseSucceed(
            Effect.map(client.get(origin), (response) => response.status === 426),
            () => false,
          );
        }),
      `Timed out starting workerd:\n${output.join("")}`,
    );

    const frames = [];
    const socket = yield* Socket.makeWebSocket(origin.replace("http", "ws"));
    yield* Effect.forkScoped(
      Effect.ignore(
        socket.runString((data) => Effect.sync(() => frames.push(decodeFrame(data)))),
      ),
    );
    const write = yield* socket.writer;
    const send = (message) => write(encodeFrame(message));

    const prompt = (requestId, text) => send({ v: 1, type: "prompt", requestId, text });
    yield* prompt("turn-1", `first turn ${"🙂".repeat(45_000)}`);
    yield* waitFor(
      () =>
        Effect.succeed(
          frames.some((frame) => frame.type === "event" && frame.event.type === "agent_start"),
        ),
      "Durable Object agent did not start streaming",
    );
    yield* send({ v: 1, type: "get_state", requestId: "streaming-state" });
    yield* waitFor(
      () =>
        Effect.succeed(
          frames.some(
            (frame) =>
              frame.type === "state" &&
              frame.requestId === "streaming-state" &&
              frame.state.isStreaming === true,
          ),
        ),
      "Durable Object did not serve state while the agent stream was active",
    );
    yield* send({ v: 1, type: "steer", requestId: "steer-1", text: "change direction" });
    yield* waitFor(
      () =>
        Effect.succeed(
          frames.some(
            (frame) =>
              frame.type === "ack" && frame.requestId === "steer-1" && frame.command === "steer",
          ),
        ),
      "Durable Object did not accept steering while the agent stream was active",
    );
    yield* waitFor(
      () =>
        Effect.succeed(
          frames.filter((frame) => frame.type === "event" && frame.event.type === "agent_end")
            .length >= 1,
        ),
      "First Durable Object agent turn did not finish",
    );
    yield* prompt("turn-2", "second turn");
    yield* waitFor(
      () =>
        Effect.succeed(
          frames.filter((frame) => frame.type === "event" && frame.event.type === "agent_end")
            .length >= 2,
        ),
      "Second Durable Object agent turn did not finish",
    );

    yield* send({ v: 1, type: "get_entries", requestId: "entries" });
    yield* waitFor(
      () =>
        Effect.succeed(
          frames.some((frame) => frame.type === "entries" && frame.requestId === "entries"),
        ),
      "Durable Object session entries were not returned",
    );

    const toolEnds = frames.filter(
      (frame) => frame.type === "event" && frame.event.type === "tool_execution_end",
    );
    if (toolEnds.length < 2) {
      return yield* Effect.die(
        new Error(`Expected at least two Effect tool executions, received ${toolEnds.length}`),
      );
    }
    const completed = frames
      .filter((frame) => frame.type === "event" && frame.event.type === "message_end")
      .flatMap((frame) => frame.event.message?.content ?? [])
      .filter((content) => content.type === "text")
      .map((content) => content.text);
    if (completed.length < 2) {
      return yield* Effect.die(
        new Error(`Missing multi-turn assistant output: ${encodeFrame(completed)}`),
      );
    }
    const entries = frames.find(
      (frame) => frame.type === "entries" && frame.requestId === "entries",
    );
    if (!Array.isArray(entries?.entries) || entries.entries.length < 6) {
      return yield* Effect.die(
        new Error("Durable Object transcript did not persist both tool-calling turns"),
      );
    }
    const persistedUserText = entries.entries
      .filter((entry) => entry.type === "message" && entry.message?.role === "user")
      .flatMap((entry) => {
        const content = entry.message.content;
        if (typeof content === "string") return [content];
        if (!Array.isArray(content)) return [];
        return content.filter((part) => part.type === "text").map((part) => part.text);
      });
    if (!persistedUserText.includes("change direction")) {
      return yield* Effect.die(
        new Error("Durable Object transcript did not persist the in-stream steering message"),
      );
    }
    yield* Effect.ignore(write(new Socket.CloseEvent(1000)));
    yield* Console.log(
      `workerd Durable Object probe passed (${toolEnds.length} tool calls, ${entries.entries.length} entries)`,
    );
  }).pipe(Effect.ensuring(shutdown));
});

NodeRuntime.runMain(
  probe.pipe(
    Effect.scoped,
    Effect.provide(
      Layer.mergeAll(
        NodeServices.layer,
        FetchHttpClient.layer,
        NodeSocket.layerWebSocketConstructor,
      ),
    ),
  ),
);
