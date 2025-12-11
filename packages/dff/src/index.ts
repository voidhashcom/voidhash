/**
 * DFF - Functional Document Framework
 * Schema-first approach with type-safe document definitions.
 */

export type {
  AnyNodeDataFromDocument,
  CreateDocumentConfig,
  DocumentDefinition,
  DocumentMeta,
  NodeDataFromDocument
} from './documents';
// Documents
export { createDocument, paywallDocument } from './documents';
export type {
  CreateNodeOptions,
  DeserializeOptions,
  Editor,
  EditorCommands,
  EditorOptions,
  Handle,
  InsertPosition,
  MoveNodeOptions,
  NodesAccessor,
  SerializedNodes,
  SiblingInfo,
  Transaction,
  TreeUtils
} from './editor';
// Editor
export {
  createEditor,
  generateIndex,
  generateIndexAtEnd,
  generateIndexAtStart,
  NodeNotFoundError,
  ValidationError
} from './editor';
export type {
  FlexNodeData,
  RootNodeData,
  ScreenNodeData,
  TextNodeData,
  Variable
} from './nodes';
// Nodes
export {
  flexNode,
  flexNodeAllowedChildren,
  parentRefSchema,
  rootNode,
  rootNodeAllowedChildren,
  screenNode,
  screenNodeAllowedChildren,
  textNode,
  textNodeAllowedChildren
} from './nodes';
export type { Infer, InferOrType, Refinement, Schema } from './schema';
// Schema
export {
  ArraySchema,
  BooleanSchema,
  getDefaults,
  hasDefault,
  isOptional,
  LiteralSchema,
  NumberSchema,
  ObjectSchema,
  RecordSchema,
  StringSchema,
  s,
  UnionSchema,
  validate
} from './schema';
export type {
  DocumentMeta as StorageDocumentMeta,
  DocumentSnapshot,
  NodesStore,
  StorageAdapter
} from './storage';
// Storage
export {
  createYjsStorage,
  createZustandStorage,
  YjsStorage,
  ZustandStorage
} from './storage';

// Styles
export * from './styles';

// Variables
export * from './variables';
