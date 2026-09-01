import * as Effect from "effect/Effect";
import * as EffectRuntime from "effect/Effect";
import * as Arr from "effect/Array";
import * as Order from "effect/Order";
import * as R from "effect/Record";

import type { BuildFileEntry, BuildFs } from "./fs.ts";
import { withTrailingSlash } from "./paths.ts";

/** Raises a defect from the synchronous `BuildFs` surface, which has no error channel. */
const dieWith = (message: string): never => EffectRuntime.runSync(Effect.die(new TypeError(message)));

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
  private readonly files: Record<string, string>;

  constructor(initial?: Iterable<readonly [string, string]>) {
    this.files = initial ? R.fromEntries(initial) : {};
  }

  read(path: string): string {
    const content = this.files[path];
    if (content === undefined) {
      return dieWith(`MemoryFs: no such file: ${path}`);
    }
    return content;
  }

  exists(path: string): boolean {
    return path in this.files;
  }

  list(dir: string): readonly string[] {
    const prefix = withTrailingSlash(dir);
    return Arr.sort(
      R.keys(this.files).filter((path) => {
        if (!path.startsWith(prefix)) return false;
        const rest = path.slice(prefix.length);
        return rest !== "" && !rest.includes("/");
      }),
      Order.String,
    );
  }

  write(path: string, content: string): void {
    this.files[path] = content;
  }

  remove(path: string): void {
    delete this.files[path];
  }

  rename(from: string, to: string): void {
    const content = this.files[from];
    if (content === undefined) {
      return dieWith(`MemoryFs: no such file: ${from}`);
    }
    delete this.files[from];
    this.files[to] = content;
  }

  /** Snapshot the current files as a sorted `{ path, content }[]`. */
  toFiles(): BuildFileEntry[] {
    const entries = R.toEntries(this.files).map(([path, content]): BuildFileEntry => ({
      path,
      content,
    }));
    return Arr.sort(
      entries,
      Order.mapInput(Order.String, (entry: BuildFileEntry) => entry.path),
    );
  }

  /** Build a {@link MemoryFs} from a `{ path, content }[]`. */
  static fromFiles(files: Iterable<BuildFileEntry>): MemoryFs {
    const fs = new MemoryFs();
    Array.from(files).forEach(({ path, content }) => {
      fs.write(path, content);
    });
    return fs;
  }
}
