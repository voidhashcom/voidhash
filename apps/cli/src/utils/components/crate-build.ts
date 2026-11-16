import {
  readModuleDefinition,
  validatePanelModule,
  type PanelManifestEntry,
} from "@voidhash/component-build";
import type { ComponentDefinition } from "@voidhash/component-definition";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

const WASM_TARGET = "wasm32-unknown-unknown";

/** The cargo flags of a component crate's editor panel build. */
export const PANEL_BUILD_FEATURES = ["--no-default-features", "--features", "panel"] as const;

/** A component crate did not build: cargo is missing, failed, or produced an unusable module. */
export class CrateBuildError extends Schema.TaggedError<CrateBuildError>("CrateBuildError")(
  "CrateBuildError",
  { message: Schema.String, log: Schema.String },
) {}

/** A built component: its module, its editor panel module when it has one, and its definition. */
export interface CrateBuild {
  readonly module: Uint8Array;
  readonly panel: Option.Option<Uint8Array>;
  /** The panel module's `vhp.panels` manifest; empty without a panel. */
  readonly panels: ReadonlyArray<PanelManifestEntry>;
  readonly definition: ComponentDefinition;
  /** Cargo's diagnostics of both builds, when captured. */
  readonly log: string;
}

const CompilerArtifact = Schema.Struct({
  reason: Schema.Literal("compiler-artifact"),
  target: Schema.Struct({ kind: Schema.Array(Schema.String) }),
  filenames: Schema.Array(Schema.String),
});
const decodeArtifact = Schema.decodeUnknownOption(Schema.fromJsonString(CompilerArtifact));

/**
 * The `.wasm` file cargo wrote for the crate's `cdylib`, read from the
 * JSON messages of `--message-format=json-render-diagnostics`, so crates
 * of a workspace (whose target directory is the workspace's) are found too.
 */
export const builtModulePath = (messages: string): Option.Option<string> =>
  Arr.findLast(messages.split("\n"), (line) =>
    decodeArtifact(line).pipe(
      Option.filter((artifact) => artifact.target.kind.includes("cdylib")),
      Option.flatMap((artifact) =>
        Arr.findFirst(artifact.filenames, (file) => file.endsWith(".wasm")),
      ),
    ),
  );

/**
 * Builds a component crate for release with the local Rust toolchain, as the
 * build service does: the component module, and when its definition
 * declares an editor panel, the panel module with the crate's `panel`
 * feature, checked with `validatePanelModule`. `diagnostics` either
 * streams cargo's output to the terminal or captures it into `log`.
 */
export const buildComponentCrate = Effect.fn("buildComponentCrate")(function* (
  directory: string,
  options: { readonly diagnostics: "inherit" | "capture" },
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const fileSystem = yield* FileSystem.FileSystem;

  const cargo = (features: ReadonlyArray<string>) =>
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner.spawn(
          ChildProcess.make(
            "cargo",
            [
              "build",
              "--release",
              "--lib",
              "--target",
              WASM_TARGET,
              "--message-format=json-render-diagnostics",
              ...features,
            ],
            {
              cwd: directory,
              stdout: "pipe",
              stderr: options.diagnostics === "inherit" ? "inherit" : "pipe",
              env: { CARGO_TERM_COLOR: options.diagnostics === "inherit" ? "always" : "never" },
              extendEnv: true,
            },
          ),
        );
        const [messages, log, exitCode] = yield* Effect.all(
          [
            Stream.mkString(Stream.decodeText(handle.stdout)),
            options.diagnostics === "inherit"
              ? Effect.succeed("")
              : Stream.mkString(Stream.decodeText(handle.stderr)),
            handle.exitCode,
          ],
          { concurrency: "unbounded" },
        );
        return { messages, log, exitCode: Number(exitCode) };
      }),
    ).pipe(
      Effect.catchTag("PlatformError", (error) =>
        Effect.fail(
          new CrateBuildError({
            message:
              error.reason._tag === "NotFound"
                ? "cargo is not installed. Install Rust from https://rustup.rs and add the target: rustup target add wasm32-unknown-unknown."
                : `cargo could not be run: ${error.message}`,
            log: "",
          }),
        ),
      ),
    );

  /** Runs one build and reads the module it wrote, before the next build overwrites it. */
  const compile = (features: ReadonlyArray<string>, label: string, previousLog: string) =>
    Effect.gen(function* () {
      const run = yield* cargo(features);
      const log = `${previousLog}${run.log}`;
      if (run.exitCode !== 0) {
        return yield* new CrateBuildError({ message: `The ${label} did not build.`, log });
      }
      const path = builtModulePath(run.messages);
      if (Option.isNone(path)) {
        return yield* new CrateBuildError({
          message: `The ${label} build produced no WebAssembly module. A component crate builds a cdylib: crate-type = ["cdylib"].`,
          log,
        });
      }
      const bytes = yield* fileSystem.readFile(path.value).pipe(
        Effect.mapError(
          (error) =>
            new CrateBuildError({
              message: `Could not read ${path.value}: ${error.message}`,
              log,
            }),
        ),
      );
      return { bytes, log };
    });

  const runtime = yield* compile([], "component", "");
  const definition = readModuleDefinition(runtime.bytes);
  if (Result.isFailure(definition)) {
    return yield* new CrateBuildError({
      message: `The module is not a component module: ${definition.failure}`,
      log: runtime.log,
    });
  }
  if (!definition.success.panel) {
    const built: CrateBuild = {
      module: runtime.bytes,
      panel: Option.none(),
      panels: [],
      definition: definition.success,
      log: runtime.log,
    };
    return built;
  }
  const panel = yield* compile(PANEL_BUILD_FEATURES, "editor panel", runtime.log);
  const checked = validatePanelModule(panel.bytes, definition.success);
  if (Result.isFailure(checked)) {
    return yield* new CrateBuildError({
      message: ["The editor panel module was rejected:", ...checked.failure].join("\n  - "),
      log: panel.log,
    });
  }
  const built: CrateBuild = {
    module: runtime.bytes,
    panel: Option.some(panel.bytes),
    panels: checked.success,
    definition: definition.success,
    log: panel.log,
  };
  return built;
});

/** Where `voidhash-cli test` writes a crate's modules, relative to the crate: `target/voidhash`. */
export const BUILD_OUTPUT_PATH = ["target", "voidhash"] as const;

/**
 * Writes a build's `module.wasm` and, for a component with an editor panel,
 * `panel.wasm` into `directory`, removing a `panel.wasm` an earlier build
 * left when the component no longer has a panel. Returns the paths written.
 */
export const writeCrateBuild = Effect.fn("writeCrateBuild")(function* (
  directory: string,
  build: CrateBuild,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fileSystem.makeDirectory(directory, { recursive: true });
  const modulePath = path.join(directory, "module.wasm");
  const panelPath = path.join(directory, "panel.wasm");
  yield* fileSystem.writeFile(modulePath, build.module);
  if (Option.isNone(build.panel)) {
    yield* fileSystem.remove(panelPath, { force: true });
    return { modulePath, panelPath: Option.none<string>() };
  }
  yield* fileSystem.writeFile(panelPath, build.panel.value);
  return { modulePath, panelPath: Option.some(panelPath) };
});
