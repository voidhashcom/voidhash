import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const freePort = async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Could not allocate a port");
  const { port } = address;
  server.close();
  await once(server, "close");
  return port;
};

const waitFor = async (predicate, message, attempts = 150) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
};

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const output = [];
const persistTo = await mkdtemp(join(tmpdir(), "voidhash-agent-workerd-"));
const wrangler = spawn(
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
  { cwd: new URL("..", import.meta.url), stdio: ["ignore", "pipe", "pipe"] },
);
wrangler.stdout.on("data", (chunk) => output.push(String(chunk)));
wrangler.stderr.on("data", (chunk) => output.push(String(chunk)));

try {
  await waitFor(
    async () => {
      if (wrangler.exitCode !== null) {
        throw new Error(`wrangler exited early:\n${output.join("")}`);
      }
      try {
        return (await fetch(origin)).status === 426;
      } catch {
        return false;
      }
    },
    `Timed out starting workerd:\n${output.join("")}`,
  );

  const frames = [];
  const socket = new WebSocket(origin.replace("http", "ws"));
  socket.addEventListener("message", (event) => frames.push(JSON.parse(String(event.data))));
  await once(socket, "open");

  const prompt = (requestId, text) =>
    socket.send(JSON.stringify({ v: 1, type: "prompt", requestId, text }));
  prompt("turn-1", `first turn ${"🙂".repeat(45_000)}`);
  await waitFor(
    () => frames.some((frame) => frame.type === "event" && frame.event.type === "agent_start"),
    "Durable Object agent did not start streaming",
  );
  socket.send(JSON.stringify({ v: 1, type: "get_state", requestId: "streaming-state" }));
  await waitFor(
    () =>
      frames.some(
        (frame) =>
          frame.type === "state" &&
          frame.requestId === "streaming-state" &&
          frame.state.isStreaming === true,
      ),
    "Durable Object did not serve state while the agent stream was active",
  );
  socket.send(
    JSON.stringify({ v: 1, type: "steer", requestId: "steer-1", text: "change direction" }),
  );
  await waitFor(
    () =>
      frames.some(
        (frame) =>
          frame.type === "ack" && frame.requestId === "steer-1" && frame.command === "steer",
      ),
    "Durable Object did not accept steering while the agent stream was active",
  );
  await waitFor(
    () =>
      frames.filter((frame) => frame.type === "event" && frame.event.type === "agent_end").length >=
      1,
    "First Durable Object agent turn did not finish",
  );
  prompt("turn-2", "second turn");
  await waitFor(
    () =>
      frames.filter((frame) => frame.type === "event" && frame.event.type === "agent_end").length >=
      2,
    "Second Durable Object agent turn did not finish",
  );

  socket.send(JSON.stringify({ v: 1, type: "get_entries", requestId: "entries" }));
  await waitFor(
    () => frames.some((frame) => frame.type === "entries" && frame.requestId === "entries"),
    "Durable Object session entries were not returned",
  );

  const toolEnds = frames.filter(
    (frame) => frame.type === "event" && frame.event.type === "tool_execution_end",
  );
  if (toolEnds.length < 2) {
    throw new Error(`Expected at least two Effect tool executions, received ${toolEnds.length}`);
  }
  const completed = frames
    .filter((frame) => frame.type === "event" && frame.event.type === "message_end")
    .flatMap((frame) => frame.event.message?.content ?? [])
    .filter((content) => content.type === "text")
    .map((content) => content.text);
  if (completed.length < 2) {
    throw new Error(`Missing multi-turn assistant output: ${JSON.stringify(completed)}`);
  }
  const entries = frames.find((frame) => frame.type === "entries" && frame.requestId === "entries");
  if (!Array.isArray(entries?.entries) || entries.entries.length < 6) {
    throw new Error("Durable Object transcript did not persist both tool-calling turns");
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
    throw new Error("Durable Object transcript did not persist the in-stream steering message");
  }
  socket.close();
  process.stdout.write(
    `workerd Durable Object probe passed (${toolEnds.length} tool calls, ${entries.entries.length} entries)\n`,
  );
} finally {
  wrangler.kill("SIGTERM");
  await Promise.race([
    once(wrangler, "exit"),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (wrangler.exitCode === null) wrangler.kill("SIGKILL");
  await rm(persistTo, { force: true, recursive: true });
}
