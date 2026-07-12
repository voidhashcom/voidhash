/**
 * `@voidhash/paywall-workspace` — the pure, isomorphic workspace seam
 * shared by the browser designer and the headless server.
 *
 * A *workspace* is a virtual filesystem projection over a project's paywalls;
 * mimic documents stay the source of truth. This package holds only the pure
 * seam: the path vocabulary, the snapshot readers over a document's code
 * components, the content hash, and the file-write → mimic `Command[]` lowering
 * (document edits, component source writes, component move/delete, reconcile).
 * No DOM, no Node APIs, no Effect services — it runs unchanged in a browser tab,
 * a Worker, or a Durable Object.
 */

export {
  COMPOSITION_FILENAME,
  docRelativeComponentPath,
  docRelativeFromFileName,
  fileNameFromDocRelative,
  formatComponentPath,
  formatCompositionPath,
  formatWorkspacePath,
  parseWorkspacePath,
  workspacePathForDocRelative,
  type ComponentPath,
  type CompositionPath,
  type ParseWorkspacePathResult,
  type WorkspacePath,
  type WorkspacePathError,
} from "./paths.ts";

export { readComponentDefinitions, type WorkspaceComponentDefinition } from "./snapshot.ts";

export { hashSource } from "./hash.ts";

export {
  lowerComponentDelete,
  lowerComponentMove,
  uniqueComponentFileName,
  validateComponentFileName,
  type ApplyFileWriteResult,
  type WriteDiagnostic,
} from "./write.ts";

export {
  applyDocumentEditsToTree,
  applyWorkspaceDelete,
  applyWorkspaceMove,
  componentPathsFromTree,
  encodePaywallDocument,
  reconcileToTree,
  writeComponentSourceToTree,
  type ApplyDocumentEditsToTreeResult,
  type ApplyWorkspaceWriteResult,
  type DocumentEdit,
  type MintedIds,
} from "./service-write.ts";
