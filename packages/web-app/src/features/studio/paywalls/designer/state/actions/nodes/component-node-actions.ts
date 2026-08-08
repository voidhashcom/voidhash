import type { ComponentManifest } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import type { BuiltinDefaultProp } from "@voidhash/paywall-builtins";
import { Effect, Option } from "effect";

import { commander } from "../../designer-commander";
import { componentDisplayName } from "../../utils/code-components";
import type { ComponentCatalogEntry } from "../../designer-store-state";
import {
  type ComponentNodeUpdates,
  type ComponentScalarValues,
  prefillBuiltinDefaultProps,
  prefillComponentDefaultProps,
  restoreComponentNodeScalars,
  updateComponentNodeData,
} from "../../utils/component-node-writes";
import { selectNode } from "../selection-actions";

/**
 * Inserts a component node pinned to the catalog entry's latest version.
 * Required identity fields go through insert data; manifest-default props
 * are written in the same transaction. Undoable: removes the inserted node
 * on undo.
 */
export const insertComponentNode = commander.undoableAction<
  {
    parentId: string;
    component: ComponentCatalogEntry;
    index?: number;
  },
  { nodeId: string | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const { component } = params;

    const newNodeId = mimic.document.transaction((root) => {
      const parent = root.findByIdAcrossTree(params.parentId);
      if (parent === undefined) {
        return null;
      }

      const data = {
        type: "component" as const,
        componentSlug: component.slug,
        componentVersion: component.latest.version,
        contentHash: component.latest.contentHash,
        name: component.title ?? component.slug,
        previewState: "default",
      };

      return Option.getOrNull(
        Effect.runSync(
          Effect.try(() => {
            const node =
              params.index === undefined
                ? parent.children.insertLast(data)
                : parent.children.insertAt(params.index, data);

            prefillComponentDefaultProps(root, node.id, component.latest.manifest.props);
            return node.id;
          }).pipe(Effect.option),
        ),
      );
    });

    if (newNodeId) {
      ctx.dispatch(selectNode)({ id: newNodeId, many: false });
    }

    return { nodeId: newNodeId };
  },
  (ctx, _params, result) => {
    const { nodeId } = result;
    if (nodeId === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      root.findByIdAcrossTree(nodeId)?.remove();
    });
  },
);

/**
 * Inserts a component node referencing a LOCAL code-component definition
 * (`componentSource: "local"`, `componentPath` set to the definition's
 * document-relative path). The catalog identity fields carry sentinels
 * (`contentHash: ""`, `componentVersion: 0`, `componentSlug: ""`). The instance
 * `name` defaults to the path's display name unless one is supplied.
 * Manifest-default props are prefilled when a compiled local manifest is
 * supplied. Undoable: removes the node on undo.
 */
export const insertLocalComponentNode = commander.undoableAction<
  {
    parentId: string;
    componentPath: string;
    name?: string;
    manifest?: ComponentManifest;
    index?: number;
  },
  { nodeId: string | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    const newNodeId = mimic.document.transaction((root) => {
      const parent = root.findByIdAcrossTree(params.parentId);
      if (parent === undefined) {
        return null;
      }

      const data = {
        type: "component" as const,
        componentSource: "local",
        componentPath: params.componentPath,
        componentSlug: "",
        componentVersion: 0,
        contentHash: "",
        name: params.name ?? componentDisplayName(params.componentPath),
        previewState: "default",
      };

      return Option.getOrNull(
        Effect.runSync(
          Effect.try(() => {
            const node =
              params.index === undefined
                ? parent.children.insertLast(data)
                : parent.children.insertAt(params.index, data);

            if (params.manifest) {
              prefillComponentDefaultProps(root, node.id, params.manifest.props);
            }
            return node.id;
          }).pipe(Effect.option),
        ),
      );
    });

    if (newNodeId) {
      ctx.dispatch(selectNode)({ id: newNodeId, many: false });
    }

    return { nodeId: newNodeId };
  },
  (ctx, _params, result) => {
    const { nodeId } = result;
    if (nodeId === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      root.findByIdAcrossTree(nodeId)?.remove();
    });
  },
);

/**
 * Inserts a component node referencing a first-party BUILTIN component
 * (`componentSource: "builtin"`, `componentSlug` = the builtin's stable slug).
 * Builtin instances stay UNPINNED — `componentVersion`/`contentHash` keep their
 * sentinels (`0`/`""`) — since the implementation ships with the renderer and
 * evolves with releases. The instance `name` defaults to the builtin's display
 * name, and its `defaultProps` (pre-built `{name, binding}` entries) seed the
 * node's `props` in the same transaction. Undoable: removes the node on undo.
 */
export const insertBuiltinComponentNode = commander.undoableAction<
  {
    parentId: string;
    slug: string;
    name: string;
    defaultProps: ReadonlyArray<BuiltinDefaultProp>;
    index?: number;
  },
  { nodeId: string | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    const newNodeId = mimic.document.transaction((root) => {
      const parent = root.findByIdAcrossTree(params.parentId);
      if (parent === undefined) {
        return null;
      }

      const data = {
        type: "component" as const,
        componentSource: "builtin",
        componentSlug: params.slug,
        componentVersion: 0,
        contentHash: "",
        name: params.name,
        previewState: "default",
      };

      return Option.getOrNull(
        Effect.runSync(
          Effect.try(() => {
            const node =
              params.index === undefined
                ? parent.children.insertLast(data)
                : parent.children.insertAt(params.index, data);

            prefillBuiltinDefaultProps(root, node.id, params.defaultProps);
            return node.id;
          }).pipe(Effect.option),
        ),
      );
    });

    if (newNodeId) {
      ctx.dispatch(selectNode)({ id: newNodeId, many: false });
    }

    return { nodeId: newNodeId };
  },
  (ctx, _params, result) => {
    const { nodeId } = result;
    if (nodeId === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      root.findByIdAcrossTree(nodeId)?.remove();
    });
  },
);

/**
 * Re-points a local component instance to a different component file — the
 * re-pair action surfaced by the "component unresolved" warning UI. Sets the
 * node's `componentPath` (a scalar update captured for undo) so a broken
 * reference (or a deliberate swap) resolves to an existing definition. Stale
 * props/bindings degrade as usual through manifest-order filtering + validation.
 * Undoable: restores the previous `componentPath`.
 */
export const repairLocalComponentReference = commander.undoableAction<
  { nodeId: string; componentPath: string },
  { previousValues: ComponentScalarValues | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const previousValues = mimic.document.transaction((root) =>
      updateComponentNodeData(root, params.nodeId, { componentPath: params.componentPath }),
    );
    return { previousValues: previousValues ?? null };
  },
  (ctx, params, result) => {
    const { previousValues } = result;
    if (previousValues === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      restoreComponentNodeScalars(root, params.nodeId, previousValues);
    });
  },
);

/**
 * Updates a component node's scalar fields (name, preview state, identity).
 * Undo restores only the scalar fields the update touched; `props` and
 * `actionBindings` must go through the component prop actions — snapshot
 * entries are `{id, pos, value}`-wrapped and cannot replay through `update`.
 */
export const updateComponentNode = commander.undoableAction<
  {
    id: string;
    updates: ComponentNodeUpdates;
  },
  { previousValues: ComponentScalarValues | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const previousValues = mimic.document.transaction((root) =>
      updateComponentNodeData(root, params.id, params.updates),
    );
    return { previousValues: previousValues ?? null };
  },
  (ctx, params, result) => {
    const { previousValues } = result;
    if (previousValues === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      restoreComponentNodeScalars(root, params.id, previousValues);
    });
  },
);
