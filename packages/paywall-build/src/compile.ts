import { causeMessage } from "@voidhash/lib/lang";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as EffectRuntime from "effect/Effect";
import * as Option from "effect/Option";
import type { BuildDiagnostic } from "./diagnostics.ts";
import { error, info } from "./diagnostics.ts";
import type { ResolvedComponent } from "./imports.ts";
import type { BuildCapabilities, BuildDiagnosticInput, CompileOutcome } from "./types.ts";

/** The per-component result of the compile stage. */
export interface CompiledComponent {
  readonly component: ResolvedComponent;
  /** Compiled CJS code, or `null` when compilation was skipped or failed. */
  readonly code: Option.Option<string>;
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
  return EffectRuntime.runPromise(compileComponentsEffect(components, caps));
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
      Arr.match(components, {
        onEmpty: () => undefined,
        onNonEmpty: ([first]) =>
          diagnostics.push(
            info(
              first.path,
              "compile",
              "No compile capability provided — components are not compiled; manifests fall back to cache or 'unknown'.",
            ),
          ),
      });
      return {
        compiled: components.map((component) => ({ component, code: Option.none() })),
        diagnostics,
      };
    }

    const compiled = yield* Effect.forEach(
      components,
      (component) =>
        Effect.tryPromise({
          try: () => compile(component.source),
          catch: (cause) => cause,
        }).pipe(
          Effect.match({
            onSuccess: Option.some,
            onFailure: (cause) => {
              diagnostics.push(error(component.path, "compile", causeMessage(cause)));
              return Option.none<CompileOutcome>();
            },
          }),
          Effect.map(
            Option.match({
              onNone: () => ({ component, code: Option.none<string>() }),
              onSome: (outcome) => {
                if ("diagnostics" in outcome) {
                  diagnostics.push(
                    ...outcome.diagnostics.map((diagnostic) =>
                      fromCapability(component.path, "compile", diagnostic),
                    ),
                  );
                  return { component, code: Option.none<string>() };
                }
                return { component, code: Option.some(outcome.code) };
              },
            }),
          ),
        ),
      { concurrency: 1 },
    );
    return { compiled, diagnostics };
  });
}
