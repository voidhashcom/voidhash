import { pick } from "@voidhash/lib/lang";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { LazyReadOnlyFs, type ReadOnlyDirEntry, type ReadOnlyDirProvider } from "./readonly-fs.ts";

/**
 * A fixture provider over a static two-level tree:
 *   /a          (dir)
 *   /a/x.txt    "hello"
 *   /top.txt    "root file"
 */
const fixtureProvider = (): ReadOnlyDirProvider => {
  const files = new Map<string, string>([
    ["a/x.txt", "hello"],
    ["top.txt", "root file"],
  ]);
  const dirs = new Set(["", "a"]);
  const listing = (relPath: string): ReadonlyArray<ReadOnlyDirEntry> | null => {
    if (!dirs.has(relPath)) {
      return null;
    }
    const prefix = pick(relPath === "", "", `${relPath}/`);
    const entries: ReadOnlyDirEntry[] = [];
    for (const dir of dirs) {
      if (dir !== "" && dir.startsWith(prefix) && !dir.slice(prefix.length).includes("/")) {
        entries.push({ name: dir.slice(prefix.length), kind: "dir" });
      }
    }
    for (const file of files.keys()) {
      if (file.startsWith(prefix) && !file.slice(prefix.length).includes("/")) {
        entries.push({ name: file.slice(prefix.length), kind: "file" });
      }
    }
    return entries;
  };
  const statOf = (relPath: string): { kind: "file" | "dir" } | null => {
    if (dirs.has(relPath)) {
      return { kind: "dir" };
    }
    if (files.get(relPath) === undefined) {
      return null;
    }
    return { kind: "file" };
  };
  return {
    readdir(relPath): Promise<ReadonlyArray<ReadOnlyDirEntry> | null> {
      return Effect.runPromise(Effect.sync(() => listing(relPath)));
    },
    stat(relPath) {
      return Effect.runPromise(Effect.sync(() => statOf(relPath)));
    },
    readFile(relPath) {
      return Effect.runPromise(Effect.sync(() => files.get(relPath) ?? null));
    },
  };
};

describe("LazyReadOnlyFs", () => {
  it("maps readdir/stat/readFile onto the provider", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = new LazyReadOnlyFs(fixtureProvider());
        expect((yield* Effect.promise(() => fs.readdir("/"))).sort()).toEqual(["a", "top.txt"]);
        expect(yield* Effect.promise(() => fs.readdir("/a"))).toEqual(["x.txt"]);
        expect(yield* Effect.promise(() => fs.readFile("/a/x.txt"))).toBe("hello");
        expect(yield* Effect.promise(() => fs.exists("/a/x.txt"))).toBe(true);
        expect(yield* Effect.promise(() => fs.exists("/nope"))).toBe(false);
        const stat = yield* Effect.promise(() => fs.stat("/a/x.txt"));
        expect(stat.isFile).toBe(true);
        expect(stat.size).toBe(5);
        expect((yield* Effect.promise(() => fs.stat("/a"))).isDirectory).toBe(true);
        expect(yield* Effect.promise(() => fs.realpath("/a/../a/x.txt"))).toBe("/a/x.txt");
      }),
    ));

  it("reports typed dirents without extra stat calls", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = new LazyReadOnlyFs(fixtureProvider());
        const entries = yield* Effect.promise(() => fs.readdirWithFileTypes("/"));
        expect(entries.find((entry) => entry.name === "a")?.isDirectory).toBe(true);
        expect(entries.find((entry) => entry.name === "top.txt")?.isFile).toBe(true);
      }),
    ));

  it("throws Node-shaped errors for missing and mistyped paths", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = new LazyReadOnlyFs(fixtureProvider());
        const rejects = (promise: Promise<unknown>, message: string) =>
          Effect.promise(() => expect(promise).rejects.toThrow(message));
        yield* rejects(
          fs.readFile("/nope.txt"),
          "ENOENT: no such file or directory, open '/nope.txt'",
        );
        yield* rejects(
          fs.readFile("/a"),
          "EISDIR: illegal operation on a directory, read '/a'",
        );
        yield* rejects(fs.stat("/nope"), "ENOENT: no such file or directory, stat '/nope'");
        yield* rejects(fs.readdir("/nope"), "ENOENT: no such file or directory, scandir '/nope'");
        yield* rejects(fs.readdir("/top.txt"), "ENOTDIR: not a directory, scandir '/top.txt'");
        yield* rejects(
          fs.readlink("/a/x.txt"),
          "EINVAL: invalid argument, readlink '/a/x.txt'",
        );
      }),
    ));

  it("throws EROFS for every mutation", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = new LazyReadOnlyFs(fixtureProvider());
        const mutations: ReadonlyArray<[string, Promise<unknown>]> = [
          ["writeFile", fs.writeFile("/a/x.txt")],
          ["appendFile", fs.appendFile("/a/x.txt")],
          ["mkdir", fs.mkdir("/b")],
          ["rm", fs.rm("/a/x.txt")],
          ["cp", fs.cp("/a/x.txt", "/a/y.txt")],
          ["mv", fs.mv("/a/x.txt")],
          ["chmod", fs.chmod("/a/x.txt")],
          ["symlink", fs.symlink("/a/x.txt", "/a/l")],
          ["link", fs.link("/a/x.txt", "/a/l")],
          ["utimes", fs.utimes("/a/x.txt")],
        ];
        for (const [name, promise] of mutations) {
          yield* Effect.promise(() =>
            expect(promise, name).rejects.toThrow(/^EROFS: read-only file system/),
          );
        }
      }),
    ));
});
