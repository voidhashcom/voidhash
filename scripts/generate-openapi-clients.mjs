#!/usr/bin/env node

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import {
  Console,
  Data,
  Effect,
  Exit,
  FileSystem,
  Path,
  Runtime,
  Schema,
  Stdio,
  Stream,
} from "effect";
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

const RenamedOpenApiSpec = Schema.fromJsonString(
  Schema.Struct({
    components: Schema.optionalKey(
      Schema.Struct({
        schemas: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
      }),
    ),
  }),
);

const decodeRenamedSpec = Schema.decodeUnknownEffect(RenamedOpenApiSpec);

const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

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
        (cause) =>
          new GenerateError({ message: `The ${label} OpenAPI schema is not valid JSON.`, cause }),
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

/**
 * Names the anonymous schemas the core document emits, so the native SDKs get
 * readable types instead of positional `Objects1` / `Union1` — and so
 * oapi-codegen does not collide two of them onto the same Go typename.
 *
 * These are POSITIONAL: `Objects_N` numbering depends on traversal order, so a
 * contract change can renumber them. `assertRenamedSchemas` below checks each
 * renamed schema still has the shape its name claims, turning a silent
 * mislabelling into a failed generation. Most response schemas avoid this
 * entirely by carrying an `identifier` annotation; the ones left here are those
 * reused with an `HttpApiSchema.status` override, which cannot be annotated
 * because the override produces a second AST with the same identifier.
 */
const CORE_SCHEMA_RENAMES = [
  "--rename-schema",
  "Objects_=PaymentProviderConfigurationSummary",
  "--rename-schema",
  "Objects_1=ProviderConfigurationPresence",
  "--rename-schema",
  "Objects_3=PaymentProviderProductSummary",
  "--rename-schema",
  "Objects_4=PersonAttributeValues",
  "--rename-schema",
  "Objects_5=PushNotificationConfigurationSummary",
  "--rename-schema",
  "Union_=AnalyticsFilterNode",
  "--rename-schema",
  "Union_1=NullableStringList",
];

/** A property each renamed schema must still expose, as a shape guard. */
const RENAMED_SCHEMA_MARKERS = {
  AnalyticsFilterNode: "anyOf",
  PaymentProviderConfigurationSummary: "configurationPresence",
  PaymentProviderProductSummary: "providerProductKey",
  PushNotificationConfigurationSummary: "pushProviderKey",
};

/**
 * Verifies each positionally-renamed schema still looks like what its new name
 * says. `Objects_N` numbering shifts when the contracts change, so without this
 * a renumber would quietly ship a `PersonAttributeValues` that is actually a
 * payment configuration.
 *
 * @param {string} specPath
 * @param {FileSystem.FileSystem} fileSystem
 */
const assertRenamedSchemas = (specPath, fileSystem) =>
  Effect.gen(function* () {
    const text = yield* fileSystem.readFileString(specPath);
    const spec = yield* decodeRenamedSpec(text).pipe(
      Effect.mapError(
        (cause) =>
          new GenerateError({ message: "The renamed OpenAPI schema is not valid JSON.", cause }),
      ),
    );
    const schemas = spec.components?.schemas ?? {};
    const wrong = Object.entries(RENAMED_SCHEMA_MARKERS).flatMap(([name, marker]) => {
      const schema = schemas[name];
      if (!isRecord(schema)) return [`${name} is missing`];
      const properties = schema["properties"];
      const present = marker in schema || (isRecord(properties) && marker in properties);
      if (present) return [];
      return [`${name} no longer has "${marker}"`];
    });
    if (wrong.length === 0) return;
    return yield* new GenerateError({
      message:
        `Anonymous-schema renames are stale (${wrong.join("; ")}). ` +
        "Re-inspect the Objects_/Union_ names in the downgraded spec and update CORE_SCHEMA_RENAMES.",
    });
  });

const USAGE =
  "Usage: node ./scripts/generate-openapi-clients.mjs [host]\n" +
  "  no host  generate the specs offline from the contracts (the default)\n" +
  "  <host>   fetch the specs from a running stage, e.g. localhost:8787";

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
  if (rawHost === "--help" || rawHost === "-h") {
    yield* Console.error(USAGE);
    return 0;
  }

  const coreSpecPath = path.join(openapiRoot, "core.json");
  const eventCaptureSpecPath = path.join(openapiRoot, "event-capture.json");

  yield* fileSystem.makeDirectory(openapiRoot, { recursive: true });

  // Offline is the default: `HttpApiBuilder.layer({ openapiPath })` serves
  // exactly `OpenApi.fromApi(api)`, so emitting straight from the contracts
  // yields the document a stage would serve — and lets a contract change and
  // its regenerated clients land in one commit. Passing a host still fetches
  // from a running stage, which is the way to verify the two agree.
  const specTexts = yield* Effect.gen(function* () {
    if (rawHost) {
      return yield* Effect.all(
        [
          fetchText(new URL("/api/docs/openapi.json", normalizeHost(rawHost)).toString()),
          fetchText(new URL("/i/docs/openapi.json", normalizeHost(rawHost)).toString()),
        ],
        { concurrency: "unbounded" },
      );
    }
    yield* run(repoRoot, "./node_modules/.bin/tsx", [
      "packages/api-contracts/scripts/emit-openapi-specs.ts",
      coreSpecPath,
      eventCaptureSpecPath,
    ]);
    return yield* Effect.all([
      fileSystem.readFileString(coreSpecPath),
      fileSystem.readFileString(eventCaptureSpecPath),
    ]);
  });
  const [coreSpecText, eventCaptureSpecText] = specTexts;

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
  // The two anonymous record schemas are emitted as `Objects_`/`Objects_1`,
  // whose order is not stable across emitter versions. They are named here
  // because oapi-codegen otherwise mints `Objects1` for the inline value union
  // inside `Objects_` and collides with `Objects_1`.
  const downgradedCorePath = path.join(openapiRoot, "core-3.0.json");
  yield* run(repoRoot, "node", [
    "./scripts/openapi-downgrade.mjs",
    ...CORE_SCHEMA_RENAMES,
    coreSpecPath,
    downgradedCorePath,
  ]);
  yield* assertRenamedSchemas(downgradedCorePath, fileSystem);

  const downgradedEventCapturePath = path.join(openapiRoot, "event-capture-3.0.json");
  yield* run(repoRoot, "node", [
    "./scripts/openapi-downgrade.mjs",
    "--rename-schema",
    "Union_=CaptureEventValue",
    "--rename-schema",
    "Union_1=CaptureContextValue",
    // The batch event object is extracted as an anonymous `Objects_2`, which
    // would otherwise reach the native SDKs as a public `Objects2` type.
    "--rename-schema",
    "Objects_2=CaptureEvent",
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
    ...CORE_SCHEMA_RENAMES,
    // `PersonAttributeValues` is the person-traits map, whose values are a
    // scalar union. progenitor renders that union as a struct of flattened
    // options, which cannot deserialize a bare `3` or `"pro"` — the same
    // limitation the event-capture value unions below work around.
    "--any-schema",
    "PersonAttributeValues",
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
    // The batch event object is extracted as an anonymous `Objects_2`, which
    // would otherwise reach the native SDKs as a public `Objects2` type.
    "--rename-schema",
    "Objects_2=CaptureEvent",
    "--any-schema",
    "CaptureEventValue",
    "--any-schema",
    "CaptureContextValue",
    "--flatten-errors",
    eventCaptureSpecPath,
    rustEventCapturePath,
  ]);
  yield* run(path.join(repoRoot, "libraries/rust"), "cargo", ["check"]);

  // The docs site's API reference is one stub per operation; regenerate it here
  // so a contract change cannot leave the published reference describing
  // endpoints that no longer exist.
  yield* run(repoRoot, "node", ["./scripts/generate-api-reference-docs.mjs"]);

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
