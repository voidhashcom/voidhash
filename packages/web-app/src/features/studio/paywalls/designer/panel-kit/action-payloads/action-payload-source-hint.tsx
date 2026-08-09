"use client";

/**
 * Subdued explainer shown when an "action payload" value source is selected:
 * payload values only exist once the published paywall runs real component
 * code — the static editor preview ignores them (spec §3.2).
 */
export function ActionPayloadSourceHint() {
  return (
    <p className="text-muted-foreground/80 text-[10px] leading-snug">
      Uses the value the component emits when this action fires. Applies once the paywall is
      published — the static preview ignores payload values.
    </p>
  );
}
