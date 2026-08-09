import { createId } from "@paralleldrive/cuid2";

/**
 * Creates an opaque identifier for local paywall designer nodes.
 */
export function createNodeId() {
  return createId();
}
