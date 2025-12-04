export {
  deleteNode,
  encodeNode,
  getAllNodes,
  getNode,
  getRootNode,
  NodeNotFoundError,
  NodeParseError,
  parseNode,
  setNode,
  setRootNode,
  updateNodeProperties
} from './conversions';
export {
  createDesignDocument,
  DesignDocument,
  fromYDoc
} from './document';

// Synchronous API for use in voidsync actions
export {
  getAllNodesSync,
  getNodeSync,
  setNodeSync,
  setRootNodeSync,
  updateNodeParentSync
} from './sync-api';
