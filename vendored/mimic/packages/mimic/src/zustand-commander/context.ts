import type { StoreApi } from "zustand";
import type { Command, Primitive } from "@voidhash/mimic-core";

import type { ClientDocument } from "../client/types.js";
import type { CommandContext, CommandDispatch, CommanderSlice } from "./types.js";

const MUTATING_METHODS = new Set([
  "set",
  "update",
  "push",
  "insertAt",
  "insertAtPos",
  "remove",
  "move",
  "moveTo",
  "moveToPos",
]);

export const RAW_MUTATION_ERROR = "Commander: raw mutations are disabled while a draft is active.";

type MutationTarget<TPrimitive extends Primitive.AnyPrimitive> = {
  readonly root: Primitive.InferProxy<TPrimitive>;
  transaction<R>(fn: (root: Primitive.InferProxy<TPrimitive>) => R): R;
};

const getDocumentTarget = <
  TStore extends CommanderSlice,
  TPrimitive extends Primitive.AnyPrimitive,
>(
  storeApi: StoreApi<TStore>,
): ClientDocument<TPrimitive> => {
  const mimic = (
    storeApi.getState() as TStore & {
      readonly mimic?: { readonly document?: ClientDocument<TPrimitive> };
    }
  ).mimic;
  if (!mimic?.document) {
    throw new Error("Commander: no mimic document found on the store.");
  }
  return mimic.document;
};

const getDefaultTarget = <TStore extends CommanderSlice, TPrimitive extends Primitive.AnyPrimitive>(
  storeApi: StoreApi<TStore>,
): MutationTarget<TPrimitive> =>
  (storeApi.getState()._commander.activeDraft ??
    getDocumentTarget<TStore, TPrimitive>(storeApi)) as MutationTarget<TPrimitive>;

const createMutationGuard = <T>(value: T, errorMessage: string): T => {
  const cache = new WeakMap<object, unknown>();
  const wrap = <TWrapped>(current: TWrapped): TWrapped => {
    if (
      current === null ||
      current === undefined ||
      (typeof current !== "object" && typeof current !== "function")
    ) {
      return current;
    }
    const existing = cache.get(current as object);
    if (existing !== undefined) {
      return existing as TWrapped;
    }
    const wrapped = new Proxy(current as object, {
      get(target, prop, receiver) {
        const next = Reflect.get(target, prop, receiver);
        if (typeof next === "function") {
          return (...args: unknown[]) => {
            if (MUTATING_METHODS.has(String(prop))) {
              throw new Error(errorMessage);
            }
            return wrap(Reflect.apply(next, target, args));
          };
        }
        return wrap(next);
      },
    });
    cache.set(current as object, wrapped);
    return wrapped as TWrapped;
  };
  return wrap(value);
};

export function createCommandContext<
  TStore extends CommanderSlice,
  TPrimitive extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
>(
  storeApi: StoreApi<TStore>,
  dispatch: CommandDispatch<TStore, TPrimitive>,
): CommandContext<TStore, TPrimitive> {
  return {
    getState: () => storeApi.getState(),
    setState: (partial) => storeApi.setState(partial as Partial<TStore>),
    dispatch,
    get root() {
      return getDefaultTarget<TStore, TPrimitive>(storeApi).root;
    },
    transaction: <R>(fn: (root: Primitive.InferProxy<TPrimitive>) => R): R =>
      getDefaultTarget<TStore, TPrimitive>(storeApi).transaction(fn),
    // Always targets the live document (never a draft): a reconcile batch is a
    // committed code push, not a staged draft edit.
    applyCommands: (commands: readonly Command[]): void =>
      getDocumentTarget<TStore, TPrimitive>(storeApi).applyCommands(commands),
    raw: {
      get root() {
        const document = getDocumentTarget<TStore, TPrimitive>(storeApi);
        if (storeApi.getState()._commander.activeDraft !== null) {
          return createMutationGuard(document.root, RAW_MUTATION_ERROR);
        }
        return document.root;
      },
      transaction: <R>(fn: (root: Primitive.InferProxy<TPrimitive>) => R): R => {
        if (storeApi.getState()._commander.activeDraft !== null) {
          throw new Error(RAW_MUTATION_ERROR);
        }
        return getDocumentTarget<TStore, TPrimitive>(storeApi).transaction(fn);
      },
    },
  };
}
