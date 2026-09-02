import {
  stringValue,
  treeValue,
  type Command,
  type ObjectValue,
  type TreeNode,
  type TreeValue,
  type Value,
} from "@voidhash/mimic-core";
import { reconcile } from "@voidhash/mimic-schema";

import { fileNameFromDocRelative } from "./paths.ts";

/**
 * A single write diagnostic (workspace-level, before any compile phase). A
 * rejection carries error-level diagnostics; an accepted write may carry
 * info-level ones (e.g. a duplicate inline id that was silently re-minted, §5
 * edge rule 1). `severity` defaults to `error` when absent (rejections).
 */
export interface WriteDiagnostic {
  readonly message: string;
  readonly severity?: "error" | "info";
}

/**
 * Result of lowering a file write: either the minimal CRDT command batch to
 * apply to the document (optionally with info-level `diagnostics` that ride
 * along — e.g. a duplicate inline id that was re-minted), or a rejection
 * carrying error diagnostics.
 */
export type ApplyFileWriteResult =
  | {
      readonly kind: "commands";
      readonly commands: Command[];
      readonly diagnostics?: WriteDiagnostic[];
    }
  | { readonly kind: "rejected"; readonly diagnostics: WriteDiagnostic[] };

const rejected = (message: string): ApplyFileWriteResult => ({
  kind: "rejected",
  diagnostics: [{ message }],
});

/**
 * The character set a component file basename may use: an identifier optionally
 * with dashes/dots (e.g. `pricing-option.tsx`, `pricing.card.tsx`). Rules out
 * whitespace and shell/path metacharacters that would break addressing.
 */
const COMPONENT_FILENAME_CHARSET = /^[A-Za-z0-9._-]+$/;

/**
 * Validate a component file basename (`<basename>.tsx`) — the identity segment of
 * a component path. Returns an error message when invalid, or `undefined` when
 * acceptable.
 *
 * Rules: non-empty basename before the extension, must end `.tsx`, no path
 * separators (`/` or `\`) or `..` traversal, and a sensible charset
 * (alphanumerics, `-`, `_`, `.`). Enforced at the write boundary since the mimic
 * `path` schema field is a permissive string.
 */
export function validateComponentFileName(fileName: string): string | undefined {
  if (fileName.includes("/") || fileName.includes("\\")) {
    return `Component file name "${fileName}" must not contain a path separator.`;
  }
  if (fileName.includes("..")) {
    return `Component file name "${fileName}" must not contain "..".`;
  }
  if (!fileName.endsWith(".tsx")) {
    return `Component file name "${fileName}" must end with ".tsx".`;
  }
  if (fileName.length <= ".tsx".length) {
    return `Component file name "${fileName}" is missing a base name before ".tsx".`;
  }
  if (!COMPONENT_FILENAME_CHARSET.test(fileName)) {
    return `Component file name "${fileName}" contains unsupported characters (use letters, digits, "-", "_", ".").`;
  }
  return undefined;
}

/**
 * Derive a component file basename unique among `existingFileNames`, matching the
 * browser's `uniqueCodeComponentSlug` suffixing but keyed on the file name:
 * uniqueness is case-INSENSITIVE (the workspace never allows two component files
 * whose names differ only in case), and a collision appends `-2`, `-3`, … BEFORE
 * the `.tsx` extension until unused. Pure so a server-side component create (a
 * `write_file` to a new `components/<name>.tsx` path) mints the same file name
 * the browser create would.
 *
 * `base` is a full `<basename>.tsx` file name; a `base` without a `.tsx`
 * extension is treated as an extensionless basename and suffixed as
 * `<basename>-2.tsx`.
 */
export function uniqueComponentFileName(base: string, existingFileNames: Iterable<string>): string {
  const existing = new Set<string>();
  for (const name of existingFileNames) {
    existing.add(name.toLowerCase());
  }
  const { stem, ext } = splitFileName(base);
  const candidate = `${stem}${ext}`;
  if (!existing.has(candidate.toLowerCase())) {
    return candidate;
  }
  let index = 2;
  while (existing.has(`${stem}-${index}${ext}`.toLowerCase())) {
    index += 1;
  }
  return `${stem}-${index}${ext}`;
}

/** Split a file name into its `stem` and `.tsx` `ext` (`ext` empty when absent). */
function splitFileName(fileName: string): { readonly stem: string; readonly ext: string } {
  if (fileName.endsWith(".tsx")) {
    return { stem: fileName.slice(0, -".tsx".length), ext: ".tsx" };
  }
  return { stem: fileName, ext: ".tsx" };
}

/**
 * Lower a component MOVE (a rename in the file sense) to the minimal command
 * batch: rewrite the target `codeComponent` node's `path` AND re-point every
 * local `component` instance node whose `componentPath` matches the old path, so
 * no instance is orphaned. `fromPath`/`toPath` are canonical document-relative
 * paths (`components/<basename>.tsx`).
 *
 * A move is the new identity of a component (component identity is the path), so
 * unlike the old display-name rename it changes both the definition's path and
 * every reference to it — in ONE reconcile batch. A move whose `toPath` already
 * names another component is rejected (a path collision would merge two
 * components' identities). A move to the current path yields a zero-command
 * no-op via `reconcile`.
 */
export function lowerComponentMove(
  liveTree: TreeValue,
  fromPath: string,
  toPath: string,
): ApplyFileWriteResult {
  const validation = validateComponentFileName(fileNameFromDocRelative(toPath));
  if (validation !== undefined) {
    return rejected(`Cannot move component to "${toPath}": ${validation}`);
  }
  if (fromPath !== toPath && liveTree.nodes.some((node) => codeComponentPath(node) === toPath)) {
    return rejected(`Cannot move component to "${toPath}": a component already exists there.`);
  }
  const target = moveComponent(liveTree, fromPath, toPath);
  if (target === undefined) {
    return rejected(`No component at "${fromPath}" to move.`);
  }
  return { kind: "commands", commands: reconcile(liveTree, target) };
}

/**
 * Pure tree→tree transform for a move: return the target tree with the
 * `codeComponent` for `fromPath` repathed to `toPath` and every local instance
 * node referencing `fromPath` re-pointed to `toPath` — or `undefined` when no
 * such definition exists. Used by {@link lowerComponentMove}. Does NOT guard
 * against a `toPath` collision (callers do).
 */
function moveComponent(
  liveTree: TreeValue,
  fromPath: string,
  toPath: string,
): TreeValue | undefined {
  const node = liveTree.nodes.find((candidate) => codeComponentPath(candidate) === fromPath);
  if (node === undefined) {
    return undefined;
  }
  if (fromPath === toPath) {
    return liveTree;
  }
  return treeValue(
    liveTree.nodes.map((candidate) => {
      if (candidate.id === node.id) {
        return withComponentPath(candidate, toPath);
      }
      // Re-point local instance nodes referencing the moved component so the
      // reference survives the identity change (no orphaned instances).
      if (localInstanceComponentPath(candidate) === fromPath) {
        return withInstanceComponentPath(candidate, toPath);
      }
      return candidate;
    }),
  );
}

/**
 * Lower a component DELETE to the minimal command batch: remove the target
 * `codeComponent` node from the library.
 *
 * This mirrors the browser's `removeCodeComponent` EXACTLY: it removes ONLY the
 * `codeComponent` definition node and does NOT cascade-delete `component`
 * instance nodes that reference it. Canvas instances referencing the deleted
 * definition degrade to placeholders in the designer (existing behavior —
 * `use-component-node-warnings` surfaces a `local-component-missing` warning),
 * so leaving them in place is the correct match. `reconcile` emits the single
 * `tree.remove` for the omitted node (leaf, no children — `codeComponent` nodes
 * hold no render subtree). `path` is the component's canonical
 * document-relative identity.
 */
export function lowerComponentDelete(liveTree: TreeValue, path: string): ApplyFileWriteResult {
  const target = deleteComponent(liveTree, path);
  if (target === undefined) {
    return rejected(`No component at "${path}" to delete.`);
  }
  return { kind: "commands", commands: reconcile(liveTree, target) };
}

/**
 * Pure tree→tree transform for a delete: return the target tree with the
 * `codeComponent` for `path` removed (ONLY the definition node — never cascading
 * into `component` instances), or `undefined` when no such component exists.
 * Used by {@link lowerComponentDelete}.
 */
function deleteComponent(liveTree: TreeValue, path: string): TreeValue | undefined {
  const node = liveTree.nodes.find((candidate) => codeComponentPath(candidate) === path);
  if (node === undefined) {
    return undefined;
  }
  return treeValue(liveTree.nodes.filter((candidate) => candidate.id !== node.id));
}

/**
 * The canonical `path` of a `codeComponent` tree node, or `undefined` for other
 * nodes. This is the component's identity.
 */
function codeComponentPath(node: TreeNode): string | undefined {
  if (stringField(node.value, "type") !== "codeComponent") {
    return undefined;
  }
  return stringField(node.value, "path");
}

/**
 * The `componentPath` a LOCAL `component` instance node references, or
 * `undefined` for non-component / catalog-instance nodes. Used to re-point
 * instances on a component move.
 */
function localInstanceComponentPath(node: TreeNode): string | undefined {
  if (stringField(node.value, "type") !== "component") {
    return undefined;
  }
  if (stringField(node.value, "componentSource") !== "local") {
    return undefined;
  }
  return stringField(node.value, "componentPath");
}

/** Rewrite a `codeComponent` node's `path` field to `path`, preserving all other fields. */
function withComponentPath(node: TreeNode, path: string): TreeNode {
  return {
    ...node,
    value: {
      kind: "object",
      fields: { ...node.value.fields, path: stringValue(path) },
    },
  };
}

/** Rewrite a `component` instance node's `componentPath` field, preserving all others. */
function withInstanceComponentPath(node: TreeNode, componentPath: string): TreeNode {
  return {
    ...node,
    value: {
      kind: "object",
      fields: { ...node.value.fields, componentPath: stringValue(componentPath) },
    },
  };
}

/** Reads a string field off an object value, or `undefined` when absent/non-string. */
function stringField(object: ObjectValue, key: string): string | undefined {
  const field: Value | undefined = object.fields[key];
  if (field?.kind === "string") {
    return field.value;
  }
  return undefined;
}
