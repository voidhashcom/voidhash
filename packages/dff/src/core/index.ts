export {
  type CanvasDef,
  defineCanvas,
  getNodeDef,
  isCanvasDef
} from './define-canvas';

export {
  defineNode,
  isNodeDef,
  type NodeDef,
  type NodeDefData,
  type NodeDefType,
  type ParentRef,
  ParentRefSchema
} from './define-node';
export {
  defineProperty,
  isPropertyDef,
  type PropertyDef,
  type PropertyDefName,
  type PropertyDefType
} from './define-property';

export {
  buildUpdateObject,
  createNodeData,
  getUpdatableProperties,
  pickDefined
} from './utils';
