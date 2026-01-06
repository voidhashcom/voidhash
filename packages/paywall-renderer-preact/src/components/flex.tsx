import type { FlexNodeData } from '@voidhash/mimic-schema';
import { buildFlexStyles } from '@voidhash/paywall-renderer-web-core';
import type { ComponentChildren, JSX } from 'preact';

type FlexProps = {
  node: FlexNodeData;
  children: ComponentChildren;
};

export function Flex({ node, children }: FlexProps) {
  const styles = buildFlexStyles(node.style) as JSX.CSSProperties;
  return (
    <div data-node-id={node.id} style={styles}>
      {children}
    </div>
  );
}
