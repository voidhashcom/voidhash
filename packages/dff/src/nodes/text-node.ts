import { BaseNode, type BaseNodeData, type PickStyles } from '../core';
import {
  getPropertiesFromGroups,
  type PropertiesOfGroup,
  type StyleGroup
} from '../styles';

/** Style groups supported by TextNode */
const TEXT_STYLE_GROUPS = [
  'margin',
  'sizeConstraints',
  'typography',
  'border',
  'visual',
  'shadow',
  'flexChild'
] as const satisfies readonly StyleGroup[];

/** All style properties for TextNode */
const TEXT_STYLES = getPropertiesFromGroups(TEXT_STYLE_GROUPS);

type TextStyleGroups = (typeof TEXT_STYLE_GROUPS)[number];
type TextStyles = PropertiesOfGroup<TextStyleGroups>;

/** TextNode data type */
export interface TextNodeData extends BaseNodeData {
  type: 'text';
  text: string;
  style: PickStyles<TextStyles>;
}

// TextNode has no children, so no mixin needed
export class TextNode extends BaseNode<'text', TextStyles> {
  override readonly type = 'text' as const;
  override readonly defaultName = 'Text';
  override readonly isRoot = false;
  override readonly supportedStyles = TEXT_STYLES;

  /** Override getDefaults to include text property */
  override getDefaults(): {
    type: 'text';
    name: string;
    text: string;
    style: PickStyles<TextStyles>;
  } {
    return {
      ...super.getDefaults(),
      text: 'New Text'
    };
  }

  /** Override validate to check for text property */
  override validate(data: unknown): data is TextNodeData {
    if (!super.validate(data)) {
      return false;
    }
    const obj = data as unknown as Record<string, unknown>;
    return typeof obj.text === 'string';
  }
}
