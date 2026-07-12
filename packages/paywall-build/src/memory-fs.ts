import type { BuildFileEntry, BuildFs } from "./fs.ts";

/**
 * A hand-rolled in-memory {@link BuildFs} over a flat `Map<path, content>`.
 *
 * Not `memfs`: the model here is intentionally trivial (a flat map of absolute
 * POSIX paths, no real directory nodes), so a dependency-free map is both
 * lighter and easier to reason about. `list(dir)` derives directory membership
 * from the key set — a path is "under `dir`" when it starts with `dir + "/"` and
 * has no further slash. Callers use {@link toFiles}/{@link fromFiles} to move a
 * fork's files in and out.
 */
export class MemoryFs implements BuildFs {
  private readonly files: Map<string, string>;

  constructor(initial?: Iterable<readonly [string, string]>) {
    this.files = new Map(initial);
  }

  read(path: string): string {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`MemoryFs: no such file: ${path}`);
    }
    return content;
  }

  exists(path: string): boolean {
    return this.files.has(path);
  }

  list(dir: string): readonly string[] {
    const prefix = dir.endsWith("/") ? dir : `${dir}/`;
    const out: string[] = [];
    for (const path of this.files.keys()) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      if (rest.length === 0 || rest.includes("/")) continue;
      out.push(path);
    }
    // Deterministic ordering so build outputs over a MemoryFs are stable.
    return out.sort();
  }

  write(path: string, content: string): void {
    this.files.set(path, content);
  }

  remove(path: string): void {
    this.files.delete(path);
  }

  rename(from: string, to: string): void {
    const content = this.files.get(from);
    if (content === undefined) {
      throw new Error(`MemoryFs: no such file: ${from}`);
    }
    this.files.delete(from);
    this.files.set(to, content);
  }

  /** Snapshot the current files as a sorted `{ path, content }[]`. */
  toFiles(): BuildFileEntry[] {
    return [...this.files.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([path, content]) => ({ path, content }));
  }

  /** Build a {@link MemoryFs} from a `{ path, content }[]`. */
  static fromFiles(files: Iterable<BuildFileEntry>): MemoryFs {
    const fs = new MemoryFs();
    for (const { path, content } of files) {
      fs.write(path, content);
    }
    return fs;
  }
}
