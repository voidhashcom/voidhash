import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { Hex } from "effect/encoding";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import type { PlatformError } from "effect/PlatformError";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import { readCrateSource } from "../components/crate-source";
import { componentCargoToml } from "../components/scaffold";
import type { SourceFiles } from "./merge";

/**
 * The working copy of a project's components, `.voidhash/` in the project
 * root: a Cargo workspace with one crate per component under `components/`,
 * and `state.json`, what the CLI knows of each component's catalog versions.
 * The layout is specified in `docs/specs/component-dev-session.md`.
 */

/** The working copy's directory in the project root. */
export const WORKING_COPY_DIRECTORY = ".voidhash";

const COMPONENT_SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Whether `name` is a component slug: lowercase letters, digits and dashes. */
export const isComponentSlug = (name: string) => COMPONENT_SLUG.test(name);

/**
 * The workspace manifest written once into a new working copy. The developer
 * owns it afterwards; the CLI never rewrites it.
 */
export const WORKSPACE_CARGO_TOML = `# The Cargo workspace of this project's Voidhash components, one crate per
# directory under components/. voidhash-cli dev builds and serves them;
# voidhash-cli publish publishes them. Add to this file as you need.
[workspace]
resolver = "3"
members = ["components/*"]

# Component modules are downloaded by apps: optimise for size.
[profile.release]
panic = "abort"
opt-level = "z"
lto = true
codegen-units = 1
strip = true

# To build against a voidhash-ui that is not released yet, point every
# component's dependency at a checkout of it (the path is relative to this file):
#
# [patch.crates-io]
# voidhash-ui = { path = "../../voidhash/crates/voidhash-ui" }
`;

/** A component's entry in `state.json`. */
export const ComponentState = Schema.Struct({
  /** The catalog version the working copy is based on. */
  baseVersion: Schema.Number,
  /** {@link sourceFilesHash} of `base`. */
  baseHash: Schema.String,
  /** That version's files as the CLI wrote them: the base of every merge and diff. */
  base: Schema.Record(Schema.String, Schema.String),
  /** The newest version `voidhash-cli publish` created from this working copy. */
  publishedVersion: Schema.optionalKey(Schema.Number),
  /** Whether the last merge left conflict markers that remain. */
  isConflicted: Schema.Boolean,
});
export type ComponentState = typeof ComponentState.Type;

/** `state.json`. A component directory without an entry is local. */
export const WorkingCopyState = Schema.Struct({
  version: Schema.Literal(1),
  projectId: Schema.String,
  components: Schema.Record(Schema.String, ComponentState),
});
export type WorkingCopyState = typeof WorkingCopyState.Type;

const StateJson = Schema.fromJsonString(WorkingCopyState, { space: 2 });
const decodeState = Schema.decodeUnknownEffect(StateJson);
const encodeState = Schema.encodeEffect(StateJson);

/** `state.json` is unreadable or belongs to another project. */
export class WorkingCopyStateError extends Schema.TaggedError<WorkingCopyStateError>(
  "WorkingCopyStateError",
)("WorkingCopyStateError", { message: Schema.String }) {}

/** The lowercase hex SHA-256 of `bytes`. */
export const sha256Hex = (bytes: Uint8Array) =>
  Effect.tryPromise({
    try: () => crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    catch: (cause) => cause,
  }).pipe(
    // SHA-256 is always available; a failure is a defect of the runtime.
    Effect.orDie,
    Effect.map((digest) => Hex.encode(new Uint8Array(digest))),
  );

/** The `baseHash` of a component's files: each as `<path>\0<content>\0`, in path order. */
export const sourceFilesHash = (files: SourceFiles) =>
  sha256Hex(
    new TextEncoder().encode(
      Arr.sort(R.keys(files), Order.String)
        .map((path) => `${path}\0${files[path] ?? ""}\0`)
        .join(""),
    ),
  );

/**
 * Whether a server file path is one the working copy keeps: `Cargo.toml` or
 * a Rust module under `src/`, without `..` or other unusual segments, so
 * writing it cannot leave the component's directory.
 */
export const isComponentSourcePath = (path: string) =>
  path === "Cargo.toml" || /^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.rs$/.test(path);

const TABLE_HEADER = /^\s*\[\s*([A-Za-z0-9_.-]+)\s*\]\s*(?:#.*)?$/;

/** `lines` without the trailing ones `drop` matches. */
const withoutTrailing = (lines: ReadonlyArray<string>, drop: (line: string) => boolean) =>
  Arr.reverse(Arr.dropWhile(Arr.reverse(lines), drop));

/**
 * Removes the `[workspace]` and `[profile.*]` tables (and their subtables)
 * from a crate manifest, with the comment lines directly above them: they
 * belong to the working copy's workspace manifest.
 */
export const withoutWorkspaceTables = (cargoToml: string): string => {
  const { kept } = Arr.reduce(
    cargoToml.split(/\r?\n/),
    { kept: Arr.empty<string>(), dropping: false },
    (manifest, line) => {
      const header = TABLE_HEADER.exec(line);
      if (header === null) {
        return manifest.dropping ? manifest : { ...manifest, kept: [...manifest.kept, line] };
      }
      const [table] = (header[1] ?? "").split(".");
      return table === "workspace" || table === "profile"
        ? {
            kept: withoutTrailing(manifest.kept, (kept) => /^\s*(#.*)?$/.test(kept)),
            dropping: true,
          }
        : { kept: [...manifest.kept, line], dropping: false };
    },
  );
  return `${withoutTrailing(kept, (line) => line.trim() === "").join("\n")}\n`;
};

/**
 * A component's files as the working copy keeps them: the server's
 * `Cargo.toml` without workspace tables, or the default member manifest
 * when the server has none.
 */
export const workingCopyFiles = (slug: string, serverFiles: SourceFiles): SourceFiles => ({
  ...serverFiles,
  "Cargo.toml": Option.match(R.get(serverFiles, "Cargo.toml"), {
    onNone: () => componentCargoToml(slug),
    onSome: withoutWorkspaceTables,
  }),
});

/**
 * The `.gitignore` that also ignores the working copy, or none when
 * `current` already does. `current` is none when the file does not exist.
 */
export const gitignoreIgnoringWorkingCopy = (current: Option.Option<string>) => {
  const content = Option.getOrElse(current, () => "");
  const ignored = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => /^\/?\.voidhash\/?$/.test(line));
  if (ignored) return Option.none<string>();
  const separator = content === "" || content.endsWith("\n") ? "" : "\n";
  return Option.some(`${content}${separator}${WORKING_COPY_DIRECTORY}/\n`);
};

/** The working copy of one project, as the commands read and change it. */
export interface WorkingCopy {
  /** `.voidhash/` */
  readonly directory: string;
  /** `.voidhash/components/` */
  readonly componentsDirectory: string;
  readonly projectId: string;
  readonly componentDirectory: (slug: string) => string;
  /** Reads `state.json`; an empty state when there is none. */
  readonly readState: Effect.Effect<WorkingCopyState, WorkingCopyStateError | PlatformError>;
  /**
   * Reads `state.json` again, applies `change` and writes the result
   * atomically (a temporary file, then a rename). Changes of one process run
   * one at a time; `dev` and `publish` may change it from two.
   */
  readonly updateState: (
    change: (state: WorkingCopyState) => WorkingCopyState,
  ) => Effect.Effect<WorkingCopyState, WorkingCopyStateError | PlatformError>;
  /** The slugs of the directories under `components/` that are crates with `src/lib.rs`. */
  readonly listComponents: Effect.Effect<Array<string>, PlatformError>;
  readonly isComponent: (slug: string) => Effect.Effect<boolean, PlatformError>;
  /** A component's `Cargo.toml` and `src/**.rs`. */
  readonly readComponentFiles: (
    slug: string,
  ) => Effect.Effect<Record<string, string>, PlatformError>;
  /**
   * Makes a component's `Cargo.toml` and `src/**.rs` exactly `files`:
   * writes the files that differ and removes the Rust modules `files` lacks.
   */
  readonly writeComponentFiles: (
    slug: string,
    files: SourceFiles,
  ) => Effect.Effect<void, PlatformError>;
}

/** The working copy in `root` for `projectId`, whether or not it exists yet. */
export const openWorkingCopy = Effect.fn("openWorkingCopy")(function* (
  root: string,
  projectId: string,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(root, WORKING_COPY_DIRECTORY);
  const componentsDirectory = path.join(directory, "components");
  const statePath = path.join(directory, "state.json");
  const stateLock = yield* Semaphore.make(1);
  const componentDirectory = (slug: string) => path.join(componentsDirectory, slug);

  const readState = Effect.fn("WorkingCopy.readState")(function* () {
    if (!(yield* fileSystem.exists(statePath))) {
      const empty: WorkingCopyState = { version: 1, projectId, components: {} };
      return empty;
    }
    const state = yield* decodeState(yield* fileSystem.readFileString(statePath)).pipe(
      Effect.mapError(
        (error) =>
          new WorkingCopyStateError({
            message: `${statePath} is not a working copy state the CLI can read (${error.message}). Fix it, or remove ${directory} to pull the components again.`,
          }),
      ),
    );
    if (state.projectId !== projectId) {
      return yield* new WorkingCopyStateError({
        message: `${directory} is the working copy of project ${state.projectId}, but voidhash.config names project ${projectId}. Move ${directory} away to start a working copy of this project.`,
      });
    }
    return state;
  })();

  const updateState = (change: (state: WorkingCopyState) => WorkingCopyState) =>
    stateLock.withPermit(
      Effect.gen(function* () {
        const next = change(yield* readState);
        const text = yield* encodeState(next).pipe(Effect.orDie);
        const temporary = `${statePath}.${crypto.randomUUID()}.tmp`;
        yield* fileSystem.writeFileString(temporary, `${text}\n`);
        yield* fileSystem.rename(temporary, statePath);
        return next;
      }),
    );

  const isComponent = (slug: string) =>
    Effect.gen(function* () {
      if (!isComponentSlug(slug)) return false;
      const crate = componentDirectory(slug);
      return (
        (yield* fileSystem.exists(path.join(crate, "Cargo.toml"))) &&
        (yield* fileSystem.exists(path.join(crate, "src", "lib.rs")))
      );
    });

  const listComponents = Effect.fn("WorkingCopy.listComponents")(function* () {
    if (!(yield* fileSystem.exists(componentsDirectory))) return [];
    const entries = yield* fileSystem.readDirectory(componentsDirectory);
    return Arr.sort(yield* Effect.filter(entries, isComponent), Order.String);
  })();

  const readComponentFiles = (slug: string) =>
    readCrateSource(componentDirectory(slug)).pipe(
      Effect.provideService(FileSystem.FileSystem, fileSystem),
      Effect.provideService(Path.Path, path),
    );

  const writeComponentFiles = (slug: string, files: SourceFiles) =>
    Effect.gen(function* () {
      const crate = componentDirectory(slug);
      const current = yield* readComponentFiles(slug);
      yield* Effect.forEach(
        R.keys(current).filter((file) => !R.has(files, file)),
        (file) => fileSystem.remove(path.join(crate, ...file.split("/"))),
        { concurrency: 1, discard: true },
      );
      yield* Effect.forEach(
        R.toEntries(files).filter(([file, content]) => current[file] !== content),
        ([file, content]) =>
          Effect.gen(function* () {
            const target = path.join(crate, ...file.split("/"));
            yield* fileSystem.makeDirectory(path.dirname(target), { recursive: true });
            yield* fileSystem.writeFileString(target, content);
          }),
        { concurrency: 1, discard: true },
      );
    });

  const workingCopy: WorkingCopy = {
    directory,
    componentsDirectory,
    projectId,
    componentDirectory,
    readState,
    updateState,
    listComponents,
    isComponent,
    readComponentFiles,
    writeComponentFiles,
  };
  return workingCopy;
});

/**
 * Opens the working copy in `root`, creating it first when it does not
 * exist: the workspace manifest, `state.json` and `components/`, and a
 * `.voidhash/` line in the project's `.gitignore`. Returns the notes to
 * print about what it created.
 */
export const prepareWorkingCopy = Effect.fn("prepareWorkingCopy")(function* (
  root: string,
  projectId: string,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workingCopy = yield* openWorkingCopy(root, projectId);
  const notes: Array<string> = [];

  yield* fileSystem.makeDirectory(workingCopy.componentsDirectory, { recursive: true });
  const manifest = path.join(workingCopy.directory, "Cargo.toml");
  if (!(yield* fileSystem.exists(manifest))) {
    yield* fileSystem.writeFileString(manifest, WORKSPACE_CARGO_TOML);
    notes.push(`Created the component working copy in ${workingCopy.directory}.`);
  }
  // Checks the project of an existing state, and writes the state of a new one.
  yield* workingCopy.updateState((state) => state);

  const gitignore = path.join(root, ".gitignore");
  const current = (yield* fileSystem.exists(gitignore))
    ? Option.some(yield* fileSystem.readFileString(gitignore))
    : Option.none<string>();
  const updated = gitignoreIgnoringWorkingCopy(current);
  if (Option.isSome(updated)) {
    yield* fileSystem.writeFileString(gitignore, updated.value);
    notes.push(
      Option.isSome(current)
        ? `Added ${WORKING_COPY_DIRECTORY}/ to ${gitignore}.`
        : `Created ${gitignore} to ignore ${WORKING_COPY_DIRECTORY}/.`,
    );
  }
  return { workingCopy, notes };
});
