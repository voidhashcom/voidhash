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

/** The POSIX directory of an absolute file path (no trailing slash). */
export function dirname(absPath: string): string {
  const idx = absPath.lastIndexOf("/");
  return idx <= 0 ? "/" : absPath.slice(0, idx);
}

/** The final path segment (with extension) of an absolute path. */
export function basename(absPath: string): string {
  const idx = absPath.lastIndexOf("/");
  return idx < 0 ? absPath : absPath.slice(idx + 1);
}

/** Join a base directory and a POSIX-relative specifier into an absolute path. */
export function joinPath(baseDir: string, specifier: string): string {
  const base = baseDir === "/" ? [] : baseDir.replace(/^\//, "").split("/");
  for (const part of specifier.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (base.length === 0) {
        throw new Error(`Path "${specifier}" escapes the root.`);
      }
      base.pop();
      continue;
    }
    base.push(part);
  }
  return `/${base.join("/")}`;
}

/**
 * The canonical document-relative path for a component file, given the entry's
 * directory. Strips the entry-dir prefix and re-appends `.tsx` — the canonical
 * `components/<…>.tsx` normalization. A component under
 * `<entryDir>/components/pricing-option.tsx` canonicalizes to
 * `components/pricing-option.tsx`.
 */
export function canonicalPathFor(entryDir: string, absPath: string): string {
  const prefix = entryDir === "/" ? "/" : `${entryDir}/`;
  const rel = absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath.replace(/^\//, "");
  return rel.replace(/\.tsx$/, "") + ".tsx";
}
