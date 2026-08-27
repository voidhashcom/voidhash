import { useCallback, useEffect, useMemo } from "react";
import { useStore, type StoreApi, type UseBoundStore } from "zustand";
import type { Primitive } from "@voidhash/mimic-core";

import { clearUndoHistory, performRedo, performUndo } from "./commander.js";
import { createCommandContext } from "./context.js";
import {
  isUndoableCommand,
  type Command,
  type CommandDispatch,
  type CommanderSlice,
} from "./types.js";

function createDispatchFromApi<
  TStore extends CommanderSlice,
  TPrimitive extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
>(storeApi: StoreApi<TStore>, maxUndoStackSize = 100): CommandDispatch<TStore, TPrimitive> {
  const dispatch: CommandDispatch<TStore, TPrimitive> = <TParams, TReturn>(
    command: Command<TStore, TParams, TReturn, TPrimitive>,
  ) => {
    return (params: TParams): TReturn => {
      const ctx = createCommandContext<TStore, TPrimitive>(storeApi, dispatch);
      const result = command.fn(ctx, params);
      const hasDraft = storeApi.getState()._commander.activeDraft !== null;
      if (isUndoableCommand(command) && !hasDraft) {
        storeApi.setState((state: TStore) => ({
          ...state,
          _commander: {
            ...state._commander,
            undoStack: [
              ...state._commander.undoStack,
              {
                command,
                params,
                result,
                timestamp: Date.now(),
              },
            ].slice(-maxUndoStackSize),
            redoStack: [],
          },
        }));
      } else if (isUndoableCommand(command) && hasDraft) {
        // A command applied to the active draft mutates only the draft's
        // staged value; the committed document (and `mimic.snapshot`) stays
        // untouched, so nothing would re-render an in-progress preview. Fire a
        // store notification — without recording an undo entry, since the
        // whole draft commits as a single step — so draft-aware selectors
        // re-read the draft snapshot and render the live optimistic preview.
        storeApi.setState((state: TStore) => ({
          ...state,
          _commander: { ...state._commander },
        }));
      }
      return result;
    };
  };
  return dispatch;
}

export function useCommander<
  TStore extends CommanderSlice,
  TPrimitive extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
>(store: UseBoundStore<StoreApi<TStore>>): CommandDispatch<TStore, TPrimitive> {
  const storeApi = useMemo(() => store as unknown as StoreApi<TStore>, [store]);
  return useMemo(() => createDispatchFromApi<TStore, TPrimitive>(storeApi), [storeApi]);
}

export interface UndoRedoState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoCount: number;
  readonly redoCount: number;
  readonly undo: () => boolean;
  readonly redo: () => boolean;
  readonly clear: () => void;
}

export function useUndoRedo<TStore extends CommanderSlice>(
  store: UseBoundStore<StoreApi<TStore>>,
): UndoRedoState {
  const storeApi = useMemo(() => store as unknown as StoreApi<TStore>, [store]);
  const commanderState = useStore(store, (state) => state._commander);

  const undo = useCallback(() => performUndo(storeApi), [storeApi]);
  const redo = useCallback(() => performRedo(storeApi), [storeApi]);
  const clear = useCallback(() => clearUndoHistory(storeApi), [storeApi]);

  return {
    canUndo: commanderState.undoStack.length > 0,
    canRedo: commanderState.redoStack.length > 0,
    undoCount: commanderState.undoStack.length,
    redoCount: commanderState.redoStack.length,
    undo,
    redo,
    clear,
  };
}

export interface UseUndoRedoKeyboardOptions {
  readonly enableUndo?: boolean;
  readonly enableRedo?: boolean;
}

export function useUndoRedoKeyboard<TStore extends CommanderSlice>(
  store: UseBoundStore<StoreApi<TStore>>,
  options: UseUndoRedoKeyboardOptions = {},
): void {
  const { enableUndo = true, enableRedo = true } = options;
  const storeApi = useMemo(() => store as unknown as StoreApi<TStore>, [store]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modKey = isMac ? event.metaKey : event.ctrlKey;
      if (!modKey) {
        return;
      }
      if (enableUndo && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        performUndo(storeApi);
        return;
      }
      if (enableRedo && ((event.key === "z" && event.shiftKey) || event.key === "y")) {
        event.preventDefault();
        performRedo(storeApi);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enableRedo, enableUndo, storeApi]);
}
