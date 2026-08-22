#!/usr/bin/env node

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect, Exit, FileSystem, Path, Runtime, Schema, Stdio, Stream } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

/** Any failure that should abort the generator with a non-zero exit code. */
class GenerateError extends Data.TaggedError("GenerateError") {}

/**
 * Only the `paths` map is inspected, so the rest of the document is decoded as
 * an opaque record rather than modelled in full.
 */
const OpenApiSpec = Schema.fromJsonString(
  Schema.Struct({
    paths: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  }),
);

const decodeSpec = Schema.decodeUnknownEffect(OpenApiSpec);

/**
 * Turns a bare host (`localhost:8787`, `api.voidhash.com`) into an absolute URL,
 * defaulting to plaintext for loopback hosts and TLS everywhere else.
 *
 * @param {string} host
 */
const normalizeHost = (host) => {
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return new URL(host).toString();
  }

  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    return new URL(`http://${host}`).toString();
  }

  return new URL(`https://${host}`).toString();
};

/**
 * Downloads a spec as text, failing when the host answers with a non-2xx status.
 *
 * @param {string} url
 */
const fetchText = (url) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.get(url);
    if (response.status < 200 || response.status >= 300) {
      return yield* new GenerateError({ message: `Failed to fetch ${url}: ${response.status}` });
    }
    return yield* response.text;
  }).pipe(Effect.mapError((cause) => new GenerateError({ message: String(cause) })));

/**
 * @param {string} text
 * @param {string} label
 * @param {(paths: Array<string>) => boolean} isValid
 * @param {string} problem
 */
const assertSpec = (text, label, isValid, problem) =>
  Effect.gen(function* () {
    const spec = yield* decodeSpec(text).pipe(
      Effect.mapError(
        (cause) => new GenerateError({ message: `The ${label} OpenAPI schema is not valid JSON.`, cause }),
      ),
    );
    if (isValid(Object.keys(spec.paths ?? {}))) return;
    return yield* new GenerateError({ message: problem });
  });

/**
 * Runs a command from the repo root, capturing its output. On failure the child's
 * stderr and stdout are relayed verbatim and the generator exits with its code.
 *
 * @param {string} repoRoot
 * @param {string} command
 * @param {Array<string>} args
 */
const run = (repoRoot, command, args) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(
      ChildProcess.make(command, args, { cwd: repoRoot, stdout: "pipe", stderr: "pipe" }),
    );
    // stdout, stderr and the exit code are collected together: reading either
    // stream to completion before waiting on the other can deadlock on a child
    // that fills the opposite pipe's buffer.
    const [stdout, stderr, code] = yield* Effect.all(
      [
        Stream.mkString(Stream.decodeText(handle.stdout)),
        Stream.mkString(Stream.decodeText(handle.stderr)),
        handle.exitCode,
      ],
      { concurrency: "unbounded" },
    );
    if (Number(code) !== 0) {
      const stdio = yield* Stdio.Stdio;
      yield* Stream.make(stderr).pipe(Stream.run(stdio.stderr({ endOnDone: false })));
      yield* Stream.make(stdout).pipe(Stream.run(stdio.stdout({ endOnDone: false })));
      return yield* new ChildFailed({ code: Number(code) });
    }
    return stdout;
  }).pipe(Effect.scoped);

/** Carries a child process's own exit code up to the teardown handler. */
class ChildFailed extends Data.TaggedError("ChildFailed") {}

const USAGE =
  "Usage: node ./scripts/generate-openapi-clients.mjs <host>\nExample: node ./scripts/generate-openapi-clients.mjs localhost:8787";

const program = Effect.gen(function* () {
  const path = yield* Path.Path;
  const fileSystem = yield* FileSystem.FileSystem;
  const stdio = yield* Stdio.Stdio;

  const scriptDirectory = path.dirname(yield* path.fromFileUrl(new URL(import.meta.url)));
  const repoRoot = path.resolve(scriptDirectory, "..");
  const generatedClientsRoot = path.join(repoRoot, "packages/generated-clients");
  const nodeGeneratedRoot = path.join(repoRoot, "libraries/node/src/generated");
  const openapiRoot = path.join(generatedClientsRoot, "openapi");

  const rawHost = (yield* stdio.args).find((arg) => arg !== "--")?.trim();
  if (!rawHost) {
    yield* Console.error(USAGE);
    return yield* new ChildFailed({ code: 1 });
  }

  const baseUrl = normalizeHost(rawHost);
  const coreSpecUrl = new URL("/api/docs/openapi.json", baseUrl).toString();
  const eventCaptureSpecUrl = new URL("/i/docs/openapi.json", baseUrl).toString();
  const coreSpecPath = path.join(openapiRoot, "core.json");
  const eventCaptureSpecPath = path.join(openapiRoot, "event-capture.json");

  yield* fileSystem.makeDirectory(openapiRoot, { recursive: true });

  const [coreSpecText, eventCaptureSpecText] = yield* Effect.all(
    [fetchText(coreSpecUrl), fetchText(eventCaptureSpecUrl)],
    { concurrency: "unbounded" },
  );

  yield* assertSpec(
    coreSpecText,
    "core",
    (paths) => paths.some((specPath) => specPath.startsWith("/api/v1/")),
    "The core OpenAPI schema is missing /api/v1/* paths.",
  );
  yield* assertSpec(
    eventCaptureSpecText,
    "event-capture",
    (paths) => paths.includes("/i/v1/capture") && paths.includes("/i/v1/batch"),
    "The event-capture OpenAPI schema is missing /i/v1/capture or /i/v1/batch.",
  );

  yield* fileSystem.writeFileString(coreSpecPath, `${coreSpecText}\n`);
  yield* fileSystem.writeFileString(eventCaptureSpecPath, `${eventCaptureSpecText}\n`);

  const coreOutput = yield* run(repoRoot, "pnpm", [
    "dlx",
    "@tim-smart/openapi-gen@1.0.3",
    "--spec",
    coreSpecPath,
    "--name",
    "VoidhashCoreClient",
  ]);
  yield* fileSystem.writeFileString(
    path.join(generatedClientsRoot, "src/core/generated.ts"),
    coreOutput,
  );

  const eventCaptureOutput = yield* run(repoRoot, "pnpm", [
    "dlx",
    "@tim-smart/openapi-gen@1.0.3",
    "--spec",
    eventCaptureSpecPath,
    "--name",
    "VoidhashEventCaptureClient",
  ]);
  yield* fileSystem.writeFileString(
    path.join(generatedClientsRoot, "src/event-capture/generated.ts"),
    eventCaptureOutput,
  );

  yield* fileSystem.makeDirectory(nodeGeneratedRoot, { recursive: true });
  yield* run(repoRoot, "node", [
    "./scripts/generate-node-grouped-client.mjs",
    coreSpecPath,
    path.join(nodeGeneratedRoot, "grouped-client.ts"),
  ]);

  // Native SDKs (Go / Rust / PHP) generate from OpenAPI 3.0.x documents
  // derived from the committed specs; see scripts/openapi-downgrade.mjs for
  // what the downgrade does.
  const downgradedCorePath = path.join(openapiRoot, "core-3.0.json");
  yield* run(repoRoot, "node", [
    "./scripts/openapi-downgrade.mjs",
    coreSpecPath,
    downgradedCorePath,
  ]);

  const downgradedEventCapturePath = path.join(openapiRoot, "event-capture-3.0.json");
  yield* run(repoRoot, "node", [
    "./scripts/openapi-downgrade.mjs",
    "--rename-schema",
    "Union_=CaptureEventValue",
    "--rename-schema",
    "Union_1=CaptureContextValue",
    eventCaptureSpecPath,
    downgradedEventCapturePath,
  ]);

  // Go: oapi-codegen over the downgraded specs.
  yield* run(path.join(repoRoot, "libraries/go"), "go", [
    "run",
    "github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.0",
    "-config",
    "oapi-codegen-core.yaml",
    downgradedCorePath,
  ]);
  yield* run(path.join(repoRoot, "libraries/go"), "go", [
    "run",
    "github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.0",
    "-config",
    "oapi-codegen-event-capture.yaml",
    downgradedEventCapturePath,
  ]);

  // PHP: jane-openapi reads the mapping in jane-config.php.
  yield* run(path.join(repoRoot, "libraries/php"), "composer", ["generate"]);

  // Rust: progenitor runs at cargo build time (build.rs) over the
  // `*.rust.json` variants, which additionally flatten error types and drop
  // parameter nullability — both required by its codegen.
  const rustCorePath = path.join(openapiRoot, "core-3.0.rust.json");
  yield* run(repoRoot, "node", [
    "./scripts/openapi-downgrade.mjs",
    "--flatten-errors",
    coreSpecPath,
    rustCorePath,
  ]);
  const rustEventCapturePath = path.join(openapiRoot, "event-capture-3.0.rust.json");
  yield* run(repoRoot, "node", [
    "./scripts/openapi-downgrade.mjs",
    "--rename-schema",
    "Union_=CaptureEventValue",
    "--rename-schema",
    "Union_1=CaptureContextValue",
    "--any-schema",
    "CaptureEventValue",
    "--any-schema",
    "CaptureContextValue",
    "--flatten-errors",
    eventCaptureSpecPath,
    rustEventCapturePath,
  ]);
  yield* run(path.join(repoRoot, "libraries/rust"), "cargo", ["check"]);

  return 0;
});

/** Prints the failure like the old top-level `.catch`, then exits non-zero. */
const reportFailure = (error) =>
  Effect.gen(function* () {
    if (error._tag === "ChildFailed") return error.code;
    yield* Console.error(error);
    return 1;
  });

/**
 * Propagates the resolved exit code verbatim instead of collapsing it to `0`/`1`.
 *
 * @type {Runtime.Teardown}
 */
const teardown = (exit, onExit) => {
  if (Exit.isSuccess(exit)) {
    onExit(Number(exit.value));
    return;
  }
  Runtime.defaultTeardown(exit, onExit);
};

program.pipe(
  Effect.catch(reportFailure),
  Effect.provide([NodeServices.layer, FetchHttpClient.layer]),
  NodeRuntime.runMain({ teardown }),
);
