import {
  COMPOSITION_FILENAME,
  formatComponentPath,
  formatCompositionPath,
  parseWorkspacePath,
} from "@voidhash/paywall-workspace";

/**
 * Resolve a model-supplied file name to a workspace-absolute path within the
 * OPEN paywall (`paywallSlug`). The AI tools address files by their name within
 * the open paywall — `paywall.tsx` (the composition) or `components/<name>.tsx`
 * (a component) — so this scopes every write/read to that one paywall: the agent
 * cannot reach another paywall's files even by passing an absolute path.
 *
 * Accepts either the bare paywall-relative form (`paywall.tsx`,
 * `components/hero.tsx`) OR the already workspace-absolute form for THIS paywall
 * (`/paywalls/<slug>/…`). A path that resolves to a component file must end in
 * `.tsx`. Returns `{ ok: false, reason }` for anything else (a foreign paywall,
 * the reserved top-level `/components/*`, or a malformed name) so the executor
 * can fold it into a readable tool error.
 */
export type ResolveToolPathResult =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly reason: string };

export function resolveToolPath(paywallSlug: string, rawPath: string): ResolveToolPathResult {
  const trimmed = rawPath.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "path is empty" };
  }

  // Already workspace-absolute: accept only when it names a file in THIS paywall.
  if (trimmed.startsWith("/")) {
    const parsed = parseWorkspacePath(trimmed);
    if (!parsed.ok) {
      return { ok: false, reason: parsed.error.reason };
    }
    if (parsed.path.paywallSlug !== paywallSlug) {
      return {
        ok: false,
        reason: `"${trimmed}" is not a file of the open paywall — you can only edit the open paywall.`,
      };
    }
    return { ok: true, path: trimmed };
  }

  // Strip a leading `./` for convenience.
  const relative = trimmed.startsWith("./") ? trimmed.slice(2) : trimmed;

  if (relative === COMPOSITION_FILENAME) {
    return { ok: true, path: formatCompositionPath(paywallSlug) };
  }

  const componentsPrefix = "components/";
  if (relative.startsWith(componentsPrefix)) {
    const fileName = relative.slice(componentsPrefix.length);
    if (fileName.length === 0 || fileName.includes("/")) {
      return { ok: false, reason: `invalid component file name in "${rawPath}"` };
    }
    if (!fileName.endsWith(".tsx")) {
      return { ok: false, reason: `component file must end with ".tsx": "${rawPath}"` };
    }
    // Validate the assembled path through the canonical parser.
    const candidate = formatComponentPath(paywallSlug, fileName);
    const parsed = parseWorkspacePath(candidate);
    if (!parsed.ok) {
      return { ok: false, reason: parsed.error.reason };
    }
    return { ok: true, path: candidate };
  }

  return {
    ok: false,
    reason: `"${rawPath}" is not a file of the open paywall — use "paywall.tsx" or "components/<name>.tsx".`,
  };
}

/**
 * The model-facing display name for a workspace-absolute path within the open
 * paywall — the inverse of {@link resolveToolPath}. `paywall.tsx` for the
 * composition, `components/<name>.tsx` for a component, or the raw path as a
 * fallback.
 */
export function displayToolPath(workspacePath: string): string {
  const parsed = parseWorkspacePath(workspacePath);
  if (!parsed.ok) {
    return workspacePath;
  }
  return parsed.path.kind === "composition"
    ? COMPOSITION_FILENAME
    : `components/${parsed.path.fileName}`;
}
