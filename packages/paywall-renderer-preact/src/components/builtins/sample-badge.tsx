import * as P from "effect/Predicate";
import type { BuiltinRendererProps } from "./types";

const BADGE_STYLES: Record<string, string | number> = {
  alignSelf: "flex-start",
  backgroundColor: "#18181b",
  borderRadius: "999px",
  boxSizing: "border-box",
  color: "#fafafa",
  display: "inline-flex",
  fontFamily: "inherit",
  fontSize: "11px",
  fontWeight: 600,
  lineHeight: "16px",
  padding: "2px 8px",
};

/**
 * TEMPORARY spine-verification builtin — a static badge rendering its `label`
 * string prop. Mirrors the `sample-badge` registry entry in
 * `@voidhash/paywall-builtins`; REMOVE both before go-live.
 */
export function SampleBadge({ props }: BuiltinRendererProps) {
  const label = P.isString(props.label) ? props.label : "New";
  return <span style={BADGE_STYLES}>{label}</span>;
}
