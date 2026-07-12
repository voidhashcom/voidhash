import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Card as CardType } from "../../types/kanban";

interface CardProps {
  card: CardType;
  columnId: string;
  onClick: () => void;
}

export function Card({ card, columnId, onClick }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: {
      type: "card",
      card,
      columnId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600
        p-3 cursor-grab active:cursor-grabbing
        hover:shadow-md hover:border-gray-300 dark:hover:border-gray-500
        transition-shadow
        ${isDragging ? "opacity-50 shadow-lg ring-2 ring-blue-500" : ""}
      `}
    >
      <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{card.title}</h4>
      {card.description && (
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 line-clamp-2">
          {card.description}
        </p>
      )}
    </div>
  );
}

// Overlay version for drag preview
export function CardOverlay({ card }: { card: CardType }) {
  return (
    <div
      className="
        bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-blue-500
        p-3 cursor-grabbing rotate-3
        w-64
      "
    >
      <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{card.title}</h4>
      {card.description && (
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 line-clamp-2">
          {card.description}
        </p>
      )}
    </div>
  );
}
