import { Effect } from "effect";
import ts from "typescript";
import type { BuildDiagnostic } from "./diagnostics.ts";
import { error } from "./diagnostics.ts";
import type { BuildReadFs } from "./fs.ts";
import {
  basename,
  canonicalPathFor,
  comparePaths,
  dirname,
  joinPath,
  tryJoinPath,
} from "./paths.ts";

/** The root SDK specifier the surface is imported from. */
const ROOT_SPECIFIER = "@voidhash/paywalls";
/** The catalog namespace prefix (pass-through — resolved by a later stage). */
const CATALOG_PREFIX = "catalog:";

/** A component discovered by the imports stage. */
export interface ResolvedComponent {
  /** Absolute POSIX path of the component file on the {@link BuildFs}. */
  readonly absPath: string;
  /** Canonical document-relative path (`components/<basename>.tsx`). */
  readonly path: string;
  /** The component's source text. */
  readonly source: string;
  /** True when reached via an import from the entry; false for library files. */
  readonly imported: boolean;
}

/** The imports stage output. */
export interface ResolveImportsResult {
  /** The parsed entry source (read once, reused by later stages). */
  readonly entrySource: string;
  /** Absolute directory of the entry file. */
  readonly entryDir: string;
  /** Every component in the build set, ordered by canonical path. */
  readonly components: readonly ResolvedComponent[];
  readonly diagnostics: readonly BuildDiagnostic[];
}

/** 1-based line/column of a node's start in a source file. */
function positionOf(source: ts.SourceFile, node: ts.Node): { line: number; column: number } {
  const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
  return { line: line + 1, column: character + 1 };
}

/**
 * Resolve a relative specifier against the FS, probing `.tsx` then `.ts` then
 * the bare path. Returns the absolute path of the first hit, or `null`.
 */
function resolveRelative(fs: BuildReadFs, fromDir: string, specifier: string): string | null {
  // A specifier that escapes the root simply does not resolve.
  const base = tryJoinPath(fromDir, specifier);
  if (base === null) return null;
  for (const candidate of candidatesFor(base)) {
    if (fs.exists(candidate)) return candidate;
  }
  return null;
}

/** The probe order for a joined specifier: an explicit extension wins outright. */
function candidatesFor(base: string): readonly string[] {
  if (base.endsWith(".tsx") || base.endsWith(".ts")) return [base];
  return [`${base}.tsx`, `${base}.ts`, base];
}

/**
 * Stage 1 — imports.
 *
 * Parses the entry with `ts.createSourceFile` (NEVER executes it), collects its
 * import declarations, and resolves each to the component set:
 *
 * - `@voidhash/paywalls` — the SDK surface, ok.
 * - `@voidhash/paywalls/*` (e.g. `/compose`) — error, positioned at the import
 *   (only the root SDK surface is importable; a subpath import is rejected here
 *   with a precise import position).
 * - `catalog:<slug>` — pass-through (a catalog reference resolved downstream).
 * - relative — resolved against the FS with `.tsx`/`.ts` probing; an
 *   unresolvable relative import is an error at the import.
 * - any other bare specifier — error.
 *
 * Component files reached this way ALSO have their own imports scanned: a
 * component may import only `@voidhash/paywalls` — a relative import FROM a
 * component file is a v1 error (a `resolveImport` seam is kept for the future).
 *
 * Finally, any `*.tsx` under `<entryDir>/components/` that was not imported is
 * added as a LIBRARY entry (built + carried in artifacts, absent from the
 * composition).
 */
export function resolveImports(fs: BuildReadFs, entryPath: string): ResolveImportsResult {
  const diagnostics: BuildDiagnostic[] = [];
  const entryDir = dirname(entryPath);
  const entrySource = fs.read(entryPath);
  const entryFile = ts.createSourceFile(
    basename(entryPath),
    entrySource,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );

  // absPath → resolved component (dedup across the entry + component scans).
  const components = new Map<string, ResolvedComponent>();

  for (const statement of entryFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specNode = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specNode)) continue;
    const specifier = specNode.text;
    const pos = positionOf(entryFile, specNode);

    if (specifier === ROOT_SPECIFIER) continue;
    if (specifier.startsWith(`${ROOT_SPECIFIER}/`)) {
      diagnostics.push(
        error(
          entryPath,
          "imports",
          `Cannot import from "${specifier}" — a paywall file imports the surface from "${ROOT_SPECIFIER}" and components by relative path.`,
          pos,
        ),
      );
      continue;
    }
    if (specifier.startsWith(CATALOG_PREFIX)) continue;
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const absPath = resolveRelative(fs, entryDir, specifier);
      if (absPath === null) {
        diagnostics.push(
          error(
            entryPath,
            "imports",
            `Cannot resolve component import "${specifier}".`,
            pos,
          ),
        );
        continue;
      }
      if (!components.has(absPath)) {
        components.set(absPath, {
          absPath,
          path: canonicalPathFor(entryDir, absPath),
          source: fs.read(absPath),
          imported: true,
        });
      }
      continue;
    }
    diagnostics.push(
      error(
        entryPath,
        "imports",
        `Cannot import from "${specifier}" — only "${ROOT_SPECIFIER}", relative components, and "catalog:" are allowed.`,
        pos,
      ),
    );
  }

  // Component-file imports: only @voidhash/paywalls is legal in v1.
  for (const component of components.values()) {
    validateComponentImports(component, diagnostics);
  }

  // Library files: unimported *.tsx directly under <entryDir>/components/.
  const componentsDir = joinPath(entryDir, "components");
  if (dirExists(fs, componentsDir)) {
    for (const absPath of fs.list(componentsDir)) {
      if (!absPath.endsWith(".tsx")) continue;
      if (components.has(absPath)) continue;
      const component: ResolvedComponent = {
        absPath,
        path: canonicalPathFor(entryDir, absPath),
        source: fs.read(absPath),
        imported: false,
      };
      components.set(absPath, component);
      validateComponentImports(component, diagnostics);
    }
  }

  const ordered = [...components.values()].sort((a, b) => comparePaths(a.path, b.path));

  return { entrySource, entryDir, components: ordered, diagnostics };
}

/**
 * Scan a component file's imports. A component may import ONLY
 * `@voidhash/paywalls`; a relative import is a v1 error. The relative branch is
 * the future `resolveImport` seam (cross-component imports).
 */
function validateComponentImports(
  component: ResolvedComponent,
  diagnostics: BuildDiagnostic[],
): void {
  const file = ts.createSourceFile(
    basename(component.absPath),
    component.source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specNode = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specNode)) continue;
    const specifier = specNode.text;
    if (specifier === ROOT_SPECIFIER) continue;
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const { line, character } = file.getLineAndCharacterOfPosition(specNode.getStart(file));
      diagnostics.push(
        error(
          component.path,
          "imports",
          `A component may only import "${ROOT_SPECIFIER}"; relative imports from a component are not supported.`,
          { line: line + 1, column: character + 1 },
        ),
      );
      continue;
    }
    const { line, character } = file.getLineAndCharacterOfPosition(specNode.getStart(file));
    diagnostics.push(
      error(
        component.path,
        "imports",
        `A component may only import "${ROOT_SPECIFIER}"; "${specifier}" is not allowed.`,
        { line: line + 1, column: character + 1 },
      ),
    );
  }
}

/** Whether a directory has any listed files (the flat FS has no real dir nodes). */
function dirExists(fs: BuildReadFs, dir: string): boolean {
  // A host FS may reject an unknown directory outright; that reads as "absent".
  return Effect.runSync(
    Effect.try({
      try: () => fs.list(dir).length > 0,
      catch: (cause) => cause,
    }).pipe(Effect.orElseSucceed(() => false)),
  );
}
