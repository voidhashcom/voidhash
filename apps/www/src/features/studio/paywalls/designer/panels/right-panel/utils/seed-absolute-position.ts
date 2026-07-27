import type {
  ScrollViewSnapshotNode,
  SnapshotNode,
  TextSnapshotNode,
  ViewSnapshotNode,
} from "@voidhash/paywall-renderer-web-core";

import type { PerNodeLayoutStyle } from "../../../state/actions";
import type { StyleTarget } from "../../../state/actions/features/style-action-helpers";
import { getOffsetWithinParent, type BoundingBox } from "../../../state/utils/bounding-box";

/** A numeric style value, else `null` (e.g. `"auto"` or absent). */
function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

/** The absolutely-positionable node types: all carry the same 5 inset fields. */
type PositionableNode = ViewSnapshotNode | ScrollViewSnapshotNode | TextSnapshotNode;

function isPositionableNode(node: SnapshotNode): node is PositionableNode {
  return node.type === "view" || node.type === "scrollView" || node.type === "text";
}

/**
 * Builds the per-node `{position: "absolute", left, top}` patches for toggling
 * absolute positioning ON across a (possibly multi-node) view/scrollView/text
 * selection.
 *
 * Each node is seeded from ITS OWN offset — its current numeric `left`/`top`
 * when set, else its measured `getOffsetWithinParent` (using its OWN parent,
 * which may differ per node), else `0`/`0`. Seeding per node keeps every node
 * where it visually sits, rather than stacking a multi-selection onto the first
 * node's offset. Non-positionable (non view/scrollView/text) or missing-target
 * nodes are skipped.
 *
 * @param nodes - the selected snapshot nodes (position-order aligned with `targets`).
 * @param targets - the style targets for those nodes (`nodeId` keyed).
 * @param boundingBoxes - canvas bounding boxes for the offset fallback.
 */
export function buildAbsolutePositionSeeds(
  nodes: readonly SnapshotNode[],
  targets: readonly StyleTarget[],
  boundingBoxes: Record<string, BoundingBox>,
): PerNodeLayoutStyle[] {
  const targetById = new Map(targets.map((target) => [target.nodeId, target]));
  const seeds: PerNodeLayoutStyle[] = [];

  for (const node of nodes) {
    if (!isPositionableNode(node)) {
      continue;
    }
    const target = targetById.get(node.id);
    if (!target) {
      continue;
    }
    const style = node.data.style;
    const styleLeft = numberOrNull(style.left);
    const styleTop = numberOrNull(style.top);
    const fallback =
      (styleLeft === null || styleTop === null) && node.parentId
        ? getOffsetWithinParent(node.id, node.parentId, boundingBoxes)
        : null;

    seeds.push({
      target,
      style: {
        position: "absolute",
        left: styleLeft ?? fallback?.left ?? 0,
        top: styleTop ?? fallback?.top ?? 0,
      },
    });
  }

  return seeds;
}
