import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import type { ComponentArtifacts } from "../component-artifacts";
import { PaywallProvider } from "../context/paywall-context";
import { ComponentInstance } from "./component";
import { Path } from "./path";
import { Screen } from "./screen";
import { ScrollView } from "./scroll-view";
import { Shape } from "./shape";
import { Text } from "./text";
import { View } from "./view";

interface PaywallProps {
  snapshot: SnapshotNode;
  componentArtifacts?: ComponentArtifacts | undefined;
  /** Locale to resolve localized content against (undefined → default locale). */
  locale?: string | undefined;
}

export function Paywall({ snapshot, componentArtifacts, locale }: PaywallProps) {
  return (
    <PaywallProvider componentArtifacts={componentArtifacts} locale={locale} snapshot={snapshot}>
      <Node node={snapshot} />
    </PaywallProvider>
  );
}

const UNKNOWN_NODE_STYLES: Record<string, string | number> = {
  alignItems: "center",
  backgroundColor: "#f4f4f5",
  border: "1px dashed #d4d4d8",
  borderRadius: "6px",
  boxSizing: "border-box",
  color: "#71717a",
  display: "flex",
  fontSize: "11px",
  justifyContent: "center",
  minHeight: "40px",
  padding: "8px",
  textAlign: "center",
};

// Embedded payloads can outlive this runtime build, so unknown node types
// must degrade to a labeled placeholder instead of crashing the render.
function UnknownNode({ node }: { node: { type?: unknown } }) {
  return <div style={UNKNOWN_NODE_STYLES}>{`Unsupported node type: ${String(node.type)}`}</div>;
}

function Node({ node }: { node: SnapshotNode }) {
  // Unknown-type nodes from newer payloads may not carry children at all.
  const children = (node.children ?? []).map((child) => <Node key={child.id} node={child} />);

  switch (node.type) {
    case "root": {
      return <>{children}</>;
    }
    case "screen": {
      return <Screen node={node}>{children}</Screen>;
    }
    case "view": {
      return <View node={node}>{children}</View>;
    }
    case "scrollView": {
      return <ScrollView node={node}>{children}</ScrollView>;
    }
    case "text": {
      return <Text node={node} />;
    }
    case "shape": {
      return <Shape node={node}>{children}</Shape>;
    }
    case "path": {
      return <Path node={node} />;
    }
    case "component": {
      return <ComponentInstance node={node}>{children}</ComponentInstance>;
    }
    // Non-visual nodes: the code-component library and its definitions live in
    // the document tree but never render (source only).
    case "library":
    case "codeComponent": {
      return null;
    }
    default: {
      return <UnknownNode node={node} />;
    }
  }
}
