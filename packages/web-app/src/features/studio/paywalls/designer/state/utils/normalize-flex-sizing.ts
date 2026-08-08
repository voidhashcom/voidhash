import type { FlexDirection } from "@voidhash/mimic-schema";

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
 * Normalizes flex sizing properties to prevent conflicts.
 * Call this when updating width, height, flex, or alignSelf.
 *
 * Rules:
 * - Numeric width + column parent -> clear alignSelf: "stretch" to "auto"
 * - Numeric width + row parent -> clear flex (delete the field)
 * - Numeric height + row parent -> clear alignSelf: "stretch" to "auto"
 * - Numeric height + column parent -> clear flex (delete the field)
 *
 * Under stretch-by-default (`alignItems: "stretch"` is the schema default), an
 * `alignSelf: "auto"` child with an auto cross size ALSO fills its cross axis —
 * container-driven stretch. This normalizer only touches the EXPLICIT
 * `alignSelf: "stretch"` marker, which is intentional: giving a numeric cross
 * size defeats stretch regardless of container alignment, so clearing an
 * explicit "stretch" to "auto" (and leaving container-driven "auto" alone) keeps
 * the stored style honest without fighting the CSS-correct default.
 */
export function normalizeFlexSizing(
  updates: FlexSizingProps,
  current: FlexSizingProps,
  parentDirection: FlexDirection | null,
): FlexSizingProps {
  const result = { ...updates };

  // If setting numeric width, clear fill indicators
  if (updates.width !== undefined && typeof updates.width === "number") {
    if (parentDirection === "column") {
      // In column, alignSelf: stretch = fill width
      if ((updates.alignSelf ?? current.alignSelf) === "stretch") {
        result.alignSelf = "auto";
      }
    } else if (parentDirection === "row") {
      // In row, flex = fill width
      if ((updates.flex ?? current.flex) != null) {
        result.flex = null;
      }
    }
  }

  // If setting numeric height, clear fill indicators
  if (updates.height !== undefined && typeof updates.height === "number") {
    if (parentDirection === "row") {
      // In row, alignSelf: stretch = fill height
      if ((updates.alignSelf ?? current.alignSelf) === "stretch") {
        result.alignSelf = "auto";
      }
    } else if (parentDirection === "column") {
      // In column, flex = fill height
      if ((updates.flex ?? current.flex) != null) {
        result.flex = null;
      }
    }
  }

  return result;
}
