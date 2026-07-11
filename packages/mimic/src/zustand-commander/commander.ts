import type { StoreApi } from "zustand";
import type { Primitive } from "@voidhash/mimic-core";

import type { DraftHandle } from "../client/types.js";
import { createCommandContext } from "./context.js";
import {
  COMMAND_SYMBOL,
  UNDOABLE_COMMAND_SYMBOL,
  isUndoableCommand,
  type Command,
  type Commander,
  type CommanderOptions,
  type CommanderSlice,
  type CommandDispatch,
  type CommandFn,
  type RevertFn,
  type UndoEntry,
  type UndoableCommand,
} from "./types.js";

const DEFAULT_OPTIONS: Required<CommanderOptions> = {
  maxUndoStackSize: 100,
};

export function createCommander<
  TStore extends object,
  TPrimitive extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
>(options: CommanderOptions = {}): Commander<TStore & CommanderSlice, TPrimitive> {
  const { maxUndoStackSize } = { ...DEFAULT_OPTIONS, ...options };
  let storeApi: StoreApi<TStore & CommanderSlice> | null = null;

  const createDispatch =
    (): CommandDispatch<TStore & CommanderSlice, TPrimitive> =>
    <TParams, TReturn>(command: Command<TStore & CommanderSlice, TParams, TReturn, TPrimitive>) =>
    (params: TParams): TReturn => {
      if (!storeApi) {
        throw new Error("Commander: store not initialized. Apply commander middleware first.");
      }
      const ctx = createCommandContext<TStore & CommanderSlice, TPrimitive>(
        storeApi,
        createDispatch(),
      );
      const result = command.fn(ctx, params);
      const hasDraft = storeApi.getState()._commander.activeDraft !== null;
      if (isUndoableCommand(command) && !hasDraft) {
        const entry: UndoEntry<TParams, TReturn> = {
          command,
          params,
          result,
          timestamp: Date.now(),
        };
        storeApi.setState((state: TStore & CommanderSlice) => ({
          ...state,
          _commander: {
            ...state._commander,
            undoStack: [...state._commander.undoStack, entry].slice(-maxUndoStackSize),
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
        storeApi.setState((state: TStore & CommanderSlice) => ({
          ...state,
          _commander: { ...state._commander },
        }));
      }
      return result;
    };

  function action<TParams, TReturn = void>(
    fn: CommandFn<TStore & CommanderSlice, TParams, TReturn, TPrimitive>,
  ): Command<TStore & CommanderSlice, TParams, TReturn, TPrimitive> {
    return {
      [COMMAND_SYMBOL]: true,
      fn,
    };
  }

  function undoableAction<TParams, TReturn>(
    fn: CommandFn<TStore & CommanderSlice, TParams, TReturn, TPrimitive>,
    revert: RevertFn<TStore & CommanderSlice, TParams, TReturn, TPrimitive>,
  ): UndoableCommand<TStore & CommanderSlice, TParams, TReturn, TPrimitive> {
    return {
      [COMMAND_SYMBOL]: true,
      [UNDOABLE_COMMAND_SYMBOL]: true,
      fn,
      revert,
    };
  }

  const middleware = <T extends object>(
    config: (
      set: StoreApi<T & CommanderSlice>["setState"],
      get: StoreApi<T & CommanderSlice>["getState"],
      api: StoreApi<T & CommanderSlice>,
    ) => T,
  ) => {
    return (
      set: StoreApi<T & CommanderSlice>["setState"],
      get: StoreApi<T & CommanderSlice>["getState"],
      api: StoreApi<T & CommanderSlice>,
    ): T & CommanderSlice => {
      storeApi = api as unknown as StoreApi<TStore & CommanderSlice>;
      const userState = config(set, get, api);
      return {
        ...userState,
        _commander: {
          undoStack: [],
          redoStack: [],
          activeDraft: null,
        },
      };
    };
  };

  return {
    action: action as Commander<TStore & CommanderSlice, TPrimitive>["action"],
    undoableAction: undoableAction as Commander<
      TStore & CommanderSlice,
      TPrimitive
    >["undoableAction"],
    middleware: middleware as Commander<TStore & CommanderSlice, TPrimitive>["middleware"],
  };
}

export function setActiveDraft<TStore extends CommanderSlice>(
  storeApi: StoreApi<TStore>,
  draft: DraftHandle<any>,
): void {
  storeApi.setState((state: TStore) => ({
    ...state,
    _commander: {
      ...state._commander,
      activeDraft: draft,
    },
  }));
}

export function clearActiveDraft<TStore extends CommanderSlice>(storeApi: StoreApi<TStore>): void {
  storeApi.setState((state: TStore) => ({
    ...state,
    _commander: {
      ...state._commander,
      activeDraft: null,
    },
  }));
}

export function performUndo<TStore extends CommanderSlice>(storeApi: StoreApi<TStore>): boolean {
  const state = storeApi.getState();
  if (state._commander.activeDraft !== null) {
    return false;
  }
  const entry = state._commander.undoStack[state._commander.undoStack.length - 1];
  if (!entry) {
    return false;
  }
  const dispatch =
    <TParams, TReturn>(command: Command<TStore, TParams, TReturn, any>) =>
    (params: TParams) =>
      command.fn(createCommandContext(storeApi, dispatch as CommandDispatch<TStore, any>), params);
  entry.command.revert(
    createCommandContext(storeApi, dispatch as CommandDispatch<TStore, any>),
    entry.params,
    entry.result,
  );
  storeApi.setState((current: TStore) => ({
    ...current,
    _commander: {
      ...current._commander,
      undoStack: current._commander.undoStack.slice(0, -1),
      redoStack: [...current._commander.redoStack, entry],
    },
  }));
  return true;
}

export function performRedo<TStore extends CommanderSlice>(storeApi: StoreApi<TStore>): boolean {
  const state = storeApi.getState();
  if (state._commander.activeDraft !== null) {
    return false;
  }
  const entry = state._commander.redoStack[state._commander.redoStack.length - 1];
  if (!entry) {
    return false;
  }
  const dispatch =
    <TParams, TReturn>(command: Command<TStore, TParams, TReturn, any>) =>
    (params: TParams) =>
      command.fn(createCommandContext(storeApi, dispatch as CommandDispatch<TStore, any>), params);
  // The re-run may produce a fresh inverse payload (e.g. newly generated node
  // ids) — the undo entry must carry it, or the next undo reverts stale state.
  const result = dispatch(entry.command as Command<TStore, any, any, any>)(entry.params);
  storeApi.setState((current: TStore) => ({
    ...current,
    _commander: {
      ...current._commander,
      undoStack: [...current._commander.undoStack, { ...entry, result }],
      redoStack: current._commander.redoStack.slice(0, -1),
    },
  }));
  return true;
}

export function clearUndoHistory<TStore extends CommanderSlice>(storeApi: StoreApi<TStore>): void {
  storeApi.setState((state: TStore) => ({
    ...state,
    _commander: {
      ...state._commander,
      undoStack: [],
      redoStack: [],
    },
  }));
}
