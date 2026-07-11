import type { PipelineResult } from "../code-mode/compile-pipeline";
import { describe, expect, test } from "vite-plus/test";

import type { SurfaceToolCall } from "@/features/studio/ai";

import type { CodeEditorHandle } from "../code-mode/code-editor-context";
import type { PaywallCodeTarget } from "../hooks/use-paywall-code-target";
import { createDesignerStore, type PaywallDesignerStoreType } from "../state/designer-store";
import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../state/testing/offline-document";
import { insertCodeComponent } from "../state/utils/code-component-writes";
import {
  renderCompileDiagnostics,
  runDesignerTool,
  type DesignerToolDeps,
} from "./tool-executor";

const PAYWALL_ID = "pw-1";
const PAYWALL_SLUG = "checkout";
const target: PaywallCodeTarget = { projectId: "proj-1", paywallSlug: PAYWALL_SLUG };

/** Records every reseed/rename the executor drives on Monaco. */
interface FakeHandle extends CodeEditorHandle {
  reseeds: Array<{ key: string; source: string }>;
  renames: Array<{ from: string; to: string }>;
}

function makeFakeHandle(): FakeHandle {
  const handle: FakeHandle = {
    reseeds: [],
    renames: [],
    undo() {},
    redo() {},
    setBufferContent(key, source) {
      handle.reseeds.push({ key, source });
    },
    saveBuffer() {
      return false;
    },
    saveAll() {},
    renameModel(from, to) {
      handle.renames.push({ from, to });
    },
  };
  return handle;
}

/** A real designer store over an offline document + a production-shaped dispatch. */
async function makeStore(
  doc: OfflineDesignerDocument,
): Promise<{ store: PaywallDesignerStoreType; dispatch: DesignerToolDeps["dispatch"] }> {
  await doc.connect();
  const store = createDesignerStore(doc as unknown as Parameters<typeof createDesignerStore>[0]);
  const storeApi = store as unknown as {
    getState: () => unknown;
    setState: (partial: unknown) => void;
  };
  const dispatch = ((command: { fn: (ctx: unknown, params: unknown) => unknown }) =>
    (params: unknown) => {
      const ctx = {
        getState: storeApi.getState,
        setState: storeApi.setState,
        dispatch,
        transaction: <R>(fn: (root: unknown) => R): R => doc.transaction(fn as never) as R,
        get root() {
          return doc.root;
        },
      };
      return command.fn(ctx, params);
    }) as unknown as DesignerToolDeps["dispatch"];
  return { store, dispatch };
}

/** Inserts a code-component definition into the document (a local component file). */
function insertComponent(doc: OfflineDesignerDocument, path: string, source: string): void {
  doc.transaction((root) => {
    if (insertCodeComponent(root, { path, source }) === null) {
      throw new Error("failed to insert code component");
    }
  });
}

interface CheckpointCall {
  chatId: string;
  turnId: string;
  paywallId: string;
}

/** Deps for the runner: real store + injectable compile/read/checkpoint seams. */
function makeDeps(
  store: PaywallDesignerStoreType,
  dispatch: DesignerToolDeps["dispatch"],
  overrides: Partial<DesignerToolDeps> = {},
): DesignerToolDeps & { handle: FakeHandle; checkpoints: CheckpointCall[] } {
  const handle = (overrides.handle as FakeHandle | undefined) ?? makeFakeHandle();
  const checkpoints: CheckpointCall[] = [];
  return {
    store,
    dispatch,
    target,
    paywallId: PAYWALL_ID,
    capturedTurns: new Set<string>(),
    compile: async (): Promise<PipelineResult> => ({
      ok: true,
      manifest: { manifestVersion: 2, props: {} },
      previewTrees: {},
      hasPanel: false,
    }),
    readPaywallDocument: async () => ({ slug: "", name: "", paywallId: "", document: null }),
    captureCheckpoint: async (input) => {
      checkpoints.push(input);
      return { captured: true };
    },
    ...overrides,
    handle,
    checkpoints,
  } as DesignerToolDeps & { handle: FakeHandle; checkpoints: CheckpointCall[] };
}

/** A minimal snapshot node: `{ id, type, data: { style }, children }`. */
interface SnapshotNode {
  id: string;
  data?: { style?: Record<string, unknown> };
  children?: readonly SnapshotNode[];
}

/** Find a node by id in the engine snapshot roots and return its `data.style`. */
function findNodeStyle(
  snapshot: readonly SnapshotNode[] | undefined,
  id: string,
): Record<string, unknown> | undefined {
  const walk = (node: SnapshotNode): Record<string, unknown> | undefined => {
    if (node.id === id) return node.data?.style;
    for (const child of node.children ?? []) {
      const found = walk(child);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  for (const root of snapshot ?? []) {
    const found = walk(root);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Build a `SurfaceToolCall` (input is assumed already schema-valid). */
const call = (
  toolName: string,
  input: unknown,
  extra: Partial<SurfaceToolCall> = {},
): SurfaceToolCall => ({
  toolName,
  toolCallId: "call-1",
  input,
  chatId: "ai_chat_1",
  ...extra,
});

describe("runDesignerTool — get_document", () => {
  test("serializes the open document as cleaned JSON, scoped by nodeId", async () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch);

    const result = await runDesignerTool(deps, call("get_document", { nodeId: screenId }));
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.output) as { id: string; type: string };
    expect(parsed.id).toBe(screenId);
    expect(parsed.type).toBe("screen");
  });

  test("an unknown nodeId folds into a readable error", async () => {
    const doc = createOfflineDesignerDocument();
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch);

    const result = await runDesignerTool(deps, call("get_document", { nodeId: "ghost" }));
    expect(result.isError).toBe(true);
    expect(result.output).toContain("ghost");
  });
});

describe("runDesignerTool — edit_document", () => {
  test("a valid batch applies and returns minted ids", async () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch);

    const result = await runDesignerTool(
      deps,
      call(
        "edit_document",
        { edits: [{ op: "insert", parentId: screenId, node: { type: "view" } }] },
        { turnId: "turn-1" },
      ),
    );
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.output) as { ok: boolean; mintedIds: Record<string, string[]> };
    expect(parsed.ok).toBe(true);
    expect(parsed.mintedIds["0"]?.length).toBe(1);
  });

  test("a lone backgroundColor update auto-enables the background in the store", async () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch);

    // Insert a fresh view (defaults backgroundEnabled=false), then set only its color.
    const inserted = await runDesignerTool(
      deps,
      call(
        "edit_document",
        { edits: [{ op: "insert", parentId: screenId, node: { type: "view" } }] },
        { turnId: "turn-1" },
      ),
    );
    const viewId = (JSON.parse(inserted.output) as { mintedIds: Record<string, string[]> })
      .mintedIds["0"]![0]!;

    const result = await runDesignerTool(
      deps,
      call(
        "edit_document",
        { edits: [{ op: "update", nodeId: viewId, set: { style: { backgroundColor: "rgba(1, 2, 3, 1)" } } }] },
        { turnId: "turn-2" },
      ),
    );
    expect(result.isError).toBe(false);

    const style = findNodeStyle(
      store.getState().mimic.snapshot as unknown as readonly SnapshotNode[],
      viewId,
    );
    expect(style?.backgroundEnabled).toBe(true);
    expect(style?.backgroundColor).toBe("rgba(1, 2, 3, 1)");
  });

  test("a validation error is returned verbatim (isError) and applies nothing", async () => {
    const doc = createOfflineDesignerDocument();
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch);

    const result = await runDesignerTool(
      deps,
      call(
        "edit_document",
        { edits: [{ op: "insert", parentId: "nope", node: { type: "view" } }] },
        { turnId: "turn-1" },
      ),
    );
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.output) as {
      ok: boolean;
      errors: Array<{ code: string }>;
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.errors[0]?.code).toBe("unknownParent");
  });

  test("captures a pre-turn checkpoint exactly once per turn", async () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch);

    const editCall = () =>
      runDesignerTool(
        deps,
        call(
          "edit_document",
          { edits: [{ op: "insert", parentId: screenId, node: { type: "view" } }] },
          { turnId: "turn-42" },
        ),
      );
    await editCall();
    await editCall();

    expect(deps.checkpoints).toEqual([
      { chatId: "ai_chat_1", turnId: "turn-42", paywallId: PAYWALL_ID },
    ]);
  });

  test("a checkpoint RPC failure is swallowed and the edit still applies", async () => {
    const doc = createOfflineDesignerDocument();
    const { screenId } = seededIds(doc);
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch, {
      captureCheckpoint: async () => {
        throw new Error("offline");
      },
    });

    const result = await runDesignerTool(
      deps,
      call(
        "edit_document",
        { edits: [{ op: "insert", parentId: screenId, node: { type: "view" } }] },
        { turnId: "turn-1" },
      ),
    );
    expect(result.isError).toBe(false);
  });
});

describe("runDesignerTool — components", () => {
  test("write_component compiles then creates a new local component", async () => {
    const doc = createOfflineDesignerDocument();
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch);

    const result = await runDesignerTool(
      deps,
      call(
        "write_component",
        { path: "components/hero.tsx", source: "export default () => null;" },
        { turnId: "turn-1" },
      ),
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("Created");
    // Reseeds the open Monaco buffer for the canonical path.
    expect(deps.handle.reseeds).toEqual([
      { key: "components/hero.tsx", source: "export default () => null;" },
    ]);
    // The definition landed in the document library.
    const nodes = store.getState().mimic.snapshot;
    expect(JSON.stringify(nodes)).toContain("components/hero.tsx");
  });

  test("write_component UPDATES an existing component's source (via the undoable save)", async () => {
    const doc = createOfflineDesignerDocument();
    insertComponent(doc, "components/hero.tsx", "export const Old = 1;");
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch);

    const result = await runDesignerTool(
      deps,
      call(
        "write_component",
        { path: "components/hero.tsx", source: "export const New = 2;" },
        { turnId: "turn-1" },
      ),
    );
    expect(result.isError).toBe(false);
    // Existing path → "Updated", not "Created".
    expect(result.output).toContain("Updated");
    const snapshot = JSON.stringify(store.getState().mimic.snapshot);
    expect(snapshot).toContain("export const New = 2;");
    expect(snapshot).not.toContain("export const Old = 1;");
    // The open Monaco buffer is reseeded with the new source.
    expect(deps.handle.reseeds).toEqual([
      { key: "components/hero.tsx", source: "export const New = 2;" },
    ]);
  });

  test("write_component compile failure commits NOTHING", async () => {
    const doc = createOfflineDesignerDocument();
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch, {
      compile: async (): Promise<PipelineResult> => ({
        ok: false,
        diagnostics: [{ message: "Unexpected token", phase: "compile", line: 1 }],
      }),
    });

    const result = await runDesignerTool(
      deps,
      call(
        "write_component",
        { path: "components/broken.tsx", source: "export default (" },
        { turnId: "turn-1" },
      ),
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("did not compile");
    expect(result.output).toContain("Unexpected token");
    // No definition created, no buffer reseeded.
    expect(JSON.stringify(store.getState().mimic.snapshot)).not.toContain("components/broken.tsx");
    expect(deps.handle.reseeds).toEqual([]);
  });

  test("read_component returns the local source by path", async () => {
    const doc = createOfflineDesignerDocument();
    insertComponent(doc, "components/widget.tsx", "// widget source");
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch);

    const result = await runDesignerTool(deps, call("read_component", { path: "components/widget.tsx" }));
    expect(result).toEqual({ output: "// widget source", isError: false });
  });

  test("rename_component renames the definition and drives a Monaco rename", async () => {
    const doc = createOfflineDesignerDocument();
    insertComponent(doc, "components/widget.tsx", "// widget");
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch);

    const result = await runDesignerTool(
      deps,
      call(
        "rename_component",
        { fromPath: "components/widget.tsx", toPath: "components/hero.tsx" },
        { turnId: "turn-1" },
      ),
    );
    expect(result.isError).toBe(false);
    expect(deps.handle.renames).toEqual([
      { from: "components/widget.tsx", to: "components/hero.tsx" },
    ]);
    expect(JSON.stringify(store.getState().mimic.snapshot)).toContain("components/hero.tsx");
  });

  test("delete_component removes the definition", async () => {
    const doc = createOfflineDesignerDocument();
    insertComponent(doc, "components/widget.tsx", "// widget");
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch);

    const result = await runDesignerTool(
      deps,
      call("delete_component", { path: "components/widget.tsx" }, { turnId: "turn-1" }),
    );
    expect(result.isError).toBe(false);
    expect(JSON.stringify(store.getState().mimic.snapshot)).not.toContain("components/widget.tsx");
  });

  test("get_components lists local components (manifest note when un-compiled)", async () => {
    const doc = createOfflineDesignerDocument();
    insertComponent(doc, "components/widget.tsx", "// widget");
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch);

    const result = await runDesignerTool(deps, call("get_components", {}));
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.output) as {
      catalog: unknown[];
      local: Array<{ path: string; note?: string }>;
    };
    expect(parsed.local[0]?.path).toBe("components/widget.tsx");
    expect(parsed.local[0]?.note).toContain("not compiled");
  });
});

describe("runDesignerTool — read_paywall + guards", () => {
  test("read_paywall returns the other paywall's cleaned document JSON", async () => {
    const doc = createOfflineDesignerDocument();
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch, {
      readPaywallDocument: async (projectId, slug) => {
        expect(projectId).toBe("proj-1");
        expect(slug).toBe("other");
        return { slug: "other", name: "Other", paywallId: "pw-2", document: { id: "root", type: "root" } };
      },
    });

    const result = await runDesignerTool(deps, call("read_paywall", { slug: "other" }));
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.output) as { slug: string; document: { type: string } };
    expect(parsed.slug).toBe("other");
    expect(parsed.document.type).toBe("root");
  });

  test("read_paywall folds an RPC failure into an error string", async () => {
    const doc = createOfflineDesignerDocument();
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch, {
      readPaywallDocument: async () => {
        throw new Error("not found");
      },
    });

    const result = await runDesignerTool(deps, call("read_paywall", { slug: "ghost" }));
    expect(result.isError).toBe(true);
    expect(result.output).toContain("not found");
  });

  test("no open paywall (null target) folds a mutating tool into an error", async () => {
    const doc = createOfflineDesignerDocument();
    const { store, dispatch } = await makeStore(doc);
    const deps = makeDeps(store, dispatch, { target: null });

    const result = await runDesignerTool(deps, call("get_document", {}));
    expect(result).toEqual({ output: "No paywall is open to edit.", isError: true });
  });
});

describe("renderCompileDiagnostics", () => {
  test("renders phase, message, and location", () => {
    const rendered = renderCompileDiagnostics([
      { message: "boom", phase: "compile", line: 3, column: 5 },
    ]);
    expect(rendered).toContain("[compile] boom");
    expect(rendered).toContain("line 3:5");
  });
});
