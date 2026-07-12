"use client";

import Editor, { type BeforeMount, loader, type OnMount } from "@monaco-editor/react";
import { sandboxDts } from "@voidhash/paywalls/sandbox-dts";
import { parseWorkspacePath } from "@voidhash/paywall-workspace";
import type { editor } from "monaco-editor";
import * as monaco from "monaco-editor";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

import { saveCodeComponentSource } from "../state/actions/code-component-actions";
import { setCodeComponentDirty } from "../state/actions/code-component-editor-actions";
import { usePaywallDesignerActions } from "../state/designer-store";
import type { CompileDiagnostic } from "../state/designer-store-state";
import { useCodeEditor, type CodeEditorHandle } from "./code-editor-context";
import "./monaco-env";
import { defineVoidhashThemes, voidhashThemeFor } from "./monaco-theme";

// Use the bundled npm monaco (offline, matches our worker wiring) instead of a CDN.
loader.config({ monaco });

let defaultsInstalled = false;
function installTypescriptDefaults(m: typeof monaco): void {
  if (defaultsInstalled) {
    return;
  }
  defaultsInstalled = true;
  const ts = m.languages.typescript;
  ts.typescriptDefaults.setCompilerOptions({
    allowNonTsExtensions: true,
    // Components import each other by relative, extension-carrying paths
    // (`./other.tsx`); allow that so cross-file imports resolve across the eager
    // `file:///` models.
    allowImportingTsExtensions: true,
    esModuleInterop: true,
    jsx: ts.JsxEmit.ReactJSX,
    jsxImportSource: "@voidhash/paywalls",
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2020,
  });
  ts.typescriptDefaults.setEagerModelSync(true);
  // The generated `.d.ts` uses `declare module`, so an ambient path is fine.
  ts.typescriptDefaults.addExtraLib(sandboxDts, "file:///paywalls-sandbox.d.ts");
}

function applyMarkers(
  m: typeof monaco,
  model: editor.ITextModel,
  diagnostics: readonly CompileDiagnostic[] | undefined,
): void {
  const markers = (diagnostics ?? [])
    .filter((diagnostic) => diagnostic.line !== undefined)
    .map((diagnostic) => ({
      endColumn: (diagnostic.column ?? 0) + 2,
      endLineNumber: diagnostic.line as number,
      message: diagnostic.message,
      severity: m.MarkerSeverity.Error,
      startColumn: (diagnostic.column ?? 0) + 1,
      startLineNumber: diagnostic.line as number,
    }));
  m.editor.setModelMarkers(model, "paywall-compile", markers);
}

/**
 * A single open buffer's inputs. `key` is the workspace path (the tab key),
 * `definitionId` the `codeComponent` node id a save writes to, and `source` the
 * current document source (seeds the model, and reseeds a non-dirty buffer when
 * it changes externally). `diagnostics` drives Monaco markers.
 */
export interface OpenBuffer {
  key: string;
  definitionId: string;
  source: string;
  diagnostics: readonly CompileDiagnostic[] | undefined;
}

export interface CodeEditorPaneProps {
  buffers: readonly OpenBuffer[];
  activeKey: string;
}

/** Per-model bookkeeping for dirty tracking, saving, and disposal. */
interface ModelEntry {
  model: editor.ITextModel;
  /** The `codeComponent` node id this buffer saves to. */
  definitionId: string;
  /** The last saved (or reseeded) source; dirty = current value differs from this. */
  baseline: string;
  disposeContentListener: monaco.IDisposable;
  /**
   * True while a PROGRAMMATIC `setValue` (reseed from the document) is in flight —
   * the content listener skips dirty recomputation so the reseeded value reads as
   * clean, not as a fresh edit.
   */
  suppressDirty: boolean;
}

/**
 * Maps a workspace path (the tab key) to its Monaco model URI. A component
 * becomes `file:///components/<basename>.tsx`, mirroring the relative import
 * graph (`./other.tsx`), so cross-file imports resolve across the eager model
 * set with no extra-lib juggling.
 */
function modelUri(m: typeof monaco, key: string): monaco.Uri {
  const parsed = parseWorkspacePath(key);
  if (parsed.ok && parsed.path.kind === "component") {
    return m.Uri.parse(`file:///components/${parsed.path.fileName}`);
  }
  // Defensive: an unrecognized key still gets a stable, unique URI.
  return m.Uri.parse(`file:///${encodeURIComponent(key)}.tsx`);
}

/**
 * A single persistent Monaco editor that manages one model per open buffer.
 *
 * The editor is mounted once and never torn down while code mode is open;
 * models are created, switched, and disposed manually. Each buffer keeps its own
 * undo history and view state. Text edits stay in Monaco; a MANUAL save commits a
 * buffer's text to its `codeComponent` node (an undoable document transaction),
 * which the compile pipeline then picks up (it watches the definition nodes).
 * Dirty state (buffer text vs the saved baseline) is mirrored into the store so
 * the tab bar + file tree can render unsaved dots.
 */
export function CodeEditorPane({ buffers, activeKey }: CodeEditorPaneProps) {
  const dispatch = usePaywallDesignerActions();
  const { registerHandle } = useCodeEditor();
  const { resolvedTheme } = useTheme();
  const themeName = voidhashThemeFor(resolvedTheme);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const mountedRef = useRef(false);

  const modelsRef = useRef<Map<string, ModelEntry>>(new Map());
  const viewStatesRef = useRef<Map<string, editor.ICodeEditorViewState | null>>(new Map());
  const activeKeyRef = useRef(activeKey);
  const currentModelKeyRef = useRef<string | null>(null);

  // Keep the latest buffers on a ref so the imperative handle closures always
  // read current diagnostics/definition ids without being rebuilt.
  const buffersRef = useRef(buffers);
  buffersRef.current = buffers;

  // Recompute a buffer's dirty flag (current text vs saved baseline) and mirror
  // it into the store. Skipped during a programmatic reseed.
  const recomputeDirty = (key: string, entry: ModelEntry): void => {
    if (entry.suppressDirty) {
      return;
    }
    dispatch(setCodeComponentDirty)({ path: key, dirty: entry.model.getValue() !== entry.baseline });
  };

  // Ensure a model exists for `key`, wiring the dirty-tracking content listener
  // on first creation. `source` seeds the buffer once; later changes to it flow
  // through `syncModels`' reseed of non-dirty buffers.
  const ensureModel = (m: typeof monaco, buffer: OpenBuffer): ModelEntry => {
    const existing = modelsRef.current.get(buffer.key);
    if (existing) {
      return existing;
    }
    const uri = modelUri(m, buffer.key);
    const model =
      m.editor.getModel(uri) ?? m.editor.createModel(buffer.source, "typescript", uri);
    const entry: ModelEntry = {
      model,
      definitionId: buffer.definitionId,
      baseline: buffer.source,
      suppressDirty: false,
      disposeContentListener: model.onDidChangeContent(() => {
        recomputeDirty(buffer.key, entry);
      }),
    };
    modelsRef.current.set(buffer.key, entry);
    return entry;
  };

  // Save one buffer's text to its `codeComponent` node (an undoable document
  // transaction) and adopt it as the new baseline (clears dirty). No-op when the
  // buffer is absent or unchanged.
  const saveModel = (key: string, entry: ModelEntry): boolean => {
    const source = entry.model.getValue();
    if (source === entry.baseline) {
      return false;
    }
    dispatch(saveCodeComponentSource)({ nodeId: entry.definitionId, source });
    entry.baseline = source;
    dispatch(setCodeComponentDirty)({ path: key, dirty: false });
    return true;
  };

  // Reseed a buffer from the document `source` WITHOUT marking it dirty. Skips a
  // dirty buffer (never clobber the user's unsaved edits) and a buffer already
  // holding `source`.
  const reseedModel = (entry: ModelEntry, source: string): void => {
    if (entry.model.getValue() === source) {
      entry.baseline = source;
      return;
    }
    // A dirty buffer holds unsaved user edits — do not overwrite them.
    if (entry.model.getValue() !== entry.baseline) {
      return;
    }
    entry.baseline = source;
    entry.suppressDirty = true;
    try {
      entry.model.setValue(source);
    } finally {
      entry.suppressDirty = false;
    }
  };

  const handleBeforeMount: BeforeMount = (mountingMonaco) => {
    defineVoidhashThemes(mountingMonaco);
  };

  const handleMount: OnMount = (mountedEditor, mountedMonaco) => {
    editorRef.current = mountedEditor;
    monacoRef.current = mountedMonaco;
    mountedRef.current = true;
    installTypescriptDefaults(mountedMonaco);
    currentModelKeyRef.current = null;
    syncModels(mountedMonaco);
    syncActive(mountedMonaco, mountedEditor);
  };

  // Reconcile the live model set with `buffers`: create missing models (EAGERLY —
  // every open component gets a model so cross-file imports resolve), reseed a
  // non-dirty model whose document source changed, and dispose models for keys no
  // longer open.
  const syncModels = (m: typeof monaco): void => {
    const openKeys = new Set(buffersRef.current.map((buffer) => buffer.key));
    for (const buffer of buffersRef.current) {
      const entry = ensureModel(m, buffer);
      entry.definitionId = buffer.definitionId;
      reseedModel(entry, buffer.source);
    }
    for (const [key, entry] of modelsRef.current) {
      if (!openKeys.has(key)) {
        entry.disposeContentListener.dispose();
        entry.model.dispose();
        modelsRef.current.delete(key);
        viewStatesRef.current.delete(key);
      }
    }
  };

  // Switch the editor to the active buffer's model, preserving per-key view
  // state, then apply that buffer's markers.
  const syncActive = (m: typeof monaco, ed: editor.IStandaloneCodeEditor): void => {
    const nextKey = activeKeyRef.current;
    const entry = modelsRef.current.get(nextKey);
    if (!entry) {
      return;
    }

    if (currentModelKeyRef.current !== nextKey) {
      const outgoing = currentModelKeyRef.current;
      if (outgoing !== null) {
        viewStatesRef.current.set(outgoing, ed.saveViewState());
      }
      ed.setModel(entry.model);
      const saved = viewStatesRef.current.get(nextKey);
      if (saved) {
        ed.restoreViewState(saved);
      }
      currentModelKeyRef.current = nextKey;
    }

    const activeBuffer = buffersRef.current.find((buffer) => buffer.key === nextKey);
    applyMarkers(m, entry.model, activeBuffer?.diagnostics);
  };

  activeKeyRef.current = activeKey;

  // Keep the model set in sync with the open buffers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = monacoRef.current;
    if (m && mountedRef.current) {
      syncModels(m);
    }
  }, [buffers]);

  // Switch models / re-apply markers when the active buffer or its diagnostics
  // change.
  const activeBuffer = buffers.find((buffer) => buffer.key === activeKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = monacoRef.current;
    const ed = editorRef.current;
    if (m && ed && mountedRef.current) {
      syncActive(m, ed);
    }
  }, [activeKey, activeBuffer?.diagnostics]);

  // Register the imperative handle. Rebuilt only when `dispatch` changes
  // (stable) — the closures read live state via refs.
  useEffect(() => {
    const handle: CodeEditorHandle = {
      undo() {
        editorRef.current?.trigger("code-editor", "undo", null);
      },
      redo() {
        editorRef.current?.trigger("code-editor", "redo", null);
      },
      setBufferContent(key, source) {
        const entry = modelsRef.current.get(key);
        if (!entry) {
          return;
        }
        entry.baseline = source;
        if (entry.model.getValue() === source) {
          dispatch(setCodeComponentDirty)({ path: key, dirty: false });
          return;
        }
        entry.suppressDirty = true;
        try {
          entry.model.setValue(source);
        } finally {
          entry.suppressDirty = false;
        }
        dispatch(setCodeComponentDirty)({ path: key, dirty: false });
      },
      saveBuffer(key) {
        const entry = modelsRef.current.get(key);
        return entry ? saveModel(key, entry) : false;
      },
      saveAll() {
        for (const [key, entry] of modelsRef.current) {
          saveModel(key, entry);
        }
      },
      renameModel(from, to) {
        const m = monacoRef.current;
        const ed = editorRef.current;
        if (m === null || from === to) {
          return;
        }
        const entry = modelsRef.current.get(from);
        if (!entry) {
          return;
        }
        // Monaco models are keyed by immutable URI, so a rename recreates the
        // model at the new URI, carrying over the current text + view state (its
        // undo stack cannot move across models — a known Monaco limitation).
        const wasActive = ed !== null && currentModelKeyRef.current === from;
        const text = entry.model.getValue();
        const savedViewState =
          wasActive && ed ? ed.saveViewState() : (viewStatesRef.current.get(from) ?? null);

        entry.disposeContentListener.dispose();
        entry.model.dispose();
        modelsRef.current.delete(from);
        viewStatesRef.current.delete(from);

        const created = ensureModel(m, {
          key: to,
          definitionId: entry.definitionId,
          source: text,
          diagnostics: undefined,
        });
        created.baseline = entry.baseline;
        if (savedViewState !== null) {
          viewStatesRef.current.set(to, savedViewState);
        }
        if (wasActive && ed) {
          currentModelKeyRef.current = null;
          activeKeyRef.current = to;
          syncActive(m, ed);
        }
      },
    };
    registerHandle(handle);
    return () => {
      registerHandle(null);
    };
  }, [dispatch, registerHandle]);

  // Dispose all models when the pane unmounts (code mode closed).
  useEffect(() => {
    return () => {
      for (const entry of modelsRef.current.values()) {
        entry.disposeContentListener.dispose();
        entry.model.dispose();
      }
      modelsRef.current.clear();
      viewStatesRef.current.clear();
      mountedRef.current = false;
    };
  }, []);

  return (
    <Editor
      beforeMount={handleBeforeMount}
      keepCurrentModel
      language="typescript"
      onMount={handleMount}
      options={{
        automaticLayout: true,
        fontSize: 13,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 2,
      }}
      theme={themeName}
    />
  );
}
