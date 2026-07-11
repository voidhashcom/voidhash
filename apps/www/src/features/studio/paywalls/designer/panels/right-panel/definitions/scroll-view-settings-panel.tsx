"use client";

/**
 * Built-in panel DEFINITION for the scrollView `Scroll` settings section — the
 * wire-tree replica of {@link ../sections/scroll-view-settings-section.ScrollViewSettingsSection}.
 * Exposes the two scrollView-only data flags as boolean switches:
 * - `horizontal` — scroll axis (off = vertical).
 * - `showsScrollIndicator` — whether the native scrollbar is shown.
 *
 * Every write goes through the node-level `updateScrollViewNode` action (a single
 * undoable step), applied to EVERY selected scrollView so the section works in a
 * homogeneous multi-selection. A value is `mixed` when the selected nodes
 * disagree; the switch then reads unchecked until toggled.
 */
import type { ScrollViewSnapshotNode, SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import type { PanelContext } from "@voidhash/paywalls/panel";
import { Panel } from "@voidhash/paywalls/panel";
import { useCallback } from "react";

import { updateScrollViewNode } from "@/features/studio/paywalls/designer/state/actions";

import { usePaywallDesignerActions } from "../../../state/designer-store";
import { useDefinitionNodes } from "./use-definition-nodes";

/** Narrows a definition's resolved nodes to the selected scrollView nodes. */
function scrollViewNodes(nodes: SnapshotNode[]): ScrollViewSnapshotNode[] {
  return nodes.filter((node): node is ScrollViewSnapshotNode => node.type === "scrollView");
}

/** Reads whether every node shares `value`, else `mixed`. */
function collapseFlag(values: boolean[]): { checked: boolean; mixed: boolean } {
  const first = values[0] ?? false;
  const mixed = values.some((value) => value !== first);
  return { checked: mixed ? false : first, mixed };
}

/** The scrollView `Scroll` settings panel definition. */
export function ScrollViewSettingsPanel(_ctx: PanelContext) {
  const dispatch = usePaywallDesignerActions();
  const { nodes } = useDefinitionNodes();

  const scrollViews = scrollViewNodes(nodes);

  const setHorizontal = useCallback(
    (checked: boolean) => {
      for (const node of scrollViews) {
        dispatch(updateScrollViewNode)({ id: node.id, updates: { horizontal: checked } });
      }
    },
    [dispatch, scrollViews],
  );

  const setShowsScrollIndicator = useCallback(
    (checked: boolean) => {
      for (const node of scrollViews) {
        dispatch(updateScrollViewNode)({
          id: node.id,
          updates: { showsScrollIndicator: checked },
        });
      }
    },
    [dispatch, scrollViews],
  );

  if (scrollViews.length === 0) return <Panel />;

  const horizontal = collapseFlag(scrollViews.map((node) => node.data.horizontal));
  const showsScrollIndicator = collapseFlag(
    scrollViews.map((node) => node.data.showsScrollIndicator),
  );

  return (
    <Panel>
      <Panel.Section title="Scroll">
        <Panel.Field label="Horizontal">
          <Panel.SwitchField
            checked={horizontal.checked}
            mixed={horizontal.mixed}
            onChange={setHorizontal}
          />
        </Panel.Field>
        <Panel.Field label="Show scroll indicator">
          <Panel.SwitchField
            checked={showsScrollIndicator.checked}
            mixed={showsScrollIndicator.mixed}
            onChange={setShowsScrollIndicator}
          />
        </Panel.Field>
      </Panel.Section>
    </Panel>
  );
}
