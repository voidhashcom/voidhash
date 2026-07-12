"use client";

/**
 * The flag gate between the legacy right panel ({@link DynamicPanel}) and the v2
 * host-rendered panel stack. The flag lives at
 * `localStorage["voidhash.designer.panelsV2"]` (`off` | `on` | `both`), with a
 * `?panelsV2=` URL query overriding it (read once per mount). DEFAULT is `off`,
 * so production is byte-identical to before this phase.
 *
 * - `off`  → render {@link DynamicPanel} EXACTLY (the default path).
 * - `on`   → the v2 stack: the component warnings block, then per applicable
 *            panel, a {@link BuiltinPanelHost} when the panel is MIGRATED and has
 *            a built-in `definition`, else the legacy {@link Section} (reused
 *            verbatim so unmigrated sections render identically).
 * - `both` → the legacy panel and the v2 stack, stacked, for visual diffing.
 */
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { isEditableNodeType } from "../../state/actions";
import type { EditableNodeType } from "../../state/actions";
import { BuiltinPanelHost } from "./builtin-panel-host";
import { ComponentPanelHost } from "./component-panel-host";
import { DynamicPanel, Section } from "./dynamic-panel";
import { getSharedPanels, MIGRATED } from "./panel-registry";
import { ComponentWarningsBlock } from "./sections/component-warnings";

type PanelsV2Flag = "off" | "on" | "both";

/**
 * Reads the v2 flag: the `?panelsV2=` URL query wins, else
 * `localStorage["voidhash.designer.panelsV2"]`, else `off`. Read once per mount
 * (a stale value until reload is fine — this is a developer flag).
 */
function readPanelsV2Flag(): PanelsV2Flag {
  const normalize = (value: string | null | undefined): PanelsV2Flag | null =>
    value === "on" || value === "off" || value === "both" ? value : null;
  if (typeof window === "undefined") return "off";
  try {
    const fromUrl = normalize(new URLSearchParams(window.location.search).get("panelsV2"));
    if (fromUrl) return fromUrl;
    return normalize(window.localStorage.getItem("voidhash.designer.panelsV2")) ?? "off";
  } catch {
    return "off";
  }
}

/**
 * The v2 stack body: the component warnings block (same single-component rule as
 * the legacy panel), then each applicable panel rendered through the v2 host when
 * migrated, or the legacy section otherwise.
 */
function PanelStackV2({ nodes }: { nodes: SnapshotNode[] }) {
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
        if (
          panel.source.kind === "builtin" &&
          panel.source.definition &&
          MIGRATED.has(panel.id)
        ) {
          return (
            <BuiltinPanelHost
              definition={panel.source.definition}
              key={panel.id}
              sectionId={panel.id}
              selection={{ nodeIds }}
            />
          );
        }
        // The component-panel slot (Phase 3b): host-rendered default panel or a
        // sandboxed custom session, batch-editing the selected component nodes.
        if (panel.source.kind === "component-panel") {
          return <ComponentPanelHost key={panel.id} nodes={nodes} />;
        }
        // Any remaining unmigrated section renders through the reused per-section
        // switch so the fallback is byte-identical to the flag-off panel.
        return <Section key={panel.id} nodes={nodes} sectionId={panel.id} />;
      })}
    </>
  );
}

/**
 * The right-panel content, gated by the v2 flag. With the flag off (default) it
 * renders {@link DynamicPanel} exactly — zero behavior change in production.
 */
export function PanelStack({ nodes }: { nodes: SnapshotNode[] }) {
  if (nodes.length === 0) return null;
  const flag = readPanelsV2Flag();

  if (flag === "off") {
    return <DynamicPanel nodes={nodes} />;
  }
  if (flag === "both") {
    return (
      <>
        <DynamicPanel nodes={nodes} />
        <PanelStackV2 nodes={nodes} />
      </>
    );
  }
  return <PanelStackV2 nodes={nodes} />;
}
