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
  Editor,
  EditorOptions,
  Handle,
  NodesAccessor,
  Transaction
} from './editor';
// Editor
export { createEditor, NodeNotFoundError, ValidationError } from './editor';
export type {
  FlexNodeData,
  RootNodeData,
  ScreenNodeData,
  TextNodeData
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
