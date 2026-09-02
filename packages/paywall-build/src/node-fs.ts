import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";
import * as Schema from "effect/Schema";
import type { BuildFileEntry } from "./fs.ts";

export type { NodeCapabilityOptions } from "./node-capabilities.ts";
export { makeNodeCapabilities } from "./node-capabilities.ts";

/** A build path attempted to traverse outside the configured root. */
export class NodeFsPathError extends Schema.TaggedErrorClass<NodeFsPathError>("NodeFsPathError")(
  "NodeFsPathError",
  { path: Schema.String },
) {}

/**
 * An Effect-native real-filesystem adapter rooted at an absolute directory.
 *
 * Every operation uses the Effect `FileSystem` and `Path` services. Build paths
 * such as `/paywall.tsx` are re-anchored under `root`, and traversal segments
 * fail with {@link NodeFsPathError}.
 */
export class NodeFs {
  constructor(private readonly root: string) {}

  private resolve(absPath: string) {
    const rel = absPath.replace(/^\/+/, "");
    if (rel.split("/").includes("..")) {
      return Effect.fail(new NodeFsPathError({ path: absPath }));
    }
    return Effect.gen(
      function* (this: NodeFs) {
        const path = yield* Path.Path;
        return path.join(this.root, ...rel.split("/"));
      }.bind(this),
    );
  }

  /** Read a UTF-8 build file. */
  read(path: string) {
    return Effect.gen(
      function* (this: NodeFs) {
        const fileSystem = yield* FileSystem.FileSystem;
        return yield* fileSystem.readFileString(yield* this.resolve(path));
      }.bind(this),
    );
  }

  /** Whether a regular file exists at the build path. */
  exists(path: string) {
    return Effect.gen(
      function* (this: NodeFs) {
        const fileSystem = yield* FileSystem.FileSystem;
        const full = yield* this.resolve(path);
        if (!(yield* fileSystem.exists(full))) return false;
        return (yield* fileSystem.stat(full)).type === "File";
      }.bind(this),
    );
  }

  /** List build paths of regular files immediately below a directory. */
  list(dir: string) {
    return Effect.gen(
      function* (this: NodeFs) {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const full = yield* this.resolve(dir);
        if (!(yield* fileSystem.exists(full))) return [];
        if ((yield* fileSystem.stat(full)).type !== "Directory") return [];
        const base = dir.replace(/\/$/, "");
        const entries = yield* fileSystem.readDirectory(full);
        const files = yield* Effect.filter(
          entries,
          (entry) =>
            fileSystem
              .stat(path.join(full, entry))
              .pipe(Effect.map((info) => info.type === "File")),
          { concurrency: "unbounded" },
        );
        return Arr.sort(
          files.map((entry) => `${base}/${entry}`),
          Order.String,
        );
      }.bind(this),
    );
  }

  /** Create or overwrite a UTF-8 build file. */
  write(path: string, content: string) {
    return Effect.gen(
      function* (this: NodeFs) {
        const fileSystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const full = yield* this.resolve(path);
        yield* fileSystem.makeDirectory(pathService.dirname(full), { recursive: true });
        yield* fileSystem.writeFileString(full, content);
      }.bind(this),
    );
  }

  /** Remove a build file if it exists. */
  remove(path: string) {
    return Effect.gen(
      function* (this: NodeFs) {
        const fileSystem = yield* FileSystem.FileSystem;
        yield* fileSystem.remove(yield* this.resolve(path), { force: true });
      }.bind(this),
    );
  }

  /** Move a build file, creating the destination directory when needed. */
  rename(from: string, to: string) {
    return Effect.gen(
      function* (this: NodeFs) {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const source = yield* this.resolve(from);
        const target = yield* this.resolve(to);
        yield* fileSystem.makeDirectory(path.dirname(target), { recursive: true });
        yield* fileSystem.rename(source, target);
      }.bind(this),
    );
  }

  /** Read every file under `root` recursively as sorted build-file entries. */
  toFiles() {
    return Effect.gen(
      function* (this: NodeFs) {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const walk = Effect.fn("NodeFs.walk")(
          function* (
            this: NodeFs,
            relDir: string,
          ): Effect.fn.Return<BuildFileEntry[], PlatformError.PlatformError> {
            const full = relDir === "" ? this.root : path.join(this.root, ...relDir.split("/"));
            const entries = Arr.sort(yield* fileSystem.readDirectory(full), Order.String);
            const children = yield* Effect.forEach(
              entries,
              (entry) => {
                const childRel = relDir === "" ? entry : `${relDir}/${entry}`;
                const childFull = path.join(full, entry);
                return Effect.flatMap(fileSystem.stat(childFull), (info) =>
                  info.type === "Directory"
                    ? walk(childRel)
                    : Effect.map(fileSystem.readFileString(childFull), (content) => [
                        { path: `/${childRel}`, content },
                      ]),
                );
              },
              { concurrency: 1 },
            );
            return children.flat();
          }.bind(this),
        );
        return yield* walk("");
      }.bind(this),
    );
  }
}
