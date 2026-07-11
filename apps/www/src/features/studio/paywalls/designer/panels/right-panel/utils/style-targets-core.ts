import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { isStatefulNodeType } from "../../../state/actions";
import type { StyleTarget } from "../../../state/actions/features/style-action-helpers";
import type { StateOverrideSelection } from "../../../state/designer-store-state";
import {
  getSelectedStateIdForNode,
  isStateCapableNode,
  resolveEffectiveStyle,
} from "../../../state/utils/state-overrides";

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }

  const objectA = a as Record<string, unknown>;
  const objectB = b as Record<string, unknown>;
  const keysA = Object.keys(objectA);
  const keysB = Object.keys(objectB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => deepEqual(objectA[key], objectB[key]));
}

function getEffectiveNodeStyle(
  node: SnapshotNode,
  selection: StateOverrideSelection,
): Record<string, unknown> | null {
  if (isStateCapableNode(node)) {
    return resolveEffectiveStyle(node, getSelectedStateIdForNode(selection, node.id));
  }
  if (node.type === "shape" || node.type === "path") {
    return { ...node.data.style };
  }
  return null;
}

function getMixedStyleKeys(styles: Array<Record<string, unknown>>): Set<string> {
  if (styles.length <= 1) {
    return new Set<string>();
  }

  const firstStyle = styles[0] ?? {};
  const allKeys = new Set<string>(Object.keys(firstStyle));
  for (let index = 1; index < styles.length; index++) {
    const style = styles[index];
    if (!style) {
      continue;
    }
    for (const key of Object.keys(style)) {
      allKeys.add(key);
    }
  }

  const mixedKeys = new Set<string>();
  for (const key of allKeys) {
    const firstValue = firstStyle[key];
    const hasDifference = styles.some((style) => !deepEqual(style[key], firstValue));
    if (hasDifference) {
      mixedKeys.add(key);
    }
  }
  return mixedKeys;
}

export interface StyleTargetsResult {
  style: Record<string, unknown> | null;
  targets: StyleTarget[];
  mixedKeys: Set<string>;
}

export function getStyleTargetsForNodes(
  nodes: SnapshotNode[],
  stateOverrideSelection: StateOverrideSelection,
): StyleTargetsResult {
  const firstNode = nodes[0];
  if (!firstNode || getEffectiveNodeStyle(firstNode, stateOverrideSelection) === null) {
    return { style: null, targets: [], mixedKeys: new Set() };
  }

  const targets: StyleTarget[] = nodes.flatMap((node) =>
    isStatefulNodeType(node.type) ? [{ nodeId: node.id, nodeType: node.type }] : [],
  );

  const effectiveStyles = nodes
    .map((node) => getEffectiveNodeStyle(node, stateOverrideSelection))
    .filter((style): style is Record<string, unknown> => style !== null);

  return {
    style: effectiveStyles[0] ?? null,
    targets,
    mixedKeys: getMixedStyleKeys(effectiveStyles),
  };
}
