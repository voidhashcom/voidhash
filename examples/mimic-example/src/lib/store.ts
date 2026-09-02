import { createContext, useContext } from "react";
import { Effect } from "effect";
import { create, type StoreApi, type UseBoundStore, useStore } from "zustand";
import { mimic } from "@voidhash/mimic/zustand";
import { createDocument } from "./document";
import { commander, type KanbanStoreState } from "./commands";

export type TodoStore = UseBoundStore<StoreApi<KanbanStoreState>>;

const initialLocalState = (): { selectedCardId: string | null } => ({
  selectedCardId: null,
});

const makeTodoStore = Effect.gen(function* () {
  const doc = yield* createDocument({ name: "John Doe" });
  return create(commander.middleware(mimic(doc, initialLocalState)));
});

/**
 * Connects to the example document and builds the zustand store backing the board.
 */
export const createTodoStore = (): Promise<TodoStore> => Effect.runPromise(makeTodoStore);

export const TodoStoreContext = createContext<TodoStore | null>(null);

export function useTodoStore(): KanbanStoreState;
export function useTodoStore<T>(selector: (s: KanbanStoreState) => T): T;
export function useTodoStore<T>(selector?: (s: KanbanStoreState) => T) {
  const store = useContext(TodoStoreContext);
  if (!store) {
    return Effect.runSync(
      Effect.die(new Error("useTodoStore must be used within TodoStoreProvider")),
    );
  }
  return useStore(store, selector!);
}
