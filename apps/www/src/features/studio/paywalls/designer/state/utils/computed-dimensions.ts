import type { BoundingBox } from "./bounding-box";

export interface ComputedDimensions {
  width: number;
  height: number;
}

/**
 * Get the computed dimensions for a node from its bounding box.
 * Returns null if the bounding box doesn't exist.
 */
export function getComputedDimensions(
  nodeId: string,
  boundingBoxes: Record<string, BoundingBox>,
): ComputedDimensions | null {
  const boundingBox = boundingBoxes[nodeId];
  if (!boundingBox) return null;

  return {
    width: Math.round(boundingBox.width),
    height: Math.round(boundingBox.height),
  };
}
