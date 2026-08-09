export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate the combined bounding box of multiple nodes.
 */
export function calculateCombinedBoundingBox(
  nodeIds: string[],
  boundingBoxes: Record<string, BoundingBox>,
): BoundingBox | null {
  if (nodeIds.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const nodeId of nodeIds) {
    const box = boundingBoxes[nodeId];
    if (!box) {
      continue;
    }
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }

  if (!Number.isFinite(minX)) {
    return null;
  }

  return {
    height: maxY - minY,
    width: maxX - minX,
    x: minX,
    y: minY,
  };
}

/**
 * Offset of a node's top-left corner relative to its parent's top-left corner,
 * in canvas coordinates. Used to seed `left`/`top` when switching a view to
 * absolute positioning so it stays visually in place. Measured from border-box
 * rects, so parent border widths are not compensated for.
 */
export function getOffsetWithinParent(
  nodeId: string,
  parentId: string,
  boundingBoxes: Record<string, BoundingBox>,
): { left: number; top: number } | null {
  const node = boundingBoxes[nodeId];
  const parent = boundingBoxes[parentId];
  if (!node || !parent) {
    return null;
  }
  return { left: node.x - parent.x, top: node.y - parent.y };
}
