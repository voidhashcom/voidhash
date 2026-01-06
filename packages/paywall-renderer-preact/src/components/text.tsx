import type { TextNodeData } from '@voidhash/mimic-schema';
import { buildTextStyles } from '@voidhash/paywall-renderer-web-core';

type TextProps = {
  node: TextNodeData;
};

export function Text({ node }: TextProps) {
  const styles = buildTextStyles(node.style);
  return (
    <span data-node-id={node.id} style={styles as Record<string, string | number>}>
      {node.text}
    </span>
  );
}
