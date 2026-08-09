import { causeMessage } from "@voidhash/lib/lang";
import { Effect } from "effect";
import type { BuildDiagnostic } from "./diagnostics.ts";
import { error, info } from "./diagnostics.ts";
import type { ResolvedComponent } from "./imports.ts";
import type { BuildCapabilities, BuildDiagnosticInput, CompileOutcome } from "./types.ts";

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

/** The 1-based position of a capability diagnostic, when it carries one. */
function positionOf(diagnostic: BuildDiagnosticInput): { line?: number; column?: number } {
  const position: { line?: number; column?: number } = {};
  if (diagnostic.line !== undefined) position.line = diagnostic.line;
  if (diagnostic.column !== undefined) position.column = diagnostic.column;
  return position;
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
    ...positionOf(diagnostic),
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
export function compileComponents(
  components: readonly ResolvedComponent[],
  caps: BuildCapabilities,
): Promise<CompileResult> {
  return Effect.runPromise(compileComponentsEffect(components, caps));
}

/** The compile stage as an Effect; {@link compileComponents} runs it. */
function compileComponentsEffect(
  components: readonly ResolvedComponent[],
  caps: BuildCapabilities,
): Effect.Effect<CompileResult> {
  return Effect.gen(function* () {
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
      // A capability failure is recorded for that file only — the rest still compile.
      const outcome: CompileOutcome | null = yield* Effect.tryPromise({
        try: () => compile(component.source),
        catch: (cause) => cause,
      }).pipe(
        Effect.match({
          onSuccess: (value) => value,
          onFailure: (cause) => {
            diagnostics.push(error(component.path, "compile", causeMessage(cause)));
            return null;
          },
        }),
      );
      if (outcome === null) {
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
  });
}
