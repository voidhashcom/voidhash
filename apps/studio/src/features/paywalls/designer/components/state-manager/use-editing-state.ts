import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

interface UseEditingStateOptions {
  existingStateNames: Set<string>;
  onUpdateStateName: (stateId: string, newName: string) => void;
}

interface EditingState {
  id: string;
  name: string;
  originalName: string;
}

/**
 * Hook for managing the "edit state name" flow.
 * Handles input focus, name validation, and keyboard events.
 */
export function useEditingState({
  existingStateNames,
  onUpdateStateName,
}: UseEditingStateOptions) {
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback((stateId: string, currentName: string) => {
    setEditingState({
      id: stateId,
      name: currentName,
      originalName: currentName,
    });
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  }, []);

  const cancel = useCallback(() => {
    setEditingState(null);
  }, []);

  const save = useCallback(() => {
    if (editingState === null) {
      return;
    }

    const trimmedName = editingState.name.trim();

    if (!trimmedName || trimmedName === editingState.originalName) {
      setEditingState(null);
      return;
    }

    if (trimmedName.length > 32) {
      toast.error("State name must be less than 32 characters");
      setEditingState(null);
      return;
    }

    if (
      existingStateNames.has(trimmedName) &&
      trimmedName !== editingState.originalName
    ) {
      toast.error("A state with this name already exists");
      setEditingState(null);
      return;
    }

    onUpdateStateName(editingState.id, trimmedName);
    setEditingState(null);
  }, [editingState, existingStateNames, onUpdateStateName]);

  const updateName = useCallback((name: string) => {
    setEditingState((prev) => (prev ? { ...prev, name } : null));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        cancel();
      } else if (e.key === "Enter") {
        save();
      }
    },
    [cancel, save]
  );

  return {
    cancel,
    editingState,
    handleKeyDown,
    inputRef,
    isEditing: (stateId: string) => editingState?.id === stateId,
    save,
    startEditing,
    updateName,
  };
}
