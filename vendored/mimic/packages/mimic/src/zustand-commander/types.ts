import type { StoreApi } from "zustand";
import type { Command as CoreCommand, Primitive } from "@voidhash/mimic-core";

import type { DraftHandle, ClientDocument } from "../client/types.js";

export const COMMAND_SYMBOL = Symbol.for("zustand-commander/command");
export const UNDOABLE_COMMAND_SYMBOL = Symbol.for("zustand-commander/undoable-command");

export interface CommandContext<
  TStore,
  TPrimitive extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> {
  readonly getState: () => TStore;
  readonly setState: (partial: Partial<TStore>) => void;
  readonly dispatch: CommandDispatch<TStore, TPrimitive>;
  readonly root: Primitive.InferProxy<TPrimitive>;
  readonly transaction: <R>(fn: (root: Primitive.InferProxy<TPrimitive>) => R) => R;
  /**
   * Apply a precomputed CRDT command batch to the live document as one
   * transaction (always targets the document, never the active draft). Used by
   * the composition round-trip, which computes its own minimal batch.
   */
  readonly applyCommands: (commands: readonly CoreCommand[]) => void;
  readonly raw: {
    readonly root: Primitive.InferProxy<TPrimitive>;
    transaction: <R>(fn: (root: Primitive.InferProxy<TPrimitive>) => R) => R;
  };
}

export type CommandFn<
  TStore,
  TParams,
  TReturn,
  TPrimitive extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> = (ctx: CommandContext<TStore, TPrimitive>, params: TParams) => TReturn;

export type RevertFn<
  TStore,
  TParams,
  TReturn,
  TPrimitive extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> = (ctx: CommandContext<TStore, TPrimitive>, params: TParams, result: TReturn) => void;

export interface Command<
  TStore,
  TParams,
  TReturn,
  TPrimitive extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> {
  readonly [COMMAND_SYMBOL]: true;
  readonly fn: CommandFn<TStore, TParams, TReturn, TPrimitive>;
}

export interface UndoableCommand<
  TStore,
  TParams,
  TReturn,
  TPrimitive extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> extends Command<TStore, TParams, TReturn, TPrimitive> {
  readonly [UNDOABLE_COMMAND_SYMBOL]: true;
  readonly revert: RevertFn<TStore, TParams, TReturn, TPrimitive>;
}

export type AnyUndoableCommand = UndoableCommand<any, any, any, any>;

export type CommandDispatch<
  TStore,
  TPrimitive extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> = <TParams, TReturn>(
  command: Command<TStore, TParams, TReturn, TPrimitive>,
) => (params: TParams) => TReturn;

export interface UndoEntry<TParams = unknown, TReturn = unknown> {
  readonly command: AnyUndoableCommand;
  readonly params: TParams;
  readonly result: TReturn;
  readonly timestamp: number;
}

export interface CommanderSlice {
  readonly _commander: {
    readonly undoStack: ReadonlyArray<UndoEntry>;
    readonly redoStack: ReadonlyArray<UndoEntry>;
    readonly activeDraft: DraftHandle<any> | null;
  };
}

export interface CommanderOptions {
  readonly maxUndoStackSize?: number;
}

export interface Commander<
  TStore,
  TPrimitive extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> {
  readonly action: {
    <TParams, TReturn = void>(
      fn: CommandFn<TStore, TParams, TReturn, TPrimitive>,
    ): Command<TStore, TParams, TReturn, TPrimitive>;
    <TReturn = void>(
      fn: CommandFn<TStore, void, TReturn, TPrimitive>,
    ): Command<TStore, void, TReturn, TPrimitive>;
  };
  readonly undoableAction: {
    <TParams, TReturn>(
      fn: CommandFn<TStore, TParams, TReturn, TPrimitive>,
      revert: RevertFn<TStore, TParams, TReturn, TPrimitive>,
    ): UndoableCommand<TStore, TParams, TReturn, TPrimitive>;
    <TReturn>(
      fn: CommandFn<TStore, void, TReturn, TPrimitive>,
      revert: RevertFn<TStore, void, TReturn, TPrimitive>,
    ): UndoableCommand<TStore, void, TReturn, TPrimitive>;
  };
  readonly middleware: <T extends object>(
    config: (
      set: StoreApi<T & CommanderSlice>["setState"],
      get: StoreApi<T & CommanderSlice>["getState"],
      api: StoreApi<T & CommanderSlice>,
    ) => T,
  ) => (
    set: StoreApi<T & CommanderSlice>["setState"],
    get: StoreApi<T & CommanderSlice>["getState"],
    api: StoreApi<T & CommanderSlice>,
  ) => T & CommanderSlice;
}

export const isUndoableCommand = (
  command: Command<any, any, any, any>,
): command is UndoableCommand<any, any, any, any> =>
  (command as { readonly [UNDOABLE_COMMAND_SYMBOL]?: true })[UNDOABLE_COMMAND_SYMBOL] === true;

export type ExtractState<TStore> = TStore extends StoreApi<infer TState> ? TState : never;

export type CommandStore<
  TStore extends CommanderSlice,
  TPrimitive extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> = StoreApi<TStore> & {
  getState(): TStore & {
    readonly mimic: {
      readonly document: ClientDocument<TPrimitive, any>;
    };
  };
};
