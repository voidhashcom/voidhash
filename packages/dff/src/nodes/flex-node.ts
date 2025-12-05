import { BaseNode, type BaseNodeData, type PickStyles } from '../core';
import { WithChildren } from '../mixins';
import {
  getPropertiesFromGroups,
  type PropertiesOfGroup,
  type StyleGroup
} from '../styles';

/** Style groups supported by FlexNode */
const FLEX_STYLE_GROUPS = [
  'padding',
  'margin',
  'layout',
  'sizeConstraints',
  'background',
  'border',
  'visual',
  'shadow',
  'safeArea',
  'flexChild'
] as const satisfies readonly StyleGroup[];

/** All style properties for FlexNode */
const FLEX_STYLES = getPropertiesFromGroups(FLEX_STYLE_GROUPS);

type FlexStyleGroups = (typeof FLEX_STYLE_GROUPS)[number];
type FlexStyles = PropertiesOfGroup<FlexStyleGroups>;

/** FlexNode data type */
export interface FlexNodeData extends BaseNodeData, PickStyles<FlexStyles> {
  type: 'flex';
}

class FlexNodeBase extends BaseNode<'flex', FlexStyles> {
  override readonly type = 'flex' as const;
  override readonly defaultName = 'Flex';
  override readonly isRoot = false;
  override readonly supportedStyles = FLEX_STYLES;
}

export const FlexNode = WithChildren(FlexNodeBase, ['flex', 'text']);
export type FlexNodeClass = InstanceType<typeof FlexNode>;
