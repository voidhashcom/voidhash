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
  return {
    async readdir(relPath): Promise<ReadonlyArray<ReadOnlyDirEntry> | null> {
      if (!dirs.has(relPath)) {
        return null;
      }
      const prefix = relPath === "" ? "" : `${relPath}/`;
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
    },
    async stat(relPath) {
      if (dirs.has(relPath)) {
        return { kind: "dir" };
      }
      const content = files.get(relPath);
      return content === undefined ? null : { kind: "file" };
    },
    async readFile(relPath) {
      return files.get(relPath) ?? null;
    },
  };
};

describe("LazyReadOnlyFs", () => {
  it("maps readdir/stat/readFile onto the provider", async () => {
    const fs = new LazyReadOnlyFs(fixtureProvider());
    expect((await fs.readdir("/")).sort()).toEqual(["a", "top.txt"]);
    expect(await fs.readdir("/a")).toEqual(["x.txt"]);
    expect(await fs.readFile("/a/x.txt")).toBe("hello");
    expect(await fs.exists("/a/x.txt")).toBe(true);
    expect(await fs.exists("/nope")).toBe(false);
    const stat = await fs.stat("/a/x.txt");
    expect(stat.isFile).toBe(true);
    expect(stat.size).toBe(5);
    expect((await fs.stat("/a")).isDirectory).toBe(true);
    expect(await fs.realpath("/a/../a/x.txt")).toBe("/a/x.txt");
  });

  it("reports typed dirents without extra stat calls", async () => {
    const fs = new LazyReadOnlyFs(fixtureProvider());
    const entries = await fs.readdirWithFileTypes("/");
    expect(entries.find((entry) => entry.name === "a")?.isDirectory).toBe(true);
    expect(entries.find((entry) => entry.name === "top.txt")?.isFile).toBe(true);
  });

  it("throws Node-shaped errors for missing and mistyped paths", async () => {
    const fs = new LazyReadOnlyFs(fixtureProvider());
    await expect(fs.readFile("/nope.txt")).rejects.toThrow(
      "ENOENT: no such file or directory, open '/nope.txt'",
    );
    await expect(fs.readFile("/a")).rejects.toThrow(
      "EISDIR: illegal operation on a directory, read '/a'",
    );
    await expect(fs.stat("/nope")).rejects.toThrow(
      "ENOENT: no such file or directory, stat '/nope'",
    );
    await expect(fs.readdir("/nope")).rejects.toThrow(
      "ENOENT: no such file or directory, scandir '/nope'",
    );
    await expect(fs.readdir("/top.txt")).rejects.toThrow(
      "ENOTDIR: not a directory, scandir '/top.txt'",
    );
    await expect(fs.readlink("/a/x.txt")).rejects.toThrow(
      "EINVAL: invalid argument, readlink '/a/x.txt'",
    );
  });

  it("throws EROFS for every mutation", async () => {
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
      await expect(promise, name).rejects.toThrow(/^EROFS: read-only file system/);
    }
  });
});
