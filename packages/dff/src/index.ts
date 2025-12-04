// Core abstractions for defining nodes and properties
export {
  buildUpdateObject,
  type CanvasDef,
  createNodeData,
  defineCanvas,
  defineNode,
  defineProperty,
  getNodeDef,
  getUpdatableProperties,
  isCanvasDef,
  isNodeDef,
  isPropertyDef,
  type NodeDef,
  type NodeDefData,
  type NodeDefType,
  type ParentRef,
  ParentRefSchema,
  type PropertyDef,
  type PropertyDefName,
  type PropertyDefType,
  pickDefined
} from './core';

// Document exports
export {
  createDesignDocument,
  DesignDocument,
  deleteNode,
  encodeNode,
  fromYDoc,
  getAllNodes,
  getAllNodesSync,
  getNode,
  getNodeSync,
  getRootNode,
  NodeNotFoundError,
  NodeParseError,
  parseNode,
  setNode,
  setNodeSync,
  setRootNode,
  setRootNodeSync,
  updateNodeParentSync,
  updateNodeProperties
} from './document';

// Schema exports (nodes, properties, canvas)
export * from './schema';
