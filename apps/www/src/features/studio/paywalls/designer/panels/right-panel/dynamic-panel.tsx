"use client";

import type {
  PathSnapshotNode,
  ScreenSnapshotNode,
  ScrollViewSnapshotNode,
  ShapeSnapshotNode,
  SnapshotNode,
  TextSnapshotNode,
  ViewSnapshotNode,
} from "@voidhash/paywall-renderer-web-core";

import { isEditableNodeType } from "../../state/actions";
import type { EditableNodeType } from "../../state/actions";
import type { SectionId } from "../types";
import { getSharedSections } from "./section-registry";
import { BorderRadiusSection } from "./sections/border-radius-section";
import { BorderSection } from "./sections/border-section";
import { ComponentActionsSection } from "./sections/component-actions-section";
import { ComponentPropsSection } from "./sections/component-props-section";
import { ComponentSection } from "./sections/component-section";
import { ComponentWarningsBlock } from "./sections/component-warnings";
import { ContentSection } from "./sections/content-section";
import { FillSection } from "./sections/fill-section";
import { FlexLayoutSection } from "./sections/flex-layout-section";
import { InteractionsSection } from "./sections/interactions-section";
import { PathFillSection } from "./sections/path-fill-section";
import { PathStrokeSection } from "./sections/path-stroke-section";
import { PositionSection } from "./sections/position-section";
import { ScrollViewSettingsSection } from "./sections/scroll-view-settings-section";
import { ShapeLayoutSection } from "./sections/shape-layout-section";
import { StatesSection } from "./sections/states-section";
import { TextFillSection } from "./sections/text-fill-section";
import { TypographySection } from "./sections/typography-section";
import { VariablesSection } from "./sections/variables-section";

type StatefulSnapshotNode =
  | ViewSnapshotNode
  | ScrollViewSnapshotNode
  | ScreenSnapshotNode
  | TextSnapshotNode
  | ShapeSnapshotNode
  | PathSnapshotNode;

function isStatefulSnapshotNode(node: SnapshotNode): node is StatefulSnapshotNode {
  return (
    node.type === "view" ||
    node.type === "scrollView" ||
    node.type === "screen" ||
    node.type === "text" ||
    node.type === "shape" ||
    node.type === "path"
  );
}

/**
 * Renders one legacy section by id, narrowing the first node's type as the old
 * per-section switch requires. Exported so the v2 {@link PanelStack} can reuse
 * this EXACT rendering path for any section not yet migrated (the fallback must
 * be byte-identical to the flag-off panel — do not fork this logic).
 */
export function Section({ sectionId, nodes }: { sectionId: SectionId; nodes: SnapshotNode[] }) {
  const firstNode = nodes[0]!;
  const statefulNodes = nodes.filter(isStatefulSnapshotNode);

  switch (sectionId) {
    case "variables":
      if (
        firstNode.type === "view" ||
        firstNode.type === "scrollView" ||
        firstNode.type === "text" ||
        firstNode.type === "screen" ||
        firstNode.type === "shape" ||
        firstNode.type === "path"
      ) {
        return <VariablesSection nodes={statefulNodes} />;
      }
      return null;
    case "states":
      if (
        firstNode.type === "view" ||
        firstNode.type === "scrollView" ||
        firstNode.type === "text" ||
        firstNode.type === "screen" ||
        firstNode.type === "shape" ||
        firstNode.type === "path"
      ) {
        return <StatesSection nodes={statefulNodes} />;
      }
      return null;
    case "scrollViewSettings":
      return (
        <ScrollViewSettingsSection
          nodes={nodes.filter((node) => node.type === "scrollView")}
        />
      );
    case "position": {
      if (firstNode.type !== "view" && firstNode.type !== "scrollView" && firstNode.type !== "text")
        return null;
      return <PositionSection nodes={nodes} />;
    }
    case "flexLayout": {
      // Use the node's actual parentId from the snapshot
      if (!firstNode.parentId) return null;

      return (
        <FlexLayoutSection
          editableDimensions={firstNode.type !== "screen"}
          nodes={nodes}
          parentId={firstNode.parentId}
        />
      );
    }
    case "shapeLayout":
      return <ShapeLayoutSection nodes={nodes} />;
    case "borderRadius":
      return <BorderRadiusSection nodes={nodes} />;
    case "fill":
      return <FillSection nodes={nodes} />;
    case "border":
      return <BorderSection nodes={nodes} />;
    case "interactions": {
      if (firstNode.type !== "view" && firstNode.type !== "scrollView") return null;
      return (
        <InteractionsSection
          nodes={nodes.filter((node) => node.type === "view" || node.type === "scrollView")}
        />
      );
    }
    case "content": {
      if (firstNode.type !== "text") return null;
      return <ContentSection node={firstNode} />;
    }
    case "typography":
      return <TypographySection nodes={nodes} />;
    case "textFill":
      return <TextFillSection nodes={nodes} />;
    case "pathFill":
      return <PathFillSection nodes={nodes} />;
    case "pathStroke":
      return <PathStrokeSection nodes={nodes} />;
    case "componentSettings": {
      if (firstNode.type !== "component") return null;
      return <ComponentSection node={firstNode} />;
    }
    case "componentProps": {
      if (firstNode.type !== "component") return null;
      return <ComponentPropsSection node={firstNode} />;
    }
    case "componentActions": {
      if (firstNode.type !== "component") return null;
      return <ComponentActionsSection node={firstNode} />;
    }
    default:
      return null;
  }
}

export function DynamicPanel({ nodes }: { nodes: SnapshotNode[] }) {
  if (nodes.length === 0) return null;

  const nodeTypes = [
    ...new Set(
      nodes.map((n) => n.type).filter((t): t is EditableNodeType => isEditableNodeType(t)),
    ),
  ];

  if (nodeTypes.length === 0) return null;

  const isMulti = nodes.length > 1;
  const sections = getSharedSections(nodeTypes, isMulti);
  const singleComponentNode = !isMulti && nodes[0]?.type === "component" ? nodes[0] : null;

  return (
    <>
      {singleComponentNode && <ComponentWarningsBlock nodeId={singleComponentNode.id} />}
      {sections.map((section) => (
        <Section key={section.id} nodes={nodes} sectionId={section.id} />
      ))}
    </>
  );
}
