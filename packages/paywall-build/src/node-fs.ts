import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname as nodeDirname, join, posix } from "node:path";
import type { BuildFileEntry, BuildFs } from "./fs.ts";

export type { NodeCapabilityOptions } from "./node-capabilities.ts";
export { makeNodeCapabilities } from "./node-capabilities.ts";

/**
 * A real-filesystem {@link BuildFs} rooted at an absolute directory.
 *
 * Exported ONLY from the `@voidhash/paywall-build/node` subpath so it (and
 * its `node:fs` import) never lands in a browser/workerd bundle of the main
 * entry. The build's absolute POSIX paths (`/paywall.tsx`) are re-anchored under
 * `root` (`<root>/paywall.tsx`); path segments are validated against traversal.
 */
export class NodeFs implements BuildFs {
  constructor(private readonly root: string) {}

  private resolve(absPath: string): string {
    // Absolute POSIX build paths map to <root>/<path-without-leading-slash>.
    const rel = absPath.replace(/^\/+/, "");
    if (rel.split("/").includes("..")) {
      throw new Error(`NodeFs: path traversal is not allowed: ${absPath}`);
    }
    return join(this.root, ...rel.split("/"));
  }

  read(path: string): string {
    return readFileSync(this.resolve(path), "utf8");
  }

  exists(path: string): boolean {
    const full = this.resolve(path);
    return existsSync(full) && statSync(full).isFile();
  }

  list(dir: string): readonly string[] {
    const full = this.resolve(dir);
    if (!existsSync(full) || !statSync(full).isDirectory()) return [];
    const base = dir.replace(/\/$/, "");
    return readdirSync(full)
      .filter((entry) => statSync(join(full, entry)).isFile())
      .map((entry) => posix.join(base, entry))
      .sort();
  }

  write(path: string, content: string): void {
    const full = this.resolve(path);
    mkdirSync(nodeDirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
  }

  remove(path: string): void {
    rmSync(this.resolve(path), { force: true });
  }

  rename(from: string, to: string): void {
    const target = this.resolve(to);
    mkdirSync(nodeDirname(target), { recursive: true });
    renameSync(this.resolve(from), target);
  }

  /** Read every file under `root` recursively as `{ path, content }[]`. */
  toFiles(): BuildFileEntry[] {
    const out: BuildFileEntry[] = [];
    const dirPath = (relDir: string): string => {
      if (relDir === "") return this.root;
      return join(this.root, ...relDir.split("/"));
    };
    const childPath = (relDir: string, entry: string): string => {
      if (relDir === "") return entry;
      return `${relDir}/${entry}`;
    };
    const walk = (relDir: string): void => {
      const full = dirPath(relDir);
      for (const entry of readdirSync(full).sort()) {
        const childRel = childPath(relDir, entry);
        const childFull = join(full, entry);
        if (statSync(childFull).isDirectory()) {
          walk(childRel);
        } else {
          out.push({ path: `/${childRel}`, content: readFileSync(childFull, "utf8") });
        }
      }
    };
    walk("");
    return out;
  }
}
