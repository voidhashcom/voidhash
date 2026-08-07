"use client";

import { Effect } from "effect";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Imperative surface the code editor exposes to the tab bar and AI panel:
 * text-level undo/redo (owned by Monaco), programmatic reseed, per-buffer save,
 * and rename. Monaco buffers are edited freely; a MANUAL save commits a buffer's
 * text to its `codeComponent` node in the document (one save = one undoable
 * transaction).
 */
export interface CodeEditorHandle {
  undo(): void;
  redo(): void;
  /**
   * Programmatically replace the buffer identified by `key` (a workspace path)
   * with `source`, adopting it as the new baseline so the edit reads as
   * already-saved (clears the dirty flag). Used when the document `source`
   * changes underneath the editor (undo, AI `write_component`, or a WS fanout
   * from another client); a no-op when that buffer is not open or already holds
   * `source`.
   */
  setBufferContent(key: string, source: string): void;
  /**
   * Save one open buffer's current text to its `codeComponent` node (an undoable
   * document transaction) and adopt the saved value as the buffer's new baseline.
   * A no-op when the buffer is not open or is not dirty. Returns `true` when a
   * save was committed.
   */
  saveBuffer(key: string): boolean;
  /**
   * Save every dirty open buffer to its `codeComponent` node. Used by the tab
   * bar's Save action (Cmd/Ctrl+S) and before an AI send so the agent reads the
   * user's latest committed source. Each buffer is its own transaction.
   */
  saveAll(): void;
  /**
   * Re-key an open model from workspace path `from` to `to`, preserving its
   * current text, view state, and undo history by recreating the model at the
   * new URI and reseeding it. A no-op when `from` is not open. Used by the file
   * tree's rename so the buffer follows the file (the model URI is derived from
   * the path).
   */
  renameModel(from: string, to: string): void;
}

interface CodeEditorContextValue {
  handle: CodeEditorHandle | null;
  registerHandle(handle: CodeEditorHandle | null): void;
}

const CodeEditorContext = createContext<CodeEditorContextValue | null>(null);

/**
 * Provides the shared editor handle. The editor registers its imperative handle
 * on mount (and clears it on unmount); the tab bar reads it to drive undo/redo
 * and the save lifecycle. Kept out of the zustand store since it holds a live
 * Monaco reference.
 */
export function CodeEditorProvider({ children }: { children: React.ReactNode }) {
  const [handle, setHandle] = useState<CodeEditorHandle | null>(null);
  const registerHandle = useCallback((next: CodeEditorHandle | null) => {
    setHandle(next);
  }, []);
  const value = useMemo(() => ({ handle, registerHandle }), [handle, registerHandle]);
  return <CodeEditorContext.Provider value={value}>{children}</CodeEditorContext.Provider>;
}

/** Reads the editor handle and its registration callback. Must be used within `CodeEditorProvider`. */
export function useCodeEditor(): CodeEditorContextValue {
  const value = useContext(CodeEditorContext);
  if (!value) {
    return Effect.runSync(Effect.die(new Error("Missing CodeEditorProvider")));
  }
  return value;
}
