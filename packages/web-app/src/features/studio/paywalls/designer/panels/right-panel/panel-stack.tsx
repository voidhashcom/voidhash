"use client";

/**
 * Renders the host-driven right panel stack for the current selection. Built-in
 * panels run in process; component property panels use the component panel host.
 */
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { isEditableNodeType } from "../../state/actions";
import type { EditableNodeType } from "../../state/actions";
import { BuiltinPanelHost } from "./builtin-panel-host";
import { ComponentPanelHost } from "./component-panel-host";
import { ComponentWarningsBlock } from "./components/component-warnings";
import { getSharedPanels } from "./panel-registry";

export function PanelStack({ nodes }: { nodes: SnapshotNode[] }) {
  if (nodes.length === 0) return null;

  const nodeTypes = [
    ...new Set(
      nodes.map((n) => n.type).filter((t): t is EditableNodeType => isEditableNodeType(t)),
    ),
  ];
  if (nodeTypes.length === 0) return null;

  const isMulti = nodes.length > 1;
  const panels = getSharedPanels(nodeTypes, isMulti);
  const singleComponentNode = !isMulti && nodes[0]?.type === "component" ? nodes[0] : null;
  const nodeIds = nodes.map((node) => node.id);

  return (
    <>
      {singleComponentNode && <ComponentWarningsBlock nodeId={singleComponentNode.id} />}
      {panels.map((panel) => {
        if (panel.source.kind === "builtin") {
          return (
            <BuiltinPanelHost
              definition={panel.source.definition}
              key={panel.id}
              selection={{ nodeIds }}
            />
          );
        }
        return <ComponentPanelHost key={panel.id} nodes={nodes} />;
      })}
    </>
  );
}
