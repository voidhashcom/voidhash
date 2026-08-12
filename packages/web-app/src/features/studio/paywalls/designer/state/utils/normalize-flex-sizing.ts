import type { FlexDirection } from "@voidhash/mimic-schema";
import { repairFlexSizing } from "@voidhash/paywall-style-engine";

interface FlexSizingProps {
  /** `"auto"` = hug contents (the stored style shape). */
  width?: number | "auto" | null;
  height?: number | "auto" | null;
  /**
   * `null` is the in-band "clear" sentinel: write sites translate it to a
   * field deletion (`update({flex: undefined})`); `undefined` means "no
   * change". The stored field itself is `number` or absent.
   */
  flex?: number | null;
  alignSelf?: "auto" | "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
}

/**
 * Normalizes flex sizing properties to prevent conflicts. Call this when
 * updating width, height, flex, or alignSelf — per node, against that node's
 * OWN current style and parent direction.
 *
 * The invariant repair itself lives in the style engine
 * ({@link repairFlexSizing}): a fixed cross-axis size clears an explicit
 * `alignSelf: "stretch"` (container-driven stretch via `"auto"` is left
 * alone), and a fixed main-axis size deletes `flex`. This adapter keeps the
 * legacy call signature and null-clear sentinel for the existing call sites.
 */
export function normalizeFlexSizing(
  updates: FlexSizingProps,
  current: FlexSizingProps,
  parentDirection: FlexDirection | null,
): FlexSizingProps {
  if (parentDirection === null) {
    return { ...updates };
  }

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) patch[key] = value;
  }

  const { patch: repaired } = repairFlexSizing(patch, {
    style: current as Record<string, unknown>,
    // The repair only reads the direction; alignItems is irrelevant to it.
    parent: { direction: parentDirection, alignItems: "stretch" },
  });

  const result: FlexSizingProps = { ...updates };
  if ("alignSelf" in repaired && repaired["alignSelf"] !== patch["alignSelf"]) {
    result.alignSelf = repaired["alignSelf"] as FlexSizingProps["alignSelf"];
  }
  // The engine clears a conflicting flex by writing an `undefined` field
  // deletion; the legacy vocabulary spells that clear `null`.
  if ("flex" in repaired && repaired["flex"] === undefined) {
    result.flex = null;
  }
  return result;
}
