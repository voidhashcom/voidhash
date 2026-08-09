import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useKanban } from "../../context/KanbanContext";
import type { Card } from "../../types/kanban";

interface EditCardModalProps {
  card: Card;
  columnId: string;
  onClose: () => void;
}

export function EditCardModal({ card, columnId, onClose }: EditCardModalProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || "");
  const { updateCard, deleteCard } = useKanban();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (e.target instanceof Node && modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleSave = () => {
    if (title.trim()) {
      updateCard(card.id, title.trim(), description.trim() || undefined);
      onClose();
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this card?")) {
      deleteCard(card.id, columnId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="
          bg-white dark:bg-gray-800 rounded-xl shadow-2xl
          w-full max-w-lg mx-4
          max-h-[90vh] overflow-y-auto
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Card</h2>
          <button
            onClick={onClose}
            className="
              text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
              p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
              transition-colors
            "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
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

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <label
              htmlFor="card-title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Title
            </label>
            <input
              id="card-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="
                w-full px-3 py-2 rounded-lg
                bg-gray-50 dark:bg-gray-700
                border border-gray-300 dark:border-gray-600
                text-gray-900 dark:text-gray-100
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              "
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="card-description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description
            </label>
            <textarea
              id="card-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Add a more detailed description..."
              className="
                w-full px-3 py-2 rounded-lg
                bg-gray-50 dark:bg-gray-700
                border border-gray-300 dark:border-gray-600
                text-gray-900 dark:text-gray-100
                placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                resize-none
              "
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleDelete}
            className="
              px-4 py-2 rounded-lg text-sm font-medium
              text-red-600 dark:text-red-400
              hover:bg-red-50 dark:hover:bg-red-900/20
              transition-colors
            "
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="
                px-4 py-2 rounded-lg text-sm font-medium
                text-gray-600 dark:text-gray-400
                hover:bg-gray-100 dark:hover:bg-gray-700
                transition-colors
              "
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="
                px-4 py-2 rounded-lg text-sm font-medium
                bg-blue-600 text-white
                hover:bg-blue-700
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
