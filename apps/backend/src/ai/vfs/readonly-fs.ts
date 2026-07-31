/**
 * A lazy, read-only just-bash filesystem backend over a small provider seam.
 *
 * Mounted under a {@link https://github.com/vercel-labs/just-bash MountableFs}
 * mount point, so every path this filesystem sees is already mount-relative
 * (`/` = the mount root). Listings and contents are resolved on demand from the
 * provider — nothing is materialized up front — which keeps `ls /paywalls`
 * cheap while `grep -r` still reaches every file. All mutations throw `EROFS`.
 */
import type { FsStat, IFileSystem } from "just-bash/browser";

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
  readdir(relPath: string): Promise<ReadonlyArray<ReadOnlyDirEntry> | null>;
  /** Kind (and optional byte size) of a path, or `null` when it does not exist. */
  stat(relPath: string): Promise<{ kind: "file" | "dir"; size?: number } | null>;
  /** Content of a file, or `null` when the path is not a file. */
  readFile(relPath: string): Promise<string | null>;
}

// Error messages mirror just-bash's own InMemoryFs formats exactly — its
// coreutils branch on the `ENOENT:`/`EISDIR:`/... message prefixes when
// rendering `cat`/`ls` failures.
const enoent = (syscall: string, path: string): Error =>
  new Error(`ENOENT: no such file or directory, ${syscall} '${path}'`);
const eisdir = (syscall: string, path: string): Error =>
  new Error(`EISDIR: illegal operation on a directory, ${syscall} '${path}'`);
const enotdir = (syscall: string, path: string): Error =>
  new Error(`ENOTDIR: not a directory, scandir '${path}'`);
const einval = (syscall: string, path: string): Error =>
  new Error(`EINVAL: invalid argument, ${syscall} '${path}'`);
const erofs = (syscall: string, path: string): Error =>
  new Error(
    `EROFS: read-only file system, ${syscall} '${path}' — this folder is a read-only projection; use /tmp for scratch files`,
  );

/** Resolve `.`/`..` segments of an absolute POSIX path (no symlinks to follow). */
const normalizePath = (path: string): string => {
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join("/")}`;
};

const relative = (path: string): string => normalizePath(path).slice(1);

const FILE_MODE = 0o644;
const DIR_MODE = 0o755;

export class LazyReadOnlyFs implements IFileSystem {
  private readonly mtime = new Date();
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
    return normalized === "/" ? this.pathPrefix || "/" : `${this.pathPrefix}${normalized}`;
  }

  async readFile(path: string): Promise<string> {
    const content = await this.provider.readFile(relative(path));
    if (content !== null) {
      return content;
    }
    const stat = await this.provider.stat(relative(path));
    throw stat?.kind === "dir"
      ? eisdir("read", this.display(path))
      : enoent("open", this.display(path));
  }

  async readFileBuffer(path: string): Promise<Uint8Array> {
    return new TextEncoder().encode(await this.readFile(path));
  }

  async writeFile(path: string): Promise<void> {
    throw erofs("open", this.display(path));
  }

  async appendFile(path: string): Promise<void> {
    throw erofs("open", this.display(path));
  }

  async exists(path: string): Promise<boolean> {
    return (await this.provider.stat(relative(path))) !== null;
  }

  async stat(path: string): Promise<FsStat> {
    const stat = await this.provider.stat(relative(path));
    if (stat === null) {
      throw enoent("stat", this.display(path));
    }
    const size =
      stat.kind === "file"
        ? (stat.size ??
          new TextEncoder().encode((await this.provider.readFile(relative(path))) ?? "").length)
        : 0;
    return {
      isFile: stat.kind === "file",
      isDirectory: stat.kind === "dir",
      isSymbolicLink: false,
      mode: stat.kind === "file" ? FILE_MODE : DIR_MODE,
      size,
      mtime: this.mtime,
    };
  }

  async lstat(path: string): Promise<FsStat> {
    return this.stat(path);
  }

  async mkdir(path: string): Promise<void> {
    throw erofs("mkdir", this.display(path));
  }

  async readdir(path: string): Promise<string[]> {
    const entries = await this.provider.readdir(relative(path));
    if (entries === null) {
      const stat = await this.provider.stat(relative(path));
      throw stat === null
        ? enoent("scandir", this.display(path))
        : enotdir("scandir", this.display(path));
    }
    return entries.map((entry) => entry.name);
  }

  async readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
    const entries = await this.provider.readdir(relative(path));
    if (entries === null) {
      const stat = await this.provider.stat(relative(path));
      throw stat === null
        ? enoent("scandir", this.display(path))
        : enotdir("scandir", this.display(path));
    }
    return entries.map((entry) => ({
      name: entry.name,
      isFile: entry.kind === "file",
      isDirectory: entry.kind === "dir",
      isSymbolicLink: false,
    }));
  }

  async rm(path: string): Promise<void> {
    throw erofs("rm", this.display(path));
  }

  async cp(src: string, dest: string): Promise<void> {
    throw erofs("cp", this.display(dest));
  }

  async mv(src: string): Promise<void> {
    throw erofs("rename", this.display(src));
  }

  resolvePath(base: string, path: string): string {
    return path.startsWith("/") ? normalizePath(path) : normalizePath(`${base}/${path}`);
  }

  // Sync by contract, so a lazy backend cannot enumerate here. Nothing in
  // just-bash consumes it outside FS-composition internals (globs walk
  // `readdir`), so reporting just the root is safe.
  getAllPaths(): string[] {
    return ["/"];
  }

  async chmod(path: string): Promise<void> {
    throw erofs("chmod", this.display(path));
  }

  async symlink(_target: string, linkPath: string): Promise<void> {
    throw erofs("symlink", this.display(linkPath));
  }

  async link(_existingPath: string, newPath: string): Promise<void> {
    throw erofs("link", this.display(newPath));
  }

  async readlink(path: string): Promise<string> {
    throw einval("readlink", this.display(path));
  }

  async realpath(path: string): Promise<string> {
    if (!(await this.exists(path))) {
      throw enoent("realpath", this.display(path));
    }
    return normalizePath(path);
  }

  async utimes(path: string): Promise<void> {
    throw erofs("utimes", this.display(path));
  }
}
