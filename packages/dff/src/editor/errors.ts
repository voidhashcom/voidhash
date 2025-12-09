/**
 * Error thrown when a node is not found.
 */
export class NodeNotFoundError extends Error {
  readonly name = 'NodeNotFoundError';
  readonly nodeId: string;

  constructor(nodeId: string) {
    super(`Node not found: ${nodeId}`);
    this.nodeId = nodeId;
  }
}

/**
 * Error thrown when node validation fails.
 */
export class ValidationError extends Error {
  readonly name = 'ValidationError';
  readonly nodeId: string;
  readonly reason: string;

  constructor(nodeId: string, reason: string) {
    super(`Validation failed for ${nodeId}: ${reason}`);
    this.nodeId = nodeId;
    this.reason = reason;
  }
}
