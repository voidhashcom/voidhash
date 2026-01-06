import type { TextNodeData } from '@voidhash/mimic-schema';
import { buildTextStyles } from '@voidhash/paywall-renderer-web-core';
import type { JSX } from 'preact';

type TextProps = {
  node: TextNodeData;
};

export function Text({ node }: TextProps) {
  const styles = buildTextStyles(node.style) as JSX.CSSProperties;
  return (
    <span data-node-id={node.id} style={styles}>
      {node.text}
    </span>
  );
}
