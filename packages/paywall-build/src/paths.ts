/**
 * Absolute-POSIX ⇄ canonical-document-path helpers.
 *
 * The build reads files by ABSOLUTE POSIX path from the {@link BuildFs}
 * (`/paywall.tsx`, `/components/x.tsx`), but a component's identity is its
 * CANONICAL DOCUMENT-RELATIVE path (`components/x.tsx`). These helpers convert
 * between the two, anchored on the entry file's directory, so the component
 * registry keys line up exactly with the paths the import stage resolves from
 * the source's `import X from "./components/x"` specifiers.
 */

import { Effect } from "effect";

/** The POSIX directory of an absolute file path (no trailing slash). */
export function dirname(absPath: string): string {
  const idx = absPath.lastIndexOf("/");
  if (idx <= 0) return "/";
  return absPath.slice(0, idx);
}

/** The final path segment (with extension) of an absolute path. */
export function basename(absPath: string): string {
  const idx = absPath.lastIndexOf("/");
  if (idx < 0) return absPath;
  return absPath.slice(idx + 1);
}

/** A directory path with exactly one trailing slash — the "under dir" prefix. */
export function withTrailingSlash(dir: string): string {
  if (dir.endsWith("/")) return dir;
  return `${dir}/`;
}

/** Ascending comparison of two paths, for deterministic sort orders. */
export function comparePaths(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Like {@link joinPath}, but returns `null` instead of failing when the
 * specifier climbs above the root — the non-throwing form callers use when an
 * escaping specifier is an expected, recoverable outcome.
 */
export function tryJoinPath(baseDir: string, specifier: string): string | null {
  const base = segmentsOf(baseDir);
  for (const part of specifier.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (base.length === 0) return null;
      base.pop();
      continue;
    }
    base.push(part);
  }
  return `/${base.join("/")}`;
}

/** The path segments of a base directory (`/` ⇒ no segments). */
function segmentsOf(baseDir: string): string[] {
  if (baseDir === "/") return [];
  return baseDir.replace(/^\//, "").split("/");
}

/** Join a base directory and a POSIX-relative specifier into an absolute path. */
export function joinPath(baseDir: string, specifier: string): string {
  const joined = tryJoinPath(baseDir, specifier);
  if (joined === null) {
    return Effect.runSync(Effect.die(new Error(`Path "${specifier}" escapes the root.`)));
  }
  return joined;
}

/**
 * The canonical document-relative path for a component file, given the entry's
 * directory. Strips the entry-dir prefix and re-appends `.tsx` — the canonical
 * `components/<…>.tsx` normalization. A component under
 * `<entryDir>/components/pricing-option.tsx` canonicalizes to
 * `components/pricing-option.tsx`.
 */
export function canonicalPathFor(entryDir: string, absPath: string): string {
  return relativeToEntry(entryDir, absPath).replace(/\.tsx$/, "") + ".tsx";
}

/** `absPath` with the entry-directory prefix (or the leading slash) stripped. */
function relativeToEntry(entryDir: string, absPath: string): string {
  const prefix = entryPrefix(entryDir);
  if (absPath.startsWith(prefix)) return absPath.slice(prefix.length);
  return absPath.replace(/^\//, "");
}

/** The directory prefix (with trailing slash) an entry-relative path strips. */
function entryPrefix(entryDir: string): string {
  if (entryDir === "/") return "/";
  return `${entryDir}/`;
}
