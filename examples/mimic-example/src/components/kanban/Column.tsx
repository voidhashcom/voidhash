import * as React from "react";
import { useState } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Card } from "./Card";
import { AddCardForm } from "./AddCardForm";
import { useKanban } from "../../context/KanbanContext";
import type { Card as CardType } from "../../types/kanban";
import type { CardSnapshot, ColumnSnapshot } from "../../shared";

const draggingClass = (isDragging: boolean): string => {
  if (isDragging) return "opacity-50";
  return "";
};

interface ColumnProps {
  column: ColumnSnapshot;
  cards: readonly CardSnapshot[];
  onCardClick: (card: CardType) => void;
}

export function Column({ column, cards, onCardClick }: ColumnProps) {
  const [isEditing, setIsEditing] = useState(false);
  const columnName = column.data?.name ?? "";
  const [title, setTitle] = useState(columnName);
  const { renameColumn, deleteColumn } = useKanban();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: {
      type: "column",
      column,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleTitleSubmit = () => {
    if (title.trim()) {
      renameColumn(column.id, title.trim());
    } else {
      setTitle(columnName);
    }
    setIsEditing(false);
  };

  const handleDeleteColumn = () => {
    if (cards.length > 0) {
      if (confirm(`Delete "${columnName}" and its ${cards.length} card(s)?`)) {
        deleteColumn(column.id);
      }
    } else {
      deleteColumn(column.id);
    }
  };

  const renderTitle = () => {
    if (isEditing) {
      return (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleTitleSubmit();
            if (e.key === "Escape") {
              setTitle(columnName);
              setIsEditing(false);
            }
          }}
          autoFocus
          className="
              font-semibold text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700
              px-2 py-1 rounded border border-blue-500 outline-none w-full
            "
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    return (
      <h3
        className="font-semibold text-gray-800 dark:text-gray-200 cursor-text"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
      >
        {columnName}
        <span className="ml-2 text-gray-500 dark:text-gray-400 font-normal text-sm">
          {cards.length}
        </span>
      </h3>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-gray-100 dark:bg-gray-800 rounded-xl w-72 flex-shrink-0
        flex flex-col max-h-full
        ${draggingClass(isDragging)}
      `}
    >
      {/* Column Header */}
      <div
        {...attributes}
        {...listeners}
        className="p-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        {renderTitle()}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteColumn();
          }}
          className="
            text-gray-400 hover:text-red-500 dark:hover:text-red-400
            p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700
            transition-colors
          "
          title="Delete column"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Cards Container */}
      <ColumnDropZone column={column} cards={cards} onCardClick={onCardClick} />

      {/* Add Card Form */}
      <div className="p-2">
        <AddCardForm columnId={column.id} />
      </div>
    </div>
  );
}

// Separate drop zone component to handle dropping cards into columns
function ColumnDropZone({
  column,
  cards,
  onCardClick,
}: {
  column: ColumnSnapshot;
  cards: readonly CardSnapshot[];
  onCardClick: (card: CardType) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-droppable-${column.id}`,
    data: {
      type: "column",
      columnId: column.id,
    },
  });

  return (
    <div ref={setNodeRef} className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[100px]">
      <SortableContext
        items={column.children.map((child: CardSnapshot) => child.id)}
        strategy={verticalListSortingStrategy}
      >
        {cards.map((card) => (
          <Card
            key={card.id}
            card={{
              id: card.id,
              title: card.data?.title ?? "",
              description: card.data?.description ?? "",
            }}
            columnId={column.id}
            onClick={() =>
              onCardClick({
                id: card.id,
                title: card.data?.title ?? "",
                description: card.data?.description ?? "",
              })
            }
          />
        ))}
      </SortableContext>
    </div>
  );
}

// Overlay version for drag preview
export function ColumnOverlay({
  column,
  cards,
}: {
  column: ColumnSnapshot;
  cards: readonly CardSnapshot[];
}) {
  return (
    <div
      className="
        bg-gray-100 dark:bg-gray-800 rounded-xl w-72
        shadow-2xl rotate-3 opacity-90
      "
    >
      <div className="p-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">
          {column.data?.name ?? ""}
          <span className="ml-2 text-gray-500 dark:text-gray-400 font-normal text-sm">
            {cards.length}
          </span>
        </h3>
      </div>
      <div className="px-2 pb-2 space-y-2 max-h-48 overflow-hidden">
        {cards.slice(0, 3).map((card) => (
          <div key={card.id} className="bg-white dark:bg-gray-700 rounded-lg shadow-sm p-2 text-sm">
            {card.data?.title ?? ""}
          </div>
        ))}
        {cards.length > 3 && (
          <div className="text-center text-gray-500 text-sm">+{cards.length - 3} more</div>
        )}
      </div>
    </div>
  );
}
