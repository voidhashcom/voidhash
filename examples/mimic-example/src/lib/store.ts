import { createContext, useContext } from "react";
import { create, type StoreApi, type UseBoundStore, useStore } from "zustand";
import { mimic } from "@voidhash/mimic/zustand";
import { createDocument } from "./document";
import { commander, type KanbanStoreState } from "./commands";

export type TodoStore = UseBoundStore<StoreApi<KanbanStoreState>>;

export async function createTodoStore(): Promise<TodoStore> {
  const doc = await createDocument({ name: "John Doe" });
  return create(
    commander.middleware(
      mimic(doc, () => ({
        selectedCardId: null as string | null,
      })),
    ),
  );
}

export const TodoStoreContext = createContext<TodoStore | null>(null);

export function useTodoStore(): KanbanStoreState;
export function useTodoStore<T>(selector: (s: KanbanStoreState) => T): T;
export function useTodoStore<T>(selector?: (s: KanbanStoreState) => T) {
  const store = useContext(TodoStoreContext);
  if (!store) throw new Error("useTodoStore must be used within TodoStoreProvider");
  return useStore(store, selector!);
}
