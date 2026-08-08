import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import type { StateOverrideSelection } from "../../../state/designer-store-state";
import {
  getSelectedStateIdForNode,
  getStateById,
  isStateCapableNode,
  stateStyleOverridesToRecord,
} from "../../../state/utils/state-overrides";

const EMPTY_KEYS = new Set<string>();
const EMPTY_STYLE: Readonly<Record<string, unknown>> = {};

export interface StyleOverrideResetContext {
  isOverrideModeActive: boolean;
  overriddenKeys: Set<string>;
  baseStyle: Readonly<Record<string, unknown>>;
  hasOverride: (keys: readonly string[]) => boolean;
  buildResetPatch: (keys: readonly string[]) => Record<string, unknown>;
}

function createInactiveContext(): StyleOverrideResetContext {
  return {
    isOverrideModeActive: false,
    overriddenKeys: EMPTY_KEYS,
    baseStyle: EMPTY_STYLE,
    hasOverride: () => false,
    buildResetPatch: () => ({}),
  };
}

export function createStyleOverrideResetContext(
  nodes: SnapshotNode[],
  stateOverrideSelection: StateOverrideSelection,
): StyleOverrideResetContext {
  if (nodes.length !== 1) {
    return createInactiveContext();
  }

  const node = nodes[0];
  if (!(node && isStateCapableNode(node))) {
    return createInactiveContext();
  }

  const selectedStateId = getSelectedStateIdForNode(stateOverrideSelection, node.id);
  if (!selectedStateId) {
    return createInactiveContext();
  }

  const selectedState = getStateById(node, selectedStateId);
  if (!selectedState) {
    return createInactiveContext();
  }

  const overriddenKeys = new Set<string>(Object.keys(stateStyleOverridesToRecord(selectedState)));

  const baseStyle: Record<string, unknown> = { ...node.data.style };
  const hasOverride = (keys: readonly string[]): boolean =>
    keys.some((key) => overriddenKeys.has(key));

  const buildResetPatch = (keys: readonly string[]): Record<string, unknown> => {
    const patch: Record<string, unknown> = {};
    for (const key of keys) {
      patch[key] = baseStyle[key];
    }
    return patch;
  };

  return {
    isOverrideModeActive: true,
    overriddenKeys,
    baseStyle,
    hasOverride,
    buildResetPatch,
  };
}
