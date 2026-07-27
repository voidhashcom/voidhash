import type { BuildDiagnostic } from "./diagnostics.ts";
import { error, info } from "./diagnostics.ts";
import type { ResolvedComponent } from "./imports.ts";
import type { BuildCapabilities, BuildDiagnosticInput } from "./types.ts";

/** The per-component result of the compile stage. */
export interface CompiledComponent {
  readonly component: ResolvedComponent;
  /** Compiled CJS code, or `null` when compilation was skipped or failed. */
  readonly code: string | null;
}

/** The compile stage output. */
export interface CompileResult {
  readonly compiled: readonly CompiledComponent[];
  readonly diagnostics: readonly BuildDiagnostic[];
}

/** Map a capability diagnostic to a build diagnostic for `path` in a phase. */
function fromCapability(
  path: string,
  phase: "compile" | "runtime",
  diagnostic: BuildDiagnosticInput,
): BuildDiagnostic {
  return {
    path,
    phase,
    severity: diagnostic.severity ?? "error",
    message: diagnostic.message,
    ...(diagnostic.line !== undefined ? { line: diagnostic.line } : {}),
    ...(diagnostic.column !== undefined ? { column: diagnostic.column } : {}),
  };
}

/**
 * Stage 3 — compile.
 *
 * Runs the host `compile` capability over each component's source. With no
 * capability the stage is skipped (one `info` diagnostic) and every component's
 * `code` is `null`, degrading downstream statuses to `unknown`. A compile
 * failure records the capability's `compile`-phase diagnostics for that file and
 * leaves its `code` null; other files still compile.
 */
export async function compileComponents(
  components: readonly ResolvedComponent[],
  caps: BuildCapabilities,
): Promise<CompileResult> {
  const diagnostics: BuildDiagnostic[] = [];
  const compile = caps.compile;
  if (!compile) {
    if (components.length > 0) {
      diagnostics.push(
        info(
          components[0]!.path,
          "compile",
          "No compile capability provided — components are not compiled; manifests fall back to cache or 'unknown'.",
        ),
      );
    }
    return {
      compiled: components.map((component) => ({ component, code: null })),
      diagnostics,
    };
  }

  const compiled: CompiledComponent[] = [];
  for (const component of components) {
    let outcome;
    try {
      outcome = await compile(component.source);
    } catch (err) {
      diagnostics.push(
        error(
          component.path,
          "compile",
          err instanceof Error ? err.message : String(err),
        ),
      );
      compiled.push({ component, code: null });
      continue;
    }
    if ("diagnostics" in outcome) {
      for (const diagnostic of outcome.diagnostics) {
        diagnostics.push(fromCapability(component.path, "compile", diagnostic));
      }
      compiled.push({ component, code: null });
      continue;
    }
    compiled.push({ component, code: outcome.code });
  }
  return { compiled, diagnostics };
}
