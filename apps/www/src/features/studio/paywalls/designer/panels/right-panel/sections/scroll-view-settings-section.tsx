"use client";

/**
 * Legacy `Scroll` settings section for scrollView nodes. Exposes the two
 * scrollView-only data flags as switches: `horizontal` (scroll axis; off =
 * vertical) and `showsScrollIndicator` (native scrollbar visibility). Every
 * write goes through the node-level `updateScrollViewNode` action, applied to
 * EVERY selected scrollView so it works in a homogeneous multi-selection. A flag
 * whose selected nodes disagree renders unchecked until toggled.
 */
import type { ScrollViewSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { Switch } from "@voidhash/ui";

import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";

import { updateScrollViewNode } from "@/features/studio/paywalls/designer/state/actions";

import { usePaywallDesignerActions } from "../../../state/designer-store";

/** Reads whether every node shares the same flag value (else "mixed"). */
function collapseFlag(values: boolean[]): boolean {
  const first = values[0] ?? false;
  return values.some((value) => value !== first) ? false : first;
}

export function ScrollViewSettingsSection({ nodes }: { nodes: ScrollViewSnapshotNode[] }) {
  const dispatch = usePaywallDesignerActions();

  if (nodes.length === 0) {
    return null;
  }

  const horizontal = collapseFlag(nodes.map((node) => node.data.horizontal));
  const showsScrollIndicator = collapseFlag(nodes.map((node) => node.data.showsScrollIndicator));

  const setHorizontal = (checked: boolean) => {
    for (const node of nodes) {
      dispatch(updateScrollViewNode)({ id: node.id, updates: { horizontal: checked } });
    }
  };

  const setShowsScrollIndicator = (checked: boolean) => {
    for (const node of nodes) {
      dispatch(updateScrollViewNode)({ id: node.id, updates: { showsScrollIndicator: checked } });
    }
  };

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Scroll</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Horizontal</span>
            <Switch checked={horizontal} onCheckedChange={setHorizontal} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Show scroll indicator</span>
            <Switch checked={showsScrollIndicator} onCheckedChange={setShowsScrollIndicator} />
          </div>
        </div>
      </PanelSectionContent>
    </PanelSection>
  );
}
