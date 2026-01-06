import type { ScreenNodeData } from '@voidhash/mimic-schema';
import {
  buildScreenContainerStyles,
  buildScreenLayoutStyles
} from '@voidhash/paywall-renderer-web-core';
import type { ComponentChildren, JSX } from 'preact';

type ScreenProps = {
  node: ScreenNodeData;
  children: ComponentChildren;
};

export function Screen({ node, children }: ScreenProps) {
  const containerStyles = buildScreenContainerStyles(node.style) as JSX.CSSProperties;
  const layoutStyles = buildScreenLayoutStyles(node.style) as JSX.CSSProperties;
  return (
    <div data-node-id={node.id} style={containerStyles}>
      <div style={layoutStyles}>{children}</div>
    </div>
  );
}
