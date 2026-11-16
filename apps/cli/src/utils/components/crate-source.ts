import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Str from "effect/String";

/**
 * Reads the `name` of the `[package]` table from a `Cargo.toml`.
 *
 * Only the flat `name = "..."` form is recognised, which is what `cargo new`
 * writes; anything else yields `Option.none()` so the caller can ask for an
 * explicit slug instead.
 */
export const packageNameFromCargoToml = (cargoToml: string): Option.Option<string> => {
  const lines = cargoToml.split(/\r?\n/).map((line) => line.trim());
  const packageHeader = lines.indexOf("[package]");
  if (packageHeader === -1) return Option.none();
  const packageTable = Arr.takeWhile(
    lines.slice(packageHeader + 1),
    (line) => !line.startsWith("["),
  );
  return Arr.findFirst(packageTable, (line) => {
    const match = /^name\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(line);
    return match === null
      ? Option.none()
      : Option.liftPredicate(Str.isNonEmpty)(match[1] ?? match[2] ?? "");
  });
};

/**
 * Selects the Rust modules to upload from a recursive listing of a crate's
 * `src/` directory (entries relative to `src/`, `/`-separated). Returns the
 * crate-relative paths (`src/...`) in a stable order, skipping build output.
 */
export const crateSourceFilePaths = (srcEntries: ReadonlyArray<string>): Array<string> =>
  Arr.sort(
    srcEntries
      .filter((entry) => entry.endsWith(".rs") && !entry.split("/").includes("target"))
      .map((entry) => `src/${entry}`),
    Order.String,
  );

/**
 * Reads a component crate's source from disk: every `.rs` module under
 * `src/` and the `Cargo.toml`, when there are, keyed by crate-relative path
 * (`src/...`, `/`-separated).
 */
export const readCrateSource = Effect.fn("readCrateSource")(function* readCrateSource(
  directory: string,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const srcDirectory = path.join(directory, "src");
  const srcEntries = (yield* fileSystem.exists(srcDirectory))
    ? yield* fileSystem.readDirectory(srcDirectory, { recursive: true })
    : [];
  const sourceFiles = yield* Effect.forEach(
    crateSourceFilePaths(srcEntries.map((entry) => entry.split(path.sep).join("/"))),
    (relativePath) =>
      fileSystem
        .readFileString(path.join(directory, ...relativePath.split("/")))
        .pipe(Effect.map((content) => [relativePath, content] as const)),
    { concurrency: 8 },
  );

  const cargoTomlPath = path.join(directory, "Cargo.toml");
  const cargoToml = (yield* fileSystem.exists(cargoTomlPath))
    ? [["Cargo.toml", yield* fileSystem.readFileString(cargoTomlPath)] as const]
    : [];
  return R.fromEntries([...sourceFiles, ...cargoToml]);
});
