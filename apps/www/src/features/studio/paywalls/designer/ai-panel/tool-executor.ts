"use client";

import {
  designerToolSchemas,
  editDocumentResultSchema,
  serializeDocument,
  type DesignerToolName,
  type DocumentEdit,
  type NodeInput,
  type PreviewScreenshotToolOutput,
} from "@voidhash/ai-shared";
import type { ComponentManifest } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import { listBuiltinComponents } from "@voidhash/paywall-builtins";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { docRelativeFromFileName, validateComponentFileName } from "@voidhash/paywall-workspace";
import { useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { z } from "zod";

import type { SurfaceToolCall, SurfaceToolResult } from "@/features/studio/ai";
import { managedRuntime, VoidhashRpc } from "@/features/studio/lib/effect-query";

import { useCodeEditor, type CodeEditorHandle } from "../code-mode/code-editor-context";
import { CompilePipeline, type PipelineResult } from "../code-mode/compile-pipeline";
import { hashSource } from "../code-mode/hash";
import { uploadComponentManifest } from "../code-mode/manifest-upload";
import { usePaywallCodeTarget, type PaywallCodeTarget } from "../hooks/use-paywall-code-target";
import { closeTab, finishAiCanvasOperation, startAiCanvasOperation } from "../state/actions";
import {
  createCodeComponent,
  deleteCodeComponent,
  renameComponentFile,
  saveCodeComponentSource,
} from "../state/actions/code-component-actions";
import { applyDocumentEdits } from "../state/actions/document-edit-actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
  type PaywallDesignerDispatch,
  type PaywallDesignerStoreType,
} from "../state/designer-store";
import type { AgentCanvasOperation } from "../state/designer-store-state";
import {
  codeComponentDefinitions,
  componentFileName,
  definitionForComponentPath,
  selectCodeComponentNodes,
} from "../state/utils/code-components";
import { selectDocumentRoot } from "../state/utils/document-root";
import { findNodeById, flattenTree } from "../state/utils/tree";
import {
  captureDesignerNodeScreenshot,
  inspectRenderedNodeLayouts,
  type DesignerNodeScreenshot,
  type RenderedNodeLayout,
} from "./canvas-capture";

/** Result of reading another paywall's cleaned document (`read_paywall`). */
interface ReadPaywallDocumentResult {
  slug: string;
  name: string;
  paywallId: string;
  document: unknown;
}

/**
 * The seam {@link runDesignerTool} operates through — the designer store +
 * dispatch, the open-paywall target (or `null`), the route paywall id, the
 * optional Monaco handle (buffers only exist while code mode is open), a compile
 * pipeline for `write_component`, browser-render inspection/capture seams, and
 * the two RPC callbacks (`read_paywall` and the per-turn checkpoint).
 * `capturedTurns` tracks which turns already captured a checkpoint so the runner
 * (which is re-invoked per tool call) fires it at most once per turn. Injected so
 * the runner is a plain function testable against a real store without React.
 */
export interface DesignerToolDeps {
  store: PaywallDesignerStoreType;
  dispatch: PaywallDesignerDispatch;
  target: PaywallCodeTarget | null;
  paywallId: string | null;
  /** The open Monaco editor handle, or `null` when code mode is not mounted. */
  handle: CodeEditorHandle | null;
  /** Compiles a component's TSX to a manifest/preview trees (or diagnostics). */
  compile: (source: string) => Promise<PipelineResult>;
  /** Reads ANOTHER paywall's cleaned document JSON for reference (`read_paywall`). */
  readPaywallDocument: (projectId: string, slug: string) => Promise<ReadPaywallDocumentResult>;
  /**
   * Captures the pre-turn document checkpoint for a mutating turn (best-effort;
   * server is first-write-wins). Rejects only on a genuine RPC failure.
   */
  captureCheckpoint: (input: {
    chatId: string;
    turnId: string;
    paywallId: string;
  }) => Promise<{ captured: boolean }>;
  /** Turn ids that already captured (or attempted) a checkpoint this session. */
  capturedTurns: Set<string>;
  /** Captures one live rendered document node as a PNG. */
  captureNodeScreenshot: (nodeId: string, scale: 1 | 2) => Promise<DesignerNodeScreenshot>;
  /** Reads actual browser layout for rendered document nodes. */
  inspectRenderedLayouts: (
    nodeIds: readonly string[],
    screenId: string,
    canvasScale: number,
  ) => RenderedNodeLayout[];
  /** Last successful visual review in this executor session. */
  reviewState: { lastScreenshot?: { documentSignature: string; nodeId: string } };
}

/** The mutating designer tools — the ones that take a pre-turn checkpoint. */
const MUTATING_TOOLS: ReadonlySet<DesignerToolName> = new Set([
  "edit_document",
  "duplicate_subtree",
  "write_component",
  "rename_component",
  "delete_component",
]);

/**
 * Runs one validated designer client-tool call against the CURRENTLY OPEN paywall
 * (its mimic document + local components) and folds every outcome — success OR
 * failure — into a model-facing `{ output, isError }` result. Screenshot review
 * returns structured multimodal content; every other tool returns text. NEVER
 * throws for an expected tool/runtime failure.
 *
 * Composition is authored as mimic document edits (`edit_document` → the
 * `applyDocumentEdits` store action); there is no code fork or apply step. Code
 * components are compiled in-browser and written straight to the document. Before
 * the FIRST mutating tool call of a turn a pre-turn server checkpoint is captured
 * (best-effort — an RPC failure is logged and the tool proceeds). `read_paywall`
 * is the only cross-paywall (read-only) tool.
 *
 * Input is validated by the caller ({@link useDesignerToolExecutor}); this runner
 * assumes `call.input` already matches the tool's schema.
 */
export async function runDesignerTool(
  deps: DesignerToolDeps,
  call: SurfaceToolCall,
): Promise<SurfaceToolResult> {
  const { store, dispatch, target, paywallId, handle } = deps;
  const name = call.toolName as DesignerToolName;
  const input = call.input;

  // `read_paywall` reads ANOTHER paywall's document — no open paywall needed
  // beyond the project the route resolves.
  if (name === "read_paywall") {
    return readPaywall((input as { slug: string }).slug);
  }

  // `get_document` / `get_components` / `read_component` need the open document
  // but not a checkpoint (read-only). The mutating tools additionally checkpoint.
  if (target === null || paywallId === null) {
    return { output: "No paywall is open to edit.", isError: true };
  }

  if (MUTATING_TOOLS.has(name)) {
    await ensureCheckpoint(deps, call.chatId, call.turnId, paywallId);
  }

  switch (name) {
    case "get_document": {
      const { nodeId, depth } = input as { nodeId?: string; depth?: number };
      return getDocument(nodeId, depth);
    }
    case "get_rendered_layout":
      return getRenderedLayout((input as { nodeIds?: readonly string[] }).nodeIds);
    case "get_preview_screenshot": {
      const { nodeId, scale = 1 } = input as { nodeId?: string; scale?: 1 | 2 };
      return getPreviewScreenshot(nodeId, scale);
    }
    case "get_components":
      return getComponents();
    case "read_component":
      return readComponent((input as { path: string }).path);
    case "edit_document":
      return editDocument((input as { edits: readonly DocumentEdit[] }).edits);
    case "duplicate_subtree": {
      const {
        nodeId,
        parentId,
        index,
        name: nextName,
      } = input as {
        nodeId: string;
        parentId: string;
        index?: number;
        name?: string;
      };
      return duplicateSubtree(nodeId, parentId, index, nextName);
    }
    case "write_component": {
      const { path, source } = input as { path: string; source: string };
      return writeComponent(path, source);
    }
    case "rename_component": {
      const { fromPath, toPath } = input as { fromPath: string; toPath: string };
      return renameComponent(fromPath, toPath);
    }
    case "delete_component":
      return deleteComponent((input as { path: string }).path);
    case "finish_design": {
      const { reviewedDocumentSignature, unresolvedIssues, verdict } = input as {
        reviewedDocumentSignature: string;
        unresolvedIssues: readonly string[];
        verdict: string;
      };
      return finishDesign(reviewedDocumentSignature, verdict, unresolvedIssues);
    }
    default:
      return { output: `Unknown tool "${name}".`, isError: true };
  }

  function getDocument(nodeId: string | undefined, depth: number | undefined): SurfaceToolResult {
    const root = selectDocumentRoot(store.getState());
    const cleaned = serializeDocument([root], { nodeId, depth });
    if (cleaned === null) {
      return { output: `No node "${nodeId}" in the document.`, isError: true };
    }
    return { output: JSON.stringify(cleaned), isError: false };
  }

  function getRenderedLayout(nodeIds: readonly string[] | undefined): SurfaceToolResult {
    const root = selectDocumentRoot(store.getState());
    const screen = screenNode(root);
    if (screen === null) {
      return { output: "The open paywall has no screen to inspect.", isError: true };
    }
    const requested =
      nodeIds ??
      flattenTree<SnapshotNode>(root)
        .filter((node) => isVisualNode(node))
        .slice(0, 100)
        .map((node) => node.id);
    try {
      const layouts = deps.inspectRenderedLayouts(
        requested,
        screen.id,
        store.getState().canvas.scale,
      );
      const missing = requested.filter(
        (nodeId) => !layouts.some((layout) => layout.nodeId === nodeId),
      );
      return {
        output: JSON.stringify({ screenId: screen.id, layouts, missingNodeIds: missing }),
        isError: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { output: `Could not inspect the live paywall layout: ${message}`, isError: true };
    }
  }

  async function getPreviewScreenshot(
    requestedNodeId: string | undefined,
    scale: 1 | 2,
  ): Promise<SurfaceToolResult> {
    const rootBefore = selectDocumentRoot(store.getState());
    const nodeId = requestedNodeId ?? screenNode(rootBefore)?.id;
    if (nodeId === undefined) {
      return { output: "The open paywall has no screen to capture.", isError: true };
    }
    const targetNode = findNodeById<SnapshotNode>(rootBefore, nodeId);
    if (targetNode === null) {
      return { output: `No node "${nodeId}" in the document.`, isError: true };
    }
    if (!isVisualNode(targetNode)) {
      return { output: `Node "${nodeId}" is not a visual canvas node.`, isError: true };
    }
    const signatureBefore = documentSignature(rootBefore);
    let screenshot: DesignerNodeScreenshot;
    try {
      screenshot = await deps.captureNodeScreenshot(nodeId, scale);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { output: `Could not capture the live paywall preview: ${message}`, isError: true };
    }
    const signatureAfter = documentSignature(selectDocumentRoot(store.getState()));
    if (signatureAfter !== signatureBefore) {
      return {
        output:
          "The paywall changed while the screenshot was rendering. Capture it again before reviewing.",
        isError: true,
      };
    }
    deps.reviewState.lastScreenshot = { documentSignature: signatureAfter, nodeId };
    const output: PreviewScreenshotToolOutput = {
      kind: "preview-screenshot",
      mediaType: "image/png",
      dataBase64: screenshot.dataBase64,
      width: screenshot.width,
      height: screenshot.height,
      scale: screenshot.scale,
      documentSignature: signatureAfter,
      message:
        "Review this live paywall render, state a concise checkpoint verdict, and correct every visible issue before finishing.",
    };
    return { output, isError: false };
  }

  function getComponents(): SurfaceToolResult {
    const state = store.getState();
    const catalog = Object.values(state.componentCatalog.components).map((entry) => ({
      kind: "catalog" as const,
      slug: entry.slug,
      title: entry.title,
      version: entry.latestVersion,
      description: entry.latest.manifest.description,
      props: entry.latest.manifest.props,
      actions: entry.latest.manifest.actions,
      previewStates: entry.latest.previewStates,
      slot: entry.latest.manifest.slot ?? false,
    }));

    const localDefinitions = codeComponentDefinitions(selectCodeComponentNodes(state));
    const local = localDefinitions.map((definition) => {
      const manifest = state.codeComponents.compiled[definition.id]?.artifact?.manifest;
      return manifestSummary(definition.path, manifest);
    });

    // Slot builtins are hidden for now — the edit canvas cannot mount document
    // children inside the builtin preact island yet (matches the add-component
    // dialog's filter).
    const builtins = listBuiltinComponents()
      .filter((builtin) => builtin.manifest.slot !== true)
      .map((builtin) => ({
        kind: "builtin" as const,
        slug: builtin.slug,
        name: builtin.name,
        description: builtin.description,
        props: builtin.manifest.props,
        actions: builtin.manifest.actions,
        previewStates: builtin.manifest.previewStates,
        slot: builtin.manifest.slot ?? false,
        // Builtins are first-party and UNPINNED: place them with these identity
        // fields only — no componentVersion/contentHash/componentPath.
        insertAs: { componentSource: "builtin", componentSlug: builtin.slug },
      }));

    return { output: JSON.stringify({ catalog, local, builtins }), isError: false };
  }

  function readComponent(path: string): SurfaceToolResult {
    const definition = definitionForComponentPath(store.getState(), path);
    if (definition === undefined) {
      return { output: `No local component "${path}".`, isError: true };
    }
    return { output: definition.source, isError: false };
  }

  function editDocument(edits: readonly DocumentEdit[]): SurfaceToolResult {
    const { result } = dispatch(applyDocumentEdits)({ edits });
    // Build the wire result through the shared schema (the designer-surface wire
    // contract) so it can never drift from the type MCP/backend agree on. The
    // validator errors are the model-facing convergence signal — passed verbatim.
    const wire = editDocumentResultSchema.parse(
      result.ok ? { ok: true, mintedIds: result.mintedIds } : { ok: false, errors: result.errors },
    );
    return { output: JSON.stringify(wire), isError: !result.ok };
  }

  function duplicateSubtree(
    nodeId: string,
    parentId: string,
    index: number | undefined,
    nextName: string | undefined,
  ): SurfaceToolResult {
    const root = selectDocumentRoot(store.getState());
    const source = findNodeById<SnapshotNode>(root, nodeId);
    if (source === null) {
      return { output: `No node "${nodeId}" in the document.`, isError: true };
    }
    if (!isVisualNode(source)) {
      return {
        output: `Cannot duplicate engine-managed ${source.type} node "${nodeId}".`,
        isError: true,
      };
    }
    const node = cloneNodeInput(source);
    if (nextName !== undefined) {
      node.name = nextName;
    }
    return editDocument([
      { op: "insert", parentId, ...(index === undefined ? {} : { index }), node },
    ]);
  }

  function finishDesign(
    reviewedDocumentSignature: string,
    verdict: string,
    unresolvedIssues: readonly string[],
  ): SurfaceToolResult {
    if (unresolvedIssues.length > 0) {
      return {
        output: `Design review still has unresolved issues: ${unresolvedIssues.join("; ")}. Correct them and capture a new screenshot.`,
        isError: true,
      };
    }
    const review = deps.reviewState.lastScreenshot;
    if (review === undefined || review.documentSignature !== reviewedDocumentSignature) {
      return {
        output:
          "finish_design requires the exact signature from this session's latest successful get_preview_screenshot.",
        isError: true,
      };
    }
    const root = selectDocumentRoot(store.getState());
    const screen = screenNode(root);
    if (screen === null || review.nodeId !== screen.id) {
      return {
        output:
          "The final review must use a full-screen get_preview_screenshot, not a subtree capture.",
        isError: true,
      };
    }
    const current = documentSignature(root);
    if (current !== reviewedDocumentSignature) {
      return {
        output:
          "The paywall changed after the final screenshot. Review the current render again before finishing.",
        isError: true,
      };
    }
    return {
      output: `Visual review complete for document ${current}. Verdict: ${verdict}`,
      isError: false,
    };
  }

  async function writeComponent(rawPath: string, source: string): Promise<SurfaceToolResult> {
    const fileName = componentFileName(rawPath.trim());
    const invalid = validateComponentFileName(fileName);
    if (invalid !== undefined) {
      return { output: `Cannot write "${rawPath}": ${invalid}`, isError: true };
    }
    const path = docRelativeFromFileName(fileName);

    // Compile FIRST — commit nothing on a compile/runtime error.
    const compiled = await deps.compile(source);
    if (!compiled.ok) {
      return {
        output: `Component did not compile — nothing was written:\n${renderCompileDiagnostics(
          compiled.diagnostics,
        )}`,
        isError: true,
      };
    }

    const existing = existingDefinitionId(path);
    if (existing !== undefined) {
      // Route the update through the undoable save action (the same path Monaco's
      // manual save uses) — one save, one undo entry — not a raw transaction.
      dispatch(saveCodeComponentSource)({ nodeId: existing, source });
    } else {
      dispatch(createCodeComponent)({ fileName, source });
    }

    uploadComponentManifest(hashSource(source), compiled);
    // Reseed the open Monaco buffer (if any) so the editor mirrors the write.
    handle?.setBufferContent(path, source);

    return {
      output: `${existing !== undefined ? "Updated" : "Created"} component ${path}.`,
      isError: false,
    };
  }

  function renameComponent(fromPath: string, toPath: string): SurfaceToolResult {
    const definitionId = existingDefinitionId(normalizeComponentPath(fromPath));
    if (definitionId === undefined) {
      return { output: `No local component "${fromPath}" to rename.`, isError: true };
    }
    const toFileName = componentFileName(toPath.trim());
    const invalid = validateComponentFileName(toFileName);
    if (invalid !== undefined) {
      return { output: `Cannot rename to "${toPath}": ${invalid}`, isError: true };
    }

    const result = dispatch(renameComponentFile)({ id: definitionId, fileName: toFileName });
    if (result.previousPath === null || result.nextPath === null) {
      return {
        output: `Could not rename "${fromPath}" to "${toPath}" (name collision or invalid name).`,
        isError: true,
      };
    }
    // Follow the move in Monaco (preserve text/view state) so open tabs update.
    handle?.renameModel(result.previousPath, result.nextPath);
    return { output: `Renamed ${result.previousPath} to ${result.nextPath}.`, isError: false };
  }

  function deleteComponent(rawPath: string): SurfaceToolResult {
    const path = normalizeComponentPath(rawPath);
    const definitionId = existingDefinitionId(path);
    if (definitionId === undefined) {
      return { output: `No local component "${rawPath}" to delete.`, isError: true };
    }
    dispatch(deleteCodeComponent)({ id: definitionId });
    // Close any open tab for the deleted component's file.
    if (store.getState().codeComponents.openTabs.includes(path)) {
      dispatch(closeTab)({ path });
    }
    return {
      output: `Deleted component ${path}. Existing instances now render a placeholder — replace or remove them.`,
      isError: false,
    };
  }

  /** Resolves a component path (any accepted form) to its definition node id, if present. */
  function existingDefinitionId(path: string): string | undefined {
    return definitionForComponentPath(store.getState(), path)?.id;
  }

  async function readPaywall(readSlug: string): Promise<SurfaceToolResult> {
    if (target === null) {
      return { output: "No project is open.", isError: true };
    }
    try {
      const result = await deps.readPaywallDocument(target.projectId, readSlug);
      return {
        output: JSON.stringify({ slug: result.slug, name: result.name, document: result.document }),
        isError: false,
      };
    } catch (error) {
      return {
        output: `Could not read paywall "${readSlug}": ${unwrapRpcError(error)}`,
        isError: true,
      };
    }
  }
}

type VisualSnapshotNode = Exclude<
  SnapshotNode,
  Extract<SnapshotNode, { type: "root" | "library" | "codeComponent" }>
>;

/** Whether a snapshot node is directly authorable/visible on the paywall canvas. */
function isVisualNode(node: SnapshotNode): node is VisualSnapshotNode {
  return node.type !== "root" && node.type !== "library" && node.type !== "codeComponent";
}

/** The first screen in a document root, or null for a malformed/empty document. */
function screenNode(root: SnapshotNode): Extract<SnapshotNode, { type: "screen" }> | null {
  const screen = flattenTree<SnapshotNode>(root).find((node) => node.type === "screen");
  return screen?.type === "screen" ? screen : null;
}

/** Convert an existing visual snapshot subtree into an id-free insert payload. */
function cloneNodeInput(node: VisualSnapshotNode): NodeInput {
  const data = structuredClone(node.data) as Record<string, unknown>;
  const children = node.children.filter(isVisualNode).map(cloneNodeInput);
  return {
    type: node.type,
    ...data,
    ...(children.length === 0 ? {} : { children }),
  };
}

/** Stable, compact signature used to prove the final screenshot matches the document. */
export function documentSignature(root: SnapshotNode): string {
  const input = JSON.stringify(root);
  let hash = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `doc-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

type AgentToolActivity = Pick<AgentCanvasOperation, "label" | "nodeIds" | "phase">;

/** Describe a tool call for the live canvas indicator, including affected nodes. */
export function describeDesignerToolActivity(
  toolName: DesignerToolName,
  input: unknown,
  root: SnapshotNode,
): AgentToolActivity {
  const screenId = screenNode(root)?.id;
  const withScreen = screenId === undefined ? [] : [screenId];
  switch (toolName) {
    case "get_document": {
      const nodeId = (input as { nodeId?: string }).nodeId;
      return {
        label: "Inspecting document structure",
        nodeIds: nodeId ? [nodeId] : withScreen,
        phase: "inspecting",
      };
    }
    case "get_rendered_layout": {
      const nodeIds = (input as { nodeIds?: readonly string[] }).nodeIds;
      return {
        label: "Measuring rendered layout",
        nodeIds: nodeIds ?? withScreen,
        phase: "inspecting",
      };
    }
    case "get_preview_screenshot": {
      const nodeId = (input as { nodeId?: string }).nodeId;
      return {
        label: "Reviewing the live preview",
        nodeIds: nodeId ? [nodeId] : withScreen,
        phase: "reviewing",
      };
    }
    case "get_components":
      return { label: "Inspecting available components", nodeIds: [], phase: "inspecting" };
    case "read_component":
      return {
        label: `Reading ${(input as { path: string }).path}`,
        nodeIds: [],
        phase: "inspecting",
      };
    case "read_paywall":
      return {
        label: `Comparing ${(input as { slug: string }).slug}`,
        nodeIds: [],
        phase: "inspecting",
      };
    case "edit_document": {
      const edits = (input as { edits: readonly DocumentEdit[] }).edits;
      const nodeIds = edits.flatMap((edit) => {
        if (edit.op === "insert") return [edit.parentId];
        if (edit.op === "move") return [edit.nodeId, edit.parentId];
        return [edit.nodeId];
      });
      return { label: "Editing the paywall", nodeIds: [...new Set(nodeIds)], phase: "editing" };
    }
    case "duplicate_subtree": {
      const { nodeId, parentId } = input as { nodeId: string; parentId: string };
      return { label: "Duplicating a visual group", nodeIds: [nodeId, parentId], phase: "editing" };
    }
    case "write_component":
    case "rename_component":
    case "delete_component": {
      const path =
        toolName === "rename_component"
          ? normalizeComponentPath((input as { fromPath: string }).fromPath)
          : normalizeComponentPath((input as { path: string }).path);
      const nodeIds = flattenTree<SnapshotNode>(root)
        .filter(
          (node) =>
            node.type === "component" &&
            node.data.componentSource === "local" &&
            node.data.componentPath === path,
        )
        .map((node) => node.id);
      return {
        label:
          toolName === "write_component"
            ? `Building ${path}`
            : toolName === "rename_component"
              ? `Renaming ${path}`
              : `Removing ${path}`,
        nodeIds,
        phase: "editing",
      };
    }
    case "finish_design":
      return { label: "Finishing visual review", nodeIds: withScreen, phase: "finishing" };
  }
}

/**
 * Captures the per-turn pre-mutation checkpoint at most once per turn.
 * Best-effort: a missing `turnId` skips it (nothing to key on) and an RPC failure
 * is logged and swallowed (the server is first-write-wins, so a later retry is
 * safe and a failed capture must not block the edit).
 */
async function ensureCheckpoint(
  deps: DesignerToolDeps,
  chatId: string,
  turnId: string | undefined,
  paywallId: string,
): Promise<void> {
  if (turnId === undefined || deps.capturedTurns.has(turnId)) {
    return;
  }
  deps.capturedTurns.add(turnId);
  try {
    await deps.captureCheckpoint({ chatId, turnId, paywallId });
  } catch (error) {
    console.warn("[designer-ai] checkpoint capture failed; proceeding", error);
  }
}

/**
 * Normalizes a model-supplied component path to the canonical
 * `components/<name>.tsx` document-relative form used as the definition identity.
 */
function normalizeComponentPath(rawPath: string): string {
  return docRelativeFromFileName(componentFileName(rawPath.trim()));
}

/** A `get_components` entry for a local component, degrading gracefully when un-compiled. */
function manifestSummary(
  path: string,
  manifest: ComponentManifest | undefined,
):
  | {
      kind: "local";
      path: string;
      title?: string;
      description?: string;
      props: ComponentManifest["props"];
      actions: ComponentManifest["actions"];
      previewStates?: readonly string[];
      slot: boolean;
    }
  | { kind: "local"; path: string; note: string } {
  if (manifest === undefined) {
    return {
      kind: "local",
      path,
      note: "manifest unavailable (component not compiled yet — open it in code mode or write it to compile).",
    };
  }
  return {
    kind: "local",
    path,
    title: manifest.title,
    description: manifest.description,
    props: manifest.props,
    actions: manifest.actions,
    previewStates: manifest.previewStates,
    slot: manifest.slot ?? false,
  };
}

/** Renders compile diagnostics into a readable block for the model. */
export function renderCompileDiagnostics(
  diagnostics: readonly { message: string; line?: number; column?: number; phase: string }[],
): string {
  return diagnostics
    .map((diagnostic) => {
      const at =
        diagnostic.line !== undefined
          ? ` (line ${diagnostic.line}${diagnostic.column !== undefined ? `:${diagnostic.column}` : ""})`
          : "";
      return `  - [${diagnostic.phase}] ${diagnostic.message}${at}`;
    })
    .join("\n");
}

/**
 * Unwraps an effect-query RPC failure to a readable message. effect-query wraps
 * the RPC error (a tagged failure under a `Rpc/`-tagged cause / a `.failure`
 * field); we surface the innermost human message when present, else the raw one.
 */
function unwrapRpcError(error: unknown): string {
  if (error !== null && typeof error === "object") {
    const failure = (error as { failure?: unknown }).failure;
    if (failure !== null && typeof failure === "object" && "message" in failure) {
      return String((failure as { message: unknown }).message);
    }
    if ("message" in error) {
      return String((error as { message: unknown }).message);
    }
  }
  return String(error);
}

/**
 * The designer client-tool executor hook. Returns an `executeTool` function
 * matching {@link @/features/studio/ai#SurfaceAgent.executeTool}: it validates
 * each call's input against the shared {@link designerToolSchemas} and delegates
 * to {@link runDesignerTool} against the open paywall's mimic document + local
 * components. A schema failure or an unknown tool is folded into a readable error
 * result; the executor NEVER throws into the AI SDK.
 */
export function useDesignerToolExecutor(): (call: SurfaceToolCall) => Promise<SurfaceToolResult> {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const { handle } = useCodeEditor();
  const target = usePaywallCodeTarget();
  const { id: paywallId = null } = useParams({ strict: false });

  // One compile pipeline per executor mount (owns an esbuild worker + sandbox);
  // destroyed on unmount.
  const pipeline = useMemo(() => new CompilePipeline(), []);
  useEffect(() => () => pipeline.destroy(), [pipeline]);

  // Turn ids that already captured a checkpoint this mount (survives the
  // per-call re-invocation of the pure runner).
  const capturedTurns = useRef<Set<string>>(new Set());
  const reviewState = useRef<DesignerToolDeps["reviewState"]>({});

  return useCallback(
    async (call: SurfaceToolCall): Promise<SurfaceToolResult> => {
      const schema = designerToolSchemas[call.toolName as DesignerToolName] as
        | z.ZodTypeAny
        | undefined;
      if (schema === undefined) {
        return { output: `Unknown tool "${call.toolName}".`, isError: true };
      }
      const parsed = schema.safeParse(call.input);
      if (!parsed.success) {
        const message = parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ");
        return { output: `Invalid input for ${call.toolName}: ${message}`, isError: true };
      }

      const activity = describeDesignerToolActivity(
        call.toolName as DesignerToolName,
        parsed.data,
        selectDocumentRoot(store.getState()),
      );
      const startedAt = Date.now();
      dispatch(startAiCanvasOperation)({ id: call.toolCallId, startedAt, ...activity });

      const deps: DesignerToolDeps = {
        store,
        dispatch,
        target,
        paywallId,
        handle,
        capturedTurns: capturedTurns.current,
        reviewState: reviewState.current,
        captureNodeScreenshot: captureDesignerNodeScreenshot,
        inspectRenderedLayouts: inspectRenderedNodeLayouts,
        compile: (source) => pipeline.compile(source),
        readPaywallDocument: (projectId, slug) =>
          managedRuntime.runPromise(
            VoidhashRpc.request((rpc) => rpc.ReadPaywallDocument({ projectId, slug })),
          ),
        captureCheckpoint: (checkpoint) =>
          managedRuntime.runPromise(
            VoidhashRpc.request((rpc) => rpc.CaptureAiCheckpoint(checkpoint)),
          ),
      };
      try {
        return await runDesignerTool(deps, { ...call, input: parsed.data });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { output: `${call.toolName} failed: ${message}`, isError: true };
      } finally {
        const remaining = 500 - (Date.now() - startedAt);
        if (remaining > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
        }
        dispatch(finishAiCanvasOperation)({ id: call.toolCallId });
      }
    },
    [dispatch, handle, paywallId, pipeline, store, target],
  );
}
