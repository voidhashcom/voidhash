import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { Flex } from "./flex";
import { Screen } from "./screen";
import { Text } from "./text";

interface PaywallProps {
  snapshot: SnapshotNode;
}

export function Paywall({ snapshot }: PaywallProps) {
  return <Node node={snapshot} />;
}

function Node({ node }: { node: SnapshotNode }) {
  const children = node.children.map((child) => (
    <Node key={child.id} node={child} />
  ));

  switch (node.type) {
    case "root": {
      return <>{children}</>;
    }
    case "screen": {
      return <Screen node={node}>{children}</Screen>;
    }
    case "flex": {
      return <Flex node={node}>{children}</Flex>;
    }
    case "text": {
      return <Text node={node} />;
    }
    default: {
      throw new Error(`Unknown node type: ${(node as SnapshotNode).type}`);
    }
  }
}
