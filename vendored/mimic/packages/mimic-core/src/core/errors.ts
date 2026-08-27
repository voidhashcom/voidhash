import { constant } from "../internal/lang.ts";

export const ErrorCodes = constant({
  InvalidCommand: "invalid_command",
  InvalidPath: "invalid_path",
  TypeMismatch: "type_mismatch",
  MissingField: "missing_field",
  MissingArrayItem: "missing_array_item",
  MissingTreeNode: "missing_tree_node",
  DuplicateArrayItemId: "duplicate_array_item_id",
  DuplicateArrayPos: "duplicate_array_pos",
  DuplicateTreeNodeId: "duplicate_tree_node_id",
  DuplicateTreePos: "duplicate_tree_pos",
  InvalidTreeParent: "invalid_tree_parent",
  TreeCycle: "tree_cycle",
  TreeNodeValueMustBeObject: "tree_node_value_must_be_object",
  ReservedIdentifier: "reserved_identifier",
});

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const formatMessage = (code: ErrorCode, message: string): string => {
  if (message) return `${code}: ${message}`;
  return code;
};

export class CoreError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message = "") {
    super(formatMessage(code, message));
    this.name = "CoreError";
    this.code = code;
  }
}

export const makeCoreError = (code: ErrorCode, message: string): CoreError =>
  new CoreError(code, message);

export const isCoreError = (value: unknown): value is CoreError => value instanceof CoreError;
