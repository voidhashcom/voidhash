import * as React from "react";
import { useContext, useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Column, ColumnOverlay } from "./Column";
import { CardOverlay } from "./Card";
import { AddColumnForm } from "./AddColumnForm";
import { EditCardModal } from "./EditCardModal";
import { useKanban } from "../../context/KanbanContext";
import type { Card as CardType } from "../../types/kanban";
import { useTodoStore, TodoStoreContext } from "../../lib/store";
import { useUndoRedo, useUndoRedoKeyboard } from "@voidhash/mimic/zustand-commander";
import type { CardSnapshot, ColumnSnapshot } from "../../shared";

const toCard = (card: CardSnapshot): CardType => ({
  id: card.id,
  title: card.data?.title ?? "",
  description: card.data?.description ?? "",
});

const dragType = (value: unknown): "card" | "column" | undefined => {
  if (value === "card") return "card";
  if (value === "column") return "column";
  return undefined;
};

const connectionClass = (isConnected: boolean): string => {
  if (isConnected) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
};

const connectionLabel = (isConnected: boolean): string => {
  if (isConnected) return "Connected";
  return "Disconnected";
};

const readyClass = (isReady: boolean): string => {
  if (isReady) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
};

const readyLabel = (isReady: boolean): string => {
  if (isReady) return "Ready";
  return "Loading...";
};

export function KanbanBoard() {
  const { state, moveCard, reorderColumns } = useKanban();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"card" | "column" | null>(null);
  const [editingCard, setEditingCard] = useState<{ card: CardType; columnId: string } | null>(null);
  const { mimic } = useTodoStore();
  const storeApi = useContext(TodoStoreContext)!;

  // Undo/Redo functionality
  const { canUndo, canRedo, undo, redo, undoCount, redoCount } = useUndoRedo(storeApi);

  // Enable keyboard shortcuts (Ctrl/Cmd+Z for undo, Ctrl/Cmd+Shift+Z for redo)
  useUndoRedoKeyboard(storeApi);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const allCards = useMemo(() => {
    return state?.children.flatMap((child: ColumnSnapshot) => child.children) ?? [];
  }, [state?.children]);

  const activeCard = useMemo(() => {
    if (activeType === "card" && activeId) {
      const card = allCards.find((candidate: CardSnapshot) => candidate.id === activeId);
      if (!card) return null;
      return toCard(card);
    }
    return null;
  }, [activeType, activeId, allCards]);

  const allColumns = useMemo(() => {
    return state?.children ?? [];
  }, [state?.children]);

  const activeColumn = useMemo(() => {
    if (activeType === "column" && activeId) {
      return allColumns?.find((column: ColumnSnapshot) => column.id === activeId);
    }
    return null;
  }, [activeType, activeId, allColumns]);

  const activeColumnCards = useMemo(() => {
    if (activeColumn) {
      return activeColumn.children ?? [];
    }
    return [];
  }, [activeColumn]);

  function findColumnByCardId(cardId: string): string | null {
    for (const column of allColumns) {
      if (column.children.some((child: CardSnapshot) => child.id === cardId)) {
        return column.id;
      }
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const type = dragType(active.data.current?.type);

    if (type === "card") {
      setActiveId(String(active.id));
      setActiveType("card");
    } else if (type === "column") {
      setActiveId(String(active.id));
      setActiveType("column");
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    // Only handle card movements during drag over
    if (activeType !== "card") return;

    const activeCardId = String(active.id);
    const sourceColumnId = findColumnByCardId(activeCardId);
    if (!sourceColumnId) return;

    let destinationColumnId: string | null = null;

    if (overType === "card") {
      // Dragging over another card
      destinationColumnId = findColumnByCardId(String(over.id));
    } else if (overType === "column" || over.id.toString().startsWith("column-droppable-")) {
      // Dragging over a column or its drop zone
      destinationColumnId =
        over.data.current?.columnId || over.id.toString().replace("column-droppable-", "");
    }

    if (!destinationColumnId || sourceColumnId === destinationColumnId) return;

    // Move card to new column
    const sourceColumn = allColumns?.find((column: ColumnSnapshot) => column.id === sourceColumnId);
    const destinationColumn = allColumns?.find(
      (column: ColumnSnapshot) => column.id === destinationColumnId,
    );
    if (!sourceColumn || !destinationColumn) return;

    const sourceIndex =
      sourceColumn?.children.findIndex((child: CardSnapshot) => child.id === activeCardId) ?? -1;
    let destinationIndex = destinationColumn?.children.length ?? 0;

    if (overType === "card") {
      destinationIndex =
        destinationColumn?.children.findIndex(
          (child: CardSnapshot) => child.id === String(over.id),
        ) ?? -1;
    }

    moveCard(activeCardId, sourceColumnId, destinationColumnId, sourceIndex, destinationIndex);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveId(null);
    setActiveType(null);

    if (!over) return;

    const activeType = active.data.current?.type;

    if (activeType === "column") {
      // Reorder columns
      if (active.id !== over.id) {
        const sourceIndex =
          allColumns?.findIndex((column: ColumnSnapshot) => column.id === String(active.id)) ??
          -1;
        const destinationIndex =
          allColumns?.findIndex((column: ColumnSnapshot) => column.id === String(over.id)) ??
          -1;

        if (sourceIndex !== -1 && destinationIndex !== -1) {
          reorderColumns(String(active.id), destinationIndex);
        }
      }
    } else if (activeType === "card") {
      // Handle card reordering within the same column
      const activeCardId = String(active.id);
      const sourceColumnId = findColumnByCardId(activeCardId);
      if (!sourceColumnId) return;

      const overType = over.data.current?.type;

      if (overType === "card") {
        const overCardId = String(over.id);
        const destinationColumnId = findColumnByCardId(overCardId);

        if (destinationColumnId && sourceColumnId === destinationColumnId) {
          const column = allColumns?.find((column: ColumnSnapshot) => column.id === sourceColumnId);
          if (!column) return;

          const sourceIndex =
            column?.children.findIndex((child: CardSnapshot) => child.id === activeCardId) ?? -1;
          const destinationIndex =
            column?.children.findIndex((child: CardSnapshot) => child.id === overCardId) ?? -1;

          if (sourceIndex !== destinationIndex) {
            moveCard(
              activeCardId,
              sourceColumnId,
              destinationColumnId,
              sourceIndex,
              destinationIndex,
            );
          }
        }
      }
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-row items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kanban Board</h1>
        <div className="flex flex-row items-center gap-4">
          {/* Undo/Redo buttons */}
          <div className="flex flex-row items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={`Undo (${undoCount})`}
            >
              ↶ Undo
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={`Redo (${redoCount})`}
            >
              Redo ↷
            </button>
          </div>

          {/* Connection status */}
          <div className="flex flex-row items-center gap-2">
            <div
              className={`px-2 py-1 text-xs rounded ${connectionClass(mimic.isConnected)}`}
            >
              {connectionLabel(mimic.isConnected)}
            </div>
            <div className={`px-2 py-1 text-xs rounded ${readyClass(mimic.isReady)}`}>
              {readyLabel(mimic.isReady)}
            </div>
          </div>

          {/* Presence indicators */}
          <div className="flex flex-row items-center -space-x-2">
            {Array.from(mimic.presence?.all.entries() ?? []).map(
              ([id, entry]: [string, { data: { name?: string } }]) => (
                <div
                  key={id}
                  className="w-8 h-8 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white text-sm font-medium border-2 border-white dark:border-gray-900"
                  title={entry.data.name ?? `User ${id}`}
                >
                  {entry.data.name?.slice(0, 1).toUpperCase() ?? "?"}
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 h-full items-start">
            <SortableContext
              items={allColumns.map((column: ColumnSnapshot) => column.id)}
              strategy={horizontalListSortingStrategy}
            >
              {allColumns.map((column: ColumnSnapshot) => {
                const cards = column.children;

                return (
                  <Column
                    key={column.id}
                    column={column}
                    cards={cards}
                    onCardClick={(card) => setEditingCard({ card, columnId: column.id })}
                  />
                );
              })}
            </SortableContext>

            <AddColumnForm />
          </div>
        </div>

        <DragOverlay>
          {activeCard && <CardOverlay card={activeCard} />}
          {activeColumn && <ColumnOverlay column={activeColumn} cards={activeColumnCards} />}
        </DragOverlay>
      </DndContext>

      {editingCard && (
        <EditCardModal
          card={editingCard.card}
          columnId={editingCard.columnId}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}
