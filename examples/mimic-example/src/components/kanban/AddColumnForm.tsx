import * as React from "react";
import { useState } from "react";
import { useKanban } from "../../context/KanbanContext";

export function AddColumnForm() {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const { addColumn } = useKanban();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      addColumn(title.trim());
      setTitle("");
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setTitle("");
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="
          flex-shrink-0 w-72
          bg-gray-100/50 dark:bg-gray-800/50
          hover:bg-gray-200/70 dark:hover:bg-gray-700/70
          rounded-xl p-3
          text-gray-500 dark:text-gray-400
          hover:text-gray-700 dark:hover:text-gray-300
          transition-colors text-sm font-medium
          flex items-center gap-2
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add another list
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-72 bg-gray-100 dark:bg-gray-800 rounded-xl p-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter list title..."
          autoFocus
          className="
            w-full px-3 py-2 rounded-lg
            bg-white dark:bg-gray-700
            border border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500
            text-sm
          "
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              handleCancel();
            }
          }}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!title.trim()}
            className="
              px-3 py-1.5 rounded-lg text-sm font-medium
              bg-blue-600 text-white
              hover:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
          >
            Add list
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="
              px-3 py-1.5 rounded-lg text-sm
              text-gray-600 dark:text-gray-400
              hover:bg-gray-200 dark:hover:bg-gray-700
              transition-colors
            "
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
