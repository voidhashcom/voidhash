/**
 * A typed, field-pathed finding the engine attaches to a validation or
 * normalization pass. Unlike the document layer — where an unknown prop is
 * silently stripped and a bad value rejects the whole transaction — every
 * problem surfaces here synchronously, before any command is minted.
 */
export interface StyleDiagnostic {
  readonly code: StyleDiagnosticCode;
  readonly severity: "error" | "warning";
  readonly nodeId?: string;
  /** The style field the finding anchors to, when field-scoped. */
  readonly field?: string;
  readonly message: string;
  /** The value the engine wrote instead, when the pass auto-repaired. */
  readonly normalizedValue?: unknown;
}

export type StyleDiagnosticCode =
  /** The field is not part of this node type's style schema — the document layer would silently strip it. */
  | "unknown-field"
  /** The value's scalar family does not match the field schema (would reject the transaction late). */
  | "invalid-value"
  /** The value violated a scalar constraint (regex / min / max) and was clamped or rejected. */
  | "constraint-violation"
  /** The engine rewrote a conflicting flex-sizing combination (e.g. numeric size + stretch). */
  | "sizing-conflict-repaired"
  /** A gated group field was set without its `*Enabled` flag; the flag was derived on. */
  | "enabled-flag-derived"
  /** The operation is not available for this node/context per the capability model. */
  | "capability-unavailable";

/** Build an error diagnostic. */
export function errorDiagnostic(
  code: StyleDiagnosticCode,
  message: string,
  extra: Partial<Pick<StyleDiagnostic, "nodeId" | "field" | "normalizedValue">> = {},
): StyleDiagnostic {
  return { code, severity: "error", message, ...extra };
}

/** Build a warning diagnostic (the pass repaired or tolerated the input). */
export function warningDiagnostic(
  code: StyleDiagnosticCode,
  message: string,
  extra: Partial<Pick<StyleDiagnostic, "nodeId" | "field" | "normalizedValue">> = {},
): StyleDiagnostic {
  return { code, severity: "warning", message, ...extra };
}
