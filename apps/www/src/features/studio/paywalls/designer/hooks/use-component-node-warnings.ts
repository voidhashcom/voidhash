import type { ComponentManifest } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import { getBuiltinComponent } from "@voidhash/paywall-builtins";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useMemo } from "react";
import { useStore } from "zustand/react";

import { usePaywallDesignerStore } from "../state/designer-store";
import { codeComponentDefinitions, selectCodeComponentNodes } from "../state/utils/code-components";
import type { AncestorVariablesSnapshotNode } from "../state/utils/ancestor-variables";
import {
  collectAncestorVariableIds,
  validateComponentNode,
  type ComponentNodeWarning,
} from "../state/utils/component-validation";
import { selectDocumentRoot } from "../state/utils/document-root";
import { findNodeById } from "../state/utils/tree";

const NO_WARNINGS: ComponentNodeWarning[] = [];

/**
 * Per-node memoized component validation selector. Returns spec §7.4 warnings
 * for the component node `nodeId` (empty for non-component nodes and nodes
 * not in the snapshot) so canvas badges, layers glyphs and the right panel
 * can share one source. Works for unselected nodes — only the snapshot and
 * catalog mirror are read.
 */
export function useComponentNodeWarnings(nodeId: string): ComponentNodeWarning[] {
  const store = usePaywallDesignerStore();
  const documentRoot = useStore(store, selectDocumentRoot);
  const byContentHash = useStore(store, (state) => state.componentCatalog.byContentHash);
  const compiled = useStore(store, (state) => state.codeComponents.compiled);
  const codeNodes = useStore(store, selectCodeComponentNodes);

  return useMemo(() => {
    const node = findNodeById<SnapshotNode>(documentRoot, nodeId);
    if (!node || node.type !== "component") {
      return NO_WARNINGS;
    }
    const variableScopeRoot: AncestorVariablesSnapshotNode = documentRoot;
    const availableVariableIds = collectAncestorVariableIds(variableScopeRoot, nodeId);
    const validationInput = {
      actionBindings: node.data.actionBindings,
      children: node.children,
      contentHash: node.data.contentHash,
      props: node.data.props,
    };

    if (node.data.componentSource === "local") {
      const componentPath = node.data.componentPath;
      const definition = codeComponentDefinitions(codeNodes).find(
        (candidate) => candidate.path === componentPath,
      );
      if (!definition) {
        return [
          {
            kind: "component-unresolved",
            message: `Missing component file — ${componentPath}`,
            severity: "warning",
            componentPath,
          },
        ];
      }
      const manifest = compiled[definition.id]?.artifact?.manifest;
      // Still compiling — no manifest to validate against yet.
      if (manifest === undefined) {
        return NO_WARNINGS;
      }
      return validateComponentNode(validationInput, manifest, availableVariableIds);
    }

    // Builtins resolve their manifest by stable slug, not the catalog hash
    // mirror — a resolvable builtin must not surface a "not in catalog"
    // (manifest-missing) warning. An unknown slug degrades like an
    // unresolvable catalog component (undefined manifest).
    if (node.data.componentSource === "builtin") {
      // The builtin definition's manifest is the same §2 shape but is declared
      // in @voidhash/paywalls/schema, whose scalar `default` fields widen to
      // `unknown`; validation only reads it, so bridge the nominal divergence.
      const manifest = getBuiltinComponent(node.data.componentSlug)?.manifest as
        | ComponentManifest
        | undefined;
      return validateComponentNode(validationInput, manifest, availableVariableIds);
    }

    const manifest = byContentHash[node.data.contentHash]?.manifest;
    return validateComponentNode(validationInput, manifest, availableVariableIds);
  }, [documentRoot, byContentHash, compiled, codeNodes, nodeId]);
}
