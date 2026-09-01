import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import * as Match from "effect/Match";
import { createElement, Fragment } from "preact";

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
  componentArtifacts?: ComponentArtifacts;
  /** Locale to resolve localized content against (undefined → default locale). */
  locale?: string;
}

export function Paywall({ snapshot, componentArtifacts, locale }: PaywallProps) {
  return createElement(
    PaywallProvider,
    {
      children: createElement(Node, { node: snapshot }),
      componentArtifacts,
      locale,
      snapshot,
    },
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
  const children = (node.children ?? []).map((child) =>
    createElement(Node, { key: child.id, node: child }),
  );

  return Match.value(node).pipe(
    Match.when({ type: "root" }, () => createElement(Fragment, null, children)),
    Match.when({ type: "screen" }, (node) => createElement(Screen, { children, node })),
    Match.when({ type: "view" }, (node) => createElement(View, { children, node })),
    Match.when({ type: "scrollView" }, (node) =>
      createElement(ScrollView, { children, node }),
    ),
    Match.when({ type: "text" }, (node) => createElement(Text, { node })),
    Match.when({ type: "shape" }, (node) => createElement(Shape, { children, node })),
    Match.when({ type: "path" }, (node) => createElement(Path, { node })),
    Match.when({ type: "component" }, (node) =>
      createElement(ComponentInstance, { children, node }),
    ),
    // Non-visual nodes: the code-component library and its definitions live in
    // the document tree but never render (source only).
    Match.when({ type: "library" }, () => null),
    Match.when({ type: "codeComponent" }, () => null),
    Match.orElse((node) => <UnknownNode node={node} />),
  );
}
