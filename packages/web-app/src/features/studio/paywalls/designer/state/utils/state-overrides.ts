import type { Action } from "@voidhash/mimic-schema";
import type {
  ScreenSnapshotNode,
  ScrollViewSnapshotNode,
  SnapshotNode,
  TextSnapshotNode,
  ViewSnapshotNode,
} from "@voidhash/paywall-renderer-web-core";

import type { StateOverrideSelection } from "../designer-store-state";

export type StateCapableNode =
  | ScreenSnapshotNode
  | ScrollViewSnapshotNode
  | TextSnapshotNode
  | ViewSnapshotNode;
export type StyleOverrideRecord = Record<string, unknown>;

type StateSnapshot = StateCapableNode["data"]["states"][number];
type ActionOverrideEntry = { interactionId: string; action: Action };

function readStyleOverridesFromUnknown(value: unknown): StyleOverrideRecord {
  if (!(value && typeof value === "object")) {
    return {};
  }

  const valueRecord = value as {
    overrides?: { style?: unknown };
    styleOverrides?: unknown;
  };

  const newShapeStyle = valueRecord.overrides?.style;
  if (newShapeStyle && typeof newShapeStyle === "object") {
    return { ...(newShapeStyle as Record<string, unknown>) };
  }

  // Legacy PoC fallback: [{ value: { key, value } }, ...]
  const legacy = valueRecord.styleOverrides;
  if (!Array.isArray(legacy)) {
    return {};
  }

  const result: StyleOverrideRecord = {};
  for (const entry of legacy) {
    if (!(entry && typeof entry === "object")) {
      continue;
    }
    const rawValue = (entry as { value?: unknown }).value;
    if (!(rawValue && typeof rawValue === "object")) {
      continue;
    }
    const key = (rawValue as { key?: unknown }).key;
    if (typeof key !== "string") {
      continue;
    }
    result[key] = (rawValue as { value?: unknown }).value;
  }
  return result;
}

function readActionOverridesFromUnknown(value: unknown): ActionOverrideEntry[] {
  if (!(value && typeof value === "object")) {
    return [];
  }

  const valueRecord = value as {
    overrides?: { actions?: unknown };
    actionOverrides?: unknown;
  };

  const newShapeActions = valueRecord.overrides?.actions;
  if (Array.isArray(newShapeActions)) {
    const result: ActionOverrideEntry[] = [];
    for (const entry of newShapeActions) {
      if (!(entry && typeof entry === "object")) {
        continue;
      }
      const payload = (entry as { value?: unknown }).value;
      if (!(payload && typeof payload === "object")) {
        continue;
      }
      const interactionId = (payload as { interactionId?: unknown }).interactionId;
      const action = (payload as { action?: unknown }).action;
      if (!(typeof interactionId === "string" && action)) {
        continue;
      }
      result.push({
        interactionId,
        action: action as Action,
      });
    }
    return result;
  }

  // Legacy PoC fallback: actionOverrides array
  const legacyActions = valueRecord.actionOverrides;
  if (!Array.isArray(legacyActions)) {
    return [];
  }

  const result: ActionOverrideEntry[] = [];
  for (const entry of legacyActions) {
    if (!(entry && typeof entry === "object")) {
      continue;
    }
    const payload = (entry as { value?: unknown }).value;
    if (!(payload && typeof payload === "object")) {
      continue;
    }
    const interactionId = (payload as { interactionId?: unknown }).interactionId;
    const action = (payload as { action?: unknown }).action;
    if (!(typeof interactionId === "string" && action)) {
      continue;
    }
    result.push({
      interactionId,
      action: action as Action,
    });
  }
  return result;
}

export function isStateCapableNode(node: SnapshotNode): node is StateCapableNode {
  return (
    node.type === "view" ||
    node.type === "scrollView" ||
    node.type === "screen" ||
    node.type === "text"
  );
}

export function getSelectedStateIdForNode(
  selection: StateOverrideSelection,
  nodeId: string,
): string | null {
  return selection[nodeId] ?? null;
}

export function setSelectedStateIdForNode(
  selection: StateOverrideSelection,
  nodeId: string,
  stateId: string | null,
): StateOverrideSelection {
  const nextSelection = { ...selection };
  if (stateId === null) {
    delete nextSelection[nodeId];
    return nextSelection;
  }
  nextSelection[nodeId] = stateId;
  return nextSelection;
}

export function clearSelectedStateIfDeleted(
  selection: StateOverrideSelection,
  nodeId: string,
  deletedStateId: string,
): StateOverrideSelection {
  const selectedStateId = getSelectedStateIdForNode(selection, nodeId);
  if (selectedStateId !== deletedStateId) {
    return selection;
  }
  return setSelectedStateIdForNode(selection, nodeId, null);
}

export function getStateById(node: StateCapableNode, stateId: string | null): StateSnapshot | null {
  if (!stateId) {
    return null;
  }
  return node.data.states.find((state) => state.id === stateId) ?? null;
}

export function stateStyleOverridesToRecord(state: StateSnapshot | null): StyleOverrideRecord {
  if (!state) {
    return {};
  }
  return readStyleOverridesFromUnknown(state.value);
}

export function resolveEffectiveStyle(
  node: StateCapableNode,
  stateId: string | null,
): Record<string, unknown> {
  const baseStyle: Record<string, unknown> = { ...node.data.style };
  const state = getStateById(node, stateId);
  if (!state) {
    return baseStyle;
  }

  const overrides = stateStyleOverridesToRecord(state);
  return {
    ...baseStyle,
    ...overrides,
  };
}

export function getStateActionOverride(
  node: ViewSnapshotNode | ScrollViewSnapshotNode,
  stateId: string | null,
  interactionId: string,
): Action | null {
  if (!stateId) {
    return null;
  }

  const state = node.data.states.find((entry) => entry.id === stateId) ?? null;
  if (!state) {
    return null;
  }

  const override = readActionOverridesFromUnknown(state.value).find(
    (entry) => entry.interactionId === interactionId,
  );
  return override?.action ?? null;
}

export function resolveEffectiveAction(
  node: ViewSnapshotNode | ScrollViewSnapshotNode,
  stateId: string | null,
  interactionId: string,
  defaultAction: Action,
): Action {
  const override = getStateActionOverride(node, stateId, interactionId);
  return override ?? defaultAction;
}

export function mapStyleOverridesForSnapshot(styleOverrides: unknown): StyleOverrideRecord {
  return readStyleOverridesFromUnknown({
    overrides: {
      style: styleOverrides,
    },
  });
}
