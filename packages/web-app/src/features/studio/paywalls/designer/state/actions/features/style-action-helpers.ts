import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";

import { documentRootFromSnapshot } from "../../utils/document-root";
import type { DesignerStoreState, StateOverrideSelection } from "../../designer-store-state";
import { findStatefulNode, type DesignerDocumentRoot } from "../../utils/node-proxies";
import {
  getSelectedStateIdForNode,
  getStateById,
  isStateCapableNode,
  mapStyleOverridesForSnapshot,
  resolveEffectiveStyle,
  stateStyleOverridesToRecord,
  type StyleOverrideRecord,
} from "../../utils/state-overrides";
import { unwrapEntriesDeep } from "../../utils/replay";
import { findNodeById } from "../../utils/tree";
import type { StatefulEditableNodeType } from "../node-resolver";

export interface StyleTarget {
  nodeId: string;
  nodeType: StatefulEditableNodeType;
}

export type StyleUpdateUndoTarget =
  | {
      kind: "base";
      style: Record<string, unknown>;
    }
  | {
      kind: "state";
      stateId: string;
      styleOverrides: StyleOverrideRecord;
    };

/**
 * Bivariant structural views of the schema-typed proxies, so the generic
 * string-keyed style writes shared by every style panel typecheck against
 * all five stateful node types at once.
 */
interface StateOverridesProxy {
  overrides: {
    style: {
      set(value: StyleOverrideRecord): void;
      update(value: Record<string, unknown>): void;
    };
  };
}

interface StyleWritableNodeProxy {
  update(value: { style?: Record<string, unknown> }): void;
  data: {
    states: {
      findById(id: string): { value: StateOverridesProxy } | undefined;
    };
  };
}

type TransactionFn = (fn: (root: DesignerDocumentRoot) => void) => void;

/**
 * Structural equality for style values. Primitives compare with `===`;
 * structured values (`backgroundGradient` / `backgroundImage`) compare by
 * content so an unchanged object never produces a spurious CRDT write. The
 * decoded snapshot wraps array elements as `{ id, pos, value }`, so this
 * unwraps a `value` field when present to compare against the logical
 * `{ color, position }` write shape.
 */
function styleValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => styleValuesEqual(item, b[index]));
  }

  const objectA = a as Record<string, unknown>;
  const objectB = b as Record<string, unknown>;
  // Unwrap the decoded array-element wrapper so a stored `{ id, pos, value }`
  // compares equal to a logical `{ color, position }` written value.
  const unwrappedA = "value" in objectA && !("value" in objectB) ? objectA.value : objectA;
  const unwrappedB = "value" in objectB && !("value" in objectA) ? objectB.value : objectB;
  if (unwrappedA !== objectA || unwrappedB !== objectB) {
    return styleValuesEqual(unwrappedA, unwrappedB);
  }

  const keysA = Object.keys(objectA);
  const keysB = Object.keys(objectB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => styleValuesEqual(objectA[key], objectB[key]));
}

function styleWritableNode(
  root: DesignerDocumentRoot,
  target: StyleTarget,
): StyleWritableNodeProxy | undefined {
  return findStatefulNode(root, target.nodeId, target.nodeType);
}

/**
 * A plain (JSON-shaped) object or array — used for structured style values like
 * `backgroundGradient` / `backgroundImage`. Class instances and other exotic
 * objects are rejected so only serializable style payloads reach the CRDT.
 */
function isPlainStructuredValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return true;
  }
  if (value === null || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isWritableStyleOverrideValue(value: unknown): boolean {
  return (
    value === undefined ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string" ||
    isPlainStructuredValue(value)
  );
}

/**
 * Deep-clone a plain JSON value before writing it into the CRDT so the write
 * never shares references with the store snapshot (which would let later
 * mutations leak, and lets the schema materialize its own nested structs).
 */
function cloneStructuredValue<T>(value: T): T {
  if (value === undefined || value === null || typeof value !== "object") {
    return value;
  }
  return structuredClone(value);
}

function setStateStyleOverride(stateProxy: StateOverridesProxy, key: string, value: unknown): void {
  stateProxy.overrides.style.update({
    [key]: cloneStructuredValue(value),
  });
}

/**
 * Normalizes a DECODED style record for a whole-object proxy write
 * (`.update({ style })` / `overrides.style.set`).
 *
 * Struct writes re-encode every field present, and they expect LOGICAL input.
 * A decoded snapshot carries array elements (e.g. `backgroundGradient.stops`)
 * in the CRDT entry wrapper (`{ id, pos, value: { color, position } }`);
 * feeding that wrapper straight back re-encodes each entry as if it were a
 * logical element, so its real fields read `undefined` and collapse to schema
 * defaults (every stop becomes the default color at position 0). Every write
 * and undo restore that replays a decoded snapshot must run through this.
 */
export function normalizeStyleForWrite(style: Record<string, unknown>): Record<string, unknown> {
  return unwrapEntriesDeep(style) as Record<string, unknown>;
}

/**
 * Saves each node's current style target (base style or state override), then applies style updates.
 * Returns previous target values for undo.
 */
export function applyStyleUpdate<TStyle extends object>(
  mimic: DesignerStoreState["mimic"],
  nodes: StyleTarget[],
  style: Partial<TStyle>,
  stateOverrideSelection: StateOverrideSelection,
  transaction: TransactionFn,
): Map<string, StyleUpdateUndoTarget> {
  const previousStyles = new Map<string, StyleUpdateUndoTarget>();
  const incoming: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style)) {
    // The schema has no null values — a null incoming value is the legacy
    // "clear this key" input. For width/height that meant hug contents, which
    // the schema spells "auto"; deleting those fields instead would
    // re-materialize their schema default (100). Every other field maps to
    // field deletion (undefined).
    if (value === null) {
      incoming[key] = key === "width" || key === "height" ? "auto" : undefined;
    } else {
      incoming[key] = value;
    }
  }
  if (Object.keys(incoming).length === 0) return previousStyles;
  const root: SnapshotNode = documentRootFromSnapshot(mimic.snapshot);
  const changedPropsByNode = new Map<string, Record<string, unknown>>();
  const baseStyles = new Map<string, Record<string, unknown>>();

  for (const target of nodes) {
    const snapshotNode = findNodeById<SnapshotNode>(root, target.nodeId);
    if (!snapshotNode || !isStateCapableNode(snapshotNode)) {
      continue;
    }

    const selectedStateId = getSelectedStateIdForNode(stateOverrideSelection, target.nodeId);
    const selectedState = getStateById(snapshotNode, selectedStateId);
    const selectedStateOverrideKeys = selectedState
      ? new Set<string>(Object.keys(stateStyleOverridesToRecord(selectedState)))
      : new Set<string>();
    const effectiveStyle = resolveEffectiveStyle(snapshotNode, selectedStateId);
    const baseStyle: Record<string, unknown> = { ...snapshotNode.data.style };

    const changedProps: Record<string, unknown> = {};
    for (const key of Object.keys(incoming)) {
      const incomingValue = incoming[key];
      const shouldClearExistingOverride =
        !!selectedStateId &&
        !!selectedState &&
        selectedStateOverrideKeys.has(key) &&
        styleValuesEqual(incomingValue, baseStyle[key]);
      if (!styleValuesEqual(incomingValue, effectiveStyle[key]) || shouldClearExistingOverride) {
        changedProps[key] = incoming[key];
      }
    }

    if (Object.keys(changedProps).length === 0) {
      continue;
    }

    changedPropsByNode.set(target.nodeId, changedProps);

    if (selectedState && selectedStateId) {
      baseStyles.set(target.nodeId, baseStyle);
      previousStyles.set(target.nodeId, {
        kind: "state",
        stateId: selectedStateId,
        styleOverrides: mapStyleOverridesForSnapshot(stateStyleOverridesToRecord(selectedState)),
      });
      continue;
    }

    previousStyles.set(target.nodeId, {
      kind: "base",
      style: { ...snapshotNode.data.style },
    });
  }

  if (changedPropsByNode.size === 0) return previousStyles;

  transaction((transactionRoot) => {
    for (const target of nodes) {
      const changedProps = changedPropsByNode.get(target.nodeId);
      if (!changedProps) continue;
      const prev = previousStyles.get(target.nodeId);
      if (!prev) continue;

      const proxy = styleWritableNode(transactionRoot, target);
      if (!proxy) continue;

      if (prev.kind === "base") {
        proxy.update({ style: { ...normalizeStyleForWrite(prev.style), ...changedProps } });
        continue;
      }

      const stateProxy = proxy.data.states.findById(prev.stateId)?.value;
      if (!stateProxy) continue;

      const baseStyle = baseStyles.get(target.nodeId);
      if (!baseStyle) continue;

      // Struct `update` cannot introduce a nested-struct field on the partial
      // override (it recurses into the absent field and dies on missing_field),
      // so writes touching structured values go through a whole-record `set`
      // built by merging the current overrides; scalar-only writes keep the
      // narrower per-key `update` path.
      const currentOverrides = normalizeStyleForWrite(prev.styleOverrides);
      const writableProps = Object.entries(changedProps).filter(([, value]) =>
        isWritableStyleOverrideValue(value),
      );
      const needsWholeRecordSet = writableProps.some(
        ([key, value]) =>
          isPlainStructuredValue(value) || isPlainStructuredValue(currentOverrides[key]),
      );
      const nextOverrides: StyleOverrideRecord = { ...currentOverrides };

      for (const [key, value] of writableProps) {
        const clearsOverride =
          value === undefined
            ? baseStyle[key] === undefined
            : styleValuesEqual(value, baseStyle[key]);

        if (clearsOverride) {
          delete nextOverrides[key];
          if (!needsWholeRecordSet) {
            setStateStyleOverride(stateProxy, key, undefined);
          }
          continue;
        }

        // A deletion whose base value still exists leaves the override alone
        // (matches the pre-structured behavior).
        if (value === undefined) {
          continue;
        }

        nextOverrides[key] = cloneStructuredValue(value);
        if (!needsWholeRecordSet) {
          setStateStyleOverride(stateProxy, key, value);
        }
      }

      if (needsWholeRecordSet) {
        stateProxy.overrides.style.set(nextOverrides);
      }
    }
  });

  return previousStyles;
}

/**
 * Restores previous style targets in a transaction (undo).
 */
export function undoStyleUpdate(
  _mimic: DesignerStoreState["mimic"],
  nodes: StyleTarget[],
  previousStyles: Map<string, StyleUpdateUndoTarget>,
  transaction: TransactionFn,
): void {
  if (previousStyles.size === 0) return;
  transaction((root) => {
    for (const target of nodes) {
      const prev = previousStyles.get(target.nodeId);
      if (!prev) continue;
      const proxy = styleWritableNode(root, target);
      if (!proxy) continue;

      if (prev.kind === "base") {
        // Optional style fields snapshot as ABSENT when unset; delete them
        // explicitly so values the undone action introduced do not survive.
        proxy.update({
          style: {
            flex: undefined,
            maxHeight: undefined,
            maxWidth: undefined,
            minHeight: undefined,
            minWidth: undefined,
            ...normalizeStyleForWrite(prev.style),
          },
        });
        continue;
      }

      const stateProxy = proxy.data.states.findById(prev.stateId)?.value;
      if (!stateProxy) continue;
      stateProxy.overrides.style.set(normalizeStyleForWrite(prev.styleOverrides));
    }
  });
}
