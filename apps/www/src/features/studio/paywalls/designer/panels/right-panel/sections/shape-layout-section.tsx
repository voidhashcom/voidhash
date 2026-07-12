"use client";

import type { ShapeSnapshotNode, SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useDesignerDraft } from "@/features/studio/paywalls/designer/hooks/use-designer-draft";
import { useCallback } from "react";
import { useStore } from "zustand";

import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
  PanelSubSection,
  PanelSubSectionContent,
  PanelSubSectionTitle,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";
import { updateShapeNode } from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";

import { getAlignItems, getFlexDirection } from "../../../state/utils/node-type-helpers";
import { getNodeById } from "../../../state/utils/nodes";
import { HeightInput } from "../inputs/height-input";
import { WidthInput } from "../inputs/width-input";

type ShapeLayoutNode = {
  width: number | "auto";
  height: number | "auto";
  flex: number | undefined;
  flexGrow: number;
  flexShrink: number;
  flexBasis: number | "auto";
  alignSelf: "auto" | "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
};

export function ShapeLayoutSection({ nodes }: { nodes: SnapshotNode[] }) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { draft, begin, commit } = useDesignerDraft(store);

  const firstNode: ShapeSnapshotNode | undefined =
    nodes[0]?.type === "shape" ? nodes[0] : undefined;
  if (!firstNode) return null;

  const style = firstNode.data.style;
  const node: ShapeLayoutNode = { ...style, flex: style.flex };
  const parentId = firstNode.parentId;

  const handleChange = useCallback(
    (incoming: Partial<ShapeLayoutNode>) => {
      dispatch(updateShapeNode)({
        id: firstNode.id,
        updates: { style: incoming },
      });
    },
    [dispatch, firstNode.id],
  );

  const handleDraftChange = useCallback(
    (incoming: Partial<ShapeLayoutNode>) => {
      if (!draft) begin();
      dispatch(updateShapeNode)({
        id: firstNode.id,
        updates: { style: incoming },
      });
    },
    [draft, begin, dispatch, firstNode.id],
  );

  const handleCommit = useCallback(() => {
    commit();
  }, [commit]);

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Layout</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        <DimensionsSubSection
          handleCommit={handleCommit}
          handleDraftChange={handleDraftChange}
          node={node}
          nodeId={firstNode.id}
          onNodeChange={handleChange}
          parentId={parentId ?? ""}
        />
      </PanelSectionContent>
    </PanelSection>
  );
}

type DimensionsSubSectionProps = {
  node: ShapeLayoutNode;
  nodeId: string;
  onNodeChange: (style: Partial<ShapeLayoutNode>) => void;
  handleDraftChange: (style: Partial<ShapeLayoutNode>) => void;
  handleCommit: () => void;
  parentId: string;
};

function DimensionsSubSection({
  node,
  nodeId,
  onNodeChange,
  handleDraftChange,
  handleCommit,
  parentId,
}: DimensionsSubSectionProps) {
  const store = usePaywallDesignerStore();
  const parent = useStore(store, (state) => getNodeById(state, parentId));
  const boundingBox = useStore(store, (state) => state.canvas.boundingBoxes[nodeId] ?? null);

  const parentDirection = parent ? getFlexDirection(parent, "row") : "row";
  const parentAlignItems = getAlignItems(parent, "stretch");

  const computedWidth = boundingBox ? Math.round(boundingBox.width) : null;
  const computedHeight = boundingBox ? Math.round(boundingBox.height) : null;

  return (
    <PanelSubSection>
      <PanelSubSectionTitle>Dimensions</PanelSubSectionTitle>
      <PanelSubSectionContent>
        <div className="flex flex-row gap-2">
          <WidthInput
            computedWidth={computedWidth}
            disabled={false}
            node={node}
            onCommit={handleCommit}
            onDraftChange={handleDraftChange}
            onNodeChange={onNodeChange}
            parentAlignItems={parentAlignItems}
            parentDirection={parentDirection}
          />
          <HeightInput
            computedHeight={computedHeight}
            disabled={false}
            node={node}
            onCommit={handleCommit}
            onDraftChange={handleDraftChange}
            onNodeChange={onNodeChange}
            parentAlignItems={parentAlignItems}
            parentDirection={parentDirection}
          />
        </div>
      </PanelSubSectionContent>
    </PanelSubSection>
  );
}
