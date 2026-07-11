import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { KanbanProvider } from "../context/KanbanContext";
import { KanbanBoard } from "../components/kanban";
import { createTodoStore, TodoStoreContext, type TodoStore } from "../lib/store";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const [store, setStore] = React.useState<TodoStore | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    createTodoStore()
      .then((s) => setStore(() => s))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)] text-red-600">
        Failed to connect: {error}
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)] text-gray-500">
        Connecting...
      </div>
    );
  }

  return (
    <TodoStoreContext.Provider value={store}>
      <KanbanProvider>
        <div className="h-[calc(100vh-60px)]">
          <KanbanBoard />
        </div>
      </KanbanProvider>
    </TodoStoreContext.Provider>
  );
}
