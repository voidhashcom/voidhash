import { readModuleDefinition, validatePanelModule } from "@voidhash/component-build";
import type { CreatePublishedComponentBundleVersionBodyJsonEncoding } from "@voidhash/generated-clients";
import * as Effect from "effect/Effect";
import { Base64 } from "effect/encoding";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";

import { userError } from "../error-formatter";
import { BUILD_OUTPUT_PATH } from "./crate-build";
import { packageNameFromCargoToml } from "./crate-source";

/** The image types a bundle's icon and thumbnails may use, by file extension. */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/** The content type of a bundle image file; none for other files. */
export const bundleImageType = (fileName: string): Option.Option<string> => {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? Option.none() : R.get(IMAGE_TYPES, fileName.slice(dot).toLowerCase());
};

/** The file cargo writes for a `cdylib` crate: its package name with dashes as underscores. */
export const wasmFileNameForPackage = (packageName: string): string =>
  `${packageName.replace(/-/g, "_")}.wasm`;

/**
 * Reads a component bundle directory into a publish request:
 *
 * - `component.json`, the component definition (required);
 * - `module.wasm`, or for a crate directory what `voidhash-cli test` wrote
 *   to `target/voidhash/module.wasm`, or the release build at
 *   `target/wasm32-unknown-unknown/release/<crate>.wasm` in the crate or its
 *   workspace one level up;
 * - `panel.wasm` or `target/voidhash/panel.wasm`, the editor panel module,
 *   which a module that declares a panel needs;
 * - optional `icon.(png|svg|webp)`, `thumbnails/<state>.(png|jpg|webp)`,
 *   `README.md` and `agent.md`.
 *
 * The server runs every publish check. The panel module is checked here
 * too (`validatePanelModule`), so a panel the server would refuse fails
 * before anything is uploaded.
 */
export const readComponentBundle = Effect.fn("readComponentBundle")(function* (directory: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = (name: string) => path.join(directory, name);
  const optionalText = (name: string) =>
    Effect.gen(function* () {
      return (yield* fileSystem.exists(file(name)))
        ? yield* fileSystem.readFileString(file(name))
        : undefined;
    });
  const base64 = (filePath: string) =>
    Effect.map(fileSystem.readFile(filePath), (bytes) => Base64.encode(bytes));

  const definitionText = yield* optionalText("component.json");
  if (definitionText === undefined) {
    return yield* Effect.fail(
      userError(
        `${file("component.json")} not found. A bundle needs component.json, the definition to publish; or publish a ready project component with --from-project <slug>@<version>.`,
      ),
    );
  }

  const buildOutput = path.join(directory, ...BUILD_OUTPUT_PATH);
  const modulePath = yield* Effect.gen(function* () {
    if (yield* fileSystem.exists(file("module.wasm"))) return file("module.wasm");
    if (yield* fileSystem.exists(path.join(buildOutput, "module.wasm"))) {
      return path.join(buildOutput, "module.wasm");
    }
    const cargoToml = yield* optionalText("Cargo.toml");
    const packageName = Option.flatMap(Option.fromUndefinedOr(cargoToml), packageNameFromCargoToml);
    // A crate builds into its own target directory, or its workspace's one level up.
    const candidates = Option.match(packageName, {
      onNone: () => [],
      onSome: (name) =>
        [directory, path.join(directory, "..")].map((root) =>
          path.join(
            root,
            "target",
            "wasm32-unknown-unknown",
            "release",
            wasmFileNameForPackage(name),
          ),
        ),
    });
    const built = yield* Effect.findFirst(candidates, (candidate) => fileSystem.exists(candidate));
    if (Option.isSome(built)) return built.value;
    return yield* Effect.fail(
      userError(
        `No module found in ${directory}. Build it with 'voidhash-cli test', or put module.wasm next to component.json.`,
      ),
    );
  });

  const panelPath = yield* Effect.findFirst(
    [file("panel.wasm"), path.join(buildOutput, "panel.wasm")],
    (candidate) => fileSystem.exists(candidate),
  );
  const moduleBytes = yield* fileSystem.readFile(modulePath);
  const panelBytes = Option.isNone(panelPath)
    ? undefined
    : yield* fileSystem.readFile(panelPath.value);
  const definition = readModuleDefinition(moduleBytes);
  if (Result.isFailure(definition)) {
    return yield* Effect.fail(userError(`${modulePath}: ${definition.failure}`));
  }
  if (panelBytes === undefined && definition.success.panel) {
    return yield* Effect.fail(
      userError(
        `${definition.success.id} declares an editor panel, but ${directory} has no panel.wasm. Build both modules with 'voidhash-cli test'.`,
      ),
    );
  }
  if (panelBytes !== undefined && Option.isSome(panelPath)) {
    const checked = validatePanelModule(panelBytes, definition.success);
    if (Result.isFailure(checked)) {
      return yield* Effect.fail(
        userError(
          [
            `${panelPath.value} did not pass the panel checks:`,
            ...checked.failure.map((problem) => `  - ${problem}`),
          ].join("\n"),
        ),
      );
    }
  }

  const entries = yield* fileSystem.readDirectory(directory);
  const iconName = entries.find((entry) => /^icon\.(png|svg|webp)$/i.test(entry));
  const thumbnailDirectory = file("thumbnails");
  const thumbnailNames = (yield* fileSystem.exists(thumbnailDirectory))
    ? (yield* fileSystem.readDirectory(thumbnailDirectory)).filter((entry) =>
        Option.isSome(bundleImageType(entry)),
      )
    : [];

  const body: CreatePublishedComponentBundleVersionBodyJsonEncoding = {
    definitionJson: definitionText,
    moduleBase64: Base64.encode(moduleBytes),
    panelBase64: panelBytes === undefined ? undefined : Base64.encode(panelBytes),
    icon:
      iconName === undefined
        ? undefined
        : {
            base64: yield* base64(file(iconName)),
            contentType: Option.getOrElse(bundleImageType(iconName), () => ""),
          },
    thumbnails: yield* Effect.forEach(
      thumbnailNames,
      (name) =>
        Effect.map(base64(path.join(thumbnailDirectory, name)), (encoded) => ({
          state: name.slice(0, name.lastIndexOf(".")),
          base64: encoded,
          contentType: Option.getOrElse(bundleImageType(name), () => ""),
        })),
      { concurrency: 4 },
    ),
    readme: yield* optionalText("README.md"),
    agentGuide: yield* optionalText("agent.md"),
  };
  return { body, modulePath };
});
