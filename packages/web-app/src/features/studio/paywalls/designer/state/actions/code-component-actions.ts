import type { CodeComponentNodeData } from "@voidhash/mimic-schema";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import {
  docRelativeFromFileName,
  uniqueComponentFileName,
  validateComponentFileName,
} from "@voidhash/paywall-workspace";

import { ComponentNode } from "@voidhash/mimic-schema";

import { commander } from "../designer-commander";
import { componentFileName } from "../utils/code-components";
import { selectDocumentRoot } from "../utils/document-root";
import type { DesignerDocumentRoot } from "../utils/node-proxies";
import {
  insertCodeComponent,
  readCodeComponentPaths,
  removeCodeComponent,
  restoreCodeComponent,
  writeCodeComponentPath,
  writeCodeComponentSource,
} from "../utils/code-component-writes";
import { flattenTree } from "../utils/tree";

const DEFAULT_COMPONENT_FILE_NAME = "untitled.tsx";

/**
 * Derives a document-unique component file name from a requested one (defaulting
 * to `untitled.tsx`), disambiguating case-insensitively (`untitled.tsx` →
 * `untitled-2.tsx`…). The base is validated/normalized by the workspace helpers.
 */
function uniqueFileName(root: DesignerDocumentRoot, requested: string | undefined): string {
  const base = (requested?.trim() ?? "") || DEFAULT_COMPONENT_FILE_NAME;
  const withExt = base.endsWith(".tsx") ? base : `${base}.tsx`;
  const existingFileNames = readCodeComponentPaths(root).map(componentFileName);
  return uniqueComponentFileName(withExt, existingFileNames);
}

/**
 * Creates a code-component definition in the paywall's library (creating the
 * library container on first use) and opens it in the editor. The `fileName`
 * (default `untitled.tsx`, `.tsx` auto-appended) is uniquified
 * case-insensitively; the definition's `path` is `components/<fileName>`.
 * Undoable: removes the definition on undo.
 */
export const createCodeComponent = commander.undoableAction<
  { fileName?: string; source?: string },
  { nodeId: string | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const nodeId = mimic.document.transaction((root) => {
      const fileName = uniqueFileName(root, params.fileName);
      return insertCodeComponent(root, {
        path: docRelativeFromFileName(fileName),
        source: params.source ?? "",
      });
    });

    return { nodeId };
  },
  (ctx, _params, result) => {
    if (result.nodeId === null) {
      return;
    }
    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      removeCodeComponent(root, result.nodeId as string);
    });
  },
);

/**
 * Saves a code-component definition's `source` (the code editor's manual save).
 * One save is one undoable document transaction — undo restores the previous
 * source. The compile pipeline watches the definition node, so a save
 * automatically drives a recompile of the preview + a manifest upload. A no-op
 * when the node is missing or the source is unchanged.
 */
export const saveCodeComponentSource = commander.undoableAction<
  { nodeId: string; source: string },
  { previousSource: string | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const previousSource = mimic.document.transaction((root) => {
      const previous = writeCodeComponentSource(root, params.nodeId, params.source);
      return previous === undefined || previous === params.source ? null : previous;
    });

    return { previousSource };
  },
  (ctx, params, result) => {
    if (result.previousSource === null) {
      return;
    }
    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      writeCodeComponentSource(root, params.nodeId, result.previousSource as string);
    });
  },
);

/** Collects the ids of local component instances whose `componentPath === path`. */
function localInstanceIdsForPath(root: SnapshotNode, path: string): string[] {
  const ids: string[] = [];
  for (const node of flattenTree<SnapshotNode>(root)) {
    if (
      node.type === "component" &&
      node.data.componentSource === "local" &&
      node.data.componentPath === path
    ) {
      ids.push(node.id);
    }
  }
  return ids;
}

/**
 * Renames a code-component definition's file (its `path`) and re-points every
 * local instance that referenced the old path — an IDE-style cascade in ONE
 * undoable transaction (undo restores both the definition path and every
 * instance's `componentPath`). The `fileName` is validated (must end `.tsx`, no
 * path separators) and rejected when it collides case-insensitively with another
 * component file; a no-op or invalid rename returns without a change.
 */
export const renameComponentFile = commander.undoableAction<
  { id: string; fileName: string },
  { previousPath: string | null; nextPath: string | null; instanceIds: string[] }
>(
  (ctx, params) => {
    const fileName = params.fileName.trim();
    const validation = validateComponentFileName(fileName);
    if (validation !== undefined) {
      return { previousPath: null, nextPath: null, instanceIds: [] };
    }
    const nextPath = docRelativeFromFileName(fileName);

    const state = ctx.getState();
    const { mimic } = state;
    const documentRoot = selectDocumentRoot(state);

    let previousPath: string | null = null;
    let instanceIds: string[] = [];

    mimic.document.transaction((root) => {
      const existingPaths = new Set(
        readCodeComponentPaths(root).map((path) => componentFileName(path).toLowerCase()),
      );
      // Reject a collision with a DIFFERENT component file (allow renaming to the
      // same name / case as itself, which is a no-op).
      const current = root.findByIdAcrossTree(params.id);
      const currentPath = current?.get()?.data?.path as string | undefined;
      if (currentPath === undefined || currentPath === nextPath) {
        return;
      }
      const currentFileName = componentFileName(currentPath).toLowerCase();
      if (
        fileName.toLowerCase() !== currentFileName &&
        existingPaths.has(fileName.toLowerCase())
      ) {
        return;
      }

      instanceIds = localInstanceIdsForPath(documentRoot, currentPath);
      previousPath = writeCodeComponentPath(root, params.id, nextPath) ?? null;
      for (const instanceId of instanceIds) {
        root.findByIdAcrossTree(instanceId)?.as(ComponentNode).update({ componentPath: nextPath });
      }
    });

    return { previousPath, nextPath, instanceIds };
  },
  (ctx, params, result) => {
    if (result.previousPath === null) {
      return;
    }
    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      writeCodeComponentPath(root, params.id, result.previousPath as string);
      for (const instanceId of result.instanceIds) {
        root
          .findByIdAcrossTree(instanceId)
          ?.as(ComponentNode)
          .update({ componentPath: result.previousPath as string });
      }
    });
  },
);

/**
 * Deletes a code-component definition. Instances referencing it are left in
 * place (they render a "missing component file" placeholder + warning). Undoable:
 * re-inserts the definition with its original id so instance references stay
 * valid.
 */
export const deleteCodeComponent = commander.undoableAction<
  { id: string },
  { snapshot: CodeComponentNodeData | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const snapshot = mimic.document.transaction((root) => removeCodeComponent(root, params.id));

    return { snapshot: snapshot ?? null };
  },
  (ctx, _params, result) => {
    if (result.snapshot === null) {
      return;
    }
    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      restoreCodeComponent(root, result.snapshot as CodeComponentNodeData);
    });
  },
);
