/**
 * The flat, absolute-POSIX-path filesystem seam the build system reads and
 * writes through. Every path is an absolute POSIX path (`/paywall.tsx`,
 * `/components/pricing-option.tsx`); there is no cwd and no `..` traversal — the
 * build never touches a real disk unless the caller wires a {@link BuildFs} that
 * does (see `./node`).
 *
 * The build orchestration ({@link buildPaywall}) only ever needs the read side
 * (`read`/`list`/`exists`); the write side exists for the in-memory/real-FS
 * implementations that host tooling (forks, tests) layer on top.
 */

/** A file entry as consumed/produced by the interop helpers. */
export interface BuildFileEntry {
  readonly path: string;
  readonly content: string;
}

/** The filesystem seam every build stage reads through. */
export interface BuildFs {
  /** Read a file's text. Rejects (throws) if the path does not exist. */
  read(path: string): string;
  /** List absolute paths of files directly under `dir` (non-recursive). */
  list(dir: string): readonly string[];
  /** Whether a file exists at `path`. */
  exists(path: string): boolean;
  /** Write (create or overwrite) a file. */
  write(path: string, content: string): void;
  /** Remove a file. No-op if absent. */
  remove(path: string): void;
  /** Rename (move) a file. Rejects (throws) if `from` does not exist. */
  rename(from: string, to: string): void;
}

/** The read-only slice of {@link BuildFs} the build stages actually consume. */
export type BuildReadFs = Pick<BuildFs, "read" | "list" | "exists">;
