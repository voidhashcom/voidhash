/**
 * The single diagnostic shape every build stage emits.
 *
 * A diagnostic is always attributed to a `path` (the entry, a component file, or
 * a virtual origin), carries a `severity` and the `phase` that produced it, and
 * optionally a 1-BASED `line`/`column`. The build accumulates diagnostics across
 * all stages; `ok` is derived from the absence of any `"error"`-severity entry.
 */

/** Which build stage produced a diagnostic. */
export type BuildPhase =
  | "imports"
  | "types"
  | "grammar"
  | "compile"
  | "runtime"
  | "validate";

/** Diagnostic severity. Only `"error"` blocks a successful build. */
export type BuildSeverity = "error" | "warning" | "info";

/** A single build diagnostic. `line`/`column` are 1-based when present. */
export interface BuildDiagnostic {
  readonly path: string;
  readonly severity: BuildSeverity;
  readonly phase: BuildPhase;
  readonly message: string;
  /** 1-based source line, when the diagnostic has a position. */
  readonly line?: number;
  /** 1-based source column, when the diagnostic has a position. */
  readonly column?: number;
}

/** Construct an `error`-severity diagnostic. */
export function error(
  path: string,
  phase: BuildPhase,
  message: string,
  position?: { readonly line?: number; readonly column?: number },
): BuildDiagnostic {
  return { path, severity: "error", phase, message, ...position };
}

/** Construct a `warning`-severity diagnostic. */
export function warning(
  path: string,
  phase: BuildPhase,
  message: string,
  position?: { readonly line?: number; readonly column?: number },
): BuildDiagnostic {
  return { path, severity: "warning", phase, message, ...position };
}

/** Construct an `info`-severity diagnostic. */
export function info(
  path: string,
  phase: BuildPhase,
  message: string,
  position?: { readonly line?: number; readonly column?: number },
): BuildDiagnostic {
  return { path, severity: "info", phase, message, ...position };
}

/** Whether a diagnostic set contains any `error`-severity entry. */
export function hasErrors(diagnostics: readonly BuildDiagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}
