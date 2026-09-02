import type {
  ComponentManifest,
  ComponentPropDefinition,
} from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import type { ComponentNodeData } from "@voidhash/mimic-schema";

export type ComponentNodeWarningSeverity = "warning" | "info";

export type ComponentNodeWarning =
  | {
      kind: "manifest-missing";
      severity: "warning";
      message: string;
    }
  | {
      kind: "unknown-prop";
      severity: "warning";
      message: string;
      propName: string;
    }
  | {
      kind: "prop-kind-mismatch";
      severity: "warning";
      message: string;
      propName: string;
      expectedKey: string;
      storedKey: string;
    }
  | {
      kind: "missing-required-prop";
      severity: ComponentNodeWarningSeverity;
      message: string;
      propName: string;
    }
  | {
      kind: "dangling-variable-reference";
      severity: "warning";
      message: string;
      variableId: string;
      /** Prop or action name the reference lives on. */
      source: string;
    }
  | {
      kind: "unknown-action";
      severity: "warning";
      message: string;
      actionName: string;
    }
  | {
      kind: "unknown-action-payload-field";
      severity: "warning";
      message: string;
      actionName: string;
      field: string;
    }
  | {
      kind: "children-without-slot";
      severity: "warning";
      message: string;
    }
  | {
      kind: "component-unresolved";
      severity: "warning";
      message: string;
      /** The document-relative component path that resolved to no definition file. */
      componentPath: string;
    };

/**
 * The component snapshot-node fields validation reads (taken from
 * `node.data`, plus the node's `children`). `children` stays `unknown`
 * because the recursion-breaking annotation widens the component node's
 * child types — only presence matters here.
 */
export interface ComponentNodeValidationInput {
  readonly contentHash: string;
  readonly props: ComponentNodeData["data"]["props"];
  readonly actionBindings: ComponentNodeData["data"]["actionBindings"];
  readonly children?: unknown;
}

/**
 * Manifest prop kinds the editor cannot author values for in this slice —
 * missing-required warnings for these downgrade to info ("configured in
 * code").
 */
function isUneditableKind(def: ComponentPropDefinition): boolean {
  if (def.kind === "component") {
    return true;
  }
  return def.kind === "array" && (def.item.kind === "component" || def.item.kind === "ref");
}

/** Stored literal value key expected for a manifest prop kind, if any. */
function expectedValueKey(def: ComponentPropDefinition): string | undefined {
  switch (def.kind) {
    case "string":
    case "select":
    case "image":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "ref":
      return "product";
    case "component":
      return undefined;
    case "array":
      switch (def.item.kind) {
        case "string":
        case "select":
        case "image":
          return "string-array";
        case "number":
          return "number-array";
        case "boolean":
          return "boolean-array";
        default:
          return undefined;
      }
  }
}

function hasDefault(def: ComponentPropDefinition): boolean {
  return "default" in def && def.default !== undefined;
}

/**
 * Pure per-node component validation (spec §7.4). `manifest` is the catalog
 * entry for the node's pinned contentHash (`undefined` when absent — reported
 * as manifest-missing); `availableVariableIds` is the lexical ancestor-chain
 * variable id set (entry ids and internal ids).
 */
export function validateComponentNode(
  node: ComponentNodeValidationInput,
  manifest: ComponentManifest | undefined,
  availableVariableIds: ReadonlySet<string>,
): ComponentNodeWarning[] {
  const warnings: ComponentNodeWarning[] = [];

  const checkVariableReference = (variableId: string, source: string): void => {
    if (!availableVariableIds.has(variableId)) {
      warnings.push({
        kind: "dangling-variable-reference",
        message: `"${source}" references variable "${variableId}", which is not declared on this node's ancestor chain.`,
        severity: "warning",
        source,
        variableId,
      });
    }
  };

  if (manifest === undefined) {
    warnings.push({
      kind: "manifest-missing",
      message: `Pinned component version (${node.contentHash.slice(0, 12)}…) is not in the project catalog. It may have been removed or not deployed to this environment.`,
      severity: "warning",
    });
  }

  for (const entry of node.props) {
    if (entry.value === undefined) {
      continue;
    }
    const propName = entry.value.name;
    const binding = entry.value.value;

    if (binding.type === "variable-reference") {
      checkVariableReference(binding.value.id, propName);
    }

    if (manifest === undefined) {
      continue;
    }

    const def = manifest.props[propName];
    if (def === undefined) {
      warnings.push({
        kind: "unknown-prop",
        message: `Prop "${propName}" is not declared by the component manifest.`,
        propName,
        severity: "warning",
      });
      continue;
    }

    if (binding.type === "literal") {
      const expected = expectedValueKey(def);
      if (expected !== undefined && binding.value.key !== expected) {
        warnings.push({
          expectedKey: expected,
          kind: "prop-kind-mismatch",
          message: `Prop "${propName}" stores a "${binding.value.key}" value but the manifest declares kind "${def.kind}" (expects "${expected}").`,
          propName,
          severity: "warning",
          storedKey: binding.value.key,
        });
      }
    }
  }

  if (manifest !== undefined) {
    const storedPropNames = new Set(
      node.props.flatMap((entry) => (entry.value === undefined ? [] : [entry.value.name])),
    );
    for (const [propName, def] of Object.entries(manifest.props)) {
      if (def.optional === true || hasDefault(def) || storedPropNames.has(propName)) {
        continue;
      }
      const uneditable = isUneditableKind(def);
      warnings.push({
        kind: "missing-required-prop",
        message: uneditable
          ? `Required prop "${propName}" is configured in code and cannot be set in the editor.`
          : `Required prop "${propName}" has no value.`,
        propName,
        severity: uneditable ? "info" : "warning",
      });
    }
  }

  const manifestActions = manifest?.actions ?? {};
  for (const entry of node.actionBindings) {
    if (entry.value === undefined) {
      continue;
    }
    const actionName = entry.value.name;
    const declared = manifest === undefined ? undefined : manifestActions[actionName];

    if (manifest !== undefined && declared === undefined) {
      warnings.push({
        actionName,
        kind: "unknown-action",
        message: `Action "${actionName}" is not declared by the component manifest.`,
        severity: "warning",
      });
    }

    const checkPayloadField = (field: string): void => {
      if (declared === undefined) {
        return;
      }
      if (!(field in declared.payload)) {
        warnings.push({
          actionName,
          field,
          kind: "unknown-action-payload-field",
          message: `Action "${actionName}" has no payload field "${field}".`,
          severity: "warning",
        });
      }
    };

    const bound = entry.value.action;
    if (bound.type === "set-variable") {
      checkVariableReference(bound.payload.variableId, actionName);
      const source = bound.payload.newValue;
      if (source.type === "variable-reference") {
        checkVariableReference(source.value.id, actionName);
      } else if (source.type === "action-payload") {
        checkPayloadField(source.value.field);
      }
    } else if (bound.type === "purchase-product") {
      const source = bound.payload;
      if (source.type === "variable-reference") {
        checkVariableReference(source.variableId, actionName);
      } else if (source.type === "action-payload") {
        checkPayloadField(source.field);
      }
    }
  }

  if (
    manifest !== undefined &&
    manifest.slot === false &&
    Array.isArray(node.children) &&
    node.children.length > 0
  ) {
    warnings.push({
      kind: "children-without-slot",
      message: "This component declares no slot — its child layers will not be rendered inside it.",
      severity: "warning",
    });
  }

  return warnings;
}

interface VariableScopeSnapshotNode {
  id: string;
  type: string;
  // The extra optional keys keep `data` from being a "weak type": a
  // `codeComponent`'s data is `{path, source}` with no `localVariables`, so a
  // shared property is needed for `RootSnapshotNode` to assign here.
  data?: { localVariables?: unknown; path?: string; source?: string };
  children?: readonly VariableScopeSnapshotNode[];
}

function collectNodeVariableIds(node: VariableScopeSnapshotNode, into: Set<string>): void {
  const localVariables = node.data?.localVariables;
  if (!Array.isArray(localVariables)) {
    return;
  }
  for (const entry of localVariables) {
    if (!(entry && typeof entry === "object")) {
      continue;
    }
    const entryId = (entry as { id?: unknown }).id;
    if (typeof entryId === "string") {
      into.add(entryId);
    }
    const value = (entry as { value?: unknown }).value;
    if (value && typeof value === "object") {
      const internalId = (value as { id?: unknown }).id;
      if (typeof internalId === "string") {
        into.add(internalId);
      }
    }
  }
}

/**
 * Collects all variable ids (array-entry ids and internal ids — references
 * may use either) visible to `nodeId` under lexical scoping: the node itself
 * plus every ancestor up to the root.
 */
export function collectAncestorVariableIds(
  snapshot: VariableScopeSnapshotNode | null,
  nodeId: string,
): ReadonlySet<string> {
  const ids = new Set<string>();
  if (!snapshot) {
    return ids;
  }

  const chain: VariableScopeSnapshotNode[] = [];
  const walk = (node: VariableScopeSnapshotNode): boolean => {
    chain.push(node);
    if (node.id === nodeId) {
      return true;
    }
    for (const child of node.children ?? []) {
      if (walk(child)) {
        return true;
      }
    }
    chain.pop();
    return false;
  };

  if (!walk(snapshot)) {
    return ids;
  }

  for (const node of chain) {
    collectNodeVariableIds(node, ids);
  }
  return ids;
}
