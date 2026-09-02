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

import * as Effect from "effect/Effect";
import * as EffectRuntime from "effect/Effect";
import * as Option from "effect/Option";

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
export function tryJoinPath(baseDir: string, specifier: string): Option.Option<string> {
  return Option.map(
    specifier.split("/").reduce<Option.Option<readonly string[]>>(
      (current, part) => {
        if (part === "" || part === ".") return current;
        return Option.flatMap(current, (segments) => {
          if (part !== "..") return Option.some([...segments, part]);
          const [, ...reversedRest] = [...segments].reverse();
          return segments[0] === undefined ? Option.none() : Option.some(reversedRest.reverse());
        });
      },
      Option.some(segmentsOf(baseDir)),
    ),
    (segments) => `/${segments.join("/")}`,
  );
}

/** The path segments of a base directory (`/` ⇒ no segments). */
function segmentsOf(baseDir: string): string[] {
  if (baseDir === "/") return [];
  return baseDir.replace(/^\//, "").split("/");
}

/** Join a base directory and a POSIX-relative specifier into an absolute path. */
export function joinPath(baseDir: string, specifier: string): string {
  const joined = tryJoinPath(baseDir, specifier);
  if (Option.isNone(joined)) {
    return EffectRuntime.runSync(
      Effect.die(new TypeError(`Path "${specifier}" escapes the root.`)),
    );
  }
  return joined.value;
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
