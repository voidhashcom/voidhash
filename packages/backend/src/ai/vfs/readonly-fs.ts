/**
 * A lazy, read-only just-bash filesystem backend over a small provider seam.
 *
 * Mounted under a {@link https://github.com/vercel-labs/just-bash MountableFs}
 * mount point, so every path this filesystem sees is already mount-relative
 * (`/` = the mount root). Listings and contents are resolved on demand from the
 * provider — nothing is materialized up front — which keeps `ls /paywalls`
 * cheap while `grep -r` still reaches every file. All mutations fail with
 * `EROFS`.
 *
 * `IFileSystem` is a Promise-shaped contract, so every operation is modelled as
 * an Effect internally and run at the class boundary: `runPromise`
 * rejects with the squashed cause, i.e. the exact {@link ReadOnlyFsError}
 * instance just-bash reads `message` off.
 */
import * as DateTime from "effect/DateTime";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { runPromise } from "../../runtime-boundary.ts";
import type { FsStat, IFileSystem } from "just-bash/browser";
import * as Schema from "effect/Schema";

type DirentEntry = Awaited<ReturnType<NonNullable<IFileSystem["readdirWithFileTypes"]>>>[number];

/** One entry of a provider directory listing. */
export interface ReadOnlyDirEntry {
  readonly name: string;
  readonly kind: "file" | "dir";
}

/**
 * The data source behind one read-only mount. Paths are provider-relative with
 * no leading slash (`""` = the mount root, `"a/b.txt"` = a nested file).
 * Implementations should memoize expensive reads per instance — one provider
 * instance lives for exactly one bash invocation.
 */
export interface ReadOnlyDirProvider {
  /** Entries of a directory, or `null` when the path is not a directory. */
  readdir(relPath: string): Promise<ReadonlyArray<ReadOnlyDirEntry> | typeof Schema.Null.Type>;
  /** Kind (and optional byte size) of a path, or `null` when it does not exist. */
  stat(relPath: string): Promise<{ kind: "file" | "dir"; size?: number } | typeof Schema.Null.Type>;
  /** Content of a file, or `null` when the path is not a file. */
  readFile(relPath: string): Promise<string | typeof Schema.Null.Type>;
}

/**
 * A filesystem failure surfaced to just-bash. It stays an `Error` subclass
 * because just-bash renders failures by reading `message` off `instanceof Error`
 * values.
 */
class ReadOnlyFsError extends Schema.TaggedErrorClass<ReadOnlyFsError>("ReadOnlyFsError")(
  "ReadOnlyFsError",
  { message: Schema.String },
) {}

// Error messages mirror just-bash's own InMemoryFs formats exactly — its
// coreutils branch on the `ENOENT:`/`EISDIR:`/... message prefixes when
// rendering `cat`/`ls` failures.
const enoent = (syscall: string, path: string): ReadOnlyFsError =>
  new ReadOnlyFsError({ message: `ENOENT: no such file or directory, ${syscall} '${path}'` });
const eisdir = (syscall: string, path: string): ReadOnlyFsError =>
  new ReadOnlyFsError({
    message: `EISDIR: illegal operation on a directory, ${syscall} '${path}'`,
  });
const enotdir = (syscall: string, path: string): ReadOnlyFsError =>
  new ReadOnlyFsError({ message: `ENOTDIR: not a directory, scandir '${path}'` });
const einval = (syscall: string, path: string): ReadOnlyFsError =>
  new ReadOnlyFsError({ message: `EINVAL: invalid argument, ${syscall} '${path}'` });
const erofs = (syscall: string, path: string): ReadOnlyFsError =>
  new ReadOnlyFsError({
    message: `EROFS: read-only file system, ${syscall} '${path}' — this folder is a read-only projection; use /tmp for scratch files`,
  });

/** Resolve `.`/`..` segments of an absolute POSIX path (no symlinks to follow). */
const normalizePath = (path: string): string => {
  const segments = Arr.reduce(path.split("/"), Arr.empty<string>(), (segments, segment) => {
    if (segment === "" || segment === ".") return segments;
    if (segment === "..") return Arr.dropRight(segments, 1);
    return Arr.append(segments, segment);
  });
  return `/${segments.join("/")}`;
};

const relative = (path: string): string => normalizePath(path).slice(1);

const FILE_MODE = 0o644;
const DIR_MODE = 0o755;

export class LazyReadOnlyFs implements IFileSystem {
  private readonly mtime = DateTime.toDateUtc(DateTime.nowUnsafe());
  private readonly pathPrefix: string;
  private readonly provider: ReadOnlyDirProvider;

  constructor(provider: ReadOnlyDirProvider, options: { readonly pathPrefix?: string } = {}) {
    this.provider = provider;
    this.pathPrefix = options.pathPrefix ?? "";
  }

  // Mounted filesystems receive mount-relative paths; errors that escape the
  // interpreter (e.g. a redirect's failed `open`) render the raw path, so
  // re-prefix with the mount point to keep messages in the user's vocabulary.
  private display(path: string): string {
    const normalized = normalizePath(path);
    if (normalized === "/") {
      return this.pathPrefix || "/";
    }
    return `${this.pathPrefix}${normalized}`;
  }

  private fsStat(kind: "file" | "dir", size: number): FsStat {
    if (kind === "file") {
      return {
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        mode: FILE_MODE,
        size,
        mtime: this.mtime,
      };
    }
    return {
      isFile: false,
      isDirectory: true,
      isSymbolicLink: false,
      mode: DIR_MODE,
      size,
      mtime: this.mtime,
    };
  }

  private readFileEffect(path: string): Effect.Effect<string, ReadOnlyFsError> {
    return Effect.fn("readFileEffect")({ self: this }, function* () {
      const content = yield* Effect.tryPromise({
        try: () => this.provider.readFile(relative(path)),
        catch: (cause) => cause,
      }).pipe(Effect.orDie);
      if (content !== null) {
        return content;
      }
      const stat = yield* Effect.tryPromise({
        try: () => this.provider.stat(relative(path)),
        catch: (cause) => cause,
      }).pipe(Effect.orDie);
      if (stat?.kind === "dir") {
        return yield* eisdir("read", this.display(path));
      }
      return yield* enoent("open", this.display(path));
    })();
  }

  private statEffect(path: string): Effect.Effect<FsStat, ReadOnlyFsError> {
    return Effect.fn("statEffect")({ self: this }, function* () {
      const stat = yield* Effect.tryPromise({
        try: () => this.provider.stat(relative(path)),
        catch: (cause) => cause,
      }).pipe(Effect.orDie);
      if (stat === null) {
        return yield* enoent("stat", this.display(path));
      }
      if (stat.kind !== "file") {
        return this.fsStat(stat.kind, 0);
      }
      if (stat.size !== undefined) {
        return this.fsStat("file", stat.size);
      }
      const content = yield* Effect.tryPromise({
        try: () => this.provider.readFile(relative(path)),
        catch: (cause) => cause,
      }).pipe(Effect.orDie);
      return this.fsStat("file", new TextEncoder().encode(content ?? "").length);
    })();
  }

  private existsEffect(path: string): Effect.Effect<boolean> {
    return Effect.map(
      Effect.tryPromise({
        try: () => this.provider.stat(relative(path)),
        catch: (cause) => cause,
      }).pipe(Effect.orDie),
      (stat) => stat !== null,
    );
  }

  /** Provider listing of a directory, failing the way `scandir` does. */
  private listEffect(
    path: string,
  ): Effect.Effect<ReadonlyArray<ReadOnlyDirEntry>, ReadOnlyFsError> {
    return Effect.fn("listEffect")({ self: this }, function* () {
      const entries = yield* Effect.tryPromise({
        try: () => this.provider.readdir(relative(path)),
        catch: (cause) => cause,
      }).pipe(Effect.orDie);
      if (entries !== null) {
        return entries;
      }
      const stat = yield* Effect.tryPromise({
        try: () => this.provider.stat(relative(path)),
        catch: (cause) => cause,
      }).pipe(Effect.orDie);
      if (stat === null) {
        return yield* enoent("scandir", this.display(path));
      }
      return yield* enotdir("scandir", this.display(path));
    })();
  }

  readFile(path: string): Promise<string> {
    return runPromise(this.readFileEffect(path));
  }

  readFileBuffer(path: string): Promise<Uint8Array> {
    return runPromise(
      Effect.map(this.readFileEffect(path), (content) => new TextEncoder().encode(content)),
    );
  }

  writeFile(path: string): Promise<void> {
    return runPromise(Effect.fail(erofs("open", this.display(path))));
  }

  appendFile(path: string): Promise<void> {
    return runPromise(Effect.fail(erofs("open", this.display(path))));
  }

  exists(path: string): Promise<boolean> {
    return runPromise(this.existsEffect(path));
  }

  stat(path: string): Promise<FsStat> {
    return runPromise(this.statEffect(path));
  }

  lstat(path: string): Promise<FsStat> {
    return this.stat(path);
  }

  mkdir(path: string): Promise<void> {
    return runPromise(Effect.fail(erofs("mkdir", this.display(path))));
  }

  readdir(path: string): Promise<string[]> {
    return runPromise(
      Effect.map(this.listEffect(path), (entries) => entries.map((entry) => entry.name)),
    );
  }

  readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
    return runPromise(
      Effect.map(this.listEffect(path), (entries) =>
        entries.map((entry) => ({
          name: entry.name,
          isFile: entry.kind === "file",
          isDirectory: entry.kind === "dir",
          isSymbolicLink: false,
        })),
      ),
    );
  }

  rm(path: string): Promise<void> {
    return runPromise(Effect.fail(erofs("rm", this.display(path))));
  }

  cp(src: string, dest: string): Promise<void> {
    return runPromise(Effect.fail(erofs("cp", this.display(dest))));
  }

  mv(src: string): Promise<void> {
    return runPromise(Effect.fail(erofs("rename", this.display(src))));
  }

  resolvePath(base: string, path: string): string {
    if (path.startsWith("/")) {
      return normalizePath(path);
    }
    return normalizePath(`${base}/${path}`);
  }

  // Sync by contract, so a lazy backend cannot enumerate here. Nothing in
  // just-bash consumes it outside FS-composition internals (globs walk
  // `readdir`), so reporting just the root is safe.
  getAllPaths(): string[] {
    return ["/"];
  }

  chmod(path: string): Promise<void> {
    return runPromise(Effect.fail(erofs("chmod", this.display(path))));
  }

  symlink(_target: string, linkPath: string): Promise<void> {
    return runPromise(Effect.fail(erofs("symlink", this.display(linkPath))));
  }

  link(_existingPath: string, newPath: string): Promise<void> {
    return runPromise(Effect.fail(erofs("link", this.display(newPath))));
  }

  readlink(path: string): Promise<string> {
    return runPromise(Effect.fail(einval("readlink", this.display(path))));
  }

  realpath(path: string): Promise<string> {
    return runPromise(
      Effect.fn("realpath")({ self: this }, function* () {
        const found = yield* this.existsEffect(path);
        if (!found) {
          return yield* enoent("realpath", this.display(path));
        }
        return normalizePath(path);
      })(),
    );
  }

  utimes(path: string): Promise<void> {
    return runPromise(Effect.fail(erofs("utimes", this.display(path))));
  }
}
