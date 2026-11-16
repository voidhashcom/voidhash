import { readModuleDefinition, validatePanelModule } from "@voidhash/component-build";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import { Argument, Command, Flag } from "effect/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import {
  BUILD_OUTPUT_PATH,
  buildComponentCrate,
  writeCrateBuild,
} from "../../utils/components/crate-build";
import { userError } from "../../utils/error-formatter";
import { isComponentSlug, WORKING_COPY_DIRECTORY } from "../../utils/workspace/working-copy";

/** The conformance checker; `VOIDHASH_CONFORMANCE` overrides the executable. */
const conformanceBin = Config.String("VOIDHASH_CONFORMANCE").pipe(
  Config.withDefault("voidhash-guest-conformance"),
);

/**
 * Runs a command with inherited output and returns its exit code, or
 * `Option.none` when the executable is not installed.
 */
const runInherited = (command: string, args: ReadonlyArray<string>, cwd?: string) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(
      ChildProcess.make(command, [...args], { cwd, stdout: "inherit", stderr: "inherit" }),
    );
    return Option.some(Number(yield* handle.exitCode));
  }).pipe(
    Effect.scoped,
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound" ? Effect.succeed(Option.none<number>()) : Effect.fail(error),
    ),
  );

/**
 * `voidhash-cli test [component|path] [--panel file]`
 *
 * Checks a component the way publishing does on a server with a component
 * build service: the module against the component conformance suite, and
 * its editor panel module, when it has one, against the panel ABI checks
 * (`validatePanelModule`). The argument is a component of the working copy
 * (its slug), a crate directory, which is built for release first and its
 * modules written to `target/voidhash/` in the crate, or a `.wasm` module,
 * whose panel is `--panel` or a `panel.wasm` next to it.
 */
export const componentsTestCommand = Command.make(
  "test",
  {
    path: Argument.String("component").pipe(
      Argument.withDescription(
        "A component of .voidhash/components, a component crate or a .wasm module (the current directory by default)",
      ),
      Argument.optional,
    ),
    panel: Flag.String("panel").pipe(
      Flag.withDescription(
        "The editor panel module of a .wasm module (default: panel.wasm next to it)",
      ),
      Flag.optional,
    ),
  },
  ({ panel: panelFlag, path: input }) =>
    Effect.gen(function* componentsTestCommand() {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const target = Option.getOrElse(input, () => ".");

      const { modulePath, panelPath } = yield* Effect.gen(function* () {
        if (path.extname(target) === ".wasm") {
          const sibling = path.join(path.dirname(target), "panel.wasm");
          const panel = Option.isSome(panelFlag)
            ? panelFlag
            : (yield* fileSystem.exists(sibling))
              ? Option.some(sibling)
              : Option.none<string>();
          return { modulePath: target, panelPath: panel };
        }
        const workingCopyCrate = path.join(WORKING_COPY_DIRECTORY, "components", target);
        const crate = (yield* fileSystem.exists(path.join(target, "Cargo.toml")))
          ? target
          : isComponentSlug(target) &&
              (yield* fileSystem.exists(path.join(workingCopyCrate, "Cargo.toml")))
            ? workingCopyCrate
            : yield* Effect.fail(
                userError(
                  `${target} is neither a component of ${WORKING_COPY_DIRECTORY}/components, a crate with Cargo.toml, nor a .wasm module.`,
                ),
              );
        yield* Console.log(`Building ${crate}...`);
        const built = yield* buildComponentCrate(crate, { diagnostics: "inherit" });
        return yield* writeCrateBuild(path.join(crate, ...BUILD_OUTPUT_PATH), built);
      });

      // The panel checks run in process; do them first so they report even
      // without the conformance checker.
      const definition = readModuleDefinition(yield* fileSystem.readFile(modulePath));
      if (Result.isFailure(definition)) {
        return yield* Effect.fail(userError(`${modulePath}: ${definition.failure}`));
      }
      if (Option.isSome(panelPath)) {
        const checked = validatePanelModule(
          yield* fileSystem.readFile(panelPath.value),
          definition.success,
        );
        if (Result.isFailure(checked)) {
          return yield* Effect.fail(
            userError(
              [
                `✗ ${panelPath.value} did not pass the panel checks:`,
                ...checked.failure.map((problem) => `  - ${problem}`),
              ].join("\n"),
            ),
          );
        }
        yield* Console.log(
          `✓ ${panelPath.value} passed the panel checks (${checked.success.map((panel) => panel.id).join(", ")}).`,
        );
      } else if (definition.success.panel) {
        return yield* Effect.fail(
          userError(
            `${definition.success.id} declares an editor panel, but no panel module was found. Test its crate instead, which builds both modules, or pass --panel.`,
          ),
        );
      }

      const checker = yield* conformanceBin;
      const result = yield* runInherited(checker, [modulePath]);
      if (Option.isNone(result)) {
        return yield* Effect.fail(
          userError(
            `The component conformance checker (${checker}) is not installed, so ${modulePath} was not tested. Install it and make sure it is on your PATH, or set VOIDHASH_CONFORMANCE to its location. A server with a component build service runs the same checks when you publish.`,
          ),
        );
      }
      if (result.value !== 0) {
        return yield* Effect.fail(
          userError(`\n✗ ${modulePath} did not pass the conformance suite.`),
        );
      }
      yield* Console.log(`✓ ${modulePath} passed the conformance suite.`);
    }).pipe(
      Effect.catchTags({
        CrateBuildError: (error) =>
          Effect.fail(
            userError(error.log === "" ? error.message : `${error.log}\n${error.message}`),
          ),
        PlatformError: (error) => Effect.fail(userError(error.message)),
        ConfigError: (error) => Effect.fail(userError(error.message)),
      }),
    ),
).pipe(
  Command.withDescription(
    "Check a component module against the conformance suite and its editor panel against the panel checks.",
  ),
);
