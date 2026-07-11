/**
 * The workspace path vocabulary — the single string scheme every tool, MCP
 * resource, and file tree agrees on. A workspace is a virtual filesystem
 * projection over a project's paywalls; a path names one file inside it.
 *
 * ```
 * /paywalls/<paywall-slug>/paywall.tsx                ← the composition
 * /paywalls/<paywall-slug>/components/<basename>.tsx  ← a code-component source
 * ```
 *
 * A paywall slug is the stable per-paywall directory name (a rename never
 * changes a slug), so composition paths are stable. A component is identified by
 * its FILE NAME (`<basename>.tsx`) — the file basename IS the component's
 * identity, matching the canonical document-relative path
 * (`components/<basename>.tsx`) a `codeComponent`/instance node stores. Renaming
 * a component is a file MOVE (a path change), not a display-name edit. The
 * top-level `/components/*` namespace (a project/org-shared component library) is
 * *reserved* — parsed and rejected as not-yet-supported so the vocabulary is
 * forward-compatible.
 */

/** Fixed filename of a paywall's composition file within its directory. */
export const COMPOSITION_FILENAME = "paywall.tsx";

const PAYWALLS_SEGMENT = "paywalls";
const COMPONENTS_SEGMENT = "components";

/**
 * A paywall slug segment: an identifier with no path separators. Kept
 * intentionally permissive (paywall slugs are generated upstream); it only rules
 * out characters that would break the path grammar itself.
 */
const SLUG = /^[^/]+$/;

/** A parsed workspace path — a discriminated union over the file kinds. */
export type WorkspacePath = CompositionPath | ComponentPath;

/** `/paywalls/<paywallSlug>/paywall.tsx` — a paywall's composition file. */
export interface CompositionPath {
  readonly kind: "composition";
  readonly paywallSlug: string;
}

/**
 * `/paywalls/<paywallSlug>/components/<fileName>` — a component source. The
 * `fileName` is the file basename INCLUDING its `.tsx` extension (e.g.
 * `pricing-option.tsx`); it is the component's identity and matches the
 * `codeComponent`/instance nodes' canonical `components/<fileName>` path.
 */
export interface ComponentPath {
  readonly kind: "component";
  readonly paywallSlug: string;
  readonly fileName: string;
}

/** Why a path string is not a usable workspace path. */
export type WorkspacePathError =
  | { readonly kind: "malformed"; readonly reason: string }
  | { readonly kind: "reserved"; readonly reason: string };

/** Result of {@link parseWorkspacePath}: a parsed path or a typed error. */
export type ParseWorkspacePathResult =
  | { readonly ok: true; readonly path: WorkspacePath }
  | { readonly ok: false; readonly error: WorkspacePathError };

/** Formats a paywall's composition path. */
export function formatCompositionPath(paywallSlug: string): string {
  return `/${PAYWALLS_SEGMENT}/${paywallSlug}/${COMPOSITION_FILENAME}`;
}

/**
 * Formats a code-component's source path. `fileName` is the file basename
 * including its `.tsx` extension (`pricing-option.tsx`) — the component's
 * identity.
 */
export function formatComponentPath(paywallSlug: string, fileName: string): string {
  return `/${PAYWALLS_SEGMENT}/${paywallSlug}/${COMPONENTS_SEGMENT}/${fileName}`;
}

/** Formats a parsed {@link WorkspacePath} back to its string form. */
export function formatWorkspacePath(path: WorkspacePath): string {
  return path.kind === "composition"
    ? formatCompositionPath(path.paywallSlug)
    : formatComponentPath(path.paywallSlug, path.fileName);
}

/**
 * The canonical document-relative path (`components/<fileName>`) a `codeComponent`
 * definition and its local instances store, given a workspace-absolute component
 * path (`/paywalls/<slug>/components/<fileName>`). This is the identity key the
 * mimic bridge (lift/lower) round-trips — dropping the `/paywalls/<slug>/`
 * prefix. Returns `undefined` when the input is not a component path.
 */
export function docRelativeComponentPath(workspaceAbsolutePath: string): string | undefined {
  const parsed = parseWorkspacePath(workspaceAbsolutePath);
  if (!parsed.ok || parsed.path.kind !== "component") {
    return undefined;
  }
  return docRelativeFromFileName(parsed.path.fileName);
}

/**
 * The canonical document-relative path (`components/<fileName>`) for a component
 * file basename. The inverse of {@link fileNameFromDocRelative}. Pure string
 * concatenation — the segment the mimic nodes key on.
 */
export function docRelativeFromFileName(fileName: string): string {
  return `${COMPONENTS_SEGMENT}/${fileName}`;
}

/**
 * The file basename (`<basename>.tsx`) of a canonical document-relative
 * component path (`components/<basename>.tsx`) — the inverse of
 * {@link docRelativeFromFileName}. Returns the input unchanged when it carries no
 * `components/` prefix (defensive; a well-formed doc-relative path always does).
 */
export function fileNameFromDocRelative(docRelativePath: string): string {
  const prefix = `${COMPONENTS_SEGMENT}/`;
  return docRelativePath.startsWith(prefix) ? docRelativePath.slice(prefix.length) : docRelativePath;
}

/**
 * The workspace-absolute component path (`/paywalls/<slug>/components/<fileName>`)
 * for a paywall slug and a canonical document-relative component path
 * (`components/<fileName>`) — the inverse of {@link docRelativeComponentPath}.
 */
export function workspacePathForDocRelative(paywallSlug: string, docRelativePath: string): string {
  return formatComponentPath(paywallSlug, fileNameFromDocRelative(docRelativePath));
}

const malformed = (reason: string): ParseWorkspacePathResult => ({
  ok: false,
  error: { kind: "malformed", reason },
});

const reserved = (reason: string): ParseWorkspacePathResult => ({
  ok: false,
  error: { kind: "reserved", reason },
});

/**
 * Parse a workspace path string into a {@link WorkspacePath}, or a typed error.
 *
 * Recognizes exactly two shapes under `/paywalls/<slug>/`: the composition file
 * (`paywall.tsx`) and a component source (`components/<basename>.tsx`). A
 * component file's name must end with `.tsx`; the retained basename (including
 * the extension) is the component's identity. The top-level `/components/*`
 * namespace is reserved for a future shared library and is rejected with a
 * `reserved` error. Everything else is `malformed`.
 */
export function parseWorkspacePath(path: string): ParseWorkspacePathResult {
  if (!path.startsWith("/")) {
    return malformed(`path must be absolute (start with "/"): "${path}"`);
  }
  const segments = path.slice(1).split("/");
  const [head, ...rest] = segments;

  if (head === COMPONENTS_SEGMENT) {
    return reserved(
      `"/components/*" (project-shared component library) is not supported yet`,
    );
  }

  if (head !== PAYWALLS_SEGMENT) {
    return malformed(`unknown top-level directory "/${head ?? ""}"`);
  }

  const [paywallSlug, ...tail] = rest;
  if (paywallSlug === undefined || !SLUG.test(paywallSlug)) {
    return malformed(`missing or invalid paywall slug in "${path}"`);
  }

  // /paywalls/<slug>/paywall.tsx
  if (tail.length === 1 && tail[0] === COMPOSITION_FILENAME) {
    return { ok: true, path: { kind: "composition", paywallSlug } };
  }

  // /paywalls/<slug>/components/<basename>.tsx
  if (tail.length === 2 && tail[0] === COMPONENTS_SEGMENT) {
    const fileName = tail[1]!;
    if (!fileName.endsWith(".tsx")) {
      return malformed(`component file must end with ".tsx": "${path}"`);
    }
    // A non-empty basename before the extension is required (`.tsx` alone is not
    // a component file). The full basename INCLUDING `.tsx` is the identity.
    if (fileName.length <= ".tsx".length) {
      return malformed(`missing component file name in "${path}"`);
    }
    return { ok: true, path: { kind: "component", paywallSlug, fileName } };
  }

  return malformed(`not a recognized workspace file: "${path}"`);
}
