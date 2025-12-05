import { BaseNode, type BaseNodeData, type PickStyles } from '../core';
import { WithChildren } from '../mixins';
import {
  getPropertiesFromGroups,
  type PropertiesOfGroup,
  type StyleGroup
} from '../styles';

/** Style groups supported by ScreenNode */
const SCREEN_STYLE_GROUPS = [
  'position',
  'size',
  'padding',
  'margin',
  'layout',
  'background',
  'border',
  'visual',
  'shadow',
  'safeArea',
  'flexChild'
] as const satisfies readonly StyleGroup[];

/** All style properties for ScreenNode */
const SCREEN_STYLES = getPropertiesFromGroups(SCREEN_STYLE_GROUPS);

type ScreenStyleGroups = (typeof SCREEN_STYLE_GROUPS)[number];
type ScreenStyles = PropertiesOfGroup<ScreenStyleGroups>;

/** ScreenNode data type */
export interface ScreenNodeData extends BaseNodeData, PickStyles<ScreenStyles> {
  type: 'screen';
}

class ScreenNodeBase extends BaseNode<'screen', ScreenStyles> {
  override readonly type = 'screen' as const;
  override readonly defaultName = 'Screen';
  override readonly isRoot = false;
  override readonly supportedStyles = SCREEN_STYLES;

  // Override specific defaults for screen
  override readonly styleOverrides = {
    width: 375,
    height: 812,
    backgroundEnabled: true,
    backgroundColor: 'rgba(255, 255, 255, 1)'
  };
}

export const ScreenNode = WithChildren(ScreenNodeBase, ['flex', 'text']);
export type ScreenNodeClass = InstanceType<typeof ScreenNode>;
